import React from 'react';
import { createPortal } from 'react-dom';
import { X, Printer } from 'lucide-react';
import { formatCurrency, DEFAULT_STORE_DETAILS } from '../utils/invoiceUtils';
import { useAuth } from '../context/AuthContext';

const mono = "'DM Mono', 'Courier New', monospace";

// Naye notes: items[]; purane single-item notes ko bhi same shape mein badal deta hai
const getNoteItems = (d) => {
  if (d.items && d.items.length > 0) return d.items;
  return [{
    itemName: d.itemName, barcode: d.barcode, size: d.size, color: d.color,
    qty: d.qty, purchasePrice: d.purchasePrice, gstPct: d.gstPct,
    base: d.base, gst: d.gst, total: d.total,
  }];
};

// Ek debit note GST-style document ke roop mein print hota hai
export default function DebitNoteReceiptModal({ note, onClose }) {
  const { user } = useAuth();
  if (!note) return null;

  const seller = {
    companyName: user?.companyName || DEFAULT_STORE_DETAILS.companyName,
    address: user?.address || DEFAULT_STORE_DETAILS.address,
    gstNumber: user?.gstNumber || DEFAULT_STORE_DETAILS.gstNumber,
    panNumber: user?.panNumber || DEFAULT_STORE_DETAILS.panNumber,
    contact: user?.contact || DEFAULT_STORE_DETAILS.contact,
    state: user?.state || DEFAULT_STORE_DETAILS.state,
  };

  const items = getNoteItems(note);
  const totalQty = items.reduce((s, i) => s + (Number(i.qty) || 0), 0);

  const handlePrint = () => window.print();

  const modalContent = (
    <div id="debit-note-print-portal">
      <style>{`
        @media print {
          html, body { margin: 0 !important; padding: 0 !important; }
          body > *:not(#debit-note-print-portal) { display: none !important; }
          #debit-note-print-portal .no-print { display: none !important; }
          #debit-note-print-portal .print-overlay {
            position: static !important;
            inset: auto !important;
            background: none !important;
            backdrop-filter: none !important;
            padding: 0 !important;
            display: block !important;
          }
          #debit-note-print-portal .print-card {
            max-height: none !important;
            overflow: visible !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            width: 100% !important;
            max-width: none !important;
          }
          #debit-note-print-portal .print-scroll {
            overflow: visible !important;
            max-height: none !important;
          }
          @page { size: A4; margin: 14mm; }
        }
      `}</style>

      <div className="print-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/70 backdrop-blur-sm animate-fade-in no-print-bg">
        <div className="print-card bg-white dark:bg-ink-900 rounded-2xl border border-ink-200 dark:border-ink-800 shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-ink-100 dark:border-ink-800 no-print">
            <div>
              <h3 className="font-semibold text-ink-900 dark:text-ink-100 text-sm">Debit Note</h3>
              <p className="text-xs text-ink-400 font-mono">{note.dnNumber}</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-ink-400 hover:text-ink-700 dark:hover:text-ink-200 hover:bg-ink-100 dark:hover:bg-ink-800 transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Printable document */}
          <div className="print-scroll flex-1 min-h-0 overflow-y-auto p-6 bg-white text-ink-900" style={{ fontFamily: 'DM Sans, sans-serif' }}>
            <div style={{ textAlign: 'center', borderBottom: '2px solid #1c1c18', paddingBottom: '12px', marginBottom: '16px' }}>
              <p style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '3px', color: '#6e6e60', margin: '0 0 4px' }}>DEBIT NOTE</p>
              <h1 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 4px' }}>{seller.companyName}</h1>
              <p style={{ fontSize: '11px', color: '#6e6e60', margin: '0 0 2px' }}>{seller.address}</p>
              <p style={{ fontSize: '11px', margin: 0 }}>
                GSTIN: {seller.gstNumber} &nbsp;|&nbsp; PAN: {seller.panNumber} &nbsp;|&nbsp; Ph: {seller.contact} &nbsp;|&nbsp; {seller.state}
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <p style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: '#909080', margin: '0 0 6px' }}>Issued To (Supplier)</p>
                <p style={{ fontSize: '14px', fontWeight: 700, margin: 0 }}>{note.supplierName}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr><td style={{ color: '#6e6e60', textAlign: 'right', paddingRight: '6px' }}>DN No.</td><td style={{ fontWeight: 700, textAlign: 'right' }}>{note.dnNumber}</td></tr>
                    <tr><td style={{ color: '#6e6e60', textAlign: 'right', paddingRight: '6px' }}>Date</td><td style={{ fontWeight: 700, textAlign: 'right' }}>{new Date(note.date).toLocaleDateString('en-IN')}</td></tr>
                    <tr><td style={{ color: '#6e6e60', textAlign: 'right', paddingRight: '6px' }}>Reason</td><td style={{ fontWeight: 700, textAlign: 'right' }}>{note.reason}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Items table — har item ek row */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginBottom: '16px' }}>
              <thead>
                <tr style={{ background: '#1c1c18', color: 'white' }}>
                  {['S.No.', 'Item', 'Barcode', 'Size/Color', 'Qty', 'Rate', 'Taxable', 'GST %', 'GST', 'Total'].map(h => (
                    <th key={h} style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 600, fontSize: '9.5px', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? 'white' : '#f7f7f4', borderBottom: '1px solid #e8e8e0' }}>
                    <td style={{ padding: '8px 6px', textAlign: 'center', color: '#6e6e60' }}>{i + 1}</td>
                    <td style={{ padding: '8px 6px', fontWeight: 600 }}>{it.itemName}</td>
                    <td style={{ padding: '8px 6px', textAlign: 'center', fontFamily: mono }}>{it.barcode || '-'}</td>
                    <td style={{ padding: '8px 6px', textAlign: 'center' }}>{[it.size, it.color].filter(Boolean).join(' / ') || '-'}</td>
                    <td style={{ padding: '8px 6px', textAlign: 'center' }}>{it.qty}</td>
                    <td style={{ padding: '8px 6px', textAlign: 'right', fontFamily: mono }}>{Number(it.purchasePrice || 0).toFixed(2)}</td>
                    <td style={{ padding: '8px 6px', textAlign: 'right', fontFamily: mono }}>{Number(it.base || 0).toFixed(2)}</td>
                    <td style={{ padding: '8px 6px', textAlign: 'center' }}>{it.gstPct}%</td>
                    <td style={{ padding: '8px 6px', textAlign: 'right', fontFamily: mono }}>{Number(it.gst || 0).toFixed(2)}</td>
                    <td style={{ padding: '8px 6px', textAlign: 'right', fontFamily: mono, fontWeight: 700 }}>{Number(it.total || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '24px' }}>
              <div style={{ width: '260px', border: '1px solid #e8e8e0', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', borderBottom: '1px solid #e8e8e0', fontSize: '12px' }}>
                  <span>Total Qty</span><span style={{ fontFamily: mono }}>{totalQty} pcs</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', borderBottom: '1px solid #e8e8e0', fontSize: '12px' }}>
                  <span>Taxable Value</span><span style={{ fontFamily: mono }}>{formatCurrency(note.base)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', borderBottom: '1px solid #e8e8e0', fontSize: '12px' }}>
                  <span>GST Reversed</span><span style={{ fontFamily: mono }}>{formatCurrency(note.gst)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#1c1c18', color: 'white' }}>
                  <span style={{ fontWeight: 700, fontSize: '13px' }}>TOTAL</span>
                  <span style={{ fontFamily: mono, fontWeight: 700, fontSize: '13px' }}>{formatCurrency(note.total)}</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div />
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '11px', fontWeight: 700, margin: '32px 0 4px' }}>For {seller.companyName}</p>
                <p style={{ fontSize: '11px', fontWeight: 600, margin: 0 }}>Authorized Signatory</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="p-4 border-t border-ink-100 dark:border-ink-800 flex items-center justify-end gap-3 no-print">
            <button onClick={onClose} className="btn-secondary text-xs">Close</button>
            <button onClick={handlePrint} className="btn-primary text-xs px-6 py-2.5 flex items-center gap-2">
              <Printer size={15} /> Print
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}