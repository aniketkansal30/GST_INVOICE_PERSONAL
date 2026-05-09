import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useInvoices } from '../context/InvoiceContext';
import { formatCurrency, formatDate, numberToWords } from '../utils/invoiceUtils';
import { generatePDF } from '../utils/pdfGenerator';
import { ArrowLeft, Edit2, Download, Printer, FileText } from 'lucide-react';
import toast from 'react-hot-toast';

export default function InvoicePreviewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getInvoice } = useInvoices();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const printRef = useRef();
  const [scale, setScale] = useState(1);

useEffect(() => {
  const updateScale = () => {
    const availableWidth = window.innerWidth - 280;
    setScale(Math.min(1, availableWidth / 794));
  };
  updateScale();
  window.addEventListener('resize', updateScale);
  return () => window.removeEventListener('resize', updateScale);
}, []);

  useEffect(() => {
    getInvoice(id)
      .then(setInvoice)
      .catch(() => { toast.error('Invoice not found'); navigate('/dashboard'); })
      .finally(() => setLoading(false));
  }, [id]);

  const handlePrint = () => window.print();
  const handleDownloadPDF = () => {
    try {
      generatePDF(invoice);
    } catch {
      toast.error('PDF generation failed');
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-ink-800 dark:border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!invoice) return null;

  const { seller, buyer, items = [], subtotal = 0, cgst = 0, sgst = 0, igst = 0, grandTotal = 0, isSameState } = invoice;

  return (
    <div className="animate-slide-up" style={{ width: `${794 * scale}px`, margin: '0 auto', paddingBottom: '2rem' }}>
      {/* Controls */}
      <div className="no-print flex items-center gap-4 mb-8">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-400 transition-all">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-800 dark:text-ink-100">Invoice Preview</h1>
          <p className="text-sm text-ink-400 font-mono">{invoice.invoiceNumber}</p>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={() => navigate(`/invoices/${id}/edit`)} className="btn-secondary">
            <Edit2 size={15} /> Edit
          </button>
          <button onClick={handlePrint} className="btn-secondary">
            <Printer size={15} /> Print
          </button>
          <button onClick={handleDownloadPDF} className="btn-primary">
            <Download size={15} /> Download PDF
          </button>
        </div>
      </div>

      {/* A4 Invoice */}
      <div
        ref={printRef}
        className="invoice-preview bg-white text-ink-800 shadow-2xl rounded-xl overflow-hidden"
        style={{ 
  width: '794px', 
  minHeight: '1123px', 
  margin: '0 auto', 
  fontFamily: 'DM Sans, sans-serif',
  transform: `scale(${scale})`,
  transformOrigin: 'top left',
  marginBottom: `${(scale - 1) * 1123}px`,
  marginRight: `${(scale - 1) * 794}px`
}}
      >
        {/* Header */}
        <div style={{ background: '#f4f4f0', padding: '32px 40px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <div style={{ width: '32px', height: '32px', background: '#1c1c18', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileText size={16} color="white" />
                </div>
                <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#1c1c18', margin: 0 }}>
                  {seller?.companyName || 'Company Name'}
                </h1>
              </div>
              <p style={{ color: '#6e6e60', fontSize: '13px', margin: '0 0 3px 42px' }}>{seller?.address}</p>
              <p style={{ color: '#1c1c18', fontSize: '13px', fontWeight: '600', margin: '0 0 3px 42px' }}>GSTIN: {seller?.gstNumber}</p>
              {seller?.contact && <p style={{ color: '#6e6e60', fontSize: '12px', margin: '0 0 0 42px' }}>{seller?.contact} &middot; {seller?.email}</p>}
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '2px', color: '#6e6e60', margin: '0 0 8px' }}>Tax Invoice</p>
              <p style={{ fontSize: '16px', fontWeight: '700', color: '#1c1c18', fontFamily: 'JetBrains Mono, monospace', margin: '0 0 4px' }}>{invoice.invoiceNumber}</p>
              <p style={{ fontSize: '12px', color: '#6e6e60', margin: '0 0 2px' }}>Date: {formatDate(invoice.invoiceDate)}</p>
              <p style={{ fontSize: '12px', color: '#6e6e60', margin: 0 }}>Due: {formatDate(invoice.dueDate)}</p>
            </div>
          </div>
        </div>

        {/* Bill to + Supply info */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: '#e8e8e0', margin: '0 40px', borderRadius: '8px', overflow: 'hidden' }}>
          <div style={{ background: 'white', padding: '16px 20px' }}>
            <p style={{ fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#909080', margin: '0 0 8px' }}>Bill To</p>
            <p style={{ fontSize: '15px', fontWeight: '700', color: '#1c1c18', margin: '0 0 4px' }}>{buyer?.clientName}</p>
            <p style={{ fontSize: '12px', color: '#1c1c18', margin: '0 0 2px', lineHeight: 1.5 }}>{buyer?.address}</p>
            <p style={{ fontSize: '12px', color: '#1c1c18', margin: 0 }}>GSTIN: {buyer?.gstNumber}</p>
          </div>
          <div style={{ background: 'white', padding: '16px 20px' }}>
            <p style={{ fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#909080', margin: '0 0 8px' }}>Supply Details</p>
            <p style={{ fontSize: '12px', color: '#6e6e60', margin: '0 0 3px' }}>Seller State: <strong style={{ color: '#1c1c18' }}>{seller?.state}</strong></p>
            <p style={{ fontSize: '12px', color: '#6e6e60', margin: '0 0 3px' }}>Buyer State: <strong style={{ color: '#1c1c18' }}>{buyer?.state}</strong></p>
            <p style={{ fontSize: '12px', color: '#6e6e60', margin: 0 }}>
              Tax Type: <strong style={{ color: isSameState ? '#2563eb' : '#d97706' }}>
                {isSameState ? 'CGST + SGST' : 'IGST'}
              </strong>
            </p>
          </div>
        </div>

        {/* Items table */}
        <div style={{ margin: '24px 40px 0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
            <thead>
              <tr style={{ background: '#1c1c18', color: 'white' }}>
                {['#', 'Product/Service', 'HSN/SAC', 'Unit', 'Qty', 'Rate (₹)', 'Taxable Amt (₹)', 'GST %', ...(isSameState ? ['CGST (₹)', 'SGST (₹)'] : ['IGST (₹)']), 'Amount (₹)'].map((h, i) => (
                  <th key={h} style={{
                    padding: '10px 6px', textAlign: 'center',
                    fontWeight: '600', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.3px',
                    whiteSpace: 'nowrap'
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => {
                const base = (Number(item.qty) || 0) * (Number(item.rate) || 0);
                const gstAmt = (base * (Number(item.gstPct) || 0)) / 100;
                return (
                  <tr key={i} style={{ background: i % 2 === 0 ? 'white' : '#f4f4f0', borderBottom: '1px solid #e8e8e0' }}>
                    <td style={{ padding: '10px 14px', textAlign: 'center', color: '#6e6e60' }}>{i + 1}</td>
                    <td style={{ padding: '10px 14px', fontWeight: '500' }}>{item.name}</td>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#6e6e60', textAlign: 'center' }}>{item.hsn}</td>

                    <td style={{ padding: '10px 14px', textAlign: 'right', color: '#6e6e60' }}>{item.unit || 'Nos'}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right' }}>{item.qty}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace' }}>{Number(item.rate).toFixed(2)}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace' }}>{base.toFixed(2)}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: '#6e6e60' }}>{item.gstPct}%</td>
                    {isSameState ? (
                      <>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', color: '#2563eb' }}>{(gstAmt / 2).toFixed(2)}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', color: '#2563eb' }}>{(gstAmt / 2).toFixed(2)}</td>
                      </>
                    ) : (
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', color: '#d97706' }}>{gstAmt.toFixed(2)}</td>
                    )}
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '600' }}>
                      {(base + gstAmt).toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Tax summary + Total */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '16px 40px 0' }}>
          <div style={{ width: '260px', border: '1px solid #e8e8e0', borderRadius: '8px', overflow: 'hidden' }}>
            {[
              { label: 'Subtotal', value: formatCurrency(subtotal) },
              ...(isSameState
                ? [{ label: 'CGST', value: formatCurrency(cgst) }, { label: 'SGST', value: formatCurrency(sgst) }]
                : [{ label: 'IGST', value: formatCurrency(igst) }]
              ),
              { label: 'Round Off', value: (Math.round(grandTotal) - grandTotal).toFixed(2) },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 16px', borderBottom: '1px solid #e8e8e0', fontSize: '13px', color: '#6e6e60' }}>
                <span>{label}</span>
                <span style={{ fontFamily: 'monospace' }}>{value}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: '#1c1c18', color: 'white' }}>
              <span style={{ fontWeight: '700', fontSize: '14px' }}>TOTAL</span>
              <span style={{ fontFamily: 'monospace', fontWeight: '700', fontSize: '14px' }}>{formatCurrency(grandTotal)}</span>
            </div>
          </div>
        </div>

        {/* Amount in words */}
        <div style={{ margin: '16px 40px 0', padding: '10px 16px', background: '#f4f4f0', borderRadius: '8px' }}>
          <p style={{ fontSize: '11.5px', color: '#6e6e60', margin: 0 }}>
            <strong style={{ color: '#1c1c18' }}>Amount in words:</strong> {numberToWords(grandTotal)}
          </p>
        </div>

        {/* Notes */}
        {invoice.notes && (
          <div style={{ margin: '16px 40px 0' }}>
            <p style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', color: '#909080', margin: '0 0 6px' }}>Notes</p>
            <p style={{ fontSize: '12.5px', color: '#6e6e60', margin: 0, lineHeight: 1.6 }}>{invoice.notes}</p>
          </div>
        )}

        {/* Footer */}
        <div style={{ margin: '32px 40px 0', paddingTop: '20px', borderTop: '1px solid #e8e8e0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: '40px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: '160px', height: '48px', border: '1px dashed #d0d0c4', borderRadius: '4px', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ fontSize: '10px', color: '#d0d0c4', margin: 0 }}>Authorized Signature</p>
            </div>
            <p style={{ fontSize: '11.5px', fontWeight: '600', color: '#1c1c18', margin: 0 }}>For {seller?.companyName}</p>
          </div>
        </div>
      </div>

      <div className="h-12" />
    </div>
  );
}

