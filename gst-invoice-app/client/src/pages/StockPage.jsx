import React, { useEffect, useState } from 'react';
import { Package, Plus, Trash2, AlertTriangle, CheckCircle } from 'lucide-react';
import axios from 'axios';

export default function StockPage() {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ itemName: '', hsn: '', unit: 'Nos', openingStock: '', openingDate: new Date().toISOString().split('T')[0] });
  const [saving, setSaving] = useState(false);

  const fetchStocks = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/stock', { headers: { Authorization: `Bearer ${token}` } });
      setStocks(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStocks(); }, []);

  const handleSave = async () => {
    if (!form.itemName || !form.openingStock) return alert('Item name aur opening stock required hai');
    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      await axios.post('/api/stock', { ...form, openingStock: Number(form.openingStock) }, { headers: { Authorization: `Bearer ${token}` } });
      setForm({ itemName: '', hsn: '', unit: 'Nos', openingStock: '', openingDate: new Date().toISOString().split('T')[0] });
      setShowForm(false);
      fetchStocks();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete karna chahte ho?')) return;
    const token = localStorage.getItem('token');
    await axios.delete(`/api/stock/${id}`, { headers: { Authorization: `Bearer ${token}` } });
    fetchStocks();
  };

  const statusColor = (remaining, opening) => {
    if (opening === 0) return '#888';
    const pct = (remaining / opening) * 100;
    if (remaining <= 0) return '#dc2626';
    if (pct <= 20) return '#d97706';
    return '#16a34a';
  };

  const totalItems = stocks.length;
  const lowStock = stocks.filter(s => s.remaining > 0 && (s.remaining / (s.openingStock || 1)) <= 0.2).length;
  const outOfStock = stocks.filter(s => s.remaining <= 0).length;

  return (
    <div className="max-w-6xl mx-auto animate-slide-up space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-800 dark:text-ink-100 flex items-center gap-2">
            <Package size={22} /> Stock Register
          </h1>
          <p className="text-sm text-ink-400 mt-1">Opening stock set karo — invoice se automatically ghata do</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: '#1c1c18', color: 'white', border: 'none', cursor: 'pointer' }}>
          <Plus size={16} /> Add Item
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Items', value: totalItems, color: '#1c1c18' },
          { label: 'Low Stock', value: lowStock, color: '#d97706' },
          { label: 'Out of Stock', value: outOfStock, color: '#dc2626' },
        ].map((c, i) => (
          <div key={i} className="card p-4 text-center">
            <div style={{ fontSize: 28, fontWeight: 700, color: c.color }}>{c.value}</div>
            <div className="text-sm text-ink-400 mt-1">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="card p-5 border-2" style={{ borderColor: '#1c1c18' }}>
          <h3 className="font-semibold text-ink-800 dark:text-ink-100 mb-4">Opening Stock Add Karo</h3>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <div>
              <label className="label">Item Name *</label>
              <input className="input" placeholder="Invoice mein jo naam use karo" value={form.itemName} onChange={e => setForm(f => ({ ...f, itemName: e.target.value }))} />
            </div>
            <div>
              <label className="label">HSN Code</label>
              <input className="input" placeholder="9954" value={form.hsn} onChange={e => setForm(f => ({ ...f, hsn: e.target.value }))} />
            </div>
            <div>
              <label className="label">Unit</label>
              <select className="input" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
                {['Nos', 'Kg', 'Bags', 'MT', 'Ltr', 'Mtr', 'Sqft', 'Cum'].map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Opening Stock (Qty) *</label>
              <input className="input" type="number" placeholder="1000" value={form.openingStock} onChange={e => setForm(f => ({ ...f, openingStock: e.target.value }))} />
            </div>
            <div>
              <label className="label">Opening Date</label>
              <input className="input" type="date" value={form.openingDate} onChange={e => setForm(f => ({ ...f, openingDate: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: '#16a34a', color: 'white', border: 'none', cursor: 'pointer' }}>
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: '#f4f4f0', color: '#1c1c18', border: 'none', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Stock Table */}
      <div className="card overflow-hidden">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['#', 'Item Name', 'HSN', 'Unit', 'Opening Stock', 'Consumed (Invoices)', 'Remaining', 'Status', ''].map((h, i) => (
                <th key={i} style={{ padding: '10px 12px', textAlign: i >= 4 ? 'right' : 'left', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'white', background: '#1c1c18', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: '#888' }}>Loading...</td></tr>
              : stocks.length === 0
                ? <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: '#888' }}>Koi item nahi — "Add Item" se shuru karo</td></tr>
                : stocks.map((row, i) => {
                  const color = statusColor(row.remaining, row.openingStock);
                  const pct = row.openingStock > 0 ? Math.max(0, Math.min(100, (row.remaining / row.openingStock) * 100)) : 0;
                  return (
                    <tr key={row._id} style={{ background: i % 2 === 0 ? 'white' : '#f4f4f0' }}>
                      <td style={{ padding: '10px 12px', fontSize: 13 }}>{i + 1}</td>
                      <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 600 }}>{row.itemName}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12, fontFamily: 'monospace', color: '#6e6e60' }}>{row.hsn || '-'}</td>
                      <td style={{ padding: '10px 12px', fontSize: 13 }}>{row.unit}</td>
                      <td style={{ padding: '10px 12px', fontSize: 13, textAlign: 'right', fontFamily: 'monospace' }}>{row.openingStock}</td>
                      <td style={{ padding: '10px 12px', fontSize: 13, textAlign: 'right', fontFamily: 'monospace', color: '#dc2626' }}>{row.consumed}</td>
                      <td style={{ padding: '10px 12px', fontSize: 14, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color }}>
                        {row.remaining}
                        <div style={{ marginTop: 4, background: '#e8e8e0', borderRadius: 4, height: 4, width: 80, marginLeft: 'auto' }}>
                          <div style={{ width: `${pct}%`, background: color, height: 4, borderRadius: 4, transition: 'width 0.3s' }} />
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        {row.remaining <= 0
                          ? <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: '#fee2e2', color: '#dc2626', fontWeight: 600 }}>OUT OF STOCK</span>
                          : pct <= 20
                            ? <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: '#fef3c7', color: '#d97706', fontWeight: 600 }}>LOW STOCK</span>
                            : <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: '#dcfce7', color: '#16a34a', fontWeight: 600 }}>OK</span>
                        }
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        <button onClick={() => handleDelete(row._id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}>
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>
    </div>
  );
}