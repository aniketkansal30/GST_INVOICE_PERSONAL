const mongoose = require('mongoose');

const stockSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  itemName: { type: String, required: true },
  hsn: { type: String, default: '' },
  unit: { type: String, default: 'Nos' },
  openingStock: { type: Number, default: 0 },
  openingDate: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('Stock', stockSchema);