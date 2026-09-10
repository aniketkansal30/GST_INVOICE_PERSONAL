import React, { useEffect, useState, useMemo } from 'react';
import { formatCurrency } from '../utils/invoiceUtils';
import {
  Undo2, Plus, X, Search, Printer, Trash2, ScanBarcode,
  IndianRupee, Percent, Package, AlertTriangle
} from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';

const REASONS = ['Unsold stock', 'Damaged / defective', 'Wrong size / color sent', 'Other'];

export default function DebitNotesPage() {
  const [debitNotes, setDebitNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Product lookup (reuses the same /products master used in Inventory)
  const [products, setProducts] = useState([]);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [productQuery, setProductQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [qty, setQty] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [reason, setReason] = useState(REASONS[0]);
  const [qtyError, setQtyError] = useState('');
  const [supplierError, setSupplierError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadDebitNotes();
    loadProducts();
  }, []);

  const loadDebitNotes = async () => {
    setLoading(true);
    try {
      const res = await api.get('/debit-notes');
      setDebitNotes(res.data);
    } catch (err) {
      toast.error('Failed to load debit notes');
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const res = await api.get('/products');
      setProducts(res.data);
    } catch (err) {
      toast.error('Failed to load product list');
    }
  };

  // ---- Modal helpers ----
  const openModal = () => {
    setShowModal(true);
    setProductQuery('');
    setSelectedProduct(null);
    setQty('');
    setSupplierName('');
    setReason(REASONS[0]);
    setQtyError('');
    setSupplierError('');
  };
  const closeModal = () => setShowModal(false);

  const productResults = useMemo(() => {
    const q = productQuery.toLowerCase().trim();
    if (!q) return [];
    return products.filter(p =>
      p.barcode?.toLowerCase().includes(q) ||
      p.name?.toLowerCase().includes(q) ||
      p.color?.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [productQuery, products]);

  const handleSelectProduct = (p) => {
    setSelectedProduct(p);
    setProductQuery(p.barcode || p.name);
  };

  const handleChangeProduct = () => {
    setSelectedProduct(null);
    setProductQuery('');
  };

  const calc = useMemo(() => {
    if (!selectedProduct || !qty || Number(qty) <= 0) return null;
    const purchasePrice = Number(selectedProduct.purchasePrice) || 0;
    const gstPct = Number(selectedProduct.gstPct) || 0;
    const base = Number(qty) * purchasePrice;
    const gst = base * gstPct / 100;
    return { base, gst, total: base + gst };
  }, [selectedProduct, qty]);

  const handleSubmit = async () => {
    if (!selectedProduct) return toast.error('Pehle item select karo');

    let hasErr = false;
    if (!qty || Number(qty) <= 0 || Number(qty) > selectedProduct.currentStock) {
      setQtyError(`Enter a valid qty (max ${selectedProduct.currentStock})`);
      hasErr = true;
    } else {
      setQtyError('');
    }
    if (!supplierName.trim()) {
      setSupplierError('Supplier name is required');
      hasErr = true;
    } else {
      setSupplierError('');
    }
    if (hasErr) return;

    setSaving(true);
    try {
      await api.post('/debit-notes', {
        productId: selectedProduct._id,
        qty: Number(qty),
        supplierName: supplierName.trim(),
        reason,
      });
      toast.success('Debit note created & stock updated!');
      setShowModal(false);
      loadDebitNotes();
      loadProducts(); // refresh stock numbers
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create debit note');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (dn) => {
    if (!window.confirm(`Delete ${dn.dnNumber}? This will NOT restore the stock automatically.`)) return;
    try {
      await api.delete(`/debit-notes/${dn._id}`);
      toast.success('Debit note deleted');
      loadDebitNotes();
    } catch (err) {
      toast.error('Delete failed');
    }
  };

  // ---- Filtering & stats ----
  const filtered = debitNotes.filter(d => {
    const q = search.toLowerCase();
    return !q ||
      d.dnNumber?.toLowerCase().includes(q) ||
      d.itemName?.toLowerCase().includes(q) ||
      d.supplierName?.toLowerCase().includes(q);
  });

  const totalValue = debitNotes.reduce((s, d) => s + (d.total || 0), 0);
  const totalGst = debitNotes.reduce((s, d) => s + (d.gst || 0), 0);
  const totalQty = debitNotes.reduce((s, d) => s + (d.qty || 0), 0);

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900 dark:text-ink-50 flex items-center gap-2.5">
            <Undo2 className="text-amber-500" size={24} />
            Debit Notes
          </h1>
          <p className="text-xs sm:text-sm text-ink-500 dark:text-ink-400 mt-0.5">
            Return unsold or damaged stock back to suppliers &amp; track purchase value reversed
          </p>
        </div>
        <button onClick={openModal} className="btn-primary text-xs px-4 py-2.5 flex items-center gap-1.5 shadow-sm">
          <Plus size={16} /> New Debit Note
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <p className="text-xs font-semibold text-ink-400 dark:text-ink-500 uppercase tracking-wider mb-1">
            Total Debit Notes
          </p>
          <p className="font-display text-2xl font-bold text-ink-900 dark:text-ink-100">
            {loading ? '—' : debitNotes.length}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-semibold text-ink-400 dark:text-ink-500 uppercase tracking-wider mb-1">
            Purchase Value Reversed
          </p>
          <p className="font-display text-2xl font-bold text-ink-900 dark:text-ink-100">
            {loading ? '—' : formatCurrency(totalValue)}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-semibold text-ink-400 dark:text-ink-500 uppercase tracking-wider mb-1">
            GST Reversed
          </p>
          <p className="font-display text-2xl font-bold text-amber-600 dark:text-amber-400">
            {loading ? '—' : formatCurrency(totalGst)}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-semibold text-ink-400 dark:text-ink-500 uppercase tracking-wider mb-1">
            Items Returned (qty)
          </p>
          <p className="font-display text-2xl font-bold text-rose-600 dark:text-rose-400">
            {loading ? '—' : totalQty}
          </p>
        </div>
      </div>

      {/* List */}
      <div className="card overflow-hidden space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search size={16} className="absolute left-3 top-2.5 text-ink-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by DN no, item or supplier..."
              className="input pl-9 text-xs"
            />
          </div>
          <p className="text-xs text-ink-400 dark:text-ink-500 font-mono">{filtered.length} debit notes</p>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-12 text-center text-ink-400 text-xs">Loading debit notes...</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <p className="text-ink-700 dark:text-ink-200 font-semibold text-sm">No debit notes yet</p>
              <p className="text-ink-400 text-xs">Click "New Debit Note" to send unsold stock back to a supplier.</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-ink-50 dark:bg-ink-800 text-ink-500 uppercase font-mono text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">DN No.</th>
                  <th className="py-2.5 px-3">Item</th>
                  <th className="py-2.5 px-3">Supplier</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-2 text-center">Qty</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                  <th className="py-2.5 px-3 text-right">GST</th>
                  <th className="py-2.5 px-3">Reason</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 dark:divide-ink-800 font-mono">
                {filtered.map(d => (
                  <tr key={d._id} className="hover:bg-ink-50/60 dark:hover:bg-ink-800/40 transition-colors">
                    <td className="py-3 px-3 font-bold text-ink-900 dark:text-ink-100">{d.dnNumber}</td>
                    <td className="py-3 px-3 font-sans">
                      <span className="font-semibold text-ink-900 dark:text-ink-100">{d.itemName}</span>
                      <span className="block text-[10px] text-ink-400 font-mono">{d.barcode}</span>
                    </td>
                    <td className="py-3 px-3 font-sans text-ink-600 dark:text-ink-300 text-[11px]">{d.supplierName}</td>
                    <td className="py-3 px-3 text-ink-500">{new Date(d.date).toLocaleDateString('en-IN')}</td>
                    <td className="py-3 px-2 text-center font-bold">{d.qty}</td>
                    <td className="py-3 px-3 text-right font-bold text-ink-900 dark:text-ink-100">
                      {formatCurrency(d.total)}
                    </td>
                    <td className="py-3 px-3 text-right text-amber-600">{formatCurrency(d.gst)}</td>
                    <td className="py-3 px-3 font-sans">
                      <span className="bg-ink-100 dark:bg-ink-800 text-ink-700 dark:text-ink-200 px-2 py-0.5 rounded-full text-[10.5px] font-semibold">
                        {d.reason}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="inline-flex items-center gap-1.5 font-sans">
                        <button
                          onClick={() => window.print()}
                          className="p-1.5 rounded-lg text-ink-500 hover:text-ink-900 dark:hover:text-ink-100 hover:bg-ink-100 dark:hover:bg-ink-800"
                          title="Print"
                        >
                          <Printer size={13} />
                        </button>
                        <button
                          onClick={() => handleDelete(d)}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* MODAL: New Debit Note */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-ink-900 rounded-2xl border border-ink-200 dark:border-ink-800 shadow-2xl w-full max-w-lg max-h-[88vh] overflow-y-auto">
            <div className="p-4 border-b border-ink-100 dark:border-ink-800 flex items-center justify-between">
              <h3 className="font-semibold text-ink-900 dark:text-ink-100 text-sm flex items-center gap-2">
                <Undo2 size={16} className="text-amber-500" />
                New Debit Note (Supplier Return)
              </h3>
              <button onClick={closeModal} className="text-ink-400 hover:text-ink-600">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Product search */}
              <div>
                <label className="label">Search item by barcode / name</label>
                <div className="relative">
                  <ScanBarcode size={15} className="absolute left-3 top-2.5 text-ink-400" />
                  <input
                    type="text"
                    value={productQuery}
                    onChange={e => { setProductQuery(e.target.value); setSelectedProduct(null); }}
                    placeholder="Scan barcode or type item name..."
                    className="input pl-9 font-mono"
                    autoFocus
                  />
                </div>

                {!selectedProduct && productResults.length > 0 && (
                  <div className="mt-2 border border-ink-200 dark:border-ink-700 rounded-xl max-h-48 overflow-y-auto divide-y divide-ink-100 dark:divide-ink-800">
                    {productResults.map(p => (
                      <button
                        key={p._id}
                        type="button"
                        onClick={() => handleSelectProduct(p)}
                        className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-amber-500/10 transition-colors"
                      >
                        <div>
                          <p className="text-xs font-semibold text-ink-900 dark:text-ink-100">
                            {p.name} · {p.size} · {p.color}
                          </p>
                          <p className="text-[10px] font-mono text-ink-400">{p.barcode}</p>
                        </div>
                        <span className={`text-[11px] font-bold font-mono ${p.currentStock <= 5 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {p.currentStock} {p.unit || 'pcs'}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Selected product card */}
              {selectedProduct && (
                <div className="relative bg-ink-50 dark:bg-ink-800/50 border border-ink-200 dark:border-ink-700 rounded-xl p-3.5 text-xs">
                  <button
                    type="button"
                    onClick={handleChangeProduct}
                    className="absolute top-3 right-3.5 text-[11px] font-semibold text-sky-600 hover:underline"
                  >
                    Change item
                  </button>
                  <p className="font-bold text-ink-900 dark:text-ink-100 text-[13px]">
                    {selectedProduct.name} · {selectedProduct.size} · {selectedProduct.color}
                  </p>
                  <p className="text-ink-500 font-mono mt-1">
                    Barcode: {selectedProduct.barcode} &nbsp;·&nbsp; Purchase price: {formatCurrency(selectedProduct.purchasePrice || 0)} &nbsp;·&nbsp; GST: {selectedProduct.gstPct}%
                  </p>
                  <p className={`mt-2 font-semibold ${selectedProduct.currentStock <= 5 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    Current stock: {selectedProduct.currentStock} {selectedProduct.unit || 'pcs'}
                  </p>
                </div>
              )}

              {/* Qty + Supplier */}
              {selectedProduct && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Quantity to return</label>
                      <input
                        type="number"
                        min="1"
                        max={selectedProduct.currentStock}
                        value={qty}
                        onChange={e => { setQty(e.target.value); setQtyError(''); }}
                        placeholder="e.g. 5"
                        className="input font-mono font-bold"
                      />
                      {qtyError && <p className="text-[11px] text-rose-600 font-semibold mt-1">{qtyError}</p>}
                    </div>
                    <div>
                      <label className="label">Supplier / Vendor name</label>
                      <input
                        type="text"
                        value={supplierName}
                        onChange={e => { setSupplierName(e.target.value); setSupplierError(''); }}
                        placeholder="e.g. XYZ Textiles"
                        className="input"
                      />
                      {supplierError && <p className="text-[11px] text-rose-600 font-semibold mt-1">{supplierError}</p>}
                    </div>
                  </div>

                  <div>
                    <label className="label">Reason for return</label>
                    <select value={reason} onChange={e => setReason(e.target.value)} className="input text-xs">
                      {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>

                  {calc && (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 text-xs font-mono space-y-1">
                      <div className="flex justify-between text-ink-600 dark:text-ink-300">
                        <span className="flex items-center gap-1"><Package size={12} /> Taxable value</span>
                        <span>{formatCurrency(calc.base)}</span>
                      </div>
                      <div className="flex justify-between text-amber-700 dark:text-amber-400">
                        <span className="flex items-center gap-1"><Percent size={12} /> GST reversed ({selectedProduct.gstPct}%)</span>
                        <span>{formatCurrency(calc.gst)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-ink-900 dark:text-ink-100 pt-1.5 mt-1 border-t border-dashed border-amber-500/40">
                        <span className="flex items-center gap-1"><IndianRupee size={12} /> Debit note value</span>
                        <span>{formatCurrency(calc.total)}</span>
                      </div>
                    </div>
                  )}

                  {selectedProduct.currentStock <= 5 && (
                    <div className="flex items-start gap-2 text-[11px] text-amber-700 dark:text-amber-400">
                      <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                      This item is already low on stock — double check the return quantity.
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex justify-end gap-2 p-4 border-t border-ink-100 dark:border-ink-800">
              <button onClick={closeModal} className="btn-secondary text-xs">Cancel</button>
              <button onClick={handleSubmit} disabled={saving || !selectedProduct} className="btn-primary text-xs">
                {saving ? 'Saving...' : '+ Create Debit Note'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}