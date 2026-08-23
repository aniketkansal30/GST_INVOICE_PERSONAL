import React, { useEffect, useState } from 'react';
import { useInvoices } from '../context/InvoiceContext';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, CLOTHING_SIZES, CLOTHING_CATEGORIES, COMMON_COLORS, DEFAULT_STORE_DETAILS } from '../utils/invoiceUtils';
import {
  Package, Download, Plus, X, History, AlertTriangle,
  Scan, Tag, Search, Edit2, Printer, Sparkles, Filter, Check, Upload
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useRef } from 'react'; // agar useRef already import nahi hai
import api from '../utils/api';
import toast from 'react-hot-toast';
import DateRangeFilter from '../components/DateRangeFilter';
import { filterByDateRange } from '../utils/dateRangeUtils';


export default function InventoryPage() {
  const { invoices, fetchInvoices } = useInvoices();
  const { user } = useAuth();
  const [allInvoices, setAllInvoices] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [dateFilter, setDateFilter] = useState({ preset: 'this_year', customFrom: '', customTo: '' });
  const [activeTab, setActiveTab] = useState('stock'); // 'stock', 'item', 'hsn'

  // Product master state
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [searchFilter, setSearchFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  

  // Add / Edit product modal
  const [showProductModal, setShowProductModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [productForm, setProductForm] = useState({
    name: '',
    barcode: '',
    size: 'M',
    color: 'Navy Blue',
    category: 'Shirts',
    hsn: '6205',
    unit: 'Pcs',
    sellingPrice: '',
    purchasePrice: '',
    gstPct: 5,
    openingStock: 10,
  });
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

  // Barcode Tag Generator modal
  const [showTagModal, setShowTagModal] = useState(false);
  const [tagProduct, setTagProduct] = useState(null);
  const [tagCount, setTagCount] = useState(6);

  const fileInputRef = useRef(null);
  const [importing, setImporting] = useState(false);
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
      toast.error('Failed to load products');
    } finally {
      setLoadingProducts(false);
    }
  };

  // Generate random clothing barcode
  const handleGenerateBarcode = () => {
    const randomCode = '890' + Math.floor(1000000000 + Math.random() * 9000000000);
    setProductForm(p => ({ ...p, barcode: randomCode }));
  };

  // Open modal for Create
  const handleOpenCreate = () => {
    setIsEditing(false);
    setEditingId(null);
    const randomCode = '890' + Math.floor(1000000000 + Math.random() * 9000000000);
    setProductForm({
      name: '',
      barcode: randomCode,
      size: 'M',
      color: 'Navy Blue',
      category: 'Shirts',
      hsn: '6205',
      unit: 'Pcs',
      sellingPrice: '',
      purchasePrice: '',
      gstPct: 5,
      openingStock: 20,
    });
    setShowProductModal(true);
  };

  // Open modal for Edit
  const handleOpenEdit = (p) => {
    setIsEditing(true);
    setEditingId(p._id);
    setProductForm({
      name: p.name || '',
      barcode: p.barcode || '',
      size: p.size || 'M',
      color: p.color || '',
      category: p.category || 'Shirts',
      hsn: p.hsn || '6205',
      unit: p.unit || 'Pcs',
      sellingPrice: p.sellingPrice || '',
      purchasePrice: p.purchasePrice || '',
      gstPct: p.gstPct !== undefined ? p.gstPct : 5,
      openingStock: p.openingStock || 0,
    });
    setShowProductModal(true);
  };

  // Save product (Create or Edit)
  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!productForm.name.trim()) return toast.error('Product name required');
    if (!productForm.sellingPrice || Number(productForm.sellingPrice) <= 0) {
      return toast.error('Valid selling price required');
    }

    setSavingProduct(true);
    try {
      const payload = {
        ...productForm,
        sellingPrice: Number(productForm.sellingPrice),
        purchasePrice: productForm.purchasePrice ? Number(productForm.purchasePrice) : 0,
        gstPct: Number(productForm.gstPct),
        openingStock: Number(productForm.openingStock) || 0,
      };

      if (isEditing) {
        await api.put(`/products/${editingId}`, payload);
        toast.success('Product updated successfully!');
      } else {
        await api.post('/products', payload);
        toast.success('Product added with barcode!');
      }

      setShowProductModal(false);
      loadProducts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error saving product');
    } finally {
      setSavingProduct(false);
    }
  };
  // Add stock
  const handleAddStock = async () => {
    if (!stockQty || Number(stockQty) <= 0) return toast.error('Please enter a valid quantity');
    setSavingStock(true);
    try {
      await api.post(`/products/${selectedProduct._id}/add-stock`, {
        qty: Number(stockQty),
        note: stockNote || 'Stock replenished',
      });
      toast.success(`${stockQty} ${selectedProduct.unit || 'pcs'} added to stock!`);
      setShowAddStock(false);
      setStockQty('');
      setStockNote('');
      setSelectedProduct(null);
      loadProducts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add stock');
    } finally {
      setSavingStock(false);
    }
  };

  // View history
  const handleViewHistory = async (product) => {
    setHistoryProduct(product);
    setShowHistory(true);
    setLoadingHistory(true);
    try {
      const res = await api.get(`/products/${product._id}/history`);
      setHistory(res.data);
    } catch (err) {
      toast.error('Failed to load stock history');
    } finally {
      setLoadingHistory(false);
    }
  };

  // Delete product
  const handleDeleteProduct = async (product) => {
    if (!window.confirm(`Delete "${product.name}" (${product.size || ''})?`)) return;
    try {
      await api.delete(`/products/${product._id}`);
      toast.success('Product deleted');
      loadProducts();
    } catch (err) {
      toast.error('Delete failed');
    }
  };

  // Filter products
  const filteredProductList = products.filter(p => {
    const q = searchFilter.toLowerCase();
    const matchesSearch = !searchFilter ||
      p.name?.toLowerCase().includes(q) ||
      p.barcode?.toLowerCase().includes(q) ||
      p.size?.toLowerCase().includes(q) ||
      p.color?.toLowerCase().includes(q);
    const matchesCategory = !categoryFilter || p.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Sales calculations for existing reports
  const filteredInvoices = filterByDateRange(allInvoices, 'invoiceDate', dateFilter.preset, dateFilter.customFrom, dateFilter.customTo);

  // NOTE: `item.rate` is the MRP (GST-inclusive) selling price per unit.
  // If the invoice item already has `baseAmount` / `gstAmount` saved (POS
  // billing now stores these using the reverse-GST split), we use those
  // directly. Otherwise we fall back to reverse-calculating them from the
  // MRP so old invoices without these fields still add up correctly.
  const itemWise = Object.values(
    filteredInvoices.reduce((acc, inv) => {
      (inv.items || []).forEach(item => {
        const key = item.name || 'Unknown';
        if (!acc[key]) acc[key] = {
          name: key, hsn: item.hsn || '6205', uom: item.unit || 'Pcs',
          size: item.size || '-',
          color: item.color || '-',
          gstPct: item.gstPct || 0, qtySold: 0, taxable: 0, totalGst: 0, grandTotal: 0,
        };
        const qty = Number(item.qty) || 0;
        const lineMrpTotal = qty * (Number(item.rate) || 0);
        const base = item.baseAmount !== undefined
          ? Number(item.baseAmount)
          : (item.gstPct > 0 ? lineMrpTotal / (1 + Number(item.gstPct) / 100) : lineMrpTotal);
        const gst = item.gstAmount !== undefined
          ? Number(item.gstAmount)
          : (lineMrpTotal - base);
        acc[key].qtySold += qty;
        acc[key].taxable += base;
        acc[key].totalGst += gst;
        acc[key].grandTotal += base + gst;
      });
      return acc;
    }, {})
  ).sort((a, b) => b.qtySold - a.qtySold);

  const hsnWise = Object.values(
    filteredInvoices.reduce((acc, inv) => {
      (inv.items || []).forEach(item => {
        const key = item.hsn || '6205';
        if (!acc[key]) acc[key] = {
          hsn: key,
          description: item.name || 'Apparel & Clothing',
          uom: item.unit || 'Pcs',
          gstPct: item.gstPct || 0,
          qtySold: 0, taxable: 0, totalGst: 0, grandTotal: 0,
        };
        const qty = Number(item.qty) || 0;
        const lineMrpTotal = qty * (Number(item.rate) || 0);
        const base = item.baseAmount !== undefined
          ? Number(item.baseAmount)
          : (item.gstPct > 0 ? lineMrpTotal / (1 + Number(item.gstPct) / 100) : lineMrpTotal);
        const gst = item.gstAmount !== undefined
          ? Number(item.gstAmount)
          : (lineMrpTotal - base);
        acc[key].qtySold += qty;
        acc[key].taxable += base;
        acc[key].totalGst += gst;
        acc[key].grandTotal += base + gst;
      });
      return acc;
    }, {})
  ).sort((a, b) => b.qtySold - a.qtySold);

    const salesmanWise = Object.values(
    filteredInvoices.reduce((acc, inv) => {
      const key = inv.salesman && inv.salesman.trim() ? inv.salesman.trim() : 'Unassigned';
      if (!acc[key]) acc[key] = {
        salesman: key, billsCount: 0, qtySold: 0, taxable: 0, totalGst: 0, grandTotal: 0,
      };
      acc[key].billsCount += 1;
      acc[key].qtySold += (inv.items || []).reduce((s, i) => s + (Number(i.qty) || 0), 0);
      acc[key].taxable += Number(inv.subtotal) || 0;
      acc[key].totalGst += Number(inv.totalGst) || ((inv.cgst || 0) + (inv.sgst || 0) + (inv.igst || 0));
      acc[key].grandTotal += Number(inv.grandTotal) || 0;
      return acc;
    }, {})
  ).sort((a, b) => b.grandTotal - a.grandTotal);

  const totalSalesValue = filteredInvoices.reduce((s, inv) => s + (inv.grandTotal || 0), 0);
const totalQtySold = itemWise.reduce((s, r) => s + r.qtySold, 0);
const totalTaxCollected = filteredInvoices.reduce(
  (s, inv) => s + (inv.totalGst ?? ((inv.cgst || 0) + (inv.sgst || 0) + (inv.igst || 0))),
  0
);

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();
    // Stock sheet
    const stockRows = [['#', 'Product Name', 'Barcode', 'Category', 'Size', 'Color', 'Selling Price (₹)', 'Purchase Price (₹)', 'GST%', 'Current Stock']];
    products.forEach((p, i) => stockRows.push([
      i + 1, p.name, p.barcode || '-', p.category || '-', p.size || '-', p.color || '-',
      p.sellingPrice || 0, p.purchasePrice || 0, p.gstPct + '%', p.currentStock
    ]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(stockRows), 'Clothing Stock');

    // Item-wise sales
    const itemRows = [['#', 'Item Name', 'Size', 'HSN', 'UOM', 'GST%', 'Qty Sold', 'Taxable Amt', 'Total GST', 'Grand Total']];
    itemWise.forEach((r, i) => itemRows.push([i + 1, r.name, r.size, r.hsn, r.uom, r.gstPct + '%', r.qtySold, r.taxable, r.totalGst, r.grandTotal]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(itemRows), 'Item-wise Sales');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(itemRows), 'Item-wise Sales');

    // Salesman-wise sales
    const salesmanRows = [['#', 'Salesman', 'Bills', 'Qty Sold', 'Taxable Amt', 'Total GST', 'Grand Total']];
    salesmanWise.forEach((r, i) => salesmanRows.push([
      i + 1, r.salesman, r.billsCount, r.qtySold, r.taxable.toFixed(2), r.totalGst.toFixed(2), r.grandTotal.toFixed(2)
    ]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(salesmanRows), 'Salesman-wise Sales');

    XLSX.writeFile(wb, `Clothing_Inventory_${selectedYear || 'All'}.xlsx`);


    XLSX.writeFile(wb, `Clothing_Inventory_${selectedYear || 'All'}.xlsx`);
    toast.success('Inventory exported to Excel!');
  };
  const handleImportExcel = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImporting(true);
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      let successCount = 0;
      let failCount = 0;

      for (const row of rows) {
        const payload = {
          name: row['Product Name'] || row['name'] || '',
          barcode: String(row['Barcode'] || row['barcode'] || ''),
          category: row['Category'] || row['category'] || 'Shirts',
          size: row['Size'] || row['size'] || 'M',
          color: row['Color'] || row['color'] || '',
          hsn: String(row['HSN'] || row['hsn'] || '6205'),
          unit: row['Unit'] || row['unit'] || 'Pcs',
          sellingPrice: Number(row['Selling Price'] || row['sellingPrice'] || 0),
          purchasePrice: Number(row['Purchase Price'] || row['purchasePrice'] || 0),
          gstPct: Number(row['GST%'] || row['gstPct'] || 5),
          openingStock: Number(row['Current Stock'] || row['Stock'] || row['openingStock'] || 0),
        };

        if (!payload.name || payload.sellingPrice <= 0) {
          failCount++;
          continue;
        }

        try {
          await api.post('/products', payload);
          successCount++;
        } catch (err) {
          failCount++;
        }
      }

      toast.success(`Imported ${successCount} items${failCount ? `, ${failCount} failed` : ''}`);
      loadProducts();
    } catch (err) {
      toast.error('Failed to read Excel file');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const lowStockProducts = products.filter(p => p.currentStock <= 5);

  const months = [
    { value: '1', label: 'January' }, { value: '2', label: 'February' },
    { value: '3', label: 'March' }, { value: '4', label: 'April' },
    { value: '5', label: 'May' }, { value: '6', label: 'June' },
    { value: '7', label: 'July' }, { value: '8', label: 'August' },
    { value: '9', label: 'September' }, { value: '10', label: 'October' },
    { value: '11', label: 'November' }, { value: '12', label: 'December' },
  ];
  const years = ['2024', '2025', '2026', '2027'];

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900 dark:text-ink-50 flex items-center gap-2.5">
            <Package className="text-amber-500" size={24} />
            Clothing Inventory & Barcodes
          </h1>
          <p className="text-xs sm:text-sm text-ink-500 dark:text-ink-400 mt-0.5">
            Manage clothing garments, unique barcodes, sizes, colors, and live stock
          </p>
        </div>
    
        <div className="flex items-center gap-2">
          <DateRangeFilter {...dateFilter} onChange={setDateFilter} />
          <button
            onClick={handleOpenCreate}
            className="btn-primary text-xs px-4 py-2.5 flex items-center gap-1.5 shadow-sm"
          >
            <Plus size={16} /> Add Clothing Item
          </button>

          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            ref={fileInputRef}
            onChange={handleImportExcel}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="btn-secondary text-xs px-3.5 py-2.5 text-sky-600 dark:text-sky-400 flex items-center gap-1.5"
          >
            <Upload size={15} /> {importing ? 'Importing...' : 'Import Excel'}
          </button>

          <button
            onClick={exportToExcel}
            className="btn-secondary text-xs px-3.5 py-2.5 text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5"
          >
            <Download size={15} /> Export Excel
          </button>
        </div>
      </div>

      {/* Low Stock Warning Alert */}
      {lowStockProducts.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 flex items-start gap-3 text-amber-800 dark:text-amber-300">
          <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-bold">Low Stock Warning ({lowStockProducts.length} items): </span>
            <span>
              {lowStockProducts.map(p => `${p.name} [${p.size || 'M'}] (${p.currentStock} left)`).join(', ')}
            </span>
          </div>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5">
          <p className="text-xs font-semibold text-ink-400 dark:text-ink-500 uppercase tracking-wider mb-1">
            Total Garments / SKUs
          </p>
          <p className="font-display text-2xl font-bold text-ink-900 dark:text-ink-100">
            {products.length} Items
          </p>
          <p className="text-[11px] text-ink-400 font-mono mt-1">
            Total in-stock: {products.reduce((s, p) => s + (p.currentStock || 0), 0)} pcs
          </p>
        </div>

        <div className="card p-5">
          <p className="text-xs font-semibold text-ink-400 dark:text-ink-500 uppercase tracking-wider mb-1">
            Total Sales Value
          </p>
          <p className="font-display text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {formatCurrency(totalSalesValue)}
          </p>
          <p className="text-[11px] text-ink-400 font-mono mt-1">
            {totalQtySold} garments sold
          </p>
        </div>

        <div className="card p-5">
          <p className="text-xs font-semibold text-ink-400 dark:text-ink-500 uppercase tracking-wider mb-1">
            Total GST Collected
          </p>
          <p className="font-display text-2xl font-bold text-amber-600 dark:text-amber-400">
            {formatCurrency(totalTaxCollected)}
          </p>
          <p className="text-[11px] text-ink-400 font-mono mt-1">
            GSTR-1 synced automatically
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-ink-200 dark:border-ink-800 gap-2">
        {[
          { key: 'stock', label: '📦 Garment Stock & Barcodes' },
          { key: 'item', label: '📊 Item-wise Sales' },
          { key: 'hsn', label: '📑 HSN Summary' },
          { key: 'salesman', label: '🧑‍💼 Salesman-wise Sales' }, 
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all ${activeTab === tab.key
              ? 'border-ink-900 dark:border-amber-500 text-ink-900 dark:text-amber-400'
              : 'border-transparent text-ink-400 hover:text-ink-700'
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: Garment Stock & Barcode Master */}
      {activeTab === 'stock' && (
        <div className="card overflow-hidden space-y-4 p-5">
          {/* Search & Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search size={16} className="absolute left-3 top-2.5 text-ink-400" />
              <input
                type="text"
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
                placeholder="Search by product name, barcode, size (L/XL), color..."
                className="input pl-9 text-xs"
              />
            </div>

            <div className="w-48">
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="input text-xs"
              >
                <option value="">All Categories</option>
                {CLOTHING_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            {loadingProducts ? (
              <div className="py-12 text-center text-ink-400 text-xs">
                Loading clothing catalogue...
              </div>
            ) : filteredProductList.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <p className="text-ink-700 dark:text-ink-200 font-semibold text-sm">No products found</p>
                <p className="text-ink-400 text-xs">Click "Add Clothing Item" above to add new inventory.</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-ink-50 dark:bg-ink-800 text-ink-500 uppercase font-mono text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Item / Garment Name</th>
                    <th className="py-2.5 px-3">Barcode</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-2 text-center">Size</th>
                    <th className="py-2.5 px-2">Color</th>
                    <th className="py-2.5 px-3 text-right">Selling Price</th>
                    <th className="py-2.5 px-2 text-center">GST %</th>
                    <th className="py-2.5 px-3 text-center">Current Stock</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100 dark:divide-ink-800 font-mono">
                  {filteredProductList.map((p, idx) => (
                    <tr key={p._id} className="hover:bg-ink-50/60 dark:hover:bg-ink-800/40 transition-colors">
                      <td className="py-3 px-3 text-ink-400">{idx + 1}</td>
                      <td className="py-3 px-3 font-sans font-semibold text-ink-900 dark:text-ink-100">
                        {p.name}
                        {p.hsn && <span className="block text-[10px] text-ink-400 font-mono">HSN: {p.hsn}</span>}
                      </td>
                      <td className="py-3 px-3">
                        <span className="bg-amber-500/10 text-amber-700 dark:text-amber-400 font-bold px-2 py-0.5 rounded text-[11px]">
                          {p.barcode || '-'}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-sans text-ink-600 dark:text-ink-300 text-[11px]">
                        {p.category || 'Shirts'}
                      </td>
                      <td className="py-3 px-2 text-center">
                        <span className="bg-ink-100 dark:bg-ink-800 text-ink-800 dark:text-ink-200 font-bold px-1.5 py-0.5 rounded text-[11px]">
                          {p.size || 'M'}
                        </span>
                      </td>
                      <td className="py-3 px-2 font-sans text-ink-600 dark:text-ink-300 text-[11px]">
                        {p.color || '-'}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-ink-900 dark:text-ink-100">
                        ₹{p.sellingPrice || 0}
                      </td>
                      <td className="py-3 px-2 text-center text-ink-500">
                        {p.gstPct}%
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`font-bold px-2 py-0.5 rounded ${p.currentStock <= 5 ? 'bg-rose-500/10 text-rose-600' :
                          p.currentStock <= 15 ? 'bg-amber-500/10 text-amber-600' :
                            'bg-emerald-500/10 text-emerald-600'
                          }`}>
                          {p.currentStock} {p.unit || 'pcs'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="inline-flex items-center gap-1.5 font-sans">
                          {/* Print Barcode Label */}
                          <button
                            onClick={() => { setTagProduct(p); setShowTagModal(true); }}
                            className="p-1.5 rounded-lg bg-ink-100 dark:bg-ink-800 hover:bg-amber-500/20 text-ink-700 dark:text-ink-200 hover:text-amber-600 transition-colors"
                            title="Print Barcode Tag"
                          >
                            <Tag size={13} />
                          </button>

                          {/* Add Stock */}
                          <button
                            onClick={() => { setSelectedProduct(p); setShowAddStock(true); }}
                            className="px-2 py-1 rounded-lg bg-ink-900 dark:bg-ink-800 hover:bg-ink-800 text-white text-[11px] font-semibold"
                          >
                            + Stock
                          </button>

                          {/* Edit */}
                          <button
                            onClick={() => handleOpenEdit(p)}
                            className="p-1.5 rounded-lg text-ink-500 hover:text-ink-900 dark:hover:text-ink-100 hover:bg-ink-100 dark:hover:bg-ink-800"
                            title="Edit"
                          >
                            <Edit2 size={13} />
                          </button>

                          {/* History */}
                          <button
                            onClick={() => handleViewHistory(p)}
                            className="p-1.5 rounded-lg text-ink-500 hover:text-ink-900 dark:hover:text-ink-100 hover:bg-ink-100 dark:hover:bg-ink-800"
                            title="Stock History"
                          >
                            <History size={13} />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => handleDeleteProduct(p)}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                            title="Delete"
                          >
                            <X size={13} />
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
      )}

      {/* TAB 2: Item-wise Sales Report */}
      {activeTab === 'item' && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-3">
            <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="input w-36 text-xs">
              <option value="">All Months</option>
              {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} className="input w-32 text-xs">
              <option value="">All Years</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse font-mono">
              <thead className="bg-ink-50 dark:bg-ink-800 text-ink-500 uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3 font-sans">Garment Name</th>
                  <th className="py-2.5 px-3">Size</th>
                  <th className="py-2.5 px-3">HSN</th>
                  <th className="py-2.5 px-3 text-center">GST %</th>
                  <th className="py-2.5 px-3 text-right">Qty Sold</th>
                  <th className="py-2.5 px-3 text-right">Taxable Value</th>
                  <th className="py-2.5 px-3 text-right">Total GST</th>
                  <th className="py-2.5 px-3 text-right">Grand Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                {itemWise.length === 0 ? (
                  <tr><td colSpan={9} className="py-8 text-center text-ink-400">No sales recorded</td></tr>
                ) : (
                  itemWise.map((row, i) => (
                    <tr key={i} className="hover:bg-ink-50/60 dark:hover:bg-ink-800/40">
                      <td className="py-2.5 px-3 text-ink-400">{i + 1}</td>
                      <td className="py-2.5 px-3 font-sans font-semibold text-ink-900 dark:text-ink-100">{row.name}</td>
                      <td className="py-2.5 px-3">{row.size}</td>
                      <td className="py-2.5 px-3 text-ink-500">{row.hsn}</td>
                      <td className="py-2.5 px-3 text-center">{row.gstPct}%</td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-600">{row.qtySold}</td>
                      <td className="py-2.5 px-3 text-right">₹{row.taxable.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right text-amber-600">₹{row.totalGst.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-ink-900 dark:text-ink-100">₹{row.grandTotal.toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: HSN-wise Sales Report */}
      {activeTab === 'hsn' && (
        <div className="card p-5 space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse font-mono">
              <thead className="bg-ink-50 dark:bg-ink-800 text-ink-500 uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">HSN / SAC</th>
                  <th className="py-2.5 px-3 font-sans">Description</th>
                  <th className="py-2.5 px-3 text-center">GST %</th>
                  <th className="py-2.5 px-3 text-right">Qty Sold</th>
                  <th className="py-2.5 px-3 text-right">Taxable Value</th>
                  <th className="py-2.5 px-3 text-right">Total GST</th>
                  <th className="py-2.5 px-3 text-right">Grand Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                {hsnWise.length === 0 ? (
                  <tr><td colSpan={8} className="py-8 text-center text-ink-400">No HSN sales recorded</td></tr>
                ) : (
                  hsnWise.map((row, i) => (
                    <tr key={i} className="hover:bg-ink-50/60 dark:hover:bg-ink-800/40">
                      <td className="py-2.5 px-3 text-ink-400">{i + 1}</td>
                      <td className="py-2.5 px-3 font-bold text-ink-900 dark:text-ink-100">{row.hsn}</td>
                      <td className="py-2.5 px-3 font-sans">{row.description}</td>
                      <td className="py-2.5 px-3 text-center">{row.gstPct}%</td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-600">{row.qtySold}</td>
                      <td className="py-2.5 px-3 text-right">₹{row.taxable.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right text-amber-600">₹{row.totalGst.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-ink-900 dark:text-ink-100">₹{row.grandTotal.toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: Salesman-wise Sales Report */}
      {activeTab === 'salesman' && (
        <div className="card p-5 space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse font-mono">
              <thead className="bg-ink-50 dark:bg-ink-800 text-ink-500 uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3 font-sans">Salesman</th>
                  <th className="py-2.5 px-3 text-right">Bills</th>
                  <th className="py-2.5 px-3 text-right">Qty Sold</th>
                  <th className="py-2.5 px-3 text-right">Taxable Value</th>
                  <th className="py-2.5 px-3 text-right">Total GST</th>
                  <th className="py-2.5 px-3 text-right">Grand Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                {salesmanWise.length === 0 ? (
                  <tr><td colSpan={7} className="py-8 text-center text-ink-400">No sales recorded</td></tr>
                ) : (
                  salesmanWise.map((row, i) => (
                    <tr key={i} className="hover:bg-ink-50/60 dark:hover:bg-ink-800/40">
                      <td className="py-2.5 px-3 text-ink-400">{i + 1}</td>
                      <td className="py-2.5 px-3 font-sans font-semibold text-ink-900 dark:text-ink-100">
                        {row.salesman === 'Unassigned' ? (
                          <span className="text-ink-400 italic">Unassigned</span>
                        ) : row.salesman}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-sky-600">{row.billsCount}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-600">{row.qtySold}</td>
                      <td className="py-2.5 px-3 text-right">₹{row.taxable.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right text-amber-600">₹{row.totalGst.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-ink-900 dark:text-ink-100">₹{row.grandTotal.toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: Add / Edit Product */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-ink-900 rounded-2xl border border-ink-200 dark:border-ink-800 shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="p-4 border-b border-ink-100 dark:border-ink-800 flex items-center justify-between">
              <h3 className="font-semibold text-ink-900 dark:text-ink-100 text-sm flex items-center gap-2">
                <Tag size={16} className="text-amber-500" />
                {isEditing ? 'Edit Garment Details' : 'Add New Clothing Garment'}
              </h3>
              <button onClick={() => setShowProductModal(false)} className="text-ink-400 hover:text-ink-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-5 space-y-3.5">
              {/* Barcode with Auto-generate */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="label mb-0">Barcode (Unique per item/size)</label>
                  <button
                    type="button"
                    onClick={handleGenerateBarcode}
                    className="text-[11px] font-semibold text-amber-600 hover:underline flex items-center gap-1"
                  >
                    <Sparkles size={12} /> Auto-generate
                  </button>
                </div>
                <input
                  type="text"
                  value={productForm.barcode}
                  onChange={e => setProductForm(p => ({ ...p, barcode: e.target.value }))}
                  placeholder="Scan or enter barcode"
                  className="input font-mono font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400"
                  required
                />
              </div>

              {/* Product Name */}
              <div>
                <label className="label">Product Name / Garment Title *</label>
                <input
                  type="text"
                  value={productForm.name}
                  onChange={e => setProductForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Slim Fit Cotton Shirt"
                  className="input"
                  required
                  autoFocus
                />
              </div>

              {/* Category, Size, Color */}
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="label">Category</label>
                  <select
                    value={productForm.category}
                    onChange={e => setProductForm(p => ({ ...p, category: e.target.value }))}
                    className="input text-xs"
                  >
                    {CLOTHING_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Size</label>
                  <select
                    value={productForm.size}
                    onChange={e => setProductForm(p => ({ ...p, size: e.target.value }))}
                    className="input font-bold text-xs"
                  >
                    {CLOTHING_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Color</label>
                  <input
                    type="text"
                    value={productForm.color}
                    onChange={e => setProductForm(p => ({ ...p, color: e.target.value }))}
                    placeholder="e.g. Navy Blue"
                    className="input text-xs"
                  />
                </div>
              </div>

              {/* Pricing & GST */}
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="label">Selling Price (₹) *</label>
                  <input
                    type="number"
                    min="0"
                    value={productForm.sellingPrice}
                    onChange={e => setProductForm(p => ({ ...p, sellingPrice: e.target.value }))}
                    placeholder="999"
                    className="input font-mono font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="label">Purchase Price (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={productForm.purchasePrice}
                    onChange={e => setProductForm(p => ({ ...p, purchasePrice: e.target.value }))}
                    placeholder="550"
                    className="input font-mono"
                  />
                </div>
                <div>
                  <label className="label">GST %</label>
                  <select
                    value={productForm.gstPct}
                    onChange={e => setProductForm(p => ({ ...p, gstPct: Number(e.target.value) }))}
                    className="input font-mono"
                  >
                    <option value={5}>5% (&le; ₹1000)</option>
                    <option value={12}>12% (&gt; ₹1000)</option>
                    <option value={18}>18%</option>
                    <option value={0}>0%</option>
                  </select>
                </div>
              </div>

              {/* HSN & Opening Stock */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">HSN Code</label>
                  <input
                    type="text"
                    value={productForm.hsn}
                    onChange={e => setProductForm(p => ({ ...p, hsn: e.target.value }))}
                    placeholder="6205"
                    className="input font-mono"
                  />
                </div>
                {!isEditing && (
                  <div>
                    <label className="label">Opening Stock (pcs)</label>
                    <input
                      type="number"
                      min="0"
                      value={productForm.openingStock}
                      onChange={e => setProductForm(p => ({ ...p, openingStock: e.target.value }))}
                      placeholder="20"
                      className="input font-mono font-bold"
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-ink-100 dark:border-ink-800">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProduct}
                  className="btn-primary text-xs"
                >
                  {savingProduct ? 'Saving...' : isEditing ? 'Update Garment' : 'Save Garment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Add Stock */}
      {showAddStock && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-ink-900 rounded-2xl border border-ink-200 dark:border-ink-800 shadow-2xl w-full max-w-sm overflow-hidden p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-ink-900 dark:text-ink-100 text-sm">Add Inward Stock</h3>
              <button onClick={() => setShowAddStock(false)} className="text-ink-400 hover:text-ink-600">
                <X size={18} />
              </button>
            </div>

            <div className="bg-ink-50 dark:bg-ink-800/50 p-3 rounded-xl text-xs space-y-1">
              <p className="font-bold text-ink-800 dark:text-ink-100">{selectedProduct.name}</p>
              <p className="text-ink-500 font-mono">
                Size: {selectedProduct.size} | Barcode: {selectedProduct.barcode}
              </p>
              <p className="text-ink-700 dark:text-ink-300 font-semibold font-mono">
                Current Stock: {selectedProduct.currentStock} {selectedProduct.unit || 'pcs'}
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="label">Quantity to Add (pcs)</label>
                <input
                  type="number"
                  min="1"
                  value={stockQty}
                  onChange={e => setStockQty(e.target.value)}
                  placeholder="e.g. 50"
                  className="input font-mono font-bold text-base"
                  autoFocus
                />
              </div>
              <div>
                <label className="label">Note (Supplier / Purchase Invoice)</label>
                <input
                  type="text"
                  value={stockNote}
                  onChange={e => setStockNote(e.target.value)}
                  placeholder="e.g. Inward from Manufacturer"
                  className="input text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowAddStock(false)} className="btn-secondary text-xs">
                Cancel
              </button>
              <button onClick={handleAddStock} disabled={savingStock} className="btn-primary text-xs">
                {savingStock ? 'Adding...' : '+ Update Stock'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Stock History */}
      {showHistory && historyProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-ink-900 rounded-2xl border border-ink-200 dark:border-ink-800 shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-ink-100 dark:border-ink-800 flex items-center justify-between">
              <h3 className="font-semibold text-ink-900 dark:text-ink-100 text-sm">
                Stock History: {historyProduct.name} [{historyProduct.size}]
              </h3>
              <button onClick={() => setShowHistory(false)} className="text-ink-400 hover:text-ink-600">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {loadingHistory ? (
                <div className="py-8 text-center text-ink-400 text-xs">Loading history...</div>
              ) : history.length === 0 ? (
                <div className="py-8 text-center text-ink-400 text-xs">No stock transactions recorded yet.</div>
              ) : (
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-ink-50 dark:bg-ink-800 text-ink-500 uppercase text-[10px]">
                    <tr>
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">Type</th>
                      <th className="py-2 px-3 text-right">Qty</th>
                      <th className="py-2 px-3 font-sans">Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                    {history.map((h, i) => (
                      <tr key={i}>
                        <td className="py-2.5 px-3 text-ink-400">{new Date(h.date).toLocaleDateString('en-IN')}</td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${h.type === 'SALE' ? 'bg-rose-500/10 text-rose-600' : 'bg-emerald-500/10 text-emerald-600'
                            }`}>
                            {h.type}
                          </span>
                        </td>
                        <td className={`py-2.5 px-3 text-right font-bold ${h.qty < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {h.qty > 0 ? `+${h.qty}` : h.qty}
                        </td>
                        <td className="py-2.5 px-3 font-sans text-ink-600 dark:text-ink-300">{h.note || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Printable Barcode Tag / Clothing Price Tag */}
      {showTagModal && tagProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/70 backdrop-blur-sm animate-fade-in no-print-bg">
          <div className="bg-white dark:bg-ink-900 rounded-2xl border border-ink-200 dark:border-ink-800 shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-ink-100 dark:border-ink-800 flex items-center justify-between no-print">
              <div className="flex items-center gap-2">
                <Tag size={16} className="text-amber-500" />
                <h3 className="font-semibold text-ink-900 dark:text-ink-100 text-sm">
                  Print Clothing Price Tags / Barcode Stickers
                </h3>
              </div>
              <button onClick={() => setShowTagModal(false)} className="text-ink-400 hover:text-ink-600">
                <X size={18} />
              </button>
            </div>

            <div className="p-4 bg-ink-50 dark:bg-ink-950/40 border-b border-ink-100 dark:border-ink-800 flex items-center justify-between no-print">
              <span className="text-xs text-ink-600 dark:text-ink-300">Number of Tags:</span>
              <div className="flex gap-2">
                {[1, 3, 6, 12].map(n => (
                  <button
                    key={n}
                    onClick={() => setTagCount(n)}
                    className={`px-3 py-1 rounded text-xs font-bold font-mono ${tagCount === n ? 'bg-amber-500 text-white' : 'bg-white dark:bg-ink-800 text-ink-700 dark:text-ink-300'
                      }`}
                  >
                    {n} Tags
                  </button>
                ))}
              </div>
            </div>

            {/* Printable Area */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-wrap gap-3 justify-center bg-ink-100 dark:bg-ink-950/70">
              {Array.from({ length: tagCount }).map((_, i) => (
                <div
                  key={i}
                  className="bg-white text-black font-sans w-48 p-3 border-2 border-dashed border-neutral-400 rounded-md shadow-xs flex flex-col items-center text-center space-y-1"
                >
                  <p className="font-bold text-[10px] tracking-wider uppercase text-neutral-800">
                    {user?.companyName || DEFAULT_STORE_DETAILS.companyName}
                  </p>
                  <p className="font-bold text-xs text-black truncate max-w-[170px]">
                    {tagProduct.name}
                  </p>
                  <div className="flex items-center gap-2 text-[10px] font-semibold text-neutral-700">
                    <span className="bg-neutral-200 px-1.5 py-0.2 rounded font-mono">Size: {tagProduct.size}</span>
                    {tagProduct.color && <span>{tagProduct.color}</span>}
                  </div>

                  {/* Barcode Representation */}
                  <div className="py-1">
                    <div className="font-mono text-base tracking-widest font-black border-y border-black px-2 py-0.5">
                      ||| | || ||| || |||
                    </div>
                    <p className="font-mono text-[9px] text-neutral-600 mt-0.5">{tagProduct.barcode}</p>
                  </div>

                  <div className="w-full pt-1 border-t border-dotted border-neutral-400 flex items-center justify-between text-[10px]">
                    <span className="font-bold text-xs">MRP: ₹{tagProduct.sellingPrice}</span>
                    <span className="text-[8px] text-neutral-500">Incl. GST</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-ink-100 dark:border-ink-800 flex justify-end gap-2 no-print">
              <button onClick={() => setShowTagModal(false)} className="btn-secondary text-xs">
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="btn-primary text-xs flex items-center gap-1.5"
              >
                <Printer size={15} /> Print Tags
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}