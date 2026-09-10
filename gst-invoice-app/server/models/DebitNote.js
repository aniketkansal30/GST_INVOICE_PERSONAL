const mongoose = require('mongoose');

const debitNoteSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  dnNumber: { type: String, required: true, trim: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },

  // Snapshot fields — kept even if the product is later edited/deleted,
  // so old debit notes still show correct historical details.
  itemName: { type: String, required: true, trim: true },
  barcode: { type: String, default: '', trim: true },
  size: { type: String, default: '', trim: true },
  color: { type: String, default: '', trim: true },

  supplierName: { type: String, required: true, trim: true },
  reason: { type: String, default: 'Unsold stock', trim: true },

  qty: { type: Number, required: true, min: 1 },
  purchasePrice: { type: Number, default: 0 }, // rate per unit used for this note
  gstPct: { type: Number, default: 0 },
  base: { type: Number, default: 0 },   // taxable value (qty * purchasePrice)
  gst: { type: Number, default: 0 },    // GST reversed
  total: { type: Number, default: 0 },  // base + gst

  date: { type: Date, default: Date.now },
}, { timestamps: true });

debitNoteSchema.index({ user: 1, dnNumber: 1 }, { unique: true });

module.exports = mongoose.model('DebitNote', debitNoteSchema);