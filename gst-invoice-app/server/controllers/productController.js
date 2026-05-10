const Product = require('../models/Product');
const StockTransaction = require('../models/StockTransaction');

// Saare products
exports.getProducts = async (req, res) => {
  try {
    const products = await Product.find({ user: req.user._id }).sort({ name: 1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Naya product + opening stock
exports.createProduct = async (req, res) => {
  try {
    const { name, hsn, unit, gstPct, openingStock } = req.body;
    const opening = Number(openingStock) || 0;

    const product = await Product.create({
      user: req.user._id,
      name, hsn, unit, gstPct,
      openingStock: opening,
      currentStock: opening,
    });

    if (opening > 0) {
      await StockTransaction.create({
        user: req.user._id,
        product: product._id,
        type: 'OPENING',
        qty: opening,
        note: 'Opening stock',
      });
    }

    res.status(201).json(product);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'Product already exists' });
    }
    res.status(500).json({ message: err.message });
  }
};

// Product update
exports.updateProduct = async (req, res) => {
  try {
    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      req.body,
      { new: true }
    );
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Product delete
exports.deleteProduct = async (req, res) => {
  try {
    await Product.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    await StockTransaction.deleteMany({ product: req.params.id, user: req.user._id });
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Naya stock aaya
exports.addStock = async (req, res) => {
  try {
    const { qty, note } = req.body;
    const product = await Product.findOne({ _id: req.params.id, user: req.user._id });
    if (!product) return res.status(404).json({ message: 'Product not found' });

    product.currentStock += Number(qty);
    await product.save();

    await StockTransaction.create({
      user: req.user._id,
      product: product._id,
      type: 'PURCHASE',
      qty: Number(qty),
      note: note || 'Stock purchased',
    });

    res.json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Stock history
exports.getStockHistory = async (req, res) => {
  try {
    const transactions = await StockTransaction.find({
      user: req.user._id,
      product: req.params.id,
    }).sort({ createdAt: -1 });
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Inventory report
exports.getInventoryReport = async (req, res) => {
  try {
    const products = await Product.find({ user: req.user._id }).sort({ name: 1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};