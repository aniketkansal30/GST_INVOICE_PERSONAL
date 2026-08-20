const Product = require('../models/Product');
const StockTransaction = require('../models/StockTransaction');

// Saare products
exports.getProducts = async (req, res) => {
  try {
    const { search } = req.query;
    const query = { user: req.user._id };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { barcode: { $regex: search, $options: 'i' } },
        { size: { $regex: search, $options: 'i' } },
        { color: { $regex: search, $options: 'i' } },
        { hsn: { $regex: search, $options: 'i' } },
      ];
    }
    const products = await Product.find(query).sort({ updatedAt: -1, name: 1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Barcode Scan endpoint
exports.getProductByBarcode = async (req, res) => {
  try {
    const rawBarcode = req.params.barcode ? req.params.barcode.trim() : '';
    if (!rawBarcode) {
      return res.status(400).json({ message: 'Barcode is required' });
    }

    const product = await Product.findOne({
      user: req.user._id,
      barcode: rawBarcode,
    });

    if (!product) {
      return res.status(404).json({ message: `Product with barcode "${rawBarcode}" not found` });
    }

    res.json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Naya product + opening stock
exports.createProduct = async (req, res) => {
  try {
    const {
      name,
      barcode,
      hsn,
      unit,
      gstPct,
      sellingPrice,
      purchasePrice,
      size,
      color,
      category,
      openingStock,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Product name is required' });
    }

    const cleanBarcode = barcode ? barcode.trim() : '';

    // Check duplicate barcode for this user
    if (cleanBarcode) {
      const existingBarcode = await Product.findOne({
        user: req.user._id,
        barcode: cleanBarcode,
      });
      if (existingBarcode) {
        return res.status(400).json({
          message: `Barcode "${cleanBarcode}" is already assigned to "${existingBarcode.name}"`,
        });
      }
    }

    const opening = Number(openingStock) || 0;
    const sellPrice = Number(sellingPrice) || 0;
    const buyPrice = Number(purchasePrice) || 0;
    const taxPct = gstPct !== undefined && gstPct !== null && gstPct !== '' ? Number(gstPct) : 5;

    const product = await Product.create({
      user: req.user._id,
      name: name.trim(),
      barcode: cleanBarcode,
      hsn: hsn ? hsn.trim() : '6205',
      unit: unit ? unit.trim() : 'Nos',
      gstPct: taxPct,
      sellingPrice: sellPrice,
      purchasePrice: buyPrice,
      size: size ? size.trim() : '',
      color: color ? color.trim() : '',
      category: category ? category.trim() : 'Clothing',
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
      return res.status(400).json({ message: 'A product with this barcode or name already exists' });
    }
    res.status(500).json({ message: err.message });
  }
};

// Product update
exports.updateProduct = async (req, res) => {
  try {
    const { barcode } = req.body;
    if (barcode && barcode.trim()) {
      const cleanBarcode = barcode.trim();
      const existingBarcode = await Product.findOne({
        user: req.user._id,
        barcode: cleanBarcode,
        _id: { $ne: req.params.id },
      });
      if (existingBarcode) {
        return res.status(400).json({
          message: `Barcode "${cleanBarcode}" is already assigned to "${existingBarcode.name}"`,
        });
      }
    }

    const updateData = { ...req.body };
    if (updateData.barcode) updateData.barcode = updateData.barcode.trim();
    if (updateData.name) updateData.name = updateData.name.trim();

    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      updateData,
      { new: true }
    );
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'Barcode or product conflict' });
    }
    res.status(500).json({ message: err.message });
  }
};

// Product delete
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!product) return res.status(404).json({ message: 'Product not found' });
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

    const numQty = Number(qty);
    if (isNaN(numQty) || numQty <= 0) {
      return res.status(400).json({ message: 'Please provide a valid positive quantity' });
    }

    product.currentStock += numQty;
    await product.save();

    await StockTransaction.create({
      user: req.user._id,
      product: product._id,
      type: 'PURCHASE',
      qty: numQty,
      note: note || 'Stock purchased / added',
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
