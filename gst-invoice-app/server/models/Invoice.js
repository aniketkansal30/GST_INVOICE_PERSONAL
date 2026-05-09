const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  hsn: { type: String, default: '' },
  unit: { type: String, default: 'Nos' },
  qty: { type: Number, required: true, min: 0 },
  rate: { type: Number, required: true, min: 0 },
  gstPct: { type: Number, default: 18 },
  baseAmount: Number,
  gstAmount: Number,
}, { _id: false });

const paymentSchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  date: { type: Date, default: Date.now },
  mode: { type: String, enum: ['cash', 'upi', 'bank', 'cheque', 'other'], default: 'bank' },
  note: { type: String, default: '' },
}, { _id: true, timestamps: true });

const invoiceSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  invoiceNumber: { type: String, required: true },
  invoiceDate: { type: Date, required: true },
  dueDate: { type: Date },
  status: { type: String, enum: ['draft', 'sent', 'paid', 'partial', 'overdue'], default: 'draft' },
  seller: {
    companyName: String, gstNumber: String, address: String,
    state: String, contact: String, email: String,
  },
  buyer: {
    clientName: String, gstNumber: String, address: String,
    state: String, contact: String,
  },
  items: [itemSchema],
  subtotal: { type: Number, default: 0 },
  cgst: { type: Number, default: 0 },
  sgst: { type: Number, default: 0 },
  igst: { type: Number, default: 0 },
  totalGst: { type: Number, default: 0 },
  grandTotal: { type: Number, default: 0 },
  isSameState: { type: Boolean, default: false },
  notes: { type: String, default: '' },
  payments: [paymentSchema],
  amountPaid: { type: Number, default: 0 },
  amountDue: { type: Number, default: 0 },
}, { timestamps: true });

invoiceSchema.index({ user: 1, invoiceNumber: 1 }, { unique: true });
module.exports = mongoose.model('Invoice', invoiceSchema);
