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
  const [expandedGST, setExpandedGST] = useState({});
  const [expandedItem, setExpandedItem] = useState({});

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
        hsn: (inv.items || []).map(i => i.hsn || '-').filter((v, i, a) => a.indexOf(v) === i).join(', '),
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
            taxable: base, cgst: gst / 2, sgst: gst / 2, igst: gst,
          });
        }
      });
      return acc;
    }, {})
  );

  // GST%-wise with invoice-level drill-down
  const gstWise = Object.values(
    filtered.reduce((acc, inv) => {
      (inv.items || []).forEach(item => {
        const key = `${item.gstPct || 0}%`;
        if (!acc[key]) acc[key] = {
          rate: key, taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0,
          invoiceList: [],
        };
        const base = (Number(item.qty) || 0) * (Number(item.rate) || 0);
        const gst = (base * (Number(item.gstPct) || 0)) / 100;
        acc[key].taxable += base;
        acc[key].cgst += gst / 2;
        acc[key].sgst += gst / 2;
        acc[key].igst += gst;
        acc[key].total += base + gst;
        const existing = acc[key].invoiceList.find(i => i.invoiceNumber === inv.invoiceNumber);
        if (existing) {
          existing.taxable += base;
          existing.cgst += gst / 2;
          existing.sgst += gst / 2;
          existing.igst += gst;
          existing.total += base + gst;
        } else {
          acc[key].invoiceList.push({
            invoiceNumber: inv.invoiceNumber,
            invoiceDate: inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString('en-IN') : '-',
            party: inv.buyer?.clientName || '-',
            status: inv.status || 'draft',
            taxable: base, cgst: gst / 2, sgst: gst / 2, igst: gst, total: base + gst,
          });
        }
      });
      return acc;
    }, {})
  ).sort((a, b) => parseFloat(a.rate) - parseFloat(b.rate));

  // Item-wise with invoice-level drill-down
  const itemWise = Object.values(
    filtered.reduce((acc, inv) => {
      (inv.items || []).forEach(item => {
        const key = item.name || 'Unknown';
        if (!acc[key]) acc[key] = {
          name: key, hsn: item.hsn || '-', uom: item.unit || 'Nos',
          gstPct: item.gstPct || 0, qty: 0, taxable: 0, gst: 0, total: 0,
          invoiceList: [],
        };
        const base = (Number(item.qty) || 0) * (Number(item.rate) || 0);
        const gst = (base * (Number(item.gstPct) || 0)) / 100;
        acc[key].qty += Number(item.qty) || 0;
        acc[key].taxable += base;
        acc[key].gst += gst;
        acc[key].total += base + gst;
        acc[key].invoiceList.push({
          invoiceNumber: inv.invoiceNumber,
          invoiceDate: inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString('en-IN') : '-',
          party: inv.buyer?.clientName || '-',
          status: inv.status || 'draft',
          qty: Number(item.qty) || 0,
          rate: Number(item.rate) || 0,
          taxable: base, gst, total: base + gst,
        });
      });
      return acc;
    }, {})
  );

  const toggleParty = (k) => setExpandedParties(p => ({ ...p, [k]: !p[k] }));
  const toggleHSN = (k) => setExpandedHSN(p => ({ ...p, [k]: !p[k] }));
  const toggleGST = (k) => setExpandedGST(p => ({ ...p, [k]: !p[k] }));
  const toggleItem = (k) => setExpandedItem(p => ({ ...p, [k]: !p[k] }));

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();

    const partyRows = [['#','Party','GSTIN','State','HSN/SAC','Invoice No','Date','Due Date','Place of Supply','Taxable','CGST','SGST','IGST','Total','Status']];
    let sr = 1;
    partyWise.forEach(p => {
      p.invoiceList.forEach(inv => {
        partyRows.push([sr++, p.party, p.gstin, p.state, inv.hsn||'-', inv.invoiceNumber, inv.invoiceDate, inv.dueDate, inv.placeOfSupply, inv.taxable, inv.cgst, inv.sgst, inv.igst, inv.total, inv.status]);
      });
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(partyRows), 'Party-wise B2B');

    const hsnRows = [['#','HSN/SAC','Description','UOM','Invoice No','Date','Party','GST%','Qty','Taxable','CGST','SGST','IGST']];
    hsnWise.forEach((r, i) => {
      r.invoiceList.forEach(inv => {
        hsnRows.push([i+1, r.hsn, r.description, r.uom, inv.invoiceNumber, inv.invoiceDate, inv.party, inv.gstPct+'%', inv.qty, inv.taxable, inv.cgst, inv.sgst, inv.igst]);
      });
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(hsnRows), 'HSN-wise');

    const gstRows = [['#','GST Rate','Invoice No','Date','Party','Taxable','CGST','SGST','IGST','Total']];
    gstWise.forEach((r,i) => {
      r.invoiceList.forEach(inv => {
        gstRows.push([i+1, r.rate, inv.invoiceNumber, inv.invoiceDate, inv.party, inv.taxable, inv.cgst, inv.sgst, inv.igst, inv.total]);
      });
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(gstRows), 'GST%-wise');

    const itemRows = [['#','Item','HSN','UOM','GST%','Invoice No','Date','Party','Qty','Rate','Taxable','Total GST','Grand Total']];
    itemWise.forEach((r,i) => {
      r.invoiceList.forEach(inv => {
        itemRows.push([i+1, r.name, r.hsn, r.uom, r.gstPct+'%', inv.invoiceNumber, inv.invoiceDate, inv.party, inv.qty, inv.rate, inv.taxable, inv.gst, inv.total]);
      });
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(itemRows), 'Item-wise');

    const month = selectedMonth ? months.find(m => m.value === selectedMonth)?.label : 'All';
    XLSX.writeFile(wb, `GSTR1_${month}_${selectedYear || 'All'}.xlsx`);
  };
  const exportToGSTR1JSON = () => {
    // ── B2B (Business-to-Business with GSTIN) ──────────────────────────────
    const b2bMap = {};
    filtered.forEach(inv => {
      const gstin = inv.buyer?.gstNumber;
      if (!gstin || gstin === '-' || gstin.trim() === '') return; // skip non-GSTIN
      if (!b2bMap[gstin]) b2bMap[gstin] = { ctin: gstin, inv: [] };
      const items = (inv.items || []).map((item, idx) => {
        const txval = (Number(item.qty) || 0) * (Number(item.rate) || 0);
        const gstPct = Number(item.gstPct) || 0;
        const isIGST = (inv.buyer?.state || '').toLowerCase() !== (inv.seller?.state || '').toLowerCase();
        return {
          num: idx+1,
          itm_det: {
            rt: gstPct,
            txval: parseFloat(txval.toFixed(2)),
            iamt: isIGST ? parseFloat(((txval * gstPct) / 100).toFixed(2)) : 0,
            camt: !isIGST ? parseFloat(((txval * gstPct) / 200).toFixed(2)) : 0,
            samt: !isIGST ? parseFloat(((txval * gstPct) / 200).toFixed(2)) : 0,
            csamt: 0,
          },
        };
      });
      const getStateCode = (stateName) => {
  const map = {
    'jammu and kashmir':'01','himachal pradesh':'02','punjab':'03',
    'chandigarh':'04','uttarakhand':'05','haryana':'06','delhi':'07',
    'rajasthan':'08','uttar pradesh':'09','bihar':'10','sikkim':'11',
    'arunachal pradesh':'12','nagaland':'13','manipur':'14','mizoram':'15',
    'tripura':'16','meghalaya':'17','assam':'18','west bengal':'19',
    'jharkhand':'20','odisha':'21','chhattisgarh':'22','madhya pradesh':'23',
    'gujarat':'24','dadra and nagar haveli':'26','maharashtra':'27',
    'andhra pradesh':'28','karnataka':'29','goa':'30','kerala':'32',
    'tamil nadu':'33','telangana':'36','uttarakhand':'05',
  };
  return map[(stateName || '').toLowerCase()];
};
      b2bMap[gstin].inv.push({
        inum: inv.invoiceNumber,
        idt: inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-') : '',
        val: parseFloat((inv.grandTotal || 0).toFixed(2)),
        pos: getStateCode(inv.buyer?.state) || '09', // default UP; update from your state master
        rchrg: 'N',
        inv_typ: 'R',
        itms: items,
      });
    });
    const b2b = Object.values(b2bMap);

    // ── B2C Large (interstate > ₹2.5L, no GSTIN) ──────────────────────────
    const b2clMap = {};
    filtered.forEach(inv => {
      const gstin = inv.buyer?.gstNumber;
      if (gstin && gstin.trim() !== '' && gstin !== '-') return; // skip GSTIN invoices
      const total = inv.grandTotal || 0;
      const isIGST = (inv.buyer?.state || '').toLowerCase() !== (inv.seller?.state || '').toLowerCase();
      if (!isIGST || total <= 250000) return; // B2CL only interstate > 2.5L
      (inv.items || []).forEach(item => {
        const txval = (Number(item.qty) || 0) * (Number(item.rate) || 0);
        const gstPct = Number(item.gstPct) || 0;
        const pos = inv.buyer?.stateCode || '09';
        const key = `${pos}_${gstPct}`;
        if (!b2clMap[key]) b2clMap[key] = { pos, rt: gstPct, txval: 0, iamt: 0, csamt: 0 };
        b2clMap[key].txval += txval;
        b2clMap[key].iamt += (txval * gstPct) / 100;
      });
    });
    const b2cl = Object.entries(
      Object.values(b2clMap).reduce((acc, r) => {
        if (!acc[r.pos]) acc[r.pos] = { pos: r.pos, inv: [] };
        acc[r.pos].inv.push({ rt: r.rt, txval: parseFloat(r.txval.toFixed(2)), iamt: parseFloat(r.iamt.toFixed(2)), csamt: 0 });
        return acc;
      }, {})
    ).map(([, v]) => v);

    // ── B2CS (intra-state unregistered + small interstate) ─────────────────
    const b2csMap = {};
    filtered.forEach(inv => {
      const gstin = inv.buyer?.gstNumber;
      if (gstin && gstin.trim() !== '' && gstin !== '-') return;
      const isIGST = (inv.buyer?.state || '').toLowerCase() !== (inv.seller?.state || '').toLowerCase();
      const total = inv.grandTotal || 0;
      if (isIGST && total > 250000) return; // those go to B2CL
      (inv.items || []).forEach(item => {
        const txval = (Number(item.qty) || 0) * (Number(item.rate) || 0);
        const gstPct = Number(item.gstPct) || 0;
        const pos = inv.buyer?.stateCode || '09';
        const type = isIGST ? 'INTER' : 'INTRA';
        const key = `${type}_${pos}_${gstPct}`;
        if (!b2csMap[key]) b2csMap[key] = {
          sply_ty: type, pos, rt: gstPct,
          txval: 0, iamt: 0, camt: 0, samt: 0, csamt: 0,
        };
        b2csMap[key].txval += txval;
        if (isIGST) b2csMap[key].iamt += (txval * gstPct) / 100;
        else {
          b2csMap[key].camt += (txval * gstPct) / 200;
          b2csMap[key].samt += (txval * gstPct) / 200;
        }
      });
    });
    const b2cs = Object.values(b2csMap).map(r => ({
      ...r,
      txval: parseFloat(r.txval.toFixed(2)),
      iamt: parseFloat(r.iamt.toFixed(2)),
      camt: parseFloat(r.camt.toFixed(2)),
      samt: parseFloat(r.samt.toFixed(2)),
    }));

    // ── HSN Summary ────────────────────────────────────────────────────────
    const hsnMap = {};
    filtered.forEach(inv => {
      (inv.items || []).forEach(item => {
        const key = item.hsn || 'NOHSN';
        if (!hsnMap[key]) hsnMap[key] = {
          hsn_sc: item.hsn || '',
          desc: item.name || '',
          uqc: (item.unit || 'NOS').toUpperCase(),
          cnt: 0, qty: 0, val: 0, txval: 0,
          iamt: 0, camt: 0, samt: 0, csamt: 0,
        };
        const qty = Number(item.qty) || 0;
        const rate = Number(item.rate) || 0;
        const gstPct = Number(item.gstPct) || 0;
        const txval = qty * rate;
        const isIGST = (inv.buyer?.state || '').toLowerCase() !== (inv.seller?.state || '').toLowerCase();
        hsnMap[key].cnt += 1;
        hsnMap[key].qty += qty;
        hsnMap[key].val += txval + (txval * gstPct) / 100;
        hsnMap[key].txval += txval;
        if (isIGST) hsnMap[key].iamt += (txval * gstPct) / 100;
        else {
          hsnMap[key].camt += (txval * gstPct) / 200;
          hsnMap[key].samt += (txval * gstPct) / 200;
        }
      });
    });
    const hsn = {
      data: Object.values(hsnMap).map(r => ({
        ...r,
        qty: parseFloat(r.qty.toFixed(3)),
        val: parseFloat(r.val.toFixed(2)),
        txval: parseFloat(r.txval.toFixed(2)),
        iamt: parseFloat(r.iamt.toFixed(2)),
        camt: parseFloat(r.camt.toFixed(2)),
        samt: parseFloat(r.samt.toFixed(2)),
        csamt: 0,
      })),
    };

    // ── GSTR-1 JSON Envelope ───────────────────────────────────────────────
    const month = selectedMonth || new Date().getMonth() + 1;
    const year = selectedYear || new Date().getFullYear();
    // GST return period format: MMyyyy e.g. "042025" for April 2025
    const fp = `${String(month).padStart(2, '0')}${year}`;

    const gstr1 = {
      gstin: '09HEVPS3324P1ZB', // ← Apna GSTIN yahan hardcode karo ya seller context se lo
      fp,
      gt: parseFloat(filtered.reduce((s, inv) => s + (inv.grandTotal || 0), 0).toFixed(2)),
      cur_gt: parseFloat(filtered.reduce((s, inv) => s + (inv.grandTotal || 0), 0).toFixed(2)),
      b2b,
      b2cl,
      b2cs,
      hsn,
      // Nil-rated, credit notes etc. — add if needed
      nil: { inv: [] },
      exp: { exp_typ: 'WOPAY', inv: [] },
      doc_issue: {
        doc_det: [
          {
            doc_num: 1,
            docs: [
              {
                num: 1,
                from: filtered.length > 0 ? filtered[filtered.length - 1].invoiceNumber : '',
                to: filtered.length > 0 ? filtered[0].invoiceNumber : '',
                totnum: filtered.length,
                cancel: 0,
                net_issue: filtered.length,
              },
            ],
          },
        ],
      },
    };

    // ── Download ───────────────────────────────────────────────────────────
    const blob = new Blob([JSON.stringify(gstr1, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const monthLabel = selectedMonth ? months.find(m => m.value === selectedMonth)?.label : 'All';
    a.download = `GSTR1_${monthLabel}_${year}.json`;
    a.click();
    URL.revokeObjectURL(url);
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
        <div className="flex gap-2">
  <button onClick={exportToGSTR1JSON} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold" style={{background:'#1d4ed8',color:'white',border:'none',cursor:'pointer'}}>
    <Download size={16}/> Export GSTR-1 JSON
  </button>
  <button onClick={exportToExcel} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold" style={{background:'#16a34a',color:'white',border:'none',cursor:'pointer'}}>
    <Download size={16}/> Export to Excel
  </button>
</div>
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
                {['','#','Party Name','GSTIN','State','HSN/SAC','Invoices','Taxable Amt','CGST','SGST','IGST','Total'].map((h,i)=>(
                  <th key={i} style={thS(i>=6)}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {partyWise.length===0
                  ? <tr><td colSpan={12} style={{textAlign:'center',padding:40,color:'#888'}}>No data</td></tr>
                  : partyWise.map((row,i)=>(
                    <React.Fragment key={i}>
                      <tr style={{background:i%2===0?'white':'#f4f4f0',cursor:'pointer'}} onClick={()=>toggleParty(row.party)}>
                        <td style={{...tdS(),width:32}}>{expandedParties[row.party]?<ChevronDown size={14}/>:<ChevronRight size={14}/>}</td>
                        <td style={tdS()}>{i+1}</td>
                        <td style={tdS()}><strong>{row.party}</strong></td>
                        <td style={{...tdS(),fontFamily:'monospace',color:'#6e6e60'}}>{row.gstin}</td>
                        <td style={tdS()}>{row.state}</td>
                        <td style={{...tdS(),fontFamily:'monospace',fontSize:12,color:'#6b21a8'}}>{[...new Set((row.invoiceList||[]).flatMap(inv=>(inv.hsn||'-').split(', ')))].join(', ')}</td>
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
                          <td style={{...tdS(),fontSize:12,fontFamily:'monospace',color:'#6b21a8'}}>{inv.hsn}</td>
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
                  <td colSpan={7} style={{padding:'10px 12px',fontWeight:'700',fontSize:'12px'}}>TOTAL</td>
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

        {/* GST%-wise with drill-down */}
        {activeTab==='gst' && (
          <div className="overflow-x-auto">
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead><tr>
                {['','#','GST Rate','Invoices','Taxable Amount','CGST','SGST','IGST','Total Tax','Grand Total'].map((h,i)=>(
                  <th key={i} style={thS(i>=3)}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {gstWise.length===0
                  ? <tr><td colSpan={10} style={{textAlign:'center',padding:40,color:'#888'}}>No data</td></tr>
                  : gstWise.map((row,i)=>(
                    <React.Fragment key={i}>
                      <tr style={{background:i%2===0?'white':'#f4f4f0',cursor:'pointer'}} onClick={()=>toggleGST(row.rate)}>
                        <td style={{...tdS(),width:32}}>{expandedGST[row.rate]?<ChevronDown size={14}/>:<ChevronRight size={14}/>}</td>
                        <td style={tdS()}>{i+1}</td>
                        <td style={{...tdS(),fontWeight:'700'}}>{row.rate}</td>
                        <td style={tdS(true)}>{row.invoiceList.length}</td>
                        <td style={tdS(true)}>{formatCurrency(row.taxable)}</td>
                        <td style={tdS(true)}>{formatCurrency(row.cgst)}</td>
                        <td style={tdS(true)}>{formatCurrency(row.sgst)}</td>
                        <td style={tdS(true)}>{formatCurrency(row.igst)}</td>
                        <td style={tdS(true)}>{formatCurrency(row.cgst+row.sgst)}</td>
                        <td style={{...tdS(true),fontWeight:'700'}}>{formatCurrency(row.total)}</td>
                      </tr>
                      {expandedGST[row.rate] && row.invoiceList.map((inv,j)=>(
                        <tr key={j} style={{background:'#fffbeb'}}>
                          <td colSpan={2} style={{...tdS(),paddingLeft:32}}></td>
                          <td style={{...tdS(),paddingLeft:16,fontSize:12,color:'#92400e'}}>
                            <span style={{fontFamily:'monospace',fontWeight:600}}>{inv.invoiceNumber}</span>
                            <span style={{marginLeft:8,fontSize:11,color:'#6e6e60'}}>{inv.invoiceDate}</span>
                            <span style={{marginLeft:8,fontSize:11,color:'#888'}}>· {inv.party}</span>
                            <span style={{marginLeft:8,fontSize:10,padding:'2px 6px',borderRadius:4,background:statusColor(inv.status)+'20',color:statusColor(inv.status),fontWeight:600}}>{inv.status?.toUpperCase()}</span>
                          </td>
                          <td style={{...tdS(true),fontSize:12}}>1</td>
                          <td style={{...tdS(true),fontSize:12}}>{formatCurrency(inv.taxable)}</td>
                          <td style={{...tdS(true),fontSize:12}}>{formatCurrency(inv.cgst)}</td>
                          <td style={{...tdS(true),fontSize:12}}>{formatCurrency(inv.sgst)}</td>
                          <td style={{...tdS(true),fontSize:12}}>{formatCurrency(inv.igst)}</td>
                          <td style={{...tdS(true),fontSize:12}}>{formatCurrency(inv.cgst+inv.sgst)}</td>
                          <td style={{...tdS(true),fontSize:12,fontWeight:700}}>{formatCurrency(inv.total)}</td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
              </tbody>
              {gstWise.length>0 && <tfoot><tr style={{background:'#1c1c18',color:'white'}}>
                <td colSpan={4} style={{padding:'10px 12px',fontWeight:'700',fontSize:'12px'}}>TOTAL</td>
                {['taxable','cgst','sgst','igst'].map(k=><td key={k} style={{padding:'10px 12px',textAlign:'right',fontFamily:'monospace',fontWeight:'700'}}>{formatCurrency(gstWise.reduce((s,r)=>s+r[k],0))}</td>)}
                <td style={{padding:'10px 12px',textAlign:'right',fontFamily:'monospace',fontWeight:'700'}}>{formatCurrency(gstWise.reduce((s,r)=>s+r.cgst+r.sgst,0))}</td>
                <td style={{padding:'10px 12px',textAlign:'right',fontFamily:'monospace',fontWeight:'700'}}>{formatCurrency(gstWise.reduce((s,r)=>s+r.total,0))}</td>
              </tr></tfoot>}
            </table>
          </div>
        )}

        {/* Item-wise with drill-down */}
        {activeTab==='item' && (
          <div className="overflow-x-auto">
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead><tr>
                {['','#','Item Name','HSN/SAC','UOM','GST %','Total Qty','Taxable Amt','Total GST','Grand Total'].map((h,i)=>(
                  <th key={i} style={thS(i>=5)}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {itemWise.length===0
                  ? <tr><td colSpan={10} style={{textAlign:'center',padding:40,color:'#888'}}>No data</td></tr>
                  : itemWise.map((row,i)=>(
                    <React.Fragment key={i}>
                      <tr style={{background:i%2===0?'white':'#f4f4f0',cursor:'pointer'}} onClick={()=>toggleItem(row.name)}>
                        <td style={{...tdS(),width:32}}>{expandedItem[row.name]?<ChevronDown size={14}/>:<ChevronRight size={14}/>}</td>
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
                      {expandedItem[row.name] && row.invoiceList.map((inv,j)=>(
                        <tr key={j} style={{background:'#fdf4ff'}}>
                          <td colSpan={2} style={{...tdS(),paddingLeft:32}}></td>
                          <td style={{...tdS(),paddingLeft:16,fontSize:12,color:'#6b21a8'}}>
                            <span style={{fontFamily:'monospace',fontWeight:600}}>{inv.invoiceNumber}</span>
                            <span style={{marginLeft:8,fontSize:11,color:'#6e6e60'}}>{inv.invoiceDate}</span>
                            <span style={{marginLeft:8,fontSize:11,color:'#888'}}>· {inv.party}</span>
                            <span style={{marginLeft:8,fontSize:10,padding:'2px 6px',borderRadius:4,background:statusColor(inv.status)+'20',color:statusColor(inv.status),fontWeight:600}}>{inv.status?.toUpperCase()}</span>
                          </td>
                          <td style={{...tdS(),fontSize:12,color:'#6e6e60'}}>{row.hsn}</td>
                          <td style={{...tdS(),fontSize:12}}>{row.uom}</td>
                          <td style={{...tdS(true),fontSize:12,fontWeight:600}}>{row.gstPct}%</td>
                          <td style={{...tdS(true),fontSize:12}}>{inv.qty}</td>
                          <td style={{...tdS(true),fontSize:12}}>{formatCurrency(inv.taxable)}</td>
                          <td style={{...tdS(true),fontSize:12}}>{formatCurrency(inv.gst)}</td>
                          <td style={{...tdS(true),fontSize:12,fontWeight:700}}>{formatCurrency(inv.total)}</td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
              </tbody>
              {itemWise.length>0 && <tfoot><tr style={{background:'#1c1c18',color:'white'}}>
                <td colSpan={7} style={{padding:'10px 12px',fontWeight:'700',fontSize:'12px'}}>TOTAL</td>
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
