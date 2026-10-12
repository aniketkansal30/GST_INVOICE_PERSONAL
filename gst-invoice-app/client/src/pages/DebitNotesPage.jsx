import React, { useEffect, useState, useMemo, useRef } from 'react';
import { formatCurrency, DEFAULT_STORE_DETAILS } from '../utils/invoiceUtils';
import {
  Undo2, Plus, Minus, X, Search, Printer, Trash2, ScanBarcode,
  IndianRupee, Percent, Package, Download
} from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import DateRangeFilter from '../components/DateRangeFilter';
import { filterByDateRange } from '../utils/dateRangeUtils';
import { exportStyledExcel } from '../utils/excelExport';
import { useAuth } from '../context/AuthContext';
import DebitNoteReceiptModal from '../components/DebitNoteReceiptModal';

const REASONS = ['Unsold stock', 'Damaged / defective', 'Wrong size / color sent', 'Other'];

// Naye notes mein items[] hota hai; purane single-item notes ko bhi same shape mein badal deta hai
const getNoteItems = (d) => {
  if (d.items && d.items.length > 0) return d.items;
  return [{
    itemName: d.itemName, barcode: d.barcode, size: d.size, color: d.color,
    qty: d.qty, purchasePrice: d.purchasePrice, gstPct: d.gstPct,
    base: d.base, gst: d.gst, total: d.total,
  }];
};

// Backend jaisi hi calculation: rate GST-inclusive hai
const getRate = (p) => (Number(p.purchasePrice) > 0 ? Number(p.purchasePrice) : (Number(p.sellingPrice) || 0));
const calcLine = (p, qty) => {
  const q = Number(qty) || 0;
  const gstPct = Number(p.gstPct) || 0;
  const rate = getRate(p);
  const total = q * rate;
  const base = gstPct > 0 ? total / (1 + gstPct / 100) : total;
  return { rate, gstPct, base, gst: total - base, total };
};

