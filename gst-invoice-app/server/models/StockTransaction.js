const mongoose = require('mongoose');

const stockTransactionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  type: {
    type: String,
    enum: ['OPENING', 'PURCHASE', 'SALE', 'ADJUSTMENT'],
    required: true
  },
  qty: { type: Number, required: true },
  note: { type: String, default: '' },
  invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', default: null },
  date: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('StockTransaction', stockTransactionSchema);