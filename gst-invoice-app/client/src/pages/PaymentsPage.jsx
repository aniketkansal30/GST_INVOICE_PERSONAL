import React, { useEffect, useState } from 'react';
import { useInvoices } from '../context/InvoiceContext';
import { formatCurrency } from '../utils/invoiceUtils';
import { Wallet, Plus, Trash2, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import api from '../utils/api';

export default function PaymentsPage() {
  const { invoices, fetchInvoices } = useInvoices();
  const [allInvoices, setAllInvoices] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ amount: '', date: '', mode: 'bank', note: '' });
  const [filter, setFilter] = useState('all');

  useEffect(() => { fetchInvoices({ limit: 1000, page: 1 }); }, []);
  useEffect(() => { setAllInvoices(invoices); }, [invoices]);

  const filtered = allInvoices.filter(inv => {
    if (filter === 'paid') return inv.status === 'paid';
    if (filter === 'partial') return inv.status === 'partial';
    if (filter === 'unpaid') return ['draft', 'sent', 'overdue'].includes(inv.status);
    return true;
  });

  const totalBilled = allInvoices.reduce((s, i) => s + (i.grandTotal || 0), 0);
  const totalPaid = allInvoices.reduce((s, i) => s + (i.amountPaid || 0), 0);
  const totalDue = totalBilled - totalPaid;

  const statusColor = (s) => ({ draft: '#888', sent: '#2563eb', paid: '#16a34a', partial: '#d97706', overdue: '#dc2626' }[s] || '#888');
  const statusBg = (s) => ({ draft: '#f3f4f6', sent: '#eff6ff', paid: '#f0fdf4', partial: '#fffbeb', overdue: '#fef2f2' }[s] || '#f3f4f6');

  const addPayment = async () => {
    if (!form.amount || isNaN(form.amount)) return toast.error('Valid amount daalo');
    try {
      const res = await api.post(`/invoices/${selected._id}/payments`, {
        ...form,
        amount: Number(form.amount)
      });
      const updated = res.data;
      setAllInvoices(prev => prev.map(i => i._id === updated._id ? updated : i));
      setSelected(updated);
      setForm({ amount: '', date: '', mode: 'bank', note: '' });
      toast.success('Payment record ho gaya!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error aaya, dobara try karo');
    }
  };

  const deletePayment = async (pid) => {
    try {
      const res = await api.delete(`/invoices/${selected._id}/payments/${pid}`);
      const updated = res.data;
      setAllInvoices(prev => prev.map(i => i._id === updated._id ? updated : i));
      setSelected(updated);
      toast.success('Payment hata diya');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error aaya');
    }
  };

  const exportExcel = () => {
    const rows = [['Invoice No', 'Client', 'Invoice Date', 'Due Date', 'Grand Total', 'Paid', 'Balance', 'Status']];
    allInvoices.forEach(inv => rows.push([
      inv.invoiceNumber, inv.buyer?.clientName,
      inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString('en-IN') : '',
      inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('en-IN') : '',
      inv.grandTotal || 0, inv.amountPaid || 0,
      (inv.grandTotal || 0) - (inv.amountPaid || 0), inv.status
    ]));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Payment Tracker');
    XLSX.writeFile(wb, 'Payment_Tracker.xlsx');
  };

  const thS = { padding: '10px 12px', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'white', background: '#1c1c18', textAlign: 'left', whiteSpace: 'nowrap' };
  const tdS = { padding: '9px 12px', fontSize: '13px', borderBottom: '1px solid #e8e8e0' };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-slide-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-800 dark:text-ink-100 flex items-center gap-2">
            <Wallet size={22} /> Payment Tracker
          </h1>
          <p className="text-sm text-ink-400 mt-1">Invoice-wise payment record karo, balance track karo</p>
        </div>
        <button onClick={exportExcel} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: '#16a34a', color: 'white', border: 'none', cursor: 'pointer' }}>
          <Download size={16} /> Export Excel
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
        {[
          { label: 'Total Billed', value: formatCurrency(totalBilled), color: '#1c1c18' },
          { label: 'Total Received', value: formatCurrency(totalPaid), color: '#16a34a' },
          { label: 'Total Pending', value: formatCurrency(totalDue), color: '#dc2626' },
        ].map(c => (
          <div key={c.label} className="card p-4">
            <p style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>{c.label}</p>
            <p style={{ fontSize: 22, fontWeight: 700, color: c.color }}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        {[['all','All'],['unpaid','Unpaid'],['partial','Partial'],['paid','Paid']].map(([k,l]) => (
          <button key={k} onClick={() => setFilter(k)}
            style={{ padding: '6px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: filter === k ? '2px solid #1c1c18' : '1px solid #e8e8e0', background: filter === k ? '#1c1c18' : 'white', color: filter === k ? 'white' : '#444' }}>
            {l}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 380px' : '1fr', gap: 20 }}>
        <div className="card overflow-hidden">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              {['Invoice No', 'Client', 'Total', 'Paid', 'Balance', 'Status', 'Action'].map(h => <th key={h} style={thS}>{h}</th>)}
            </tr></thead>
            <tbody>
              {filtered.length === 0
                ? <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: '#888' }}>No invoices</td></tr>
                : filtered.map((inv, i) => {
                  const paid = inv.amountPaid || 0;
                  const due = (inv.grandTotal || 0) - paid;
                  return (
                    <tr key={inv._id} style={{ background: selected?._id === inv._id ? '#eef2ff' : i % 2 === 0 ? 'white' : '#f9f9f7', cursor: 'pointer' }} onClick={() => setSelected(inv)}>
                      <td style={{ ...tdS, fontFamily: 'monospace', fontWeight: 600, color: '#3730a3' }}>{inv.invoiceNumber}</td>
                      <td style={tdS}>{inv.buyer?.clientName || '-'}</td>
                      <td style={{ ...tdS, textAlign: 'right', fontFamily: 'monospace' }}>{formatCurrency(inv.grandTotal || 0)}</td>
                      <td style={{ ...tdS, textAlign: 'right', fontFamily: 'monospace', color: '#16a34a' }}>{formatCurrency(paid)}</td>
                      <td style={{ ...tdS, textAlign: 'right', fontFamily: 'monospace', color: due > 0 ? '#dc2626' : '#16a34a', fontWeight: 700 }}>{formatCurrency(due)}</td>
                      <td style={tdS}>
                        <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: statusBg(inv.status), color: statusColor(inv.status) }}>
                          {inv.status?.toUpperCase()}
                        </span>
                      </td>
                      <td style={tdS}>
                        <button onClick={e => { e.stopPropagation(); setSelected(inv); }}
                          style={{ fontSize: 12, color: '#3730a3', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                          + Payment
                        </button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {selected && (
          <div className="card p-4 space-y-4" style={{ height: 'fit-content' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontWeight: 700, fontSize: 15 }}>{selected.invoiceNumber}</p>
                <p style={{ fontSize: 12, color: '#888' }}>{selected.buyer?.clientName}</p>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#888' }}>x</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, background: '#f9f9f7', borderRadius: 8, padding: 12 }}>
              <div><p style={{ fontSize: 11, color: '#888' }}>Total</p><p style={{ fontWeight: 700 }}>{formatCurrency(selected.grandTotal || 0)}</p></div>
              <div><p style={{ fontSize: 11, color: '#888' }}>Paid</p><p style={{ fontWeight: 700, color: '#16a34a' }}>{formatCurrency(selected.amountPaid || 0)}</p></div>
              <div><p style={{ fontSize: 11, color: '#888' }}>Due</p><p style={{ fontWeight: 700, color: '#dc2626' }}>{formatCurrency((selected.grandTotal || 0) - (selected.amountPaid || 0))}</p></div>
            </div>
            <div style={{ borderTop: '1px solid #e8e8e0', paddingTop: 12 }}>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>New Payment</p>
              <input type="number" placeholder="Amount (Rs)" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className="input w-full mb-2" />
              <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="input w-full mb-2" />
              <select value={form.mode} onChange={e => setForm({ ...form, mode: e.target.value })} className="input w-full mb-2">
                <option value="bank">Bank Transfer</option>
                <option value="upi">UPI</option>
                <option value="cash">Cash</option>
                <option value="cheque">Cheque</option>
                <option value="other">Other</option>
              </select>
              <input type="text" placeholder="Note (optional)" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} className="input w-full mb-2" />
              <button onClick={addPayment} style={{ width: '100%', padding: '9px', background: '#1c1c18', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Plus size={15} /> Add Payment
              </button>
            </div>
            {(selected.payments || []).length > 0 && (
              <div style={{ borderTop: '1px solid #e8e8e0', paddingTop: 12 }}>
                <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Payment History</p>
                {selected.payments.map(p => (
                  <div key={p._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f0f0ec' }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#16a34a' }}>{formatCurrency(p.amount)}</p>
                      <p style={{ fontSize: 11, color: '#888' }}>{new Date(p.date).toLocaleDateString('en-IN')} . {p.mode}{p.note ? ` . ${p.note}` : ''}</p>
                    </div>
                    <button onClick={() => deletePayment(p._id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
