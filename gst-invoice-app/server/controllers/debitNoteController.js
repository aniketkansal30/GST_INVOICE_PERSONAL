const DebitNote = require('../models/DebitNote');
const Product = require('../models/Product');
const StockTransaction = require('../models/StockTransaction');

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Sabse bada DN number +1 (delete ke baad bhi duplicate nahi banega)
const getNextDnNumber = async (userId) => {
  const notes = await DebitNote.find({ user: userId }, { dnNumber: 1 }).lean();
  let max = 0;
  notes.forEach((n) => {
    const m = String(n.dnNumber || '').match(/(\d+)\s*$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return `DN-${String(max + 1).padStart(3, '0')}`;
};

// Saari debit notes (naya sabse upar)
exports.getDebitNotes = async (req, res) => {
  try {
    const notes = await DebitNote.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(notes);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Naya debit note — ek note mein multiple items.
// Body: { supplierName, reason, items: [{ productId, qty }, ...] }
// (purana format { productId, qty } bhi chalta hai)
exports.createDebitNote = async (req, res) => {
  try {
    const { supplierName, reason } = req.body;

    let rawItems = Array.isArray(req.body.items) ? req.body.items : [];
    if (rawItems.length === 0 && req.body.productId) {
      rawItems = [{ productId: req.body.productId, qty: req.body.qty }];
    }

    if (!supplierName || !supplierName.trim()) {
      return res.status(400).json({ message: 'Supplier name is required' });
    }
    if (rawItems.length === 0) {
      return res.status(400).json({ message: 'Add at least one item' });
    }

    // Same product do baar aaya toh qty jod do
    const merged = new Map();
    for (const it of rawItems) {
      const id = String(it.productId || '');
      const q = Number(it.qty);
      if (!id) return res.status(400).json({ message: 'Product is required for every item' });
      if (isNaN(q) || q <= 0) {
        return res.status(400).json({ message: 'Please provide a valid positive quantity for every item' });
      }
      merged.set(id, (merged.get(id) || 0) + q);
    }

    // PEHLE sab validate karo — koi bhi item galat ho toh stock bilkul na kate
    const lines = [];
    for (const [id, q] of merged) {
      const product = await Product.findOne({ _id: id, user: req.user._id });
      if (!product) return res.status(404).json({ message: 'Product not found' });
      if (q > product.currentStock) {
        return res.status(400).json({
          message: `"${product.name}": only ${product.currentStock} ${product.unit || 'pcs'} in stock — cannot return ${q}`,
        });
      }
      lines.push({ product, qty: q });
    }

    const dnNumber = await getNextDnNumber(req.user._id);
    const cleanSupplier = supplierName.trim();
    const cleanReason = reason || 'Unsold stock';

    // Amount: rate (purchasePrice, nahi toh sellingPrice) GST-INCLUSIVE maana jata hai,
    // GST usme se reverse nikalta hai — POS billing wali convention
    const items = [];
    let totalQty = 0, totalBase = 0, totalGst = 0, totalAmt = 0;

    for (const { product, qty } of lines) {
      const gstPct = Number(product.gstPct) || 0;
      const priceIncGst = Number(product.purchasePrice) > 0
        ? Number(product.purchasePrice)
        : (Number(product.sellingPrice) || 0);

      const lineTotal = round2(qty * priceIncGst);
      const lineBase = round2(gstPct > 0 ? lineTotal / (1 + gstPct / 100) : lineTotal);
      const lineGst = round2(lineTotal - lineBase);

      // Stock kam karo + history log
      product.currentStock -= qty;
      await product.save();

      await StockTransaction.create({
        user: req.user._id,
        product: product._id,
        type: 'DEBIT_NOTE',
        qty: -qty,
        note: `${dnNumber} · Returned to ${cleanSupplier} (${cleanReason})`,
      });

      items.push({
        product: product._id,
        itemName: product.name,
        barcode: product.barcode || '',
        size: product.size || '',
        color: product.color || '',
        qty,
        purchasePrice: priceIncGst,
        gstPct,
        base: lineBase,
        gst: lineGst,
        total: lineTotal,
      });

      totalQty += qty;
      totalBase += lineBase;
      totalGst += lineGst;
      totalAmt += lineTotal;
    }

    const debitNote = await DebitNote.create({
      user: req.user._id,
      dnNumber,
      supplierName: cleanSupplier,
      reason: cleanReason,
      items,
      qty: totalQty,
      base: round2(totalBase),
      gst: round2(totalGst),
      total: round2(totalAmt),
    });

    res.status(201).json(debitNote);
  } catch (err) {
    console.error('CREATE DEBIT NOTE ERROR:', err.message);
    res.status(500).json({ message: err.message });
  }
};

// Delete — stock automatically wapas NAHI hota (galat entry theek karne ke liye hai,
// asli physical return undo karne ke liye nahi)
exports.deleteDebitNote = async (req, res) => {
  try {
    const note = await DebitNote.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!note) return res.status(404).json({ message: 'Debit note not found' });
    res.json({ message: 'Debit note deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};