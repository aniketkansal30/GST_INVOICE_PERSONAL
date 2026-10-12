import React, { useEffect, useState, useCallback , useMemo} from 'react';
import { useNavigate } from 'react-router-dom';
import { useInvoices } from '../context/InvoiceContext';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatDate, DEFAULT_STORE_DETAILS } from '../utils/invoiceUtils';
import {
  Plus, Search, Eye, Edit2, Trash2, Copy, FileText,
  ChevronLeft, ChevronRight, TrendingUp, IndianRupee, Clock, CheckCircle,
  Scan, Printer, ShoppingBag, ArrowRight, Lock, X, Download
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import ThermalReceiptModal from '../components/POS/ThermalReceiptModal';
import DateRangeFilter from '../components/DateRangeFilter';
import { filterByDateRange } from '../utils/dateRangeUtils';
import { exportStyledExcel } from '../utils/excelExport';


const StatusBadge = ({ status }) => {
  const styles = {
    draft: 'bg-ink-100 dark:bg-ink-800 text-ink-500 dark:text-ink-400',
    sent: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    paid: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
    overdue: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
    partial: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${styles[status] || styles.draft}`}>
      {status || 'draft'}
    </span>
  );
};

// Same manager PIN used everywhere Edit/Delete can be triggered from.
const DEFAULT_MANAGER_PIN = '1234';
const getManagerPin = () => localStorage.getItem('pos_manager_pin') || DEFAULT_MANAGER_PIN;

export default function DashboardPage() {
  const { deleteInvoice, duplicateInvoice, updateInvoice } = useInvoices();
    const { user } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState(null);

  // ── Stats cards (Total Revenue / Paid Bills / Pending-Drafts) must reflect
  // ALL invoices, not just the current paginated page shown in the table
  // below. Fetched separately so it isn't tied to page/search state. ──
  const [dateFilter, setDateFilter] = useState({ preset: 'all_time', customFrom: '', customTo: '' });

// Ek hi source of truth — search se filtered saare invoices (backend se), phir
// date range aur pagination dono isi list pe client-side lagenge, taaki
// stats aur table hamesha ek doosre se match karein.
const [allInvoices, setAllInvoices] = useState([]);
const [loadingAll, setLoadingAll] = useState(true);

// Export ke liye product master (stock, brand, barcode etc.)
const [products, setProducts] = useState([]);
useEffect(() => {
  api.get('/products').then(r => setProducts(r.data || [])).catch(() => {});
}, []);

const loadAllInvoices = useCallback(async () => {
  setLoadingAll(true);
  try {
    const res = await api.get('/invoices', { params: { search, limit: 10000 } });
    setAllInvoices(res.data.invoices || []);
  } catch (err) {
    toast.error('Failed to load invoices');
  } finally {
    setLoadingAll(false);
  }
}, [search]);

useEffect(() => { loadAllInvoices(); }, [loadAllInvoices]);

// Search ya date filter badalne par page 1 pe reset karo
useEffect(() => { setPage(1); }, [search, dateFilter]);

const dateFilteredInvoices = useMemo(
  () => filterByDateRange(allInvoices, 'invoiceDate', dateFilter.preset, dateFilter.customFrom, dateFilter.customTo),
  [allInvoices, dateFilter]
);

const pageSize = 10;
const totalFiltered = dateFilteredInvoices.length;
const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
const pagedInvoices = dateFilteredInvoices.slice((page - 1) * pageSize, page * pageSize);

const allStats = useMemo(() => ({
  totalAmount: dateFilteredInvoices.reduce((s, inv) => s + (inv.grandTotal || 0), 0),
  paidCount: dateFilteredInvoices.filter(i => i.status === 'paid').length,
  draftCount: dateFilteredInvoices.filter(i => i.status === 'draft' || !i.status).length,
  totalCount: totalFiltered,
}), [dateFilteredInvoices, totalFiltered]);

  // Thermal Receipt Modal State — used for Print, View (read-only) and Edit (editable)
  const [receiptInvoice, setReceiptInvoice] = useState(null);
  const [receiptMode, setReceiptMode] = useState('view'); // 'view' | 'edit'

  // ── Password gate for Edit / Delete actions ──
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [pendingAction, setPendingAction] = useState(null); // { type: 'edit' | 'delete', id }


  const handleDelete = async (id) => {
    setDeleting(id);
    try {
      await deleteInvoice(id);
      loadAllInvoices();
    } finally {
      setDeleting(null);
    }
  };

  const handleDuplicate = async (id) => {
    try {
      const dup = await duplicateInvoice(id);
      toast.success('Invoice duplicated');
      loadAllInvoices();  
    } catch {
      toast.error('Failed to duplicate');
    }
  };

  const requestAction = (type, id) => {
    setPendingAction({ type, id });
    setPinInput('');
    setPinError('');
    setShowPinModal(true);
  };
  const closePinModal = () => {
    setShowPinModal(false);
    setPendingAction(null);
    setPinInput('');
    setPinError('');
  };
  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (pinInput !== getManagerPin()) {
      setPinError('Galat password! Dobara try karein.');
      setPinInput('');
      return;
    }
    const action = pendingAction;
    closePinModal();
    if (!action) return;
    if (action.type === 'edit') {
      const inv =allInvoices.find((i) => i._id === action.id);
      if (!inv) return toast.error('Invoice not found');
      setReceiptInvoice(inv);
      setReceiptMode('edit');
    } else if (action.type === 'delete') {
      handleDelete(action.id);
    }
  };

  // Called by ThermalReceiptModal's "Save Changes" button in edit mode.
  const handleSaveEditedInvoice = async (id, payload) => {
    try {
      await updateInvoice(id, payload);
      setReceiptInvoice(null);
      setReceiptMode('view');
      loadAllInvoices(); 
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update bill');
    }
  };

  const openView = (inv) => {
    setReceiptInvoice(inv);
    setReceiptMode('view');
  };

  // ── Full Stock + Sales report: ek sheet, party ke sample jaisa ──
  const exportFullReport = async () => {
    if (products.length === 0) return toast.error('Products load nahi hue, thodi der baad try karo');

    const up = (v) => String(v || '').trim().toUpperCase();
    const storeName = DEFAULT_STORE_DETAILS.companyName || user?.companyName || '';

    const pById = new Map(products.map(p => [String(p._id), p]));
    const pByBarcode = new Map(
      products.filter(p => p.barcode && p.barcode.trim()).map(p => [p.barcode.trim(), p])
    );

    // Dashboard ke date filter ke andar ke invoices se har item ki sale nikalo
    const sold = {};
    dateFilteredInvoices.forEach(inv => {
      (inv.items || []).forEach(item => {
        const p =
          (item.productId && pById.get(String(item.productId))) ||
          (item.barcode && pByBarcode.get(String(item.barcode).trim())) ||
          null;
        const key = p ? `p_${p._id}` : `o_${item.barcode || item.name || ''}`;
        if (!sold[key]) sold[key] = { qty: 0, value: 0, invs: new Set(), item: p ? null : item };
        const qty = Number(item.qty) || 0;
        sold[key].qty += qty;
        sold[key].value += qty * (Number(item.rate) || 0) - (Number(item.discountAmount) || 0);
        if (inv.invoiceNumber) sold[key].invs.add(inv.invoiceNumber);
      });
    });

    const columns = [
      // ── Party ke sample ke 21 columns (same order) ──
      { header: 'SNO.', key: 'sno', width: 7 },
      { header: 'Store Name', key: 'storeName', width: 28 },
      { header: 'Brand Name', key: 'brand', width: 18 },
      { header: 'SUB CATEGORY.', key: 'subCategory', width: 20 },
      { header: 'GENDER.', key: 'gender', width: 10 },
      { header: 'CATEGORY.', key: 'category', width: 14 },
      { header: 'GST.', key: 'gst', width: 8 },
      { header: 'SEASON.', key: 'season', width: 10 },
      { header: 'GODOWN NAME', key: 'godown', width: 14 },
      { header: 'LOT CODE', key: 'lotCode', width: 12 },
      { header: 'HSN CODE', key: 'hsn', width: 12, format: 'text' },
      { header: 'Barcode', key: 'barcode', width: 18, format: 'text' },
      { header: 'Item', key: 'item', width: 24 },
      { header: 'UOM', key: 'uom', width: 8 },
      { header: 'Size', key: 'size', width: 8 },
      { header: 'Color', key: 'color', width: 14 },
      { header: 'Item Desc.', key: 'itemDesc', width: 16 },
      { header: 'BASIC RATE', key: 'basicRate', width: 12, format: 'currency' },
      { header: 'M.R.P', key: 'mrp', width: 12, format: 'currency' },
      { header: 'Cl. Stock Value(MRP)', key: 'stockValue', width: 20, format: 'currency' },
      { header: 'Closing Stock Qty', key: 'closingQty', width: 16, format: 'number' },
      // ── Invoice / sales details (extra, right side mein) ──
      { header: 'Opening Stock Qty', key: 'openingQty', width: 16, format: 'number' },
      { header: 'Sold Qty', key: 'soldQty', width: 10, format: 'number' },
      { header: 'Sale Value', key: 'saleValue', width: 14, format: 'currency' },
      { header: 'Bills', key: 'bills', width: 8, format: 'number' },
      { header: 'Invoice Nos', key: 'invoiceNos', width: 30, format: 'text' },
    ];

    const salesCols = (s) => ({
      soldQty: s ? s.qty : 0,
      saleValue: s ? s.value : 0,
      bills: s ? s.invs.size : 0,
      invoiceNos: s ? [...s.invs].join(', ') : '',
    });

    // Brand → category → naam ke order mein, sample jaisa
    const sorted = [...products].sort((a, b) =>
      up(a.brand).localeCompare(up(b.brand)) ||
      up(a.category).localeCompare(up(b.category)) ||
      String(a.name || '').localeCompare(String(b.name || ''))
    );

    const rows = sorted.map(p => ({
      storeName,
      brand: up(p.brand),
      subCategory: up(p.category),
      gender: '',
      category: 'APPARELS',
      gst: `${Number(p.gstPct) || 0}%`,
      season: '',
      godown: '',
      lotCode: '',
      hsn: String(p.hsn || ''),
      barcode: String(p.barcode || ''),
      item: p.name || '',
      uom: 'PCS',
      size: p.size || '',
      color: p.color || '',
      itemDesc: '',
      basicRate: Number(p.sellingPrice) || 0,
      mrp: Number(p.sellingPrice) || 0,
      stockValue: (Number(p.currentStock) || 0) * (Number(p.sellingPrice) || 0),
      closingQty: Number(p.currentStock) || 0,
      openingQty: Number(p.openingStock) || 0,
      ...salesCols(sold[`p_${p._id}`]),
    }));

    // Jin items ka product ab delete ho chuka hai par invoice mein bik chuke hain
    Object.entries(sold).forEach(([key, s]) => {
      if (!key.startsWith('o_') || !s.item) return;
      const it = s.item;
      rows.push({
        storeName,
        brand: up(it.brand),
        subCategory: '',
        gender: '',
        category: 'APPARELS',
        gst: `${Number(it.gstPct) || 0}%`,
        season: '',
        godown: '',
        lotCode: '',
        hsn: String(it.hsn || ''),
        barcode: String(it.barcode || ''),
        item: it.name || '',
        uom: 'PCS',
        size: it.size || '',
        color: it.color || '',
        itemDesc: '',
        basicRate: Number(it.rate) || 0,
        mrp: Number(it.rate) || 0,
        stockValue: 0,
        closingQty: 0,
        openingQty: 0,
        ...salesCols(s),
      });
    });

    rows.forEach((r, i) => { r.sno = String(i + 1); });

    const today = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
    await exportStyledExcel(
      [{ name: 'Report', columns, rows }],
      `Stock_Sales_Report_${today}.xlsx`
    );
    toast.success('Report exported to Excel!');
  };

  const stats = [
    { label: 'Total Invoices & Bills', value: allStats.totalCount, icon: FileText, color: 'bg-ink-800 dark:bg-amber-500' },
    { label: 'Total Revenue', value: formatCurrency(allStats.totalAmount), icon: IndianRupee, color: 'bg-emerald-600' },
    { label: 'Paid Bills', value: allStats.paidCount, icon: CheckCircle, color: 'bg-blue-600' },
    { label: 'Pending / Drafts', value: allStats.draftCount, icon: Clock, color: 'bg-amber-500' },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-slide-up">
      {/* Top Banner / Store Header */}
      <div className="bg-linear-to-r from-ink-900 via-ink-800 to-ink-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-mono font-semibold mb-1">
            <ShoppingBag size={14} /> CLOTHING SHOP POS SYSTEM
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
            {user?.companyName || DEFAULT_STORE_DETAILS.companyName}
          </h1>
          <p className="text-ink-300 text-xs sm:text-sm font-mono flex items-center gap-2 flex-wrap">
            <span>Owner: {user?.name || DEFAULT_STORE_DETAILS.companyName}</span>
            <span>·</span>
            <span>GSTIN: {user?.gstNumber || DEFAULT_STORE_DETAILS.gstNumber}</span>
            <span>·</span>
            
            <span>·</span>
            <span>Ph: {user?.contact || DEFAULT_STORE_DETAILS.contact}</span>
            <span>·</span>
            <span>{user?.state || DEFAULT_STORE_DETAILS.state}</span>
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={() => navigate('/pos')}
            className="flex-1 md:flex-none btn-primary py-3.5 px-6 text-sm font-bold bg-amber-500 hover:bg-amber-400 text-ink-950 flex items-center justify-center gap-2.5 rounded-xl shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
          >
            <Scan size={18} />
            <span>Open POS Counter (F2)</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center`}>
                <Icon size={15} className="text-white" />
              </div>
            </div>
            <p className="text-2xl font-bold text-ink-800 dark:text-ink-100 font-mono">
              {loadingAll ? '—' : value}
            </p>
            <p className="text-xs text-ink-500 dark:text-ink-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Invoices table */}
      <div className="card overflow-hidden">
        {/* Table header */}
        <div className="px-6 py-4 border-b border-ink-100 dark:border-ink-800 flex items-center justify-between gap-4 flex-wrap">
          <div className="relative flex-1 max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by client or bill #..."
              className="input pl-9 h-9 text-xs"
            />
          </div>
          
          <div className="flex items-center gap-3">
          <DateRangeFilter {...dateFilter} onChange={setDateFilter} />
            <p className="text-xs text-ink-400 dark:text-ink-500 font-mono">{totalFiltered} total bills</p>
            <button
              onClick={exportFullReport}
              className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400"
              title="Stock + Sales report (Excel)"
            >
              <Download size={14} /> Export Excel
            </button>
            <button onClick={() => navigate('/pos')} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1">
              <Plus size={14} /> New POS Bill
            </button>
          </div>
        </div>

        {/* Table */}
        {loadingAll? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-ink-800 dark:border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : pagedInvoices.length=== 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-ink-100 dark:bg-ink-800 flex items-center justify-center">
              <FileText size={28} className="text-ink-300 dark:text-ink-600" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-ink-600 dark:text-ink-300">No bills generated yet</p>
              <p className="text-sm text-ink-400 mt-1">Open the POS Billing counter to scan your first clothing item</p>
            </div>
            <button onClick={() => navigate('/pos')} className="btn-primary">
              <Scan size={16} /> Open POS Counter
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-ink-50 dark:bg-ink-800/50">
                <tr className="border-b border-ink-100 dark:border-ink-800 text-left">
                  {['Invoice No.', 'Customer Name', 'Date', 'Items Count', 'Amount (₹)', 'Status', 'Actions'].map((h, i) => (
                    <th key={h} className={`px-6 py-3 text-xs font-bold uppercase tracking-wider text-ink-400 dark:text-ink-500 ${i === 4 ? 'text-right' : ''}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-50 dark:divide-ink-800">
                {pagedInvoices.map((inv) => {
                  const itemsCount = (inv.items || []).reduce((s, i) => s + (Number(i.qty) || 1), 0);
                  return (
                    <tr key={inv._id} className="hover:bg-ink-50 dark:hover:bg-ink-800/50 transition-colors group">
                      <td className="px-6 py-4">
                        <span className="text-sm font-mono font-bold text-ink-900 dark:text-ink-100">{inv.invoiceNumber}</span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-ink-800 dark:text-ink-100">{inv.buyer?.clientName || ''}</p>
                        <p className="text-[11px] text-ink-400 font-mono">{inv.buyer?.contact || inv.buyer?.state || 'POS Counter'}</p>
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-ink-500 dark:text-ink-400">{formatDate(inv.invoiceDate)}</td>
                      <td className="px-6 py-4 text-xs font-mono text-ink-600 dark:text-ink-300">
                        {itemsCount} pcs ({(inv.items || []).length} lines)
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-sm font-bold text-ink-900 dark:text-ink-100 font-mono">{formatCurrency(inv.grandTotal)}</span>
                      </td>
                      <td className="px-6 py-4"><StatusBadge status={inv.status} /></td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          {/* Thermal Print / View Receipt button */}
                          <button
                            onClick={() => openView(inv)}
                            className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-all font-semibold text-xs flex items-center gap-1"
                            title="Thermal Print Receipt"
                          >
                            <Printer size={14} />
                          </button>
                          
                          <button onClick={() => openView(inv)}
                            className="p-1.5 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-700 text-ink-400 hover:text-ink-700 dark:hover:text-ink-200 transition-all" title="View Bill">
                            <Eye size={15} />
                          </button>
                          <button onClick={() => requestAction('edit', inv._id)}
                            className="p-1.5 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-700 text-ink-400 hover:text-ink-700 dark:hover:text-ink-200 transition-all" title="Edit (password protected)">
                            <Edit2 size={15} />
                          </button>
                          <button onClick={() => handleDuplicate(inv._id)}
                            className="p-1.5 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-700 text-ink-400 hover:text-ink-700 dark:hover:text-ink-200 transition-all" title="Duplicate">
                            <Copy size={15} />
                          </button>
                          <button onClick={() => requestAction('delete', inv._id)} disabled={deleting === inv._id}
                            className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-ink-400 hover:text-red-600 transition-all" title="Delete (password protected)">
                            {deleting === inv._id
                              ? <div className="w-3.5 h-3.5 border border-red-500 border-t-transparent rounded-full animate-spin" />
                              : <Trash2 size={15} />
                            }
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-ink-100 dark:border-ink-800 flex items-center justify-between">
            <p className="text-xs text-ink-400 font-mono">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="p-1.5 rounded-lg border border-ink-200 dark:border-ink-700 hover:bg-ink-50 dark:hover:bg-ink-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft size={15} />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
                className="p-1.5 rounded-lg border border-ink-200 dark:border-ink-700 hover:bg-ink-50 dark:hover:bg-ink-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Thermal Receipt Modal — Print / View (read-only) / Edit (editable + Save) */}
      {receiptInvoice && (
        <ThermalReceiptModal
          invoice={receiptInvoice}
          user={user}
          editable={receiptMode === 'edit'}
          onSave={handleSaveEditedInvoice}
          onClose={() => { setReceiptInvoice(null); setReceiptMode('view'); }}
        />
      )}

      {/* ── Password Gate Modal — shown before Edit / Delete runs ── */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/70 backdrop-blur-sm animate-fade-in no-print">
          <div className="bg-white dark:bg-ink-900 rounded-2xl border border-ink-200 dark:border-ink-800 shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="p-5 border-b border-ink-100 dark:border-ink-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <Lock size={17} />
                </div>
                <div>
                  <h3 className="font-semibold text-ink-900 dark:text-ink-100 text-sm">Password Required</h3>
                  <p className="text-xs text-ink-400">
                    {pendingAction?.type === 'delete' ? 'Invoice delete karne ke liye' : 'Invoice edit karne ke liye'}
                  </p>
                </div>
              </div>
              <button onClick={closePinModal} className="p-1.5 rounded-lg text-ink-400 hover:text-ink-700 dark:hover:text-ink-200 hover:bg-ink-100 dark:hover:bg-ink-800 transition-colors">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handlePinSubmit} className="p-5 space-y-3">
              <div>
                <label className="text-xs font-medium text-ink-500 dark:text-ink-400">Enter Password</label>
                <input
                  type="password"
                  autoFocus
                  value={pinInput}
                  onChange={(e) => { setPinInput(e.target.value); setPinError(''); }}
                  placeholder="••••"
                  className="input mt-1 font-mono tracking-widest text-center text-lg"
                />
                {pinError && (
                  <p className="text-xs text-red-500 font-semibold mt-1.5">{pinError}</p>
                )}
              </div>

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={closePinModal} className="btn-secondary flex-1 text-xs">
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`btn-primary flex-1 text-xs ${pendingAction?.type === 'delete' ? 'bg-red-600 hover:bg-red-500' : ''}`}
                >
                  Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}