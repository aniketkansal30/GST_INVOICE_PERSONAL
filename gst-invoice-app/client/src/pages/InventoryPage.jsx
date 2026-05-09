import React, { useEffect, useState } from 'react';
import { useInvoices } from '../context/InvoiceContext';
import { formatCurrency } from '../utils/invoiceUtils';
import { Package, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function InventoryPage() {
  const { invoices, fetchInvoices } = useInvoices();
  const [allInvoices, setAllInvoices] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [activeTab, setActiveTab] = useState('item');

  useEffect(() => { fetchInvoices({ limit: 1000, page: 1 }); }, []);
  useEffect(() => { setAllInvoices(invoices); }, [invoices]);

  const filtered = allInvoices.filter(inv => {
    if (!inv.invoiceDate) return false;
    const d = new Date(inv.invoiceDate);
    const monthMatch = selectedMonth ? (d.getMonth() + 1) === Number(selectedMonth) : true;
    const yearMatch = selectedYear ? d.getFullYear() === Number(selectedYear) : true;
    return monthMatch && yearMatch;
  });

  // Item-wise sales
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

  // HSN-wise sales
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
    const itemRows = [['#','Item Name','HSN','UOM','GST%','Qty Sold','Taxable Amt','Total GST','Grand Total']];
    itemWise.forEach((r,i) => itemRows.push([i+1, r.name, r.hsn, r.uom, r.gstPct+'%', r.qtySold, r.taxable, r.totalGst, r.grandTotal]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(itemRows), 'Item-wise Sales');
    const hsnRows = [['#','HSN/SAC','Description','UOM','GST%','Qty Sold','Taxable Amt','Total GST','Grand Total']];
    hsnWise.forEach((r,i) => hsnRows.push([i+1, r.hsn, r.description, r.uom, r.gstPct+'%', r.qtySold, r.taxable, r.totalGst, r.grandTotal]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(hsnRows), 'HSN-wise Sales');
    const month = selectedMonth ? months.find(m => m.value === selectedMonth)?.label : 'All';
    XLSX.writeFile(wb, `Inventory_${month}_${selectedYear || 'All'}.xlsx`);
  };

  const months = [
    {value:'1',label:'January'},{value:'2',label:'February'},{value:'3',label:'March'},
    {value:'4',label:'April'},{value:'5',label:'May'},{value:'6',label:'June'},
    {value:'7',label:'July'},{value:'8',label:'August'},{value:'9',label:'September'},
    {value:'10',label:'October'},{value:'11',label:'November'},{value:'12',label:'December'},
  ];
  const years = ['2023','2024','2025','2026'];
  const tabs = [
    { key: 'item', label: 'Item-wise Sales' },
    { key: 'hsn', label: 'HSN-wise Sales' },
  ];

  const thS = (right=false) => ({ padding:'10px 12px', textAlign:right?'right':'left', fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.5px', color:'white', whiteSpace:'nowrap', background:'#1c1c18' });
  const tdS = (right=false) => ({ padding:'9px 12px', fontSize:'12.5px', textAlign:right?'right':'left', borderBottom:'1px solid #e8e8e0', fontFamily:right?'monospace':'inherit' });

  return (
    <div className="max-w-7xl mx-auto animate-slide-up space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-800 dark:text-ink-100 flex items-center gap-2">
            <Package size={22} /> Inventory / Sales Report
          </h1>
          <p className="text-sm text-ink-400 mt-1">Item-wise aur HSN-wise kitna bikaa — sab ek jagah</p>
        </div>
        <button onClick={exportToExcel} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold" style={{background:'#16a34a',color:'white',border:'none',cursor:'pointer'}}>
          <Download size={16}/> Export Excel
        </button>
      </div>

      {/* Summary Cards */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16}}>
        <div className="card p-5">
          <p className="text-sm text-ink-400 mb-1">Total Sales Value</p>
          <p className="font-display text-2xl font-bold text-ink-800 dark:text-ink-100">{formatCurrency(totalSalesValue)}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-ink-400 mb-1">Total Qty Sold</p>
          <p className="font-display text-2xl font-bold" style={{color:'#2563eb'}}>{totalQtySold} units</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-ink-400 mb-1">Total Tax Collected</p>
          <p className="font-display text-2xl font-bold" style={{color:'#d97706'}}>{formatCurrency(totalTaxCollected)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 flex gap-4 items-center">
        <div>
          <label className="label">Month</label>
          <select value={selectedMonth} onChange={e=>setSelectedMonth(e.target.value)} className="input w-40">
            <option value="">All Months</option>
            {months.map(m=><option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Year</label>
          <select value={selectedYear} onChange={e=>setSelectedYear(e.target.value)} className="input w-32">
            <option value="">All Years</option>
            {years.map(y=><option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="ml-auto text-sm text-ink-400">
          Showing <strong className="text-ink-700 dark:text-ink-200">{filtered.length}</strong> invoices
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-ink-100 dark:border-ink-800">
        {tabs.map(tab=>(
          <button key={tab.key} onClick={()=>setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all ${activeTab===tab.key?'border-ink-800 dark:border-amber-500 text-ink-800 dark:text-amber-400':'border-transparent text-ink-400 hover:text-ink-600'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">

        {/* Item-wise Sales */}
        {activeTab==='item' && (
          <div className="overflow-x-auto">
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead><tr>
                {['#','Item Name','HSN','UOM','GST %','Qty Sold','Taxable Amt','Total GST','Grand Total'].map((h,i)=>(
                  <th key={i} style={thS(i>=4)}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {itemWise.length===0
                  ? <tr><td colSpan={9} style={{textAlign:'center',padding:40,color:'#888'}}>No data</td></tr>
                  : itemWise.map((row,i)=>(
                    <tr key={i} style={{background:i%2===0?'white':'#f4f4f0'}}>
                      <td style={tdS()}>{i+1}</td>
                      <td style={{...tdS(),fontWeight:'500'}}>{row.name}</td>
                      <td style={{...tdS(),fontFamily:'monospace',color:'#6e6e60'}}>{row.hsn}</td>
                      <td style={tdS()}>{row.uom}</td>
                      <td style={{...tdS(true),fontWeight:'600'}}>{row.gstPct}%</td>
                      <td style={{...tdS(true),color:'#2563eb',fontWeight:'700'}}>{row.qtySold}</td>
                      <td style={tdS(true)}>{formatCurrency(row.taxable)}</td>
                      <td style={{...tdS(true),color:'#d97706'}}>{formatCurrency(row.totalGst)}</td>
                      <td style={{...tdS(true),fontWeight:'700'}}>{formatCurrency(row.grandTotal)}</td>
                    </tr>
                  ))}
              </tbody>
              {itemWise.length>0 && <tfoot><tr style={{background:'#1c1c18',color:'white'}}>
                <td colSpan={5} style={{padding:'10px 12px',fontWeight:'700',fontSize:'12px'}}>TOTAL</td>
                <td style={{padding:'10px 12px',textAlign:'right',fontFamily:'monospace',fontWeight:'700'}}>{totalQtySold}</td>
                <td style={{padding:'10px 12px',textAlign:'right',fontFamily:'monospace',fontWeight:'700'}}>{formatCurrency(itemWise.reduce((s,r)=>s+r.taxable,0))}</td>
                <td style={{padding:'10px 12px',textAlign:'right',fontFamily:'monospace',fontWeight:'700'}}>{formatCurrency(totalTaxCollected)}</td>
                <td style={{padding:'10px 12px',textAlign:'right',fontFamily:'monospace',fontWeight:'700'}}>{formatCurrency(totalSalesValue)}</td>
              </tr></tfoot>}
            </table>
          </div>
        )}

        {/* HSN-wise Sales */}
        {activeTab==='hsn' && (
          <div className="overflow-x-auto">
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead><tr>
                {['#','HSN/SAC','Description','UOM','GST %','Qty Sold','Taxable Amt','Total GST','Grand Total'].map((h,i)=>(
                  <th key={i} style={thS(i>=4)}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {hsnWise.length===0
                  ? <tr><td colSpan={9} style={{textAlign:'center',padding:40,color:'#888'}}>No data</td></tr>
                  : hsnWise.map((row,i)=>(
                    <tr key={i} style={{background:i%2===0?'white':'#f4f4f0'}}>
                      <td style={tdS()}>{i+1}</td>
                      <td style={{...tdS(),fontFamily:'monospace',fontWeight:'700',color:'#1c1c18'}}>{row.hsn==='-'?'No HSN':row.hsn}</td>
                      <td style={tdS()}>{row.description}</td>
                      <td style={tdS()}>{row.uom}</td>
                      <td style={{...tdS(true),fontWeight:'600'}}>{row.gstPct}%</td>
                      <td style={{...tdS(true),color:'#2563eb',fontWeight:'700'}}>{row.qtySold}</td>
                      <td style={tdS(true)}>{formatCurrency(row.taxable)}</td>
                      <td style={{...tdS(true),color:'#d97706'}}>{formatCurrency(row.totalGst)}</td>
                      <td style={{...tdS(true),fontWeight:'700'}}>{formatCurrency(row.grandTotal)}</td>
                    </tr>
                  ))}
              </tbody>
              {hsnWise.length>0 && <tfoot><tr style={{background:'#1c1c18',color:'white'}}>
                <td colSpan={5} style={{padding:'10px 12px',fontWeight:'700',fontSize:'12px'}}>TOTAL</td>
                <td style={{padding:'10px 12px',textAlign:'right',fontFamily:'monospace',fontWeight:'700'}}>{hsnWise.reduce((s,r)=>s+r.qtySold,0)}</td>
                <td style={{padding:'10px 12px',textAlign:'right',fontFamily:'monospace',fontWeight:'700'}}>{formatCurrency(hsnWise.reduce((s,r)=>s+r.taxable,0))}</td>
                <td style={{padding:'10px 12px',textAlign:'right',fontFamily:'monospace',fontWeight:'700'}}>{formatCurrency(hsnWise.reduce((s,r)=>s+r.totalGst,0))}</td>
                <td style={{padding:'10px 12px',textAlign:'right',fontFamily:'monospace',fontWeight:'700'}}>{formatCurrency(hsnWise.reduce((s,r)=>s+r.grandTotal,0))}</td>
              </tr></tfoot>}
            </table>
          </div>
        )}

      </div>
    </div>
  );
}
