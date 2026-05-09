import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useInvoices } from '../context/InvoiceContext';
import { useAuth } from '../context/AuthContext';
import {
  formatCurrency, generateInvoiceNumber,
  GST_RATES, INDIAN_STATES, getHSNSuggestion
} from '../utils/invoiceUtils';
import { Plus, Trash2, Save, ArrowLeft, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';

const emptyItem = () => ({ id: Date.now() + Math.random(), name: '', hsn: '', qty: 1, unit: 'Nos', rate: 0, gstPct: 18 });

export default function InvoiceFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { createInvoice, updateInvoice, getInvoice } = useInvoices();
  const { user } = useAuth();

  const [saving, setSaving] = useState(false);
  const [loadingInv, setLoadingInv] = useState(isEdit);

  // Autocomplete state
  const [savedClients, setSavedClients] = useState([]);
  const [savedProducts, setSavedProducts] = useState([]);
  const [clientSearch, setClientSearch] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [productSearch, setProductSearch] = useState({});
  const [showProductDropdown, setShowProductDropdown] = useState({});
  const clientRef = useRef(null);

  const [seller, setSeller] = useState({
    companyName: user?.companyName || '',
    gstNumber: user?.gstNumber || '',
    address: user?.address || '',
    state: user?.state || '',
    contact: user?.contact || '',
    email: user?.email || '',
  });
  const [buyer, setBuyer] = useState({ clientName: '', gstNumber: '', address: '', state: '', contact: '' });
  const [meta, setMeta] = useState({
    invoiceNumber: generateInvoiceNumber(),
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    notes: '',
    status: 'draft',
  });
  const [items, setItems] = useState([emptyItem()]);

  const isSameState = seller.state && buyer.state &&
    seller.state.trim().toLowerCase() === buyer.state.trim().toLowerCase();

  // Load saved clients and products
  useEffect(() => {
    api.get('/invoices/meta/clients').then(r => setSavedClients(r.data)).catch(() => { });
    api.get('/invoices/meta/products').then(r => setSavedProducts(r.data)).catch(() => { });
  }, []);

  // Close client dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (clientRef.current && !clientRef.current.contains(e.target)) {
        setShowClientDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (isEdit) {
      setLoadingInv(true);
      getInvoice(id).then(inv => {
        setSeller(inv.seller);
        setBuyer(inv.buyer);
        setClientSearch(inv.buyer?.clientName || '');
        setMeta({
          invoiceNumber: inv.invoiceNumber,
          invoiceDate: inv.invoiceDate?.split('T')[0],
          dueDate: inv.dueDate?.split('T')[0] || '',
          notes: inv.notes || '',
          status: inv.status || 'draft',
        });
        setItems(inv.items.map(it => ({ ...it, id: Date.now() + Math.random() })));
      }).catch(() => {
        toast.error('Failed to load invoice');
        navigate('/dashboard');
      }).finally(() => setLoadingInv(false));
    }
  }, [id]);

  const calcItemGst = (item) => {
    const base = (Number(item.qty) || 0) * (Number(item.rate) || 0);
    const totalGst = (base * (Number(item.gstPct) || 0)) / 100;
    if (isSameState) return { cgst: totalGst / 2, sgst: totalGst / 2, igst: 0, totalGst };
    return { cgst: 0, sgst: 0, igst: totalGst, totalGst };
  };

  const totals = (() => {
    let subtotal = 0, cgst = 0, sgst = 0, igst = 0, totalGst = 0;
    items.forEach(item => {
      const base = (Number(item.qty) || 0) * (Number(item.rate) || 0);
      subtotal += base;
      const g = calcItemGst(item);
      cgst += g.cgst; sgst += g.sgst; igst += g.igst; totalGst += g.totalGst;
    });
    const grandTotal = subtotal + totalGst;
    const roundOff = Math.round(grandTotal) - grandTotal;
    const finalTotal = Math.round(grandTotal);
    return { subtotal, cgst, sgst, igst, totalGst, grandTotal, roundOff, finalTotal };
  })();

  const addItem = () => setItems(p => [...p, emptyItem()]);
  const removeItem = (itemId) => {
    if (items.length === 1) return toast.error('At least one item required');
    setItems(p => p.filter(i => i.id !== itemId));
  };

  const updateItem = (itemId, field, value) => {
    setItems(p => p.map(i => {
      if (i.id !== itemId) return i;
      const updated = { ...i, [field]: value };
      if (field === 'name' && value.length > 2) {
        const suggestion = getHSNSuggestion(value);
        if (suggestion) {
          if (!i.hsn) updated.hsn = suggestion.hsn;
          updated.gstPct = suggestion.gst;
        }
      }
      return updated;
    }));
  };

  // Select a saved client
  const selectClient = (client) => {
    setBuyer({ ...client });
    setClientSearch(client.clientName);
    setShowClientDropdown(false);
  };

  // Select a saved product for a row
  const selectProduct = (itemId, product) => {
    setItems(p => p.map(i => {
      if (i.id !== itemId) return i;
      return { ...i, name: product.name, hsn: product.hsn, unit: product.unit, rate: product.rate, gstPct: product.gstPct };
    }));
    setProductSearch(p => ({ ...p, [itemId]: product.name }));
    setShowProductDropdown(p => ({ ...p, [itemId]: false }));
  };

  const filteredClients = savedClients.filter(c =>
    c.clientName?.toLowerCase().includes(clientSearch.toLowerCase())
  );

  const buildPayload = () => ({
    seller, buyer,
    invoiceNumber: meta.invoiceNumber,
    invoiceDate: meta.invoiceDate,
    dueDate: meta.dueDate,
    notes: meta.notes,
    status: meta.status,
    items: items.map(({ id: _id, ...rest }) => rest),
    subtotal: totals.subtotal,
    cgst: totals.cgst, sgst: totals.sgst, igst: totals.igst,
    totalGst: totals.totalGst, grandTotal: totals.grandTotal, isSameState,
  });

  const handleSave = async (e) => {
    e.preventDefault();
    if (!seller.companyName) return toast.error('Seller company name is required');
    if (!buyer.clientName) return toast.error('Client name is required');
    if (items.some(i => !i.name)) return toast.error('All items must have a name');
    setSaving(true);
    try {
      if (isEdit) {
        await updateInvoice(id, buildPayload());
        navigate('/dashboard');
      } else {
        const newInv = await createInvoice(buildPayload());
        navigate(`/invoices/${newInv._id}`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save invoice');
    } finally {
      setSaving(false);
    }
  };

  if (loadingInv) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-ink-800 dark:border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto animate-slide-up">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-400 transition-all">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-800 dark:text-ink-100">
            {isEdit ? 'Edit Invoice' : 'New Invoice'}
          </h1>
          <p className="text-sm text-ink-400 font-mono">{meta.invoiceNumber}</p>
        </div>
        <div className="ml-auto flex gap-3">
          <button type="button" onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={15} />}
            {saving ? 'Saving...' : 'Save Invoice'}
          </button>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Invoice meta */}
        <div className="card p-6">
          <p className="section-title">Invoice Details</p>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="label">Invoice Number</label>
              <input value={meta.invoiceNumber} onChange={e => setMeta(p => ({ ...p, invoiceNumber: e.target.value }))} className="input font-mono" />
            </div>
            <div>
              <label className="label">Invoice Date</label>
              <input type="date" value={meta.invoiceDate} onChange={e => setMeta(p => ({ ...p, invoiceDate: e.target.value }))} className="input" />
            </div>
            <div>
              <label className="label">Due Date</label>
              <input type="date" value={meta.dueDate} onChange={e => setMeta(p => ({ ...p, dueDate: e.target.value }))} className="input" />
            </div>
          </div>
        </div>

        {/* Seller & Buyer */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Seller - LOCKED */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="section-title mb-0">Seller (Your Company)</p>
              <span className="text-xs bg-ink-100 dark:bg-ink-800 text-ink-400 px-2 py-1 rounded-full">Locked</span>
            </div>
            <div className="space-y-3">
              <div>
                <label className="label">Company Name</label>
                <input value={seller.companyName} readOnly className="input font-semibold bg-ink-50 dark:bg-ink-900 cursor-not-allowed opacity-75" />
              </div>
              <div>
                <label className="label">GST Number</label>
                <input value={seller.gstNumber} readOnly className="input font-mono uppercase bg-ink-50 dark:bg-ink-900 cursor-not-allowed opacity-75" />
              </div>
              <div>
                <label className="label">Address</label>
                <textarea value={seller.address} readOnly className="input resize-none bg-ink-50 dark:bg-ink-900 cursor-not-allowed opacity-75" rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">State</label>
                  <input value={seller.state} readOnly className="input bg-ink-50 dark:bg-ink-900 cursor-not-allowed opacity-75" />
                </div>
                <div>
                  <label className="label">Contact</label>
                  <input value={seller.contact} readOnly className="input bg-ink-50 dark:bg-ink-900 cursor-not-allowed opacity-75" />
                </div>
              </div>
              <div>
                <label className="label">Email</label>
                <input value={seller.email} readOnly className="input bg-ink-50 dark:bg-ink-900 cursor-not-allowed opacity-75" />
              </div>
            </div>
          </div>

          {/* Buyer - with autocomplete */}
          <div className="card p-6">
            <p className="section-title">Buyer (Client)</p>
            <div className="space-y-3">
              {/* Client Name with autocomplete */}
              <div ref={clientRef} className="relative">
                <label className="label">Client Name *</label>
                <div className="relative">
                  <input
                    value={clientSearch}
                    onChange={e => {
                      setClientSearch(e.target.value);
                      setBuyer(p => ({ ...p, clientName: e.target.value }));
                      setShowClientDropdown(true);
                    }}
                    onFocus={() => setShowClientDropdown(true)}
                    className="input font-semibold pr-8"
                    placeholder="Type or select client..."
                  />
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400" />
                </div>
                {showClientDropdown && filteredClients.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-700 rounded-xl shadow-xl overflow-hidden">
                    <div className="px-3 py-2 text-xs text-ink-400 border-b border-ink-100 dark:border-ink-800 font-semibold uppercase tracking-wide">Saved Clients</div>
                    {filteredClients.map((c, i) => (
                      <button key={i} type="button" onMouseDown={() => selectClient(c)}
                        className="w-full text-left px-4 py-3 hover:bg-ink-50 dark:hover:bg-ink-800 transition-colors border-b border-ink-50 dark:border-ink-800 last:border-0">
                        <p className="text-sm font-semibold text-ink-800 dark:text-ink-100">{c.clientName}</p>
                        <p className="text-xs text-ink-400">{c.state} {c.gstNumber ? '· ' + c.gstNumber : ''}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="label">GST Number</label>
                <input value={buyer.gstNumber} onChange={e => setBuyer(p => ({ ...p, gstNumber: e.target.value.toUpperCase() }))} className="input font-mono uppercase" placeholder="29AAAAA0000A1Z5" maxLength={15} />
              </div>
              <div>
                <label className="label">Address</label>
                <textarea value={buyer.address} onChange={e => setBuyer(p => ({ ...p, address: e.target.value }))} className="input resize-none" rows={2} placeholder="Street, City, PIN Code" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">State</label>
                  <select value={buyer.state} onChange={e => setBuyer(p => ({ ...p, state: e.target.value }))} className="input">
                    <option value="">Select State</option>
                    {INDIAN_STATES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Contact</label>
                  <input value={buyer.contact} onChange={e => setBuyer(p => ({ ...p, contact: e.target.value }))} className="input" placeholder="+91 98765 43210" />
                </div>
              </div>
            </div>
            {seller.state && buyer.state && (
              <div className={`mt-4 px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 ${isSameState ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'}`}>
                {isSameState ? '✓ Same state → CGST + SGST will apply' : '✓ Different states → IGST will apply'}
              </div>
            )}
          </div>
        </div>

        {/* Items Table */}
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-ink-100 dark:border-ink-800 flex items-center justify-between">
            <p className="section-title mb-0">Line Items</p>
            <button type="button" onClick={addItem} className="btn-secondary py-1.5 text-xs">
              <Plus size={13} /> Add Item
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-ink-100 dark:border-ink-800">
                  {['#', 'Product/Service', 'HSN/SAC', 'UoM', 'QTY', 'Unit Price (₹)', 'Taxable Amt (₹)', 'GST %',
                    ...(isSameState ? ['CGST (₹)', 'SGST (₹)'] : ['IGST (₹)']),
                    'Amount (₹)', ''].map(h => (
                      <th key={h} className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wider text-ink-400 dark:text-ink-500 whitespace-nowrap">{h}</th>
                    ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-50 dark:divide-ink-800">
                {items.map((item, index) => {
                  const base = (Number(item.qty) || 0) * (Number(item.rate) || 0);
                  const g = calcItemGst(item);
                  const total = base + g.totalGst;
                  const filteredProducts = savedProducts.filter(p =>
                    p.name?.toLowerCase().includes((productSearch[item.id] ?? item.name ?? '').toLowerCase())
                  );
                  return (
                    <tr key={item.id} className="group">
                      <td className="px-3 py-3 text-sm text-ink-400 text-center w-8">{index + 1}</td>
                      {/* Product with autocomplete */}
                      <td className="px-3 py-3 min-w-[180px]">
                        <div className="relative">
                          <input
                            value={productSearch[item.id] !== undefined ? productSearch[item.id] : item.name}
                            onChange={e => {
                              const val = e.target.value;
                              setProductSearch(p => ({ ...p, [item.id]: val }));
                              updateItem(item.id, 'name', val);
                              setShowProductDropdown(p => ({ ...p, [item.id]: true }));
                            }}
                            onFocus={() => setShowProductDropdown(p => ({ ...p, [item.id]: true }))}
                            onBlur={() => setTimeout(() => setShowProductDropdown(p => ({ ...p, [item.id]: false })), 150)}
                            className="input pr-6"
                            placeholder="Product/Service"
                          />
                          <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-300" />
                          {showProductDropdown[item.id] && filteredProducts.length > 0 && (
                            <div className="absolute z-50 w-80 mt-1 bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-700 rounded-xl shadow-xl overflow-hidden">
                              <div className="px-3 py-2 text-xs text-ink-400 border-b border-ink-100 dark:border-ink-800 font-semibold uppercase tracking-wide">Saved Products</div>
                              {filteredProducts.slice(0, 6).map((prod, i) => (
                                <button key={i} type="button" onMouseDown={() => selectProduct(item.id, prod)}
                                  className="w-full text-left px-4 py-2.5 hover:bg-ink-50 dark:hover:bg-ink-800 transition-colors border-b border-ink-50 dark:border-ink-800 last:border-0">
                                  <p className="text-sm font-semibold text-ink-800 dark:text-ink-100 whitespace-normal break-words leading-snug">{prod.name}</p>
                                  <p className="text-xs text-ink-400">HSN: {prod.hsn || '-'} · ₹{prod.rate} · {prod.gstPct}%</p>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 min-w-[100px]">
                        <input value={item.hsn} onChange={e => updateItem(item.id, 'hsn', e.target.value)} className="input font-mono" placeholder="HSN/SAC" />
                      </td>
                      <td className="px-3 py-3 min-w-[120px]">
                        <input value={item.unit} onChange={e => updateItem(item.id, 'unit', e.target.value)} className="input" placeholder="Unit" list="unit-options" />
                        <datalist id="unit-options">
                          {['Nos', 'Kg', 'Ltr', 'Mtr', 'Box', 'Pcs', 'Set', 'Hrs', 'Trolly', 'MT', 'Quintal', 'Span'].map(u => (
                            <option key={u} value={u} />
                          ))}
                        </datalist>
                      </td>
                      <td className="px-3 py-3 min-w-[90px]">
                        <input type="number" min="0" step="0.01" value={item.qty} onChange={e => updateItem(item.id, 'qty', e.target.value)} className="input text-center" />
                      </td>
                      <td className="px-3 py-3 min-w-[110px]">
                        <input type="number" min="0" step="0.01" value={item.rate} onChange={e => updateItem(item.id, 'rate', e.target.value)} className="input text-right font-mono" />
                      </td>
                      <td className="px-3 py-3 min-w-[110px]">
                        <div className="px-2 py-2 rounded-lg bg-ink-50 dark:bg-ink-800 text-right font-mono text-sm text-ink-600 dark:text-ink-300">{base.toFixed(2)}</div>
                      </td>
                      <td className="px-3 py-3 min-w-[90px]">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={item.gstPct}
                          onChange={e => updateItem(item.id, 'gstPct', e.target.value === '' ? 0 : Number(e.target.value))}
                          className="input text-center font-mono"
                          placeholder="0"
                        />
                      </td>
                      {isSameState ? (
                        <>
                          <td className="px-3 py-3 min-w-[90px]">
                            <div className="px-2 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-right font-mono text-sm text-blue-700 dark:text-blue-300">{g.cgst.toFixed(2)}</div>
                          </td>
                          <td className="px-3 py-3 min-w-[90px]">
                            <div className="px-2 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-right font-mono text-sm text-blue-700 dark:text-blue-300">{g.sgst.toFixed(2)}</div>
                          </td>
                        </>
                      ) : (
                        <td className="px-3 py-3 min-w-[90px]">
                          <div className="px-2 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-right font-mono text-sm text-amber-700 dark:text-amber-300">{g.igst.toFixed(2)}</div>
                        </td>
                      )}
                      <td className="px-3 py-3 min-w-[110px]">
                        <div className="px-2 py-2 rounded-lg bg-ink-50 dark:bg-ink-800 text-right font-mono text-sm font-semibold text-ink-700 dark:text-ink-200">{formatCurrency(total)}</div>
                      </td>
                      <td className="px-3 py-3">
                        <button type="button" onClick={() => removeItem(item.id)}
                          className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-ink-300 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="border-t border-ink-100 dark:border-ink-800 px-6 py-5 flex justify-end">
            <div className="w-72 space-y-2">
              <div className="flex justify-between text-sm text-ink-500 dark:text-ink-400">
                <span>Subtotal (Taxable)</span>
                <span className="font-mono">{formatCurrency(totals.subtotal)}</span>
              </div>
              {isSameState ? (
                <>
                  <div className="flex justify-between text-sm text-blue-600 dark:text-blue-400">
                    <span>CGST</span><span className="font-mono">{formatCurrency(totals.cgst)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-blue-600 dark:text-blue-400">
                    <span>SGST</span><span className="font-mono">{formatCurrency(totals.sgst)}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between text-sm text-amber-600 dark:text-amber-400">
                  <span>IGST</span><span className="font-mono">{formatCurrency(totals.igst)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm text-ink-500 dark:text-ink-400">
                <span>Total GST</span><span className="font-mono">{formatCurrency(totals.totalGst)}</span>
              </div>
              <div className="flex justify-between text-sm text-ink-500 dark:text-ink-400">
                <span>Round Off</span>
                <span className="font-mono">{totals.roundOff >= 0 ? '+' : ''}{totals.roundOff.toFixed(2)}</span>
              </div>
              <div className="h-px bg-ink-200 dark:bg-ink-700" />
              <div className="flex justify-between text-base font-bold text-ink-800 dark:text-ink-100">
                <span>Grand Total</span>
                <span className="font-mono">₹{totals.finalTotal.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="card p-6">
          <label className="label">Notes / Terms</label>
          <textarea value={meta.notes} onChange={e => setMeta(p => ({ ...p, notes: e.target.value }))}
            className="input resize-none" rows={3}
            placeholder="Payment terms, bank details, thank you note, etc." />
        </div>

        <div className="flex justify-end gap-3 pb-8">
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary px-8">
            {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={15} />}
            {saving ? 'Saving...' : 'Save Invoice'}
          </button>
        </div>
      </form>
    </div>
  );
}

