const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true },
  hsn: { type: String, default: '' },
  unit: { type: String, default: 'Nos' },
  gstPct: { type: Number, default: 18 },
  openingStock: { type: Number, default: 0 },
  currentStock: { type: Number, default: 0 },
}, { timestamps: true });

productSchema.index({ user: 1, name: 1 }, { unique: true });
module.exports = mongoose.model('Product', productSchema);