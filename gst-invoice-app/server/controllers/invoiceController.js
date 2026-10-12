const Invoice = require('../models/Invoice');
const Product = require('../models/Product');
const StockTransaction = require('../models/StockTransaction');

// ── Invoice numbering ──
// Pehla bill isi number se start hoga, uske baad +1 hota rahega.
const START_INVOICE_NO = 302;
// Agar prefix chahiye (jaise 'INV-') toh yahan daal do. Abhi plain number: 302, 303...
const INVOICE_PREFIX = '';

// Saare invoices ke number dekhta hai, sabse bada number nikaalta hai, +1 return karta hai.
// Purane 'INV-001' jaise numbers bhi parse ho jaate hain (302 se chhote hain, toh ignore).
const computeNextInvoiceNumber = async (userId) => {
  const invoices = await Invoice.find({ user: userId }, { invoiceNumber: 1 }).lean();
  let max = START_INVOICE_NO - 1;
  invoices.forEach((inv) => {
    const m = String(inv.invoiceNumber || '').match(/(\d+)\s*$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (!isNaN(n) && n > max) max = n;
    }
  });
  return `${INVOICE_PREFIX}${max + 1}`;
};

exports.getInvoices = async (req, res) => {
  try {
    const { search, page = 1, limit = 10, status } = req.query;
    const query = { user: req.user._id };

    if (search) {
      query.$or = [
        { 'buyer.clientName': { $regex: search, $options: 'i' } },
        { invoiceNumber: { $regex: search, $options: 'i' } },
      ];
    }
    if (status) query.status = status;

    const skip = (Number(page) - 1) * Number(limit);
    const [invoices, total] = await Promise.all([
      Invoice.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      Invoice.countDocuments(query),
    ]);

    res.json({
      invoices,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      total,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, user: req.user._id });
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    res.json(invoice);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createInvoice = async (req, res) => {
  try {
    const nextNumber = await computeNextInvoiceNumber(req.user._id);
    const invoiceNumber = req.body.invoiceNumber || nextNumber;

    const invoiceData = { ...req.body, invoiceNumber, user: req.user._id };

    const payments = Array.isArray(invoiceData.payments) ? invoiceData.payments : [];
    invoiceData.amountPaid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    invoiceData.amountDue = Math.max(0, (invoiceData.grandTotal || 0) - invoiceData.amountPaid);

    if (invoiceData.amountDue <= 0 && invoiceData.grandTotal > 0) {
      invoiceData.status = 'paid';
    } else if (invoiceData.amountPaid > 0) {
      invoiceData.status = 'partial';
    } else {
      invoiceData.status = 'sent'; // koi payment nahi mila
    }

    const invoice = await Invoice.create(invoiceData);

    // Stock auto deduct
    for (const item of req.body.items || []) {
      if (item.name || item.barcode || item.productId) {
        let product = null;
        if (item.productId) {
          product = await Product.findOne({ _id: item.productId, user: req.user._id });
        }
        if (!product && item.barcode && item.barcode.trim()) {
          product = await Product.findOne({ user: req.user._id, barcode: item.barcode.trim() });
        }
        if (!product && item.name) {
          product = await Product.findOne({
            user: req.user._id,
            name: { $regex: new RegExp(`^${item.name.trim()}$`, 'i') },
          });
        }

        if (product) {
          const qtyDeducted = Number(item.qty) || 0;
          product.currentStock -= qtyDeducted;
          await product.save();
          await StockTransaction.create({
            user: req.user._id,
            product: product._id,
            type: 'SALE',
            qty: -qtyDeducted,
            note: `POS Bill ${invoiceNumber}`,
            invoiceId: invoice._id,
          });
        }
      }
    }

    res.status(201).json(invoice);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'Invoice number already exists' });
    }
    res.status(500).json({ message: err.message });
  }
};

exports.deleteInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    res.json({ message: 'Invoice deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.duplicateInvoice = async (req, res) => {
  try {
    const original = await Invoice.findOne({ _id: req.params.id, user: req.user._id });
    if (!original) return res.status(404).json({ message: 'Invoice not found' });

    const { _id, createdAt, updatedAt, invoiceNumber, payments, amountPaid, amountDue, ...data } = original.toObject();

    const nextNumber = await computeNextInvoiceNumber(req.user._id);

    const duplicate = await Invoice.create({
      ...data,
      invoiceNumber: nextNumber,
      invoiceDate: new Date(),
      status: 'draft',
      payments: [],
      amountPaid: 0,
      amountDue: data.grandTotal || 0,
      user: req.user._id,
    });
    res.status(201).json(duplicate);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getClients = async (req, res) => {
  try {
    const invoices = await Invoice.find({ user: req.user._id }, { buyer: 1 });
    const clientMap = {};
    invoices.forEach((inv) => {
      const b = inv.buyer;
      if (b && b.clientName) {
        const key = b.clientName.trim().toLowerCase();
        if (!clientMap[key]) clientMap[key] = b;
      }
    });
    res.json(Object.values(clientMap));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getProducts = async (req, res) => {
  try {
    const invoices = await Invoice.find({ user: req.user._id }, { items: 1 });
    const productMap = {};
    invoices.forEach((inv) => {
      (inv.items || []).forEach((item) => {
        if (item.name) {
          const key = item.name.trim().toLowerCase();
          if (!productMap[key]) productMap[key] = {
            name: item.name,
            hsn: item.hsn || '',
            unit: item.unit || 'Nos',
            rate: item.rate || 0,
            gstPct: item.gstPct || 18,
          };
        }
      });
    });
    res.json(Object.values(productMap));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.addPayment = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, user: req.user._id });
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    const { amount, date, mode, note } = req.body;
    invoice.payments.push({ amount: Number(amount), date: date || new Date(), mode, note });
    invoice.amountPaid = invoice.payments.reduce((s, p) => s + p.amount, 0);
    invoice.amountDue = invoice.grandTotal - invoice.amountPaid;
    if (invoice.amountDue <= 0) invoice.status = 'paid';
    else if (invoice.amountPaid > 0) invoice.status = 'partial';
    await invoice.save();
    res.json(invoice);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deletePayment = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, user: req.user._id });
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    invoice.payments = invoice.payments.filter((p) => p._id.toString() !== req.params.pid);
    invoice.amountPaid = invoice.payments.reduce((s, p) => s + p.amount, 0);
    invoice.amountDue = invoice.grandTotal - invoice.amountPaid;
    if (invoice.amountDue <= 0) invoice.status = 'paid';
    else if (invoice.amountPaid > 0) invoice.status = 'partial';
    else invoice.status = 'sent';
    await invoice.save();
    res.json(invoice);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getNextInvoiceNumber = async (req, res) => {
  try {
    const nextNumber = await computeNextInvoiceNumber(req.user._id);
    res.json({ nextNumber });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    res.json(invoice);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};