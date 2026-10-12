const mongoose = require('mongoose');

// Ek debit note ke andar ka har item
const debitItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  itemName: { type: String, required: true, trim: true },
  barcode: { type: String, default: '', trim: true },
  size: { type: String, default: '', trim: true },
  color: { type: String, default: '', trim: true },
  qty: { type: Number, required: true, min: 1 },
  purchasePrice: { type: Number, default: 0 }, // GST-inclusive rate per unit
  gstPct: { type: Number, default: 0 },
  base: { type: Number, default: 0 },
  gst: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
}, { _id: false });

const debitNoteSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  dnNumber: { type: String, required: true, trim: true },

  supplierName: { type: String, required: true, trim: true },
  reason: { type: String, default: 'Unsold stock', trim: true },

  // NAYA: multiple items
  items: [debitItemSchema],

  // Note-level totals (saare items ka jod)
  qty: { type: Number, default: 0 },
  base: { type: Number, default: 0 },
  gst: { type: Number, default: 0 },
  total: { type: Number, default: 0 },

  // ── Purane single-item notes ke fields (backward compatibility, naye notes mein khaali) ──
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  itemName: { type: String, default: '', trim: true },
  barcode: { type: String, default: '', trim: true },
  size: { type: String, default: '', trim: true },
  color: { type: String, default: '', trim: true },
  purchasePrice: { type: Number, default: 0 },
  gstPct: { type: Number, default: 0 },

  date: { type: Date, default: Date.now },
}, { timestamps: true });

debitNoteSchema.index({ user: 1, dnNumber: 1 }, { unique: true });

module.exports = mongoose.model('DebitNote', debitNoteSchema);