import React, { useEffect, useState } from 'react';
import { useInvoices } from '../context/InvoiceContext';
import { formatCurrency } from '../utils/invoiceUtils';
import { FileText, Download } from 'lucide-react';

export default function Report() {
  const { invoices, fetchInvoices } = useInvoices();
  const [allInvoices, setAllInvoices] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [activeTab, setActiveTab] = useState('party');

  useEffect(() => {
    fetchInvoices({ limit: 1000, page: 1 });
  }, []);

  useEffect(() => {
    setAllInvoices(invoices);
  }, [invoices]);

  // Filter by month/year
  const filtered = allInvoices.filter(inv => {
    if (!inv.invoiceDate) return false;
    const d = new Date(inv.invoiceDate);
    const monthMatch = selectedMonth ? (d.getMonth() + 1) === Number(selectedMonth) : true;
    const yearMatch = selectedYear ? d.getFullYear() === Number(selectedYear) : true;
    return monthMatch && yearMatch;
  });

  // Party-wise
  const partyWise = Object.values(
    filtered.reduce((acc, inv) => {
      const key = inv.buyer?.clientName || 'Unknown';
      if (!acc[key]) acc[key] = {
        party: key,
        gstin: inv.buyer?.gstNumber || '-',
        state: inv.buyer?.state || '-',
        invoices: 0,
        taxable: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        total: 0,
      };
      acc[key].invoices += 1;
      acc[key].taxable += inv.subtotal || 0;
      acc[key].cgst += inv.cgst || 0;
      acc[key].sgst += inv.sgst || 0;
      acc[key].igst += inv.igst || 0;
      acc[key].total += inv.grandTotal || 0;
      return acc;
    }, {})
  );

  // HSN-wise
  const hsnWise = Object.values(
    filtered.flatMap(inv => inv.items || []).reduce((acc, item) => {
      const key = item.hsn || `NO_HSN_${item.name || ""}`;
      if (!acc[key]) acc[key] = { hsn: item.hsn || 'No HSN',
        description: item.name || '-',
        uom: item.unit || 'Nos',
        qty: 0,
        taxable: 0,
        igst: 0,
        cgst: 0,
        sgst: 0,
      };
      acc[key].qty += Number(item.qty) || 0;
      const base = (Number(item.qty) || 0) * (Number(item.rate) || 0);
      acc[key].taxable += base;
      const gst = (base * (Number(item.gstPct) || 0)) / 100;
      acc[key].igst += gst;
      acc[key].cgst += gst / 2;
      acc[key].sgst += gst / 2;
      return acc;
    }, {})
  );

  // GST%-wise
  const gstWise = Object.values(
    filtered.flatMap(inv => inv.items || []).reduce((acc, item) => {
      const key = `${item.gstPct || 0}%`;
      if (!acc[key]) acc[key] = {
        rate: key,
        taxable: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        total: 0,
      };
      const base = (Number(item.qty) || 0) * (Number(item.rate) || 0);
      const gst = (base * (Number(item.gstPct) || 0)) / 100;
      acc[key].taxable += base;
      acc[key].cgst += gst / 2;
      acc[key].sgst += gst / 2;
      acc[key].igst += gst;
      acc[key].total += base + gst;
      return acc;
    }, {})
  ).sort((a, b) => parseFloat(a.rate) - parseFloat(b.rate));

  // Item-wise
  const itemWise = Object.values(
    filtered.flatMap(inv => inv.items || []).reduce((acc, item) => {
      const key = item.name || 'Unknown';
      if (!acc[key]) acc[key] = {
        name: key,
        hsn: item.hsn || '-',
        uom: item.unit || 'Nos',
        gstPct: item.gstPct || 0,
        qty: 0,
        taxable: 0,
        gst: 0,
        total: 0,
      };
      const base = (Number(item.qty) || 0) * (Number(item.rate) || 0);
      const gst = (base * (Number(item.gstPct) || 0)) / 100;
      acc[key].qty += Number(item.qty) || 0;
      acc[key].taxable += base;
      acc[key].gst += gst;
      acc[key].total += base + gst;
      return acc;
    }, {})
  );

  const months = [
    { value: '1', label: 'January' }, { value: '2', label: 'February' },
    { value: '3', label: 'March' }, { value: '4', label: 'April' },
    { value: '5', label: 'May' }, { value: '6', label: 'June' },
    { value: '7', label: 'July' }, { value: '8', label: 'August' },
    { value: '9', label: 'September' }, { value: '10', label: 'October' },
    { value: '11', label: 'November' }, { value: '12', label: 'December' },
  ];

  const years = ['2023', '2024', '2025', '2026'];

  const tabs = [
    { key: 'party', label: 'Party-wise (B2B)' },
    { key: 'hsn', label: 'HSN-wise' },
    { key: 'gst', label: 'GST % wise' },
    { key: 'item', label: 'Item-wise' },
  ];

  const thStyle = (right = false) => ({
    padding: '10px 12px',
    textAlign: right ? 'right' : 'left',
    fontSize: '11px',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    color: 'white',
    whiteSpace: 'nowrap',
    background: '#1c1c18',
  });

  const tdStyle = (right = false) => ({
    padding: '9px 12px',
    fontSize: '12.5px',
    textAlign: right ? 'right' : 'left',
    borderBottom: '1px solid #e8e8e0',
    fontFamily: right ? 'monospace' : 'inherit',
  });

  return (
    <div className="max-w-7xl mx-auto animate-slide-up space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-800 dark:text-ink-100 flex items-center gap-2">
            <FileText size={22} /> GSTR-1 Report
          </h1>
          <p className="text-sm text-ink-400 mt-1">Party-wise, HSN-wise, GST%-wise & Item-wise summary</p>
        </div>
      </div>

      {/* Filters */}
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

      {/* Tabs */}
      <div className="flex gap-2 border-b border-ink-100 dark:border-ink-800">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all ${activeTab === tab.key
                ? 'border-ink-800 dark:border-amber-500 text-ink-800 dark:text-amber-400'
                : 'border-transparent text-ink-400 hover:text-ink-600'
              }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tables */}
      <div className="card overflow-hidden">

        {/* Party-wise */}
        {activeTab === 'party' && (
          <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['#', 'Party Name', 'GSTIN', 'State', 'Invoices', 'Taxable Amt', 'CGST', 'SGST', 'IGST', 'Total'].map((h, i) => (
                    <th key={h} style={thStyle(i >= 4)}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {partyWise.length === 0 ? (
                  <tr><td colSpan={10} style={{ textAlign: 'center', padding: '40px', color: '#6e6e60' }}>No data found</td></tr>
                ) : partyWise.map((row, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? 'white' : '#f4f4f0' }}>
                    <td style={tdStyle()}>{i + 1}</td>
                    <td style={tdStyle()}><strong>{row.party}</strong></td>
                    <td style={{ ...tdStyle(), fontFamily: 'monospace', color: '#6e6e60' }}>{row.gstin}</td>
                    <td style={tdStyle()}>{row.state}</td>
                    <td style={tdStyle(true)}>{row.invoices}</td>
                    <td style={tdStyle(true)}>{formatCurrency(row.taxable)}</td>
                    <td style={tdStyle(true)}>{formatCurrency(row.cgst)}</td>
                    <td style={tdStyle(true)}>{formatCurrency(row.sgst)}</td>
                    <td style={tdStyle(true)}>{formatCurrency(row.igst)}</td>
                    <td style={{ ...tdStyle(true), fontWeight: '700' }}>{formatCurrency(row.total)}</td>
                  </tr>
                ))}
              </tbody>
              {partyWise.length > 0 && (
                <tfoot>
                  <tr style={{ background: '#1c1c18', color: 'white' }}>
                    <td colSpan={5} style={{ padding: '10px 12px', fontWeight: '700', fontSize: '12px' }}>TOTAL</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '700' }}>{formatCurrency(partyWise.reduce((s, r) => s + r.taxable, 0))}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '700' }}>{formatCurrency(partyWise.reduce((s, r) => s + r.cgst, 0))}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '700' }}>{formatCurrency(partyWise.reduce((s, r) => s + r.sgst, 0))}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '700' }}>{formatCurrency(partyWise.reduce((s, r) => s + r.igst, 0))}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '700' }}>{formatCurrency(partyWise.reduce((s, r) => s + r.total, 0))}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        {/* HSN-wise */}
        {activeTab === 'hsn' && (
          <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['#', 'HSN/SAC', 'Description', 'UOM', 'Total Qty', 'Taxable Amt', 'CGST', 'SGST', 'IGST'].map((h, i) => (
                    <th key={h} style={thStyle(i >= 4)}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hsnWise.length === 0 ? (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: '#6e6e60' }}>No data found</td></tr>
                ) : hsnWise.map((row, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? 'white' : '#f4f4f0' }}>
                    <td style={tdStyle()}>{i + 1}</td>
                    <td style={{ ...tdStyle(), fontFamily: "monospace", fontWeight: "600" }}>{row.hsn.startsWith("NO_HSN_") ? "-" : row.hsn}</td>
                    <td style={tdStyle()}>{row.description}</td>
                    <td style={tdStyle()}>{row.uom}</td>
                    <td style={tdStyle(true)}>{row.qty}</td>
                    <td style={tdStyle(true)}>{formatCurrency(row.taxable)}</td>
                    <td style={tdStyle(true)}>{formatCurrency(row.cgst)}</td>
                    <td style={tdStyle(true)}>{formatCurrency(row.sgst)}</td>
                    <td style={tdStyle(true)}>{formatCurrency(row.igst)}</td>
                  </tr>
                ))}
              </tbody>
              {hsnWise.length > 0 && (
                <tfoot>
                  <tr style={{ background: '#1c1c18', color: 'white' }}>
                    <td colSpan={5} style={{ padding: '10px 12px', fontWeight: '700', fontSize: '12px' }}>TOTAL</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '700' }}>{formatCurrency(hsnWise.reduce((s, r) => s + r.taxable, 0))}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '700' }}>{formatCurrency(hsnWise.reduce((s, r) => s + r.cgst, 0))}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '700' }}>{formatCurrency(hsnWise.reduce((s, r) => s + r.sgst, 0))}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '700' }}>{formatCurrency(hsnWise.reduce((s, r) => s + r.igst, 0))}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        {/* GST%-wise */}
        {activeTab === 'gst' && (
          <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['#', 'GST Rate', 'Taxable Amount', 'CGST', 'SGST', 'IGST', 'Total Tax', 'Grand Total'].map((h, i) => (
                    <th key={h} style={thStyle(i >= 2)}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gstWise.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: '#6e6e60' }}>No data found</td></tr>
                ) : gstWise.map((row, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? 'white' : '#f4f4f0' }}>
                    <td style={tdStyle()}>{i + 1}</td>
                    <td style={{ ...tdStyle(), fontWeight: '700', color: '#1c1c18' }}>{row.rate}</td>
                    <td style={tdStyle(true)}>{formatCurrency(row.taxable)}</td>
                    <td style={tdStyle(true)}>{formatCurrency(row.cgst)}</td>
                    <td style={tdStyle(true)}>{formatCurrency(row.sgst)}</td>
                    <td style={tdStyle(true)}>{formatCurrency(row.igst)}</td>
                    <td style={tdStyle(true)}>{formatCurrency(row.cgst + row.sgst)}</td>
                    <td style={{ ...tdStyle(true), fontWeight: '700' }}>{formatCurrency(row.total)}</td>
                  </tr>
                ))}
              </tbody>
              {gstWise.length > 0 && (
                <tfoot>
                  <tr style={{ background: '#1c1c18', color: 'white' }}>
                    <td colSpan={2} style={{ padding: '10px 12px', fontWeight: '700', fontSize: '12px' }}>TOTAL</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '700' }}>{formatCurrency(gstWise.reduce((s, r) => s + r.taxable, 0))}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '700' }}>{formatCurrency(gstWise.reduce((s, r) => s + r.cgst, 0))}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '700' }}>{formatCurrency(gstWise.reduce((s, r) => s + r.sgst, 0))}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '700' }}>{formatCurrency(gstWise.reduce((s, r) => s + r.igst, 0))}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '700' }}>{formatCurrency(gstWise.reduce((s, r) => s + r.cgst + r.sgst, 0))}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '700' }}>{formatCurrency(gstWise.reduce((s, r) => s + r.total, 0))}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        {/* Item-wise */}
        {activeTab === 'item' && (
          <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['#', 'Item Name', 'HSN/SAC', 'UOM', 'GST %', 'Total Qty', 'Taxable Amt', 'Total GST', 'Grand Total'].map((h, i) => (
                    <th key={h} style={thStyle(i >= 4)}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {itemWise.length === 0 ? (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: '#6e6e60' }}>No data found</td></tr>
                ) : itemWise.map((row, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? 'white' : '#f4f4f0' }}>
                    <td style={tdStyle()}>{i + 1}</td>
                    <td style={{ ...tdStyle(), fontWeight: '500' }}>{row.name}</td>
                    <td style={{ ...tdStyle(), fontFamily: 'monospace', color: '#6e6e60' }}>{row.hsn}</td>
                    <td style={tdStyle()}>{row.uom}</td>
                    <td style={{ ...tdStyle(true), fontWeight: '600' }}>{row.gstPct}%</td>
                    <td style={tdStyle(true)}>{row.qty}</td>
                    <td style={tdStyle(true)}>{formatCurrency(row.taxable)}</td>
                    <td style={tdStyle(true)}>{formatCurrency(row.gst)}</td>
                    <td style={{ ...tdStyle(true), fontWeight: '700' }}>{formatCurrency(row.total)}</td>
                  </tr>
                ))}
              </tbody>
              {itemWise.length > 0 && (
                <tfoot>
                  <tr style={{ background: '#1c1c18', color: 'white' }}>
                    <td colSpan={6} style={{ padding: '10px 12px', fontWeight: '700', fontSize: '12px' }}>TOTAL</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '700' }}>{formatCurrency(itemWise.reduce((s, r) => s + r.taxable, 0))}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '700' }}>{formatCurrency(itemWise.reduce((s, r) => s + r.gst, 0))}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '700' }}>{formatCurrency(itemWise.reduce((s, r) => s + r.total, 0))}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  );
}


