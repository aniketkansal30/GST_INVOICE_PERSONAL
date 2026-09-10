const DebitNote = require('../models/DebitNote');
const Product = require('../models/Product');
const StockTransaction = require('../models/StockTransaction');

// Saari debit notes (naya sabse upar)
exports.getDebitNotes = async (req, res) => {
  try {
    const notes = await DebitNote.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(notes);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Naya debit note — stock kam karta hai + StockTransaction log karta hai
exports.createDebitNote = async (req, res) => {
  try {
    const { productId, qty, supplierName, reason } = req.body;

    if (!productId) return res.status(400).json({ message: 'Product is required' });
    if (!supplierName || !supplierName.trim()) {
      return res.status(400).json({ message: 'Supplier name is required' });
    }

    const numQty = Number(qty);
    if (isNaN(numQty) || numQty <= 0) {
      return res.status(400).json({ message: 'Please provide a valid positive quantity' });
    }

    const product = await Product.findOne({ _id: productId, user: req.user._id });
    if (!product) return res.status(404).json({ message: 'Product not found' });

    if (numQty > product.currentStock) {
      return res.status(400).json({
        message: `Only ${product.currentStock} ${product.unit || 'pcs'} in stock — cannot return ${numQty}`,
      });
    }

    // Amount calculation — SAME convention as POS billing / ThermalReceiptModal:
    // the per-unit rate (purchasePrice if set, else sellingPrice) is treated
    // as GST-INCLUSIVE, and GST is reverse-extracted out of it rather than
    // added on top. This keeps debit notes consistent with how bills are
    // calculated everywhere else in the app.
    const gstPct = Number(product.gstPct) || 0;
    const priceIncGst = Number(product.purchasePrice) > 0
      ? Number(product.purchasePrice)
      : (Number(product.sellingPrice) || 0);

    const perUnitBase = gstPct > 0 ? priceIncGst / (1 + gstPct / 100) : priceIncGst;
    const base = numQty * perUnitBase;
    const total = numQty * priceIncGst;
    const gst = total - base;
    const purchasePrice = priceIncGst;

    // DN number: DN-001, DN-002... per user
    const existingCount = await DebitNote.countDocuments({ user: req.user._id });
    const dnNumber = `DN-${String(existingCount + 1).padStart(3, '0')}`;

    // Reduce stock
    product.currentStock -= numQty;
    await product.save();

    // Log it the same way "Add Stock" does, so Stock History shows it too
    await StockTransaction.create({
      user: req.user._id,
      product: product._id,
      type: 'DEBIT_NOTE',
      qty: -numQty, // negative, since stock is going OUT
      note: `${dnNumber} · Returned to ${supplierName.trim()} (${reason || 'Unsold stock'})`,
    });

    const debitNote = await DebitNote.create({
      user: req.user._id,
      dnNumber,
      product: product._id,
      itemName: product.name,
      barcode: product.barcode,
      size: product.size,
      color: product.color,
      supplierName: supplierName.trim(),
      reason: reason || 'Unsold stock',
      qty: numQty,
      purchasePrice,
      gstPct,
      base,
      gst,
      total,
    });

    res.status(201).json(debitNote);
  } catch (err) {
    console.error('CREATE DEBIT NOTE ERROR:', err.message);
    res.status(500).json({ message: err.message });
  }
};

// Delete — NOTE: stock is intentionally NOT restored automatically here,
// since deleting is meant for fixing a wrongly-entered note, not undoing a
// real physical return. Match this to whatever behaviour you want.
exports.deleteDebitNote = async (req, res) => {
  try {
    const note = await DebitNote.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!note) return res.status(404).json({ message: 'Debit note not found' });
    res.json({ message: 'Debit note deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};