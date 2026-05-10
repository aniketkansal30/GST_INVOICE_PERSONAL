const express = require('express');
const router = express.Router();
const Stock = require('../models/Stock');
const Invoice = require('../models/Invoice');
const auth = require('../middleware/auth');

// Get all stock items with consumed quantity
router.get('/', auth, async (req, res) => {
  try {
    const stocks = await Stock.find({ user: req.user.id });
    const invoices = await Invoice.find({ user: req.user.id });

    const consumed = {};
    invoices.forEach(inv => {
      (inv.items || []).forEach(item => {
        const key = (item.name || '').toLowerCase().trim();
        if (!consumed[key]) consumed[key] = 0;
        consumed[key] += Number(item.qty) || 0;
      });
    });

    const result = stocks.map(s => {
      const key = s.itemName.toLowerCase().trim();
      const used = consumed[key] || 0;
      return {
        _id: s._id,
        itemName: s.itemName,
        hsn: s.hsn,
        unit: s.unit,
        openingStock: s.openingStock,
        consumed: used,
        remaining: s.openingStock - used,
        openingDate: s.openingDate,
      };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Add/Update stock item
router.post('/', auth, async (req, res) => {
  try {
    const { itemName, hsn, unit, openingStock, openingDate } = req.body;
    let stock = await Stock.findOne({ user: req.user.id, itemName });
    if (stock) {
      stock.openingStock = openingStock;
      stock.hsn = hsn || stock.hsn;
      stock.unit = unit || stock.unit;
      if (openingDate) stock.openingDate = openingDate;
      await stock.save();
    } else {
      stock = await Stock.create({ user: req.user.id, itemName, hsn, unit, openingStock, openingDate });
    }
    res.json(stock);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete stock item
router.delete('/:id', auth, async (req, res) => {
  try {
    await Stock.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;