const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true },
  barcode: { type: String, default: '', trim: true },
  hsn: { type: String, default: '6205', trim: true },
  unit: { type: String, default: 'Nos', trim: true },
  gstPct: { type: Number, default: 5 }, // Standard clothing GST is 5% (or 12% > ₹1000)
  sellingPrice: { type: Number, default: 0, min: 0 },
  purchasePrice: { type: Number, default: 0, min: 0 },
  size: { type: String, default: '', trim: true },
  color: { type: String, default: '', trim: true },
  category: { type: String, default: 'Clothing', trim: true },
  openingStock: { type: Number, default: 0 },
  currentStock: { type: Number, default: 0 },
}, { timestamps: true });

// Barcode must be unique per user (sparse allows empty barcode products)
productSchema.index({ user: 1, barcode: 1 }, { 
  unique: true, 
  partialFilterExpression: { barcode: { $type: 'string', $gt: '' } } 
});

// User + name + size + color index for unique clothing variants
productSchema.index({ user: 1, name: 1, size: 1, color: 1 });

module.exports = mongoose.model('Product', productSchema);
