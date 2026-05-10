import React, { useEffect, useState } from 'react';
import { useInvoices } from '../context/InvoiceContext';
import { formatCurrency } from '../utils/invoiceUtils';
import { Package, Download, Plus, X, History, AlertTriangle } from 'lucide-react';
import * as XLSX from 'xlsx';
import api from '../utils/api';
import toast from 'react-hot-toast';

export default function InventoryPage() {
  const { invoices, fetchInvoices } = useInvoices();
  const [allInvoices, setAllInvoices] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [activeTab, setActiveTab] = useState('stock'); // stock tab pehle

  // Product master state
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // Add product modal
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', hsn: '', unit: 'Nos', gstPct: 18, openingStock: 0 });
  const [savingProduct, setSavingProduct] = useState(false);

  // Add stock modal
  const [showAddStock, setShowAddStock] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [stockQty, setStockQty] = useState('');
  const [stockNote, setStockNote] = useState('');
  const [savingStock, setSavingStock] = useState(false);

  // Stock history modal
  const [showHistory, setShowHistory] = useState(false);
  const [historyProduct, setHistoryProduct] = useState(null);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    fetchInvoices({ limit: 1000, page: 1 });
    loadProducts();
  }, []);

  useEffect(() => { setAllInvoices(invoices); }, [invoices]);

  const loadProducts = async () => {
    try {
      setLoadingProducts(true);
      const res = await api.get('/products');
      setProducts(res.data);
    } catch (err) {
      toast.error('Products load nahi hue');
    } finally {
      setLoadingProducts(false);
    }
  };

  // Product banao
  const handleCreateProduct = async () => {
    if (!newProduct.name.trim()) return toast.error('Product name required');
    setSavingProduct(true);
    try {
      await api.post('/products', newProduct);
      toast.success('Product add ho gaya!');
      setShowAddProduct(false);
      setNewProduct({ name: '', hsn: '', unit: 'Nos', gstPct: 18, openingStock: 0 });
      loadProducts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error');
    } finally {
      setSavingProduct(false);
    }
  };

  // Stock add karo
  const handleAddStock = async () => {
    if (!stockQty || Number(stockQty) <= 0) return toast.error('Valid qty daalo');
    setSavingStock(true);
    try {
      await api.post(`/products/${selectedProduct._id}/add-stock`, {
        qty: Number(stockQty),
        note: stockNote || 'Stock purchased',
      });
      toast.success(`${stockQty} ${selectedProduct.unit} add ho gaya!`);
      setShowAddStock(false);
      setStockQty('');
      setStockNote('');
      setSelectedProduct(null);
      loadProducts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error');
    } finally {
      setSavingStock(false);
    }
  };

  // History dekho
  const handleViewHistory = async (product) => {
    setHistoryProduct(product);
    setShowHistory(true);
    setLoadingHistory(true);
    try {
      const res = await api.get(`/products/${product._id}/history`);
      setHistory(res.data);
    } catch (err) {
      toast.error('History load nahi hui');
    } finally {
      setLoadingHistory(false);
    }
  };

  // Product delete
  const handleDeleteProduct = async (product) => {
    if (!window.confirm(`"${product.name}" delete karna chahte ho?`)) return;
    try {
      await api.delete(`/products/${product._id}`);
      toast.success('Product delete ho gaya');
      loadProducts();
    } catch (err) {
      toast.error('Delete nahi hua');
    }
  };

  // Invoice filtered data (sales tab ke liye)
  const filtered = allInvoices.filter(inv => {
    if (!inv.invoiceDate) return false;
    const d = new Date(inv.invoiceDate);
    const monthMatch = selectedMonth ? (d.getMonth() + 1) === Number(selectedMonth) : true;
    const yearMatch = selectedYear ? d.getFullYear() === Number(selectedYear) : true;
    return monthMatch && yearMatch;
  });

  const itemWise = Object.values(
    filtered.reduce((acc, inv) => {
      (inv.items || []).forEach(item => {
        const key = item.name || 'Unknown';
        if (!acc[key]) acc[key] = {
          name: key, hsn: item.hsn || '-', uom: item.unit || 'Nos',
          gstPct: item.gstPct || 0, qtySold: 0, taxable: 0, totalGst: 0, grandTotal: 0,
        };
        const base = (Number(item.qty) || 0) * (Number(item.rate) || 0);
        const gst = (base * (Number(item.gstPct) || 0)) / 100;
        acc[key].qtySold += Number(item.qty) || 0;
        acc[key].taxable += base;
        acc[key].totalGst += gst;
        acc[key].grandTotal += base + gst;
      });
      return acc;
    }, {})
  ).sort((a, b) => b.qtySold - a.qtySold);

  const hsnWise = Object.values(
    filtered.reduce((acc, inv) => {
      (inv.items || []).forEach(item => {
        const key = item.hsn || 'NO_HSN';
        if (!acc[key]) acc[key] = {
          hsn: key === 'NO_HSN' ? '-' : key,
          description: item.name || '-',
          uom: item.unit || 'Nos',
          gstPct: item.gstPct || 0,
          qtySold: 0, taxable: 0, totalGst: 0, grandTotal: 0,
        };
        const base = (Number(item.qty) || 0) * (Number(item.rate) || 0);
        const gst = (base * (Number(item.gstPct) || 0)) / 100;
        acc[key].qtySold += Number(item.qty) || 0;
        acc[key].taxable += base;
        acc[key].totalGst += gst;
        acc[key].grandTotal += base + gst;
      });
      return acc;
    }, {})
  ).sort((a, b) => b.qtySold - a.qtySold);

  const totalSalesValue = itemWise.reduce((s, r) => s + r.grandTotal, 0);
  const totalQtySold = itemWise.reduce((s, r) => s + r.qtySold, 0);
  const totalTaxCollected = itemWise.reduce((s, r) => s + r.totalGst, 0);

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();
    // Stock sheet
    const stockRows = [['#', 'Product', 'HSN', 'Unit', 'GST%', 'Opening Stock', 'Current Stock']];
    products.forEach((p, i) => stockRows.push([i + 1, p.name, p.hsn || '-', p.unit, p.gstPct + '%', p.openingStock, p.currentStock]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(stockRows), 'Current Stock');
    // Sales sheets
    const itemRows = [['#', 'Item Name', 'HSN', 'UOM', 'GST%', 'Qty Sold', 'Taxable Amt', 'Total GST', 'Grand Total']];
    itemWise.forEach((r, i) => itemRows.push([i + 1, r.name, r.hsn, r.uom, r.gstPct + '%', r.qtySold, r.taxable, r.totalGst, r.grandTotal]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(itemRows), 'Item-wise Sales');
    XLSX.writeFile(wb, `Inventory_${selectedYear || 'All'}.xlsx`);
  };

  const months = [
    { value: '1', label: 'January' }, { value: '2', label: 'February' },
    { value: '3', label: 'March' }, { value: '4', label: 'April' },
    { value: '5', label: 'May' }, { value: '6', label: 'June' },
    { value: '7', label: 'July' }, { value: '8', label: 'August' },
    { value: '9', label: 'September' }, { value: '10', label: 'October' },
    { value: '11', label: 'November' }, { value: '12', label: 'December' },
  ];
  const years = ['2023', '2024', '2025', '2026'];

  const thS = (right = false) => ({ padding: '10px 12px', textAlign: right ? 'right' : 'left', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'white', whiteSpace: 'nowrap', background: '#1c1c18' });
  const tdS = (right = false) => ({ padding: '9px 12px', fontSize: '12.5px', textAlign: right ? 'right' : 'left', borderBottom: '1px solid #e8e8e0', fontFamily: right ? 'monospace' : 'inherit' });

  const tabs = [
    { key: 'stock', label: '📦 Current Stock' },
    { key: 'item', label: 'Item-wise Sales' },
    { key: 'hsn', label: 'HSN-wise Sales' },
  ];

  const lowStockProducts = products.filter(p => p.currentStock <= 5 && p.currentStock >= 0);

  return (
    <div className="max-w-7xl mx-auto animate-slide-up space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-800 dark:text-ink-100 flex items-center gap-2">
            <Package size={22} /> Inventory / Sales Report
          </h1>
          <p className="text-sm text-ink-400 mt-1">Stock manage karo aur sales dekho</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowAddProduct(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: '#1c1c18', color: 'white', border: 'none', cursor: 'pointer' }}>
            <Plus size={15} /> Add Product
          </button>
          <button onClick={exportToExcel}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: '#16a34a', color: 'white', border: 'none', cursor: 'pointer' }}>
            <Download size={16} /> Export Excel
          </button>
        </div>
      </div>

      {/* Low Stock Alert */}
      {lowStockProducts.length > 0 && (
        <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertTriangle size={18} color="#d97706" />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#92400e' }}>
            Low Stock Alert: {lowStockProducts.map(p => `${p.name} (${p.currentStock} ${p.unit})`).join(', ')}
          </span>
        </div>
      )}

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
        <div className="card p-5">
          <p className="text-sm text-ink-400 mb-1">Total Products</p>
          <p className="font-display text-2xl font-bold text-ink-800 dark:text-ink-100">{products.length}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-ink-400 mb-1">Total Sales Value</p>
          <p className="font-display text-2xl font-bold" style={{ color: '#2563eb' }}>{formatCurrency(totalSalesValue)}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-ink-400 mb-1">Total Tax Collected</p>
          <p className="font-display text-2xl font-bold" style={{ color: '#d97706' }}>{formatCurrency(totalTaxCollected)}</p>
        </div>
      </div>

      {/* Filters — sirf sales tabs ke liye */}
      {activeTab !== 'stock' && (
        <div className="card p-4 flex gap-4 items-center">
          <div>
            <label className="label">Month</label>
            <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="input w-40">
              <option value="">All Months</option>
              {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Year</label>
            <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} className="input w-32">
              <option value="">All Years</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="ml-auto text-sm text-ink-400">
            Showing <strong className="text-ink-700 dark:text-ink-200">{filtered.length}</strong> invoices
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-ink-100 dark:border-ink-800">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all ${activeTab === tab.key ? 'border-ink-800 dark:border-amber-500 text-ink-800 dark:text-amber-400' : 'border-transparent text-ink-400 hover:text-ink-600'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">

        {/* ✅ Current Stock Tab */}
        {activeTab === 'stock' && (
          <div className="overflow-x-auto">
            {loadingProducts ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>Loading...</div>
            ) : products.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>
                <p style={{ fontSize: 15, marginBottom: 8 }}>Koi product nahi hai abhi</p>
                <p style={{ fontSize: 13 }}>Upar "Add Product" se product add karo</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>
                  {['#', 'Product Name', 'HSN', 'Unit', 'GST%', 'Opening Stock', 'Current Stock', 'Actions'].map((h, i) => (
                    <th key={i} style={thS(i >= 5)}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {products.map((p, i) => (
                    <tr key={p._id} style={{ background: i % 2 === 0 ? 'white' : '#f4f4f0' }}>
                      <td style={tdS()}>{i + 1}</td>
                      <td style={{ ...tdS(), fontWeight: '600' }}>{p.name}</td>
                      <td style={{ ...tdS(), fontFamily: 'monospace', color: '#6e6e60' }}>{p.hsn || '-'}</td>
                      <td style={tdS()}>{p.unit}</td>
                      <td style={{ ...tdS(true) }}>{p.gstPct}%</td>
                      <td style={{ ...tdS(true), color: '#6e6e60' }}>{p.openingStock}</td>
                      <td style={{ ...tdS(true), fontWeight: '700', color: p.currentStock <= 5 ? '#dc2626' : p.currentStock <= 20 ? '#d97706' : '#16a34a' }}>
                        {p.currentStock} {p.currentStock <= 5 && '⚠️'}
                      </td>
                      <td style={{ ...tdS(), display: 'flex', gap: 6 }}>
                        <button onClick={() => { setSelectedProduct(p); setShowAddStock(true); }}
                          style={{ padding: '4px 10px', borderRadius: 6, background: '#1c1c18', color: 'white', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                          + Stock
                        </button>
                        <button onClick={() => handleViewHistory(p)}
                          style={{ padding: '4px 10px', borderRadius: 6, background: '#e8e8e0', color: '#1c1c18', border: 'none', cursor: 'pointer', fontSize: 12 }}>
                          <History size={12} />
                        </button>
                        <button onClick={() => handleDeleteProduct(p)}
                          style={{ padding: '4px 10px', borderRadius: 6, background: '#fee2e2', color: '#dc2626', border: 'none', cursor: 'pointer', fontSize: 12 }}>
                          <X size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Item-wise Sales */}
        {activeTab === 'item' && (
          <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                {['#', 'Item Name', 'HSN', 'UOM', 'GST %', 'Qty Sold', 'Taxable Amt', 'Total GST', 'Grand Total'].map((h, i) => (
                  <th key={i} style={thS(i >= 4)}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {itemWise.length === 0
                  ? <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: '#888' }}>No data</td></tr>
                  : itemWise.map((row, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? 'white' : '#f4f4f0' }}>
                      <td style={tdS()}>{i + 1}</td>
                      <td style={{ ...tdS(), fontWeight: '500' }}>{row.name}</td>
                      <td style={{ ...tdS(), fontFamily: 'monospace', color: '#6e6e60' }}>{row.hsn}</td>
                      <td style={tdS()}>{row.uom}</td>
                      <td style={{ ...tdS(true), fontWeight: '600' }}>{row.gstPct}%</td>
                      <td style={{ ...tdS(true), color: '#2563eb', fontWeight: '700' }}>{row.qtySold}</td>
                      <td style={tdS(true)}>{formatCurrency(row.taxable)}</td>
                      <td style={{ ...tdS(true), color: '#d97706' }}>{formatCurrency(row.totalGst)}</td>
                      <td style={{ ...tdS(true), fontWeight: '700' }}>{formatCurrency(row.grandTotal)}</td>
                    </tr>
                  ))}
              </tbody>
              {itemWise.length > 0 && <tfoot><tr style={{ background: '#1c1c18', color: 'white' }}>
                <td colSpan={5} style={{ padding: '10px 12px', fontWeight: '700', fontSize: '12px' }}>TOTAL</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '700' }}>{totalQtySold}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '700' }}>{formatCurrency(itemWise.reduce((s, r) => s + r.taxable, 0))}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '700' }}>{formatCurrency(totalTaxCollected)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '700' }}>{formatCurrency(totalSalesValue)}</td>
              </tr></tfoot>}
            </table>
          </div>
        )}

        {/* HSN-wise Sales */}
        {activeTab === 'hsn' && (
          <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                {['#', 'HSN/SAC', 'Description', 'UOM', 'GST %', 'Qty Sold', 'Taxable Amt', 'Total GST', 'Grand Total'].map((h, i) => (
                  <th key={i} style={thS(i >= 4)}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {hsnWise.length === 0
                  ? <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: '#888' }}>No data</td></tr>
                  : hsnWise.map((row, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? 'white' : '#f4f4f0' }}>
                      <td style={tdS()}>{i + 1}</td>
                      <td style={{ ...tdS(), fontFamily: 'monospace', fontWeight: '700', color: '#1c1c18' }}>{row.hsn === '-' ? 'No HSN' : row.hsn}</td>
                      <td style={tdS()}>{row.description}</td>
                      <td style={tdS()}>{row.uom}</td>
                      <td style={{ ...tdS(true), fontWeight: '600' }}>{row.gstPct}%</td>
                      <td style={{ ...tdS(true), color: '#2563eb', fontWeight: '700' }}>{row.qtySold}</td>
                      <td style={tdS(true)}>{formatCurrency(row.taxable)}</td>
                      <td style={{ ...tdS(true), color: '#d97706' }}>{formatCurrency(row.totalGst)}</td>
                      <td style={{ ...tdS(true), fontWeight: '700' }}>{formatCurrency(row.grandTotal)}</td>
                    </tr>
                  ))}
              </tbody>
              {hsnWise.length > 0 && <tfoot><tr style={{ background: '#1c1c18', color: 'white' }}>
                <td colSpan={5} style={{ padding: '10px 12px', fontWeight: '700', fontSize: '12px' }}>TOTAL</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '700' }}>{hsnWise.reduce((s, r) => s + r.qtySold, 0)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '700' }}>{formatCurrency(hsnWise.reduce((s, r) => s + r.taxable, 0))}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '700' }}>{formatCurrency(hsnWise.reduce((s, r) => s + r.totalGst, 0))}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '700' }}>{formatCurrency(hsnWise.reduce((s, r) => s + r.grandTotal, 0))}</td>
              </tr></tfoot>}
            </table>
          </div>
        )}
      </div>

      {/* ✅ Add Product Modal */}
      {showAddProduct && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: 16, padding: 28, width: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Naya Product Add Karo</h3>
              <button onClick={() => setShowAddProduct(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="label">Product Name *</label>
                <input value={newProduct.name} onChange={e => setNewProduct(p => ({ ...p, name: e.target.value }))} className="input" placeholder="e.g. Cement" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="label">HSN Code</label>
                  <input value={newProduct.hsn} onChange={e => setNewProduct(p => ({ ...p, hsn: e.target.value }))} className="input" placeholder="e.g. 9954" />
                </div>
                <div>
                  <label className="label">Unit</label>
                  <input value={newProduct.unit} onChange={e => setNewProduct(p => ({ ...p, unit: e.target.value }))} className="input" list="unit-opts" placeholder="Nos" />
                  <datalist id="unit-opts">
                    {['Nos', 'Kg', 'Bags', 'Ltr', 'Mtr', 'Box', 'Pcs', 'MT', 'Rm'].map(u => <option key={u} value={u} />)}
                  </datalist>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="label">GST %</label>
                  <input type="number" value={newProduct.gstPct} onChange={e => setNewProduct(p => ({ ...p, gstPct: Number(e.target.value) }))} className="input" />
                </div>
                <div>
                  <label className="label">Opening Stock</label>
                  <input type="number" value={newProduct.openingStock} onChange={e => setNewProduct(p => ({ ...p, openingStock: Number(e.target.value) }))} className="input" placeholder="0" />
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowAddProduct(false)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
              <button onClick={handleCreateProduct} disabled={savingProduct} className="btn-primary" style={{ flex: 1 }}>
                {savingProduct ? 'Saving...' : 'Add Product'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ Add Stock Modal */}
      {showAddStock && selectedProduct && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: 16, padding: 28, width: 360, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Stock Add Karo</h3>
              <button onClick={() => setShowAddStock(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <p style={{ fontSize: 13, color: '#6e6e60', marginBottom: 16 }}>
              <strong>{selectedProduct.name}</strong> — Current Stock: <strong style={{ color: '#1c1c18' }}>{selectedProduct.currentStock} {selectedProduct.unit}</strong>
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="label">Kitna aaya? ({selectedProduct.unit})</label>
                <input type="number" value={stockQty} onChange={e => setStockQty(e.target.value)} className="input" placeholder="e.g. 100" autoFocus />
              </div>
              <div>
                <label className="label">Note (optional)</label>
                <input value={stockNote} onChange={e => setStockNote(e.target.value)} className="input" placeholder="e.g. Supplier se aaya" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowAddStock(false)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
              <button onClick={handleAddStock} disabled={savingStock} className="btn-primary" style={{ flex: 1 }}>
                {savingStock ? 'Saving...' : '+ Add Stock'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ Stock History Modal */}
      {showHistory && historyProduct && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: 16, padding: 28, width: 500, maxHeight: '80vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{historyProduct.name} — Stock History</h3>
              <button onClick={() => setShowHistory(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            {loadingHistory ? (
              <div style={{ textAlign: 'center', padding: 30, color: '#888' }}>Loading...</div>
            ) : history.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 30, color: '#888' }}>Koi history nahi</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ background: '#1c1c18' }}>
                  {['Date', 'Type', 'Qty', 'Note'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', color: 'white', fontSize: 11, fontWeight: 700, textAlign: 'left' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {history.map((h, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? 'white' : '#f4f4f0' }}>
                      <td style={{ padding: '8px 12px', fontSize: 12 }}>{new Date(h.date).toLocaleDateString('en-IN')}</td>
                      <td style={{ padding: '8px 12px', fontSize: 12 }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: 4, fontWeight: 600, fontSize: 11,
                          background: h.type === 'SALE' ? '#fee2e2' : h.type === 'PURCHASE' ? '#dcfce7' : '#e0f2fe',
                          color: h.type === 'SALE' ? '#dc2626' : h.type === 'PURCHASE' ? '#16a34a' : '#0284c7'
                        }}>
                          {h.type}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', fontSize: 12, fontWeight: 700, color: h.qty < 0 ? '#dc2626' : '#16a34a' }}>
                        {h.qty > 0 ? '+' : ''}{h.qty}
                      </td>
                      <td style={{ padding: '8px 12px', fontSize: 12, color: '#6e6e60' }}>{h.note || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

    </div>
  );
}