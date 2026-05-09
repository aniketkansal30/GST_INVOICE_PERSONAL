const Invoice = require('../models/Invoice');

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
    const invoice = await Invoice.create({ ...req.body, user: req.user._id });
    res.status(201).json(invoice);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'Invoice number already exists' });
    }
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

    const { _id, createdAt, updatedAt, invoiceNumber, ...data } = original.toObject();
    const yr = new Date().getFullYear().toString().slice(-2);
    const mo = String(new Date().getMonth() + 1).padStart(2, '0');
    const rand = String(Math.floor(Math.random() * 9000) + 1000);
    const newNumber = `${invoiceNumber.split('-')[0]}-${yr}${mo}-${rand}`;

    const duplicate = await Invoice.create({
      ...data,
      invoiceNumber: newNumber,
      invoiceDate: new Date(),
      status: 'draft',
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
    invoices.forEach(inv => {
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
    invoices.forEach(inv => {
      (inv.items || []).forEach(item => {
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
    invoice.payments = invoice.payments.filter(p => p._id.toString() !== req.params.pid);
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
