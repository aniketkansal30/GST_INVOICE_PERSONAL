import React, { useEffect, useState } from 'react';
import { useInvoices } from '../context/InvoiceContext';
import { formatCurrency } from '../utils/invoiceUtils';
import { FileText, Download, ChevronDown, ChevronRight } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function Report() {
  const { invoices, fetchInvoices } = useInvoices();
  const [allInvoices, setAllInvoices] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [activeTab, setActiveTab] = useState('party');
  const [expandedParties, setExpandedParties] = useState({});
  const [expandedHSN, setExpandedHSN] = useState({});

  useEffect(() => { fetchInvoices({ limit: 1000, page: 1 }); }, []);
  useEffect(() => { setAllInvoices(invoices); }, [invoices]);

  const filtered = allInvoices.filter(inv => {
    if (!inv.invoiceDate) return false;
    const d = new Date(inv.invoiceDate);
    const monthMatch = selectedMonth ? (d.getMonth() + 1) === Number(selectedMonth) : true;
    const yearMatch = selectedYear ? d.getFullYear() === Number(selectedYear) : true;
    return monthMatch && yearMatch;
  });

  // Party-wise with invoice-level detail
  const partyWise = Object.values(
    filtered.reduce((acc, inv) => {
      const key = inv.buyer?.clientName || 'Unknown';
      if (!acc[key]) acc[key] = {
        party: key, gstin: inv.buyer?.gstNumber || '-', state: inv.buyer?.state || '-',
        invoiceList: [], taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0,
      };
      acc[key].invoiceList.push({
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString('en-IN') : '-',
        dueDate: inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('en-IN') : '-',
        placeOfSupply: inv.buyer?.state || '-',
        taxable: inv.subtotal || 0, cgst: inv.cgst || 0, sgst: inv.sgst || 0,
        igst: inv.igst || 0, total: inv.grandTotal || 0, status: inv.status || 'draft',
      });
      acc[key].taxable += inv.subtotal || 0;
      acc[key].cgst += inv.cgst || 0;
      acc[key].sgst += inv.sgst || 0;
      acc[key].igst += inv.igst || 0;
      acc[key].total += inv.grandTotal || 0;
      return acc;
    }, {})
  );

  // HSN-wise with invoice-level drill-down
  const hsnWise = Object.values(
    filtered.reduce((acc, inv) => {
      (inv.items || []).forEach(item => {
        const key = item.hsn || 'NO_HSN';
        if (!acc[key]) acc[key] = {
          hsn: item.hsn || '-', description: item.name || '-', uom: item.unit || 'Nos',
          qty: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0,
          invoiceList: [],
        };
        const base = (Number(item.qty) || 0) * (Number(item.rate) || 0);
        const gst = (base * (Number(item.gstPct) || 0)) / 100;
        acc[key].qty += Number(item.qty) || 0;
        acc[key].taxable += base;
        acc[key].cgst += gst / 2;
        acc[key].sgst += gst / 2;
        acc[key].igst += gst;
        // invoice level detail
        const existing = acc[key].invoiceList.find(i => i.invoiceNumber === inv.invoiceNumber);
        if (existing) {
          existing.qty += Number(item.qty) || 0;
          existing.taxable += base;
          existing.cgst += gst / 2;
          existing.sgst += gst / 2;
          existing.igst += gst;
        } else {
          acc[key].invoiceList.push({
            invoiceNumber: inv.invoiceNumber,
            invoiceDate: inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString('en-IN') : '-',
            party: inv.buyer?.clientName || '-',
            gstPct: item.gstPct || 0,
            qty: Number(item.qty) || 0,
            taxable: base,
            cgst: gst / 2,
            sgst: gst / 2,
            igst: gst,
          });
        }
      });
      return acc;
    }, {})
  );

  const gstWise = Object.values(
    filtered.flatMap(inv => inv.items || []).reduce((acc, item) => {
      const key = `${item.gstPct || 0}%`;
      if (!acc[key]) acc[key] = { rate: key, taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 };
      const base = (Number(item.qty) || 0) * (Number(item.rate) || 0);
      const gst = (base * (Number(item.gstPct) || 0)) / 100;
      acc[key].taxable += base; acc[key].cgst += gst / 2; acc[key].sgst += gst / 2;
      acc[key].igst += gst; acc[key].total += base + gst;
      return acc;
    }, {})
  ).sort((a, b) => parseFloat(a.rate) - parseFloat(b.rate));

  const itemWise = Object.values(
    filtered.flatMap(inv => inv.items || []).reduce((acc, item) => {
      const key = item.name || 'Unknown';
      if (!acc[key]) acc[key] = { name: key, hsn: item.hsn || '-', uom: item.unit || 'Nos', gstPct: item.gstPct || 0, qty: 0, taxable: 0, gst: 0, total: 0 };
      const base = (Number(item.qty) || 0) * (Number(item.rate) || 0);
      const gst = (base * (Number(item.gstPct) || 0)) / 100;
      acc[key].qty += Number(item.qty) || 0;
      acc[key].taxable += base; acc[key].gst += gst; acc[key].total += base + gst;
      return acc;
    }, {})
  );

  const toggleParty = (k) => setExpandedParties(p => ({ ...p, [k]: !p[k] }));
  const toggleHSN = (k) => setExpandedHSN(p => ({ ...p, [k]: !p[k] }));

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();

    // Party-wise sheet
    const partyRows = [['#','Party','GSTIN','State','Invoice No','Date','Due Date','Place of Supply','Taxable','CGST','SGST','IGST','Total','Status']];
    let sr = 1;
    partyWise.forEach(p => {
      p.invoiceList.forEach(inv => {
        partyRows.push([sr++, p.party, p.gstin, p.state, inv.invoiceNumber, inv.invoiceDate, inv.dueDate, inv.placeOfSupply, inv.taxable, inv.cgst, inv.sgst, inv.igst, inv.total, inv.status]);
      });
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(partyRows), 'Party-wise B2B');

    // HSN-wise sheet
    const hsnRows = [['#','HSN/SAC','Description','UOM','Invoice No','Date','Party','GST%','Qty','Taxable','CGST','SGST','IGST']];
    hsnWise.forEach((r, i) => {
      r.invoiceList.forEach(inv => {
        hsnRows.push([i+1, r.hsn, r.description, r.uom, inv.invoiceNumber, inv.invoiceDate, inv.party, inv.gstPct+'%', inv.qty, inv.taxable, inv.cgst, inv.sgst, inv.igst]);
      });
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(hsnRows), 'HSN-wise');

    // GST%-wise sheet
    const gstRows = [['#','GST Rate','Taxable','CGST','SGST','IGST','Total Tax','Grand Total']];
    gstWise.forEach((r,i) => gstRows.push([i+1, r.rate, r.taxable, r.cgst, r.sgst, r.igst, r.cgst+r.sgst, r.total]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(gstRows), 'GST%-wise');

    // Item-wise sheet
    const itemRows = [['#','Item','HSN','UOM','GST%','Qty','Taxable','Total GST','Grand Total']];
    itemWise.forEach((r,i) => itemRows.push([i+1, r.name, r.hsn, r.uom, r.gstPct+'%', r.qty, r.taxable, r.gst, r.total]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(itemRows), 'Item-wise');

    const month = selectedMonth ? months.find(m => m.value === selectedMonth)?.label : 'All';
    XLSX.writeFile(wb, `GSTR1_${month}_${selectedYear || 'All'}.xlsx`);
  };

  const months = [
    {value:'1',label:'January'},{value:'2',label:'February'},{value:'3',label:'March'},
    {value:'4',label:'April'},{value:'5',label:'May'},{value:'6',label:'June'},
    {value:'7',label:'July'},{value:'8',label:'August'},{value:'9',label:'September'},
    {value:'10',label:'October'},{value:'11',label:'November'},{value:'12',label:'December'},
  ];
  const years = ['2023','2024','2025','2026'];
  const tabs = [
    {key:'party',label:'Party-wise (B2B)'},
    {key:'hsn',label:'HSN-wise'},
    {key:'gst',label:'GST % wise'},
    {key:'item',label:'Item-wise'},
  ];

  const thS = (right=false) => ({ padding:'10px 12px', textAlign:right?'right':'left', fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.5px', color:'white', whiteSpace:'nowrap', background:'#1c1c18' });
  const tdS = (right=false) => ({ padding:'9px 12px', fontSize:'12.5px', textAlign:right?'right':'left', borderBottom:'1px solid #e8e8e0', fontFamily:right?'monospace':'inherit' });
  const statusColor = (s) => ({draft:'#888',sent:'#2563eb',paid:'#16a34a',partial:'#d97706',overdue:'#dc2626'}[s]||'#888');

  return (
    <div className="max-w-7xl mx-auto animate-slide-up space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-800 dark:text-ink-100 flex items-center gap-2">
            <FileText size={22} /> GSTR-1 Report
          </h1>
          <p className="text-sm text-ink-400 mt-1">Party-wise, HSN-wise, GST%-wise & Item-wise summary</p>
        </div>
        <button onClick={exportToExcel} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold" style={{background:'#16a34a',color:'white',border:'none',cursor:'pointer'}}>
          <Download size={16}/> Export to Excel
        </button>
      </div>

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

      <div className="flex gap-2 border-b border-ink-100 dark:border-ink-800">
        {tabs.map(tab=>(
          <button key={tab.key} onClick={()=>setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all ${activeTab===tab.key?'border-ink-800 dark:border-amber-500 text-ink-800 dark:text-amber-400':'border-transparent text-ink-400 hover:text-ink-600'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">

        {/* Party-wise */}
        {activeTab==='party' && (
          <div className="overflow-x-auto">
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead><tr>
                {['','#','Party Name','GSTIN','State','Invoices','Taxable Amt','CGST','SGST','IGST','Total'].map((h,i)=>(
                  <th key={i} style={thS(i>=5)}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {partyWise.length===0
                  ? <tr><td colSpan={11} style={{textAlign:'center',padding:40,color:'#888'}}>No data</td></tr>
                  : partyWise.map((row,i)=>(
                    <React.Fragment key={i}>
                      <tr style={{background:i%2===0?'white':'#f4f4f0',cursor:'pointer'}} onClick={()=>toggleParty(row.party)}>
                        <td style={{...tdS(),width:32}}>{expandedParties[row.party]?<ChevronDown size={14}/>:<ChevronRight size={14}/>}</td>
                        <td style={tdS()}>{i+1}</td>
                        <td style={tdS()}><strong>{row.party}</strong></td>
                        <td style={{...tdS(),fontFamily:'monospace',color:'#6e6e60'}}>{row.gstin}</td>
                        <td style={tdS()}>{row.state}</td>
                        <td style={tdS(true)}>{row.invoiceList.length}</td>
                        <td style={tdS(true)}>{formatCurrency(row.taxable)}</td>
                        <td style={tdS(true)}>{formatCurrency(row.cgst)}</td>
                        <td style={tdS(true)}>{formatCurrency(row.sgst)}</td>
                        <td style={tdS(true)}>{formatCurrency(row.igst)}</td>
                        <td style={{...tdS(true),fontWeight:'700'}}>{formatCurrency(row.total)}</td>
                      </tr>
                      {expandedParties[row.party] && row.invoiceList.map((inv,j)=>(
                        <tr key={j} style={{background:'#eef2ff'}}>
                          <td colSpan={2} style={{...tdS(),paddingLeft:32}}></td>
                          <td style={{...tdS(),paddingLeft:16,fontSize:12,color:'#3730a3'}}>
                            <span style={{fontFamily:'monospace',fontWeight:600}}>{inv.invoiceNumber}</span>
                            <span style={{marginLeft:8,fontSize:11,color:'#6e6e60'}}>{inv.invoiceDate}</span>
                            <span style={{marginLeft:8,fontSize:10,padding:'2px 6px',borderRadius:4,background:statusColor(inv.status)+'20',color:statusColor(inv.status),fontWeight:600}}>{inv.status?.toUpperCase()}</span>
                          </td>
                          <td style={{...tdS(),fontSize:12,color:'#6e6e60'}}>{row.gstin}</td>
                          <td style={{...tdS(),fontSize:12}}>{inv.placeOfSupply}</td>
                          <td style={{...tdS(true),fontSize:12}}>Due: {inv.dueDate}</td>
                          <td style={{...tdS(true),fontSize:12}}>{formatCurrency(inv.taxable)}</td>
                          <td style={{...tdS(true),fontSize:12}}>{formatCurrency(inv.cgst)}</td>
                          <td style={{...tdS(true),fontSize:12}}>{formatCurrency(inv.sgst)}</td>
                          <td style={{...tdS(true),fontSize:12}}>{formatCurrency(inv.igst)}</td>
                          <td style={{...tdS(true),fontSize:12,fontWeight:700}}>{formatCurrency(inv.total)}</td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
              </tbody>
              {partyWise.length>0 && (
                <tfoot><tr style={{background:'#1c1c18',color:'white'}}>
                  <td colSpan={6} style={{padding:'10px 12px',fontWeight:'700',fontSize:'12px'}}>TOTAL</td>
                  {['taxable','cgst','sgst','igst','total'].map(k=>(
                    <td key={k} style={{padding:'10px 12px',textAlign:'right',fontFamily:'monospace',fontWeight:'700'}}>{formatCurrency(partyWise.reduce((s,r)=>s+r[k],0))}</td>
                  ))}
                </tr></tfoot>
              )}
            </table>
          </div>
        )}

        {/* HSN-wise with drill-down */}
        {activeTab==='hsn' && (
          <div className="overflow-x-auto">
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead><tr>
                {['','#','HSN/SAC','Description','UOM','Invoices','Total Qty','Taxable Amt','CGST','SGST','IGST'].map((h,i)=>(
                  <th key={i} style={thS(i>=5)}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {hsnWise.length===0
                  ? <tr><td colSpan={11} style={{textAlign:'center',padding:40,color:'#888'}}>No data</td></tr>
                  : hsnWise.map((row,i)=>(
                    <React.Fragment key={i}>
                      <tr style={{background:i%2===0?'white':'#f4f4f0',cursor:'pointer'}} onClick={()=>toggleHSN(row.hsn)}>
                        <td style={{...tdS(),width:32}}>{expandedHSN[row.hsn]?<ChevronDown size={14}/>:<ChevronRight size={14}/>}</td>
                        <td style={tdS()}>{i+1}</td>
                        <td style={{...tdS(),fontFamily:'monospace',fontWeight:'700',color:'#1c1c18'}}>{row.hsn==='-'?'No HSN':row.hsn}</td>
                        <td style={tdS()}>{row.description}</td>
                        <td style={tdS()}>{row.uom}</td>
                        <td style={tdS(true)}>{row.invoiceList.length}</td>
                        <td style={tdS(true)}>{row.qty}</td>
                        <td style={tdS(true)}>{formatCurrency(row.taxable)}</td>
                        <td style={tdS(true)}>{formatCurrency(row.cgst)}</td>
                        <td style={tdS(true)}>{formatCurrency(row.sgst)}</td>
                        <td style={tdS(true)}>{formatCurrency(row.igst)}</td>
                      </tr>
                      {expandedHSN[row.hsn] && row.invoiceList.map((inv,j)=>(
                        <tr key={j} style={{background:'#f0fdf4'}}>
                          <td colSpan={2} style={{...tdS(),paddingLeft:32}}></td>
                          <td style={{...tdS(),paddingLeft:16,fontSize:12,color:'#166534'}}>
                            <span style={{fontFamily:'monospace',fontWeight:600}}>{inv.invoiceNumber}</span>
                            <span style={{marginLeft:8,fontSize:11,color:'#6e6e60'}}>{inv.invoiceDate}</span>
                            <span style={{marginLeft:8,fontSize:11,color:'#888'}}>· {inv.party}</span>
                          </td>
                          <td style={{...tdS(),fontSize:12,color:'#6e6e60'}}>{row.description}</td>
                          <td style={{...tdS(),fontSize:12}}>{row.uom}</td>
                          <td style={{...tdS(true),fontSize:12,color:'#166534',fontWeight:600}}>{inv.gstPct}%</td>
                          <td style={{...tdS(true),fontSize:12}}>{inv.qty}</td>
                          <td style={{...tdS(true),fontSize:12}}>{formatCurrency(inv.taxable)}</td>
                          <td style={{...tdS(true),fontSize:12}}>{formatCurrency(inv.cgst)}</td>
                          <td style={{...tdS(true),fontSize:12}}>{formatCurrency(inv.sgst)}</td>
                          <td style={{...tdS(true),fontSize:12}}>{formatCurrency(inv.igst)}</td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
              </tbody>
              {hsnWise.length>0 && (
                <tfoot><tr style={{background:'#1c1c18',color:'white'}}>
                  <td colSpan={6} style={{padding:'10px 12px',fontWeight:'700',fontSize:'12px'}}>TOTAL</td>
                  <td style={{padding:'10px 12px',textAlign:'right',fontFamily:'monospace',fontWeight:'700'}}>{hsnWise.reduce((s,r)=>s+r.qty,0)}</td>
                  {['taxable','cgst','sgst','igst'].map(k=>(
                    <td key={k} style={{padding:'10px 12px',textAlign:'right',fontFamily:'monospace',fontWeight:'700'}}>{formatCurrency(hsnWise.reduce((s,r)=>s+r[k],0))}</td>
                  ))}
                </tr></tfoot>
              )}
            </table>
          </div>
        )}

        {/* GST%-wise */}
        {activeTab==='gst' && (
          <div className="overflow-x-auto">
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead><tr>{['#','GST Rate','Taxable Amount','CGST','SGST','IGST','Total Tax','Grand Total'].map((h,i)=><th key={h} style={thS(i>=2)}>{h}</th>)}</tr></thead>
              <tbody>
                {gstWise.length===0
                  ? <tr><td colSpan={8} style={{textAlign:'center',padding:40,color:'#888'}}>No data</td></tr>
                  : gstWise.map((row,i)=>(
                    <tr key={i} style={{background:i%2===0?'white':'#f4f4f0'}}>
                      <td style={tdS()}>{i+1}</td>
                      <td style={{...tdS(),fontWeight:'700'}}>{row.rate}</td>
                      <td style={tdS(true)}>{formatCurrency(row.taxable)}</td>
                      <td style={tdS(true)}>{formatCurrency(row.cgst)}</td>
                      <td style={tdS(true)}>{formatCurrency(row.sgst)}</td>
                      <td style={tdS(true)}>{formatCurrency(row.igst)}</td>
                      <td style={tdS(true)}>{formatCurrency(row.cgst+row.sgst)}</td>
                      <td style={{...tdS(true),fontWeight:'700'}}>{formatCurrency(row.total)}</td>
                    </tr>
                  ))}
              </tbody>
              {gstWise.length>0 && <tfoot><tr style={{background:'#1c1c18',color:'white'}}>
                <td colSpan={2} style={{padding:'10px 12px',fontWeight:'700',fontSize:'12px'}}>TOTAL</td>
                {['taxable','cgst','sgst','igst'].map(k=><td key={k} style={{padding:'10px 12px',textAlign:'right',fontFamily:'monospace',fontWeight:'700'}}>{formatCurrency(gstWise.reduce((s,r)=>s+r[k],0))}</td>)}
                <td style={{padding:'10px 12px',textAlign:'right',fontFamily:'monospace',fontWeight:'700'}}>{formatCurrency(gstWise.reduce((s,r)=>s+r.cgst+r.sgst,0))}</td>
                <td style={{padding:'10px 12px',textAlign:'right',fontFamily:'monospace',fontWeight:'700'}}>{formatCurrency(gstWise.reduce((s,r)=>s+r.total,0))}</td>
              </tr></tfoot>}
            </table>
          </div>
        )}

        {/* Item-wise */}
        {activeTab==='item' && (
          <div className="overflow-x-auto">
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead><tr>{['#','Item Name','HSN/SAC','UOM','GST %','Total Qty','Taxable Amt','Total GST','Grand Total'].map((h,i)=><th key={h} style={thS(i>=4)}>{h}</th>)}</tr></thead>
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
                      <td style={tdS(true)}>{row.qty}</td>
                      <td style={tdS(true)}>{formatCurrency(row.taxable)}</td>
                      <td style={tdS(true)}>{formatCurrency(row.gst)}</td>
                      <td style={{...tdS(true),fontWeight:'700'}}>{formatCurrency(row.total)}</td>
                    </tr>
                  ))}
              </tbody>
              {itemWise.length>0 && <tfoot><tr style={{background:'#1c1c18',color:'white'}}>
                <td colSpan={6} style={{padding:'10px 12px',fontWeight:'700',fontSize:'12px'}}>TOTAL</td>
                <td style={{padding:'10px 12px',textAlign:'right',fontFamily:'monospace',fontWeight:'700'}}>{formatCurrency(itemWise.reduce((s,r)=>s+r.taxable,0))}</td>
                <td style={{padding:'10px 12px',textAlign:'right',fontFamily:'monospace',fontWeight:'700'}}>{formatCurrency(itemWise.reduce((s,r)=>s+r.gst,0))}</td>
                <td style={{padding:'10px 12px',textAlign:'right',fontFamily:'monospace',fontWeight:'700'}}>{formatCurrency(itemWise.reduce((s,r)=>s+r.total,0))}</td>
              </tr></tfoot>}
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
