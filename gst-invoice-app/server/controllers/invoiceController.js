const Invoice = require('../models/Invoice');
const Product = require('../models/Product');
const StockTransaction = require('../models/StockTransaction');

// ── Invoice numbering ──
// Pehla bill isi number se start hoga, uske baad +1 hota rahega.
const START_INVOICE_NO = 302;
// Agar prefix chahiye (jaise 'INV-') toh yahan daal do. Abhi plain number: 302, 303...
const INVOICE_PREFIX = 'INV-';

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

// ── Stock helpers (edit/delete par stock sahi rakhne ke liye) ──
const findProductForItem = async (userId, item) => {
  let product = null;
  if (item.productId) product = await Product.findOne({ _id: item.productId, user: userId });
  if (!product && item.barcode && String(item.barcode).trim()) {
    product = await Product.findOne({ user: userId, barcode: String(item.barcode).trim() });
  }
  if (!product && item.name) {
    const esc = String(item.name).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    product = await Product.findOne({ user: userId, name: { $regex: new RegExp(`^${esc}$`, 'i') } });
  }
  return product;
};

// direction: +1 = stock wapas jodo, -1 = stock kaato
const applyStock = async (userId, items, direction, note, invoiceId) => {
  for (const item of items || []) {
    const qty = Number(item.qty) || 0;
    if (!qty) continue;
    const product = await findProductForItem(userId, item);
    if (!product) continue;
    product.currentStock += direction * qty;
    await product.save();
    await StockTransaction.create({
      user: userId,
      product: product._id,
      type: direction > 0 ? 'ADJUSTMENT' : 'SALE',
      qty: direction * qty,
      note,
      invoiceId,
    });
  }
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

    const { _id, user, ...body } = req.body;
    const invoiceData = { ...body, invoiceNumber, user: req.user._id };

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

    // Stock auto deduct (regex-safe helper se)
    await applyStock(req.user._id, invoice.items, -1, `POS Bill ${invoiceNumber}`, invoice._id);

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
    await applyStock(req.user._id, invoice.items, +1, `Bill ${invoice.invoiceNumber} deleted (stock restored)`, invoice._id);
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
    const old = await Invoice.findOne({ _id: req.params.id, user: req.user._id });
    if (!old) return res.status(404).json({ message: 'Invoice not found' });

    const invoice = await Invoice.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      (({ _id, user, invoiceNumber, ...rest }) => rest)(req.body),
      { new: true, runValidators: true }
    );

    // Items badle hain toh: purane items ka stock wapas, naye items ka stock minus
    if (Array.isArray(req.body.items)) {
      await applyStock(req.user._id, old.items, +1, `Bill ${old.invoiceNumber} edited (old items reversed)`, old._id);
      await applyStock(req.user._id, invoice.items, -1, `Bill ${invoice.invoiceNumber} edited (new items)`, old._id);
    }
    res.json(invoice);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// (purana version, ab use nahi hota)
exports._updateInvoiceOld = async (req, res) => {
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