export default function DebitNotesPage() {
  const { user } = useAuth();
  const [debitNotes, setDebitNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState({ preset: 'this_year', customFrom: '', customTo: '' });

  const [products, setProducts] = useState([]);

  // Modal state — New Debit Note (multi-item)
  const [showModal, setShowModal] = useState(false);
  const [productQuery, setProductQuery] = useState('');
  const [items, setItems] = useState([]); // [{ product, qty }]
  const [supplierName, setSupplierName] = useState('');
  const [reason, setReason] = useState(REASONS[0]);
  const [supplierError, setSupplierError] = useState('');
  const [saving, setSaving] = useState(false);
  const barcodeRef = useRef(null);
  const supplierRef = useRef(null);

  // Modal state — single-DN print
  const [printNote, setPrintNote] = useState(null);

  const seller = {
    companyName: user?.companyName || DEFAULT_STORE_DETAILS.companyName,
    gstNumber: user?.gstNumber || DEFAULT_STORE_DETAILS.gstNumber,
    address: user?.address || DEFAULT_STORE_DETAILS.address,
    state: user?.state || DEFAULT_STORE_DETAILS.state,
  };

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

  const focusBarcode = () => setTimeout(() => barcodeRef.current?.focus(), 50);

  // ---- Modal helpers ----
  const openModal = () => {
    setShowModal(true);
    setProductQuery('');
    setItems([]);
    setSupplierName('');
    setReason(REASONS[0]);
    setSupplierError('');
  };
  const closeModal = () => setShowModal(false);

  const productResults = useMemo(() => {
    const q = productQuery.toLowerCase().trim();
    if (!q) return [];
    return products.filter(p =>
      p.barcode?.toLowerCase().includes(q) ||
      p.name?.toLowerCase().includes(q) ||
      p.color?.toLowerCase().includes(q) ||
      p.brand?.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [productQuery, products]);

  // Item list mein add (already hai toh qty +1)
  const addProduct = (p) => {
    const stock = Number(p.currentStock) || 0;
    if (stock <= 0) {
      toast.error(`"${p.name}" ka stock 0 hai`, { id: 'dn-stock' });
      return;
    }
    const idx = items.findIndex(i => i.product._id === p._id);
    if (idx > -1) {
      if (items[idx].qty + 1 > stock) {
        toast.error(`"${p.name}" ke sirf ${stock} pcs stock mein hain`, { id: 'dn-stock' });
        return;
      }
      setItems(items.map((it, i) => (i === idx ? { ...it, qty: it.qty + 1 } : it)));
    } else {
      setItems([...items, { product: p, qty: 1 }]);
    }
    setProductQuery('');
    focusBarcode();
  };

  // Scanner / Enter: exact barcode match -> add; nahi toh single search result -> add
  const handleBarcodeKeyDown = (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const q = productQuery.trim();
    if (!q) return;
    const exact = products.find(p => p.barcode && p.barcode.trim().toLowerCase() === q.toLowerCase());
    if (exact) return addProduct(exact);
    if (productResults.length === 1) return addProduct(productResults[0]);
    toast.error(
      productResults.length > 1 ? 'Neeche list se item select karo' : `"${q}" nahi mila`,
      { id: 'dn-nf' }
    );
  };

  const bumpQty = (idx, delta) => {
    const it = items[idx];
    const stock = Number(it.product.currentStock) || 0;
    const newQty = (Number(it.qty) || 0) + delta;
    if (newQty <= 0) return removeItem(idx);
    if (newQty > stock) {
      toast.error(`"${it.product.name}" ke sirf ${stock} pcs stock mein hain`, { id: 'dn-stock' });
      return;
    }
    setItems(items.map((x, i) => (i === idx ? { ...x, qty: newQty } : x)));
  };

  const setQtyDirect = (idx, val) => {
    if (val === '') {
      setItems(items.map((x, i) => (i === idx ? { ...x, qty: '' } : x)));
      return;
    }
    const num = parseInt(val, 10);
    if (isNaN(num) || num < 0) return;
    const stock = Number(items[idx].product.currentStock) || 0;
    if (num > stock) {
      toast.error(`Sirf ${stock} pcs stock mein hain`, { id: 'dn-stock' });
      setItems(items.map((x, i) => (i === idx ? { ...x, qty: stock } : x)));
      return;
    }
    setItems(items.map((x, i) => (i === idx ? { ...x, qty: num } : x)));
  };

  const removeItem = (idx) => {
    setItems(items.filter((_, i) => i !== idx));
    focusBarcode();
  };

  const totals = useMemo(() => {
    let qty = 0, base = 0, gst = 0, total = 0;
    items.forEach(({ product, qty: q }) => {
      const c = calcLine(product, q);
      qty += Number(q) || 0;
      base += c.base;
      gst += c.gst;
      total += c.total;
    });
    return { qty, base, gst, total };
  }, [items]);

  const handleSubmit = async () => {
    if (items.length === 0) return toast.error('Pehle kam se kam ek item scan karo');
    if (!supplierName.trim()) {
      setSupplierError('Supplier name is required');
      supplierRef.current?.focus();
      return;
    }
    setSupplierError('');
    if (items.some(i => !(Number(i.qty) > 0))) return toast.error('Har item ki qty 1 ya usse zyada honi chahiye');

    setSaving(true);
    try {
      await api.post('/debit-notes', {
        supplierName: supplierName.trim(),
        reason,
        items: items.map(i => ({ productId: i.product._id, qty: Number(i.qty) })),
      });
      toast.success('Debit note created & stock updated!');
      setShowModal(false);
      loadDebitNotes();
      loadProducts(); // stock numbers refresh
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
  const dateFiltered = filterByDateRange(debitNotes, 'date', dateFilter.preset, dateFilter.customFrom, dateFilter.customTo);

  const filtered = dateFiltered.filter(d => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      d.dnNumber?.toLowerCase().includes(q) ||
      d.supplierName?.toLowerCase().includes(q) ||
      getNoteItems(d).some(it =>
        it.itemName?.toLowerCase().includes(q) || it.barcode?.toLowerCase().includes(q)
      )
    );
  });

  const totalValue = dateFiltered.reduce((s, d) => s + (d.total || 0), 0);
  const totalGst = dateFiltered.reduce((s, d) => s + (d.gst || 0), 0);
  const totalQty = dateFiltered.reduce((s, d) => s + (d.qty || 0), 0);

  // Excel: har item ek row (DN No. repeat hota hai), last mein TOTAL
  const exportToExcel = async () => {
    const columns = [
      { header: 'DN No.', key: 'dnNo', width: 12 },
      { header: 'Date', key: 'date', width: 12, format: 'text' },
      { header: 'Supplier', key: 'supplier', width: 22 },
      { header: 'Item', key: 'item', width: 24 },
      { header: 'Barcode', key: 'barcode', width: 18, format: 'text' },
      { header: 'Size', key: 'size', width: 8 },
      { header: 'Color', key: 'color', width: 14 },
      { header: 'Qty', key: 'qty', width: 8, format: 'number' },
      { header: 'Rate', key: 'rate', width: 12, format: 'currency' },
      { header: 'Taxable Value', key: 'base', width: 15, format: 'currency' },
      { header: 'GST %', key: 'gstPct', width: 9, format: 'percent' },
      { header: 'GST', key: 'gst', width: 13, format: 'currency' },
      { header: 'Total', key: 'total', width: 15, format: 'currency' },
      { header: 'Reason', key: 'reason', width: 22 },
    ];

    const rows = [];
    dateFiltered.forEach(d => {
      getNoteItems(d).forEach(it => {
        rows.push({
          dnNo: d.dnNumber,
          date: new Date(d.date).toLocaleDateString('en-IN'),
          supplier: d.supplierName,
          item: it.itemName,
          barcode: it.barcode || '',
          size: it.size || '',
          color: it.color || '',
          qty: it.qty,
          rate: it.purchasePrice,
          base: it.base,
          gstPct: it.gstPct,
          gst: it.gst,
          total: it.total,
          reason: d.reason,
        });
      });
    });

    if (rows.length > 0) {
      const sum = (k) => rows.reduce((s, r) => s + (Number(r[k]) || 0), 0);
      rows.push({
        dnNo: 'TOTAL', date: '', supplier: '', item: '', barcode: '', size: '', color: '',
        qty: sum('qty'), rate: '', base: sum('base'), gstPct: '', gst: sum('gst'), total: sum('total'), reason: '',
      });
    }

    await exportStyledExcel(
      [{ name: 'Debit Notes', columns, rows }],
      `Debit_Notes_${new Date().getFullYear()}.xlsx`
    );
    toast.success('Debit notes exported to Excel!');
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-slide-up">
      <style>{`
        @media print {
          .no-print, .no-print * {
            display: none !important;
          }
          #debit-notes-printable {
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
          }
          #debit-notes-printable table {
            font-size: 11px !important;
          }
          @page {
            size: A4;
            margin: 14mm;
          }
        }
      `}</style>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 no-print">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900 dark:text-ink-50 flex items-center gap-2.5">
            <Undo2 className="text-amber-500" size={24} />
            Debit Notes
          </h1>
          <p className="text-xs sm:text-sm text-ink-500 dark:text-ink-400 mt-0.5">
            Return unsold or damaged stock back to suppliers &amp; track purchase value reversed
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DateRangeFilter {...dateFilter} onChange={setDateFilter} />
          <button
            onClick={exportToExcel}
            className="btn-secondary text-xs px-3.5 py-2.5 text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5"
          >
            <Download size={15} /> Export Excel
          </button>
          <button
            onClick={() => window.print()}
            className="btn-secondary text-xs px-3.5 py-2.5 flex items-center gap-1.5"
          >
            <Printer size={15} /> Print
          </button>
          <button onClick={openModal} className="btn-primary text-xs px-4 py-2.5 flex items-center gap-1.5 shadow-sm">
            <Plus size={16} /> New Debit Note
          </button>
        </div>
      </div>

      {/* Printable area */}
      <div id="debit-notes-printable">
        <div className="hidden print:block mb-4 pb-3 border-b-2 border-ink-900 text-center">
          <p style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '3px', color: '#6e6e60', margin: '0 0 4px' }}>DEBIT NOTES REPORT</p>
          <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 4px' }}>{seller.companyName}</h2>
          <p style={{ fontSize: '11px', color: '#6e6e60', margin: '0 0 2px' }}>{seller.address}</p>
          <p style={{ fontSize: '11px', margin: '0 0 4px' }}>GSTIN: {seller.gstNumber} &nbsp;|&nbsp; {seller.state}</p>
          <p className="text-xs text-ink-500">
            {dateFilter.preset === 'custom' && dateFilter.customFrom && dateFilter.customTo
              ? `Period: ${dateFilter.customFrom} to ${dateFilter.customTo}`
              : `Period: ${dateFilter.preset.replace(/_/g, ' ')}`}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 print:mb-4">
          <div className="card p-5 print:border print:border-ink-300 print:rounded-none">
            <p className="text-xs font-semibold text-ink-400 dark:text-ink-500 uppercase tracking-wider mb-1">
              Total Debit Notes
            </p>
            <p className="font-display text-2xl font-bold text-ink-900 dark:text-ink-100">
              {loading ? '—' : debitNotes.length}
            </p>
          </div>
          <div className="card p-5 print:border print:border-ink-300 print:rounded-none">
            <p className="text-xs font-semibold text-ink-400 dark:text-ink-500 uppercase tracking-wider mb-1">
              Purchase Value Reversed
            </p>
            <p className="font-display text-2xl font-bold text-ink-900 dark:text-ink-100">
              {loading ? '—' : formatCurrency(totalValue)}
            </p>
          </div>
          <div className="card p-5 print:border print:border-ink-300 print:rounded-none">
            <p className="text-xs font-semibold text-ink-400 dark:text-ink-500 uppercase tracking-wider mb-1">
              GST Reversed
            </p>
            <p className="font-display text-2xl font-bold text-amber-600 dark:text-amber-400">
              {loading ? '—' : formatCurrency(totalGst)}
            </p>
          </div>
          <div className="card p-5 print:border print:border-ink-300 print:rounded-none">
            <p className="text-xs font-semibold text-ink-400 dark:text-ink-500 uppercase tracking-wider mb-1">
              Items Returned (qty)
            </p>
            <p className="font-display text-2xl font-bold text-rose-600 dark:text-rose-400">
              {loading ? '—' : totalQty}
            </p>
          </div>
        </div>

        {/* List */}
        <div className="card overflow-hidden space-y-4 p-5 print:border print:border-ink-300 print:rounded-none print:p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 no-print">
            <div className="relative flex-1 min-w-[240px]">
              <Search size={16} className="absolute left-3 top-2.5 text-ink-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by DN no, item, barcode or supplier..."
                className="input pl-9 text-xs"
              />
            </div>
            <p className="text-xs text-ink-400 dark:text-ink-500 font-mono">{filtered.length} debit notes</p>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="py-12 text-center text-ink-400 text-xs no-print">Loading debit notes...</div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <p className="text-ink-700 dark:text-ink-200 font-semibold text-sm">No debit notes yet</p>
                <p className="text-ink-400 text-xs no-print">Click "New Debit Note" to send unsold stock back to a supplier.</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-ink-50 dark:bg-ink-800 text-ink-500 uppercase font-mono text-[10px] print:bg-transparent print:text-ink-900 print:border-b-2 print:border-ink-900">
                  <tr>
                    <th className="py-2.5 px-3">DN No.</th>
                    <th className="py-2.5 px-3">Items</th>
                    <th className="py-2.5 px-3">Supplier</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-2 text-center">Qty</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                    <th className="py-2.5 px-3 text-right">GST</th>
                    <th className="py-2.5 px-3">Reason</th>
                    <th className="py-2.5 px-3 text-right no-print">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100 dark:divide-ink-800 font-mono print:divide-ink-300">
                  {filtered.map(d => {
                    const noteItems = getNoteItems(d);
                    const first = noteItems[0];
                    return (
                      <tr key={d._id} className="hover:bg-ink-50/60 dark:hover:bg-ink-800/40 transition-colors">
                        <td className="py-3 px-3 font-bold text-ink-900 dark:text-ink-100">{d.dnNumber}</td>
                        <td className="py-3 px-3 font-sans" title={noteItems.map(i => `${i.itemName} x${i.qty}`).join('\n')}>
                          <span className="font-semibold text-ink-900 dark:text-ink-100">{first.itemName}</span>
                          {noteItems.length > 1 ? (
                            <span className="ml-1.5 bg-amber-500/10 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded text-[10px] font-bold">
                              +{noteItems.length - 1} more
                            </span>
                          ) : (
                            <span className="block text-[10px] text-ink-400 font-mono">{first.barcode}</span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-sans text-ink-600 dark:text-ink-300 text-[11px]">{d.supplierName}</td>
                        <td className="py-3 px-3 text-ink-500">{new Date(d.date).toLocaleDateString('en-IN')}</td>
                        <td className="py-3 px-2 text-center font-bold">{d.qty}</td>
                        <td className="py-3 px-3 text-right font-bold text-ink-900 dark:text-ink-100">
                          {formatCurrency(d.total)}
                        </td>
                        <td className="py-3 px-3 text-right text-amber-600">{formatCurrency(d.gst)}</td>
                        <td className="py-3 px-3 font-sans">
                          <span className="bg-ink-100 dark:bg-ink-800 text-ink-700 dark:text-ink-200 px-2 py-0.5 rounded-full text-[10.5px] font-semibold print:bg-transparent print:px-0">
                            {d.reason}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right no-print">
                          <div className="inline-flex items-center gap-1.5 font-sans">
                            <button
                              onClick={() => setPrintNote(d)}
                              className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-all"
                              title="Print this debit note"
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
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* MODAL: New Debit Note (multi-item, scan-friendly) */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/70 backdrop-blur-sm animate-fade-in no-print">
          <div className="bg-white dark:bg-ink-900 rounded-2xl border border-ink-200 dark:border-ink-800 shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-ink-100 dark:border-ink-800 flex items-center justify-between">
              <h3 className="font-semibold text-ink-900 dark:text-ink-100 text-sm flex items-center gap-2">
                <Undo2 size={16} className="text-amber-500" />
                New Debit Note (Supplier Return)
              </h3>
              <button onClick={closeModal} className="text-ink-400 hover:text-ink-600">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
              {/* Supplier + Reason (poore note ke liye ek baar) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Supplier / Vendor name</label>
                  <input
                    ref={supplierRef}
                    type="text"
                    value={supplierName}
                    onChange={e => { setSupplierName(e.target.value); setSupplierError(''); }}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); barcodeRef.current?.focus(); } }}
                    placeholder="e.g. XYZ Textiles"
                    className="input"
                    autoFocus
                  />
                  {supplierError && <p className="text-[11px] text-rose-600 font-semibold mt-1">{supplierError}</p>}
                </div>
                <div>
                  <label className="label">Reason for return</label>
                  <select value={reason} onChange={e => setReason(e.target.value)} className="input text-xs">
                    {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>

              {/* Scan / search */}
              <div>
                <label className="label">Scan barcode or search item (Enter dabao)</label>
                <div className="relative">
                  <ScanBarcode size={15} className="absolute left-3 top-2.5 text-ink-400" />
                  <input
                    ref={barcodeRef}
                    type="text"
                    value={productQuery}
                    onChange={e => setProductQuery(e.target.value)}
                    onKeyDown={handleBarcodeKeyDown}
                    placeholder="Scan barcode ya item ka naam likho..."
                    className="input pl-9 font-mono"
                  />
                </div>

                {productResults.length > 0 && (
                  <div className="mt-2 border border-ink-200 dark:border-ink-700 rounded-xl max-h-48 overflow-y-auto divide-y divide-ink-100 dark:divide-ink-800">
                    {productResults.map(p => (
                      <button
                        key={p._id}
                        type="button"
                        onClick={() => addProduct(p)}
                        className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-amber-500/10 transition-colors"
                      >
                        <div>
                          <p className="text-xs font-semibold text-ink-900 dark:text-ink-100">
                            {p.name} · {p.size} · {p.color}
                            {p.brand ? <span className="ml-1.5 text-amber-600">{p.brand}</span> : null}
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

              {/* Items list */}
              <div className="border border-ink-200 dark:border-ink-700 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-ink-50 dark:bg-ink-800/60 flex items-center justify-between">
                  <span className="text-xs font-bold text-ink-700 dark:text-ink-200">Items to return</span>
                  <span className="text-[11px] font-mono text-ink-500">
                    {totals.qty} pcs ({items.length} item{items.length === 1 ? '' : 's'})
                  </span>
                </div>

                {items.length === 0 ? (
                  <div className="py-8 text-center text-ink-400 text-xs">
                    Abhi koi item nahi. Upar barcode scan karo — har scan list mein add hoga.
                  </div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="text-ink-500 uppercase font-mono text-[10px] border-b border-ink-100 dark:border-ink-800">
                      <tr>
                        <th className="py-2 px-3">#</th>
                        <th className="py-2 px-3">Item</th>
                        <th className="py-2 px-2 text-center">Qty</th>
                        <th className="py-2 px-3 text-right">Rate</th>
                        <th className="py-2 px-3 text-right">Total</th>
                        <th className="py-2 px-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                      {items.map((it, idx) => {
                        const c = calcLine(it.product, it.qty);
                        const stock = Number(it.product.currentStock) || 0;
                        return (
                          <tr key={it.product._id}>
                            <td className="py-2.5 px-3 text-ink-400">{idx + 1}</td>
                            <td className="py-2.5 px-3">
                              <p className="font-semibold text-ink-900 dark:text-ink-100">{it.product.name}</p>
                              <p className="text-[10px] text-ink-400 font-mono">
                                {[it.product.size, it.product.color].filter(Boolean).join(' / ')}
                                {it.product.barcode ? ` · ${it.product.barcode}` : ''}
                              </p>
                              <p className={`text-[10px] font-semibold ${stock <= 5 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                Stock: {stock} {it.product.unit || 'pcs'}
                              </p>
                            </td>
                            <td className="py-2.5 px-2">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => bumpQty(idx, -1)}
                                  className="w-6 h-6 rounded bg-ink-100 dark:bg-ink-800 hover:bg-ink-200 flex items-center justify-center"
                                >
                                  <Minus size={12} />
                                </button>
                                <input
                                  type="number"
                                  min="1"
                                  max={stock}
                                  value={it.qty}
                                  onChange={e => setQtyDirect(idx, e.target.value)}
                                  className="w-12 text-center font-mono font-bold text-sm bg-transparent border border-ink-200 dark:border-ink-700 rounded py-0.5 focus:outline-hidden"
                                />
                                <button
                                  type="button"
                                  onClick={() => bumpQty(idx, 1)}
                                  className="w-6 h-6 rounded bg-ink-100 dark:bg-ink-800 hover:bg-ink-200 flex items-center justify-center"
                                >
                                  <Plus size={12} />
                                </button>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-ink-600 dark:text-ink-300">
                              {c.rate.toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-ink-900 dark:text-ink-100">
                              {c.total.toFixed(2)}
                            </td>
                            <td className="py-2.5 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => removeItem(idx)}
                                className="p-1 text-ink-400 hover:text-rose-600"
                                title="Remove"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Totals */}
              {items.length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 text-xs font-mono space-y-1">
                  <div className="flex justify-between text-ink-600 dark:text-ink-300">
                    <span className="flex items-center gap-1"><Package size={12} /> Taxable value</span>
                    <span>{formatCurrency(totals.base)}</span>
                  </div>
                  <div className="flex justify-between text-amber-700 dark:text-amber-400">
                    <span className="flex items-center gap-1"><Percent size={12} /> GST reversed</span>
                    <span>{formatCurrency(totals.gst)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-ink-900 dark:text-ink-100 pt-1.5 mt-1 border-t border-dashed border-amber-500/40">
                    <span className="flex items-center gap-1"><IndianRupee size={12} /> Debit note value</span>
                    <span>{formatCurrency(totals.total)}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 p-4 border-t border-ink-100 dark:border-ink-800">
              <button onClick={closeModal} className="btn-secondary text-xs">Cancel</button>
              <button onClick={handleSubmit} disabled={saving || items.length === 0} className="btn-primary text-xs">
                {saving ? 'Saving...' : `+ Create Debit Note${items.length ? ` (${items.length} item${items.length === 1 ? '' : 's'})` : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Print single debit note */}
      {printNote && (
        <DebitNoteReceiptModal note={printNote} onClose={() => setPrintNote(null)} />
      )}
    </div>
  );
}