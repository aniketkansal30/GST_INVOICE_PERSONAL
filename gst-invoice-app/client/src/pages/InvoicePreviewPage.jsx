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
    try { generatePDF(invoice); }
    catch { toast.error('PDF generation failed'); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-ink-800 dark:border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!invoice) return null;

  const { seller, buyer, shipTo, items = [], subtotal = 0, cgst = 0, sgst = 0, igst = 0, grandTotal = 0, isSameState } = invoice;

  // ✅ Ship To fallback — agar purana invoice hai jisme shipTo nahi tha
  const shipToData = shipTo?.clientName ? shipTo : buyer;

  const scaledHeight = 1123 * scale;

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
          height: 'auto',
          margin: '0 auto',
          fontFamily: 'DM Sans, sans-serif',
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          marginBottom: `${(scale - 1) * scaledHeight}px`,
          marginRight: `${(scale - 1) * 794}px`,
          boxSizing: 'border-box',
        }}
      >
        {/* Header */}
        <div style={{ borderBottom: '2px solid #1c1c18' }}>
          {/* Company name centered */}
          <div style={{ textAlign: 'center', padding: '16px 36px 8px', borderBottom: '1px solid #e8e8e0' }}>
            <p style={{ fontSize: '9px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '3px', color: '#6e6e60', margin: '0 0 4px' }}>TAX INVOICE</p>
            <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#1c1c18', margin: '0 0 4px' }}>{seller?.companyName || 'Company Name'}</h1>
            <p style={{ fontSize: '11px', color: '#6e6e60', margin: '0 0 2px' }}>{seller?.address}</p>
            <p style={{ fontSize: '11px', color: '#1c1c18', margin: '0 0 2px' }}>Tel. : {seller?.contact} email : <span style={{ color: '#1c1c18' }}>abhiyantsalescorporation@gmail.com</span></p>
          </div>

          {/* GSTIN + Invoice details + Transport — 2 column box */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid #e8e8e0' }}>
            {/* Left — Invoice details */}
            <div style={{ borderRight: '1px solid #e8e8e0', padding: '10px 14px' }}>
              <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr><td style={{ color: '#6e6e60', paddingBottom: '3px', width: '45%' }}>GSTIN</td><td style={{ fontWeight: '600', paddingBottom: '3px' }}>: {seller?.gstNumber}</td></tr>
                  <tr><td style={{ color: '#6e6e60', paddingBottom: '3px' }}>Invoice No.</td><td style={{ fontWeight: '600', paddingBottom: '3px' }}>: {invoice.invoiceNumber}</td></tr>
                  <tr><td style={{ color: '#6e6e60', paddingBottom: '3px' }}>Date of Invoice</td><td style={{ fontWeight: '600', paddingBottom: '3px' }}>: {formatDate(invoice.invoiceDate)}</td></tr>
                  <tr><td style={{ color: '#6e6e60', paddingBottom: '3px' }}>Place of Supply</td><td style={{ fontWeight: '600', paddingBottom: '3px' }}>: {seller?.state}</td></tr>
                  <tr><td style={{ color: '#6e6e60', paddingBottom: '3px' }}>Reverse Charge</td><td style={{ fontWeight: '600', paddingBottom: '3px' }}>: {invoice.reverseCharge || 'No'}</td></tr>
                  <tr><td style={{ color: '#6e6e60' }}>GR/RR No.</td><td style={{ fontWeight: '600' }}>: {invoice.grRrNo || '-'}</td></tr>
                </tbody>
              </table>
            </div>

            {/* Right — Transport details */}
            <div style={{ padding: '10px 14px' }}>
              <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr><td style={{ color: '#6e6e60', paddingBottom: '3px', width: '45%' }}>Transport</td><td style={{ fontWeight: '600', paddingBottom: '3px' }}>: {invoice.transport || '-'}</td></tr>
                  <tr><td style={{ color: '#6e6e60', paddingBottom: '3px' }}>Vehicle No</td><td style={{ fontWeight: '600', paddingBottom: '3px' }}>: {invoice.vehicleNo || '-'}</td></tr>
                  <tr><td style={{ color: '#6e6e60', paddingBottom: '3px' }}>Station</td><td style={{ fontWeight: '600', paddingBottom: '3px' }}>: {invoice.station || '-'}</td></tr>
                  <tr><td style={{ color: '#6e6e60', paddingBottom: '3px' }}>NUG</td><td style={{ fontWeight: '600', paddingBottom: '3px' }}>: {invoice.nug || '-'}</td></tr>
                  <tr><td style={{ color: '#6e6e60' }}>P O No.</td><td style={{ fontWeight: '600' }}>: {invoice.poNo || '-'}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
        {/* ✅ Bill To + Ship To (Supply Details hataya) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: '#e8e8e0', margin: '0 36px', borderRadius: '8px', overflow: 'hidden' }}>
          {/* Bill To */}
          <div style={{ background: 'white', padding: '14px 18px' }}>
            <p style={{ fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#909080', margin: '0 0 6px' }}>Billed To</p>
            <p style={{ fontSize: '14px', fontWeight: '700', color: '#1c1c18', margin: '0 0 4px', wordBreak: 'break-word' }}>{buyer?.clientName}</p>
            <p style={{ fontSize: '12px', color: '#1c1c18', margin: '0 0 2px', lineHeight: 1.5, wordBreak: 'break-word', whiteSpace: 'pre-line' }}>{buyer?.address}</p>
            {buyer?.gstNumber && (
              <p style={{ fontSize: '12px', color: '#6e6e60', margin: '4px 0 0', fontWeight: '600' }}>
                GSTIN / UIN &nbsp;: &nbsp;{buyer?.gstNumber}
              </p>
            )}
          </div>
          {/* Ship To */}
          <div style={{ background: 'white', padding: '14px 18px' }}>
            <p style={{ fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#909080', margin: '0 0 6px' }}>Shipped To</p>
            <p style={{ fontSize: '14px', fontWeight: '700', color: '#1c1c18', margin: '0 0 4px', wordBreak: 'break-word' }}>{shipToData?.clientName}</p>
            <p style={{ fontSize: '12px', color: '#1c1c18', margin: '0 0 2px', lineHeight: 1.5, wordBreak: 'break-word', whiteSpace: 'pre-line' }}>{shipToData?.address}</p>
            {shipToData?.gstNumber && (
              <p style={{ fontSize: '12px', color: '#6e6e60', margin: '4px 0 0', fontWeight: '600' }}>
                GSTIN / UIN &nbsp;: &nbsp;{shipToData?.gstNumber}
              </p>
            )}
          </div>
        </div>
        {/* Transport Details */}
        {(invoice.transport || invoice.vehicleNo || invoice.station || invoice.nug || invoice.poNo || invoice.grRrNo) && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: '#e8e8e0', margin: '12px 36px 0', borderRadius: '8px', overflow: 'hidden' }}>
            {[
              { label: 'Transport', value: invoice.transport },
              { label: 'Vehicle No', value: invoice.vehicleNo },
              { label: 'Station', value: invoice.station },
              { label: 'NUG', value: invoice.nug },
              { label: 'P O No.', value: invoice.poNo },
              { label: 'GR/RR No.', value: invoice.grRrNo },
            ].map(({ label, value }) => value ? (
              <div key={label} style={{ background: 'white', padding: '8px 14px' }}>
                <p style={{ fontSize: '9px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px', color: '#909080', margin: '0 0 3px' }}>{label}</p>
                <p style={{ fontSize: '12px', fontWeight: '600', color: '#1c1c18', margin: 0 }}>{value}</p>
              </div>
            ) : null)}
          </div>
        )}

        {/* Items table */}
        <div style={{ margin: '20px 36px 0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', tableLayout: 'auto' }}>
            <thead>
              <tr style={{ background: '#1c1c18', color: 'white' }}>
                {['#', 'Product/Service', 'HSN/SAC', 'Unit', 'Qty', 'Rate (₹)', 'Taxable Amt', 'GST %',
                  ...(isSameState ? ['CGST (₹)', 'SGST (₹)'] : ['IGST (₹)']), 'Amount (₹)'].map((h) => (
                    <th key={h} style={{
                      padding: '9px 5px', textAlign: 'center',
                      fontWeight: '600', fontSize: '9.5px', textTransform: 'uppercase',
                      letterSpacing: '0.2px', whiteSpace: 'nowrap'
                    }}>{h}</th>
                  ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => {
                const base = (Number(item.qty) || 0) * (Number(item.rate) || 0);
                const gstAmt = (base * (Number(item.gstPct) || 0)) / 100;
                return (
                  <tr key={i} style={{ background: i % 2 === 0 ? 'white' : '#f7f7f4', borderBottom: '1px solid #e8e8e0' }}>
                    <td style={{ padding: '9px 5px', textAlign: 'center', color: '#6e6e60', whiteSpace: 'nowrap' }}>{i + 1}</td>
                    <td style={{ padding: '9px 8px', fontWeight: '500', wordBreak: 'break-word', maxWidth: '140px' }}>{item.name}</td>
                    <td style={{ padding: '9px 5px', fontFamily: 'monospace', color: '#6e6e60', textAlign: 'center', whiteSpace: 'nowrap' }}>{item.hsn || '-'}</td>
                    <td style={{ padding: '9px 5px', textAlign: 'center', color: '#6e6e60', whiteSpace: 'nowrap' }}>{item.unit || 'Nos'}</td>
                    <td style={{ padding: '9px 5px', textAlign: 'right', whiteSpace: 'nowrap' }}>{item.qty}</td>
                    <td style={{ padding: '9px 5px', textAlign: 'right', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{Number(item.rate).toFixed(2)}</td>
                    <td style={{ padding: '9px 5px', textAlign: 'right', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{base.toFixed(2)}</td>
                    <td style={{ padding: '9px 5px', textAlign: 'center', color: '#6e6e60', whiteSpace: 'nowrap' }}>{item.gstPct}%</td>
                    {isSameState ? (
                      <>
                        <td style={{ padding: '9px 5px', textAlign: 'right', fontFamily: 'monospace', color: '#2563eb', whiteSpace: 'nowrap' }}>{(gstAmt / 2).toFixed(2)}</td>
                        <td style={{ padding: '9px 5px', textAlign: 'right', fontFamily: 'monospace', color: '#2563eb', whiteSpace: 'nowrap' }}>{(gstAmt / 2).toFixed(2)}</td>
                      </>
                    ) : (
                      <td style={{ padding: '9px 5px', textAlign: 'right', fontFamily: 'monospace', color: '#d97706', whiteSpace: 'nowrap' }}>{gstAmt.toFixed(2)}</td>
                    )}
                    <td style={{ padding: '9px 5px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '600', whiteSpace: 'nowrap' }}>
                      {(base + gstAmt).toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Tax summary + Total */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '16px 36px 0' }}>
          <div style={{ width: '260px', border: '1px solid #e8e8e0', borderRadius: '8px', overflow: 'hidden' }}>
            {[
              { label: 'Subtotal', value: formatCurrency(subtotal) },
              ...(isSameState
                ? [{ label: 'CGST', value: formatCurrency(cgst) }, { label: 'SGST', value: formatCurrency(sgst) }]
                : [{ label: 'IGST', value: formatCurrency(igst) }]
              ),
              { label: 'Round Off', value: (Math.round(grandTotal) - grandTotal).toFixed(2) },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', borderBottom: '1px solid #e8e8e0', fontSize: '12.5px', color: '#6e6e60' }}>
                <span>{label}</span>
                <span style={{ fontFamily: 'monospace' }}>{value}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 14px', background: '#1c1c18', color: 'white' }}>
              <span style={{ fontWeight: '700', fontSize: '13px' }}>TOTAL</span>
              <span style={{ fontFamily: 'monospace', fontWeight: '700', fontSize: '13px' }}>{formatCurrency(grandTotal)}</span>
            </div>
          </div>
        </div>

        {/* Amount in words */}
        <div style={{ margin: '14px 36px 0', padding: '10px 14px', background: '#f4f4f0', borderRadius: '8px' }}>
          <p style={{ fontSize: '11px', color: '#6e6e60', margin: 0, lineHeight: 1.6 }}>
            <strong style={{ color: '#1c1c18' }}>Amount in words:</strong> {numberToWords(grandTotal)}
          </p>
        </div>

        {/* Notes */}
        {invoice.notes && (
          <div style={{ margin: '14px 36px 0' }}>
            <p style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', color: '#909080', margin: '0 0 5px' }}>Notes</p>
            <p style={{ fontSize: '12px', color: '#6e6e60', margin: 0, lineHeight: 1.6, whiteSpace: 'pre-line' }}>{invoice.notes}</p>
          </div>
        )}

        {/* Bank Details + Terms + Signature */}
        <div style={{ margin: '14px 36px 28px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: '#e8e8e0', border: '1px solid #e8e8e0' }}>
          <div style={{ background: 'white', padding: '10px 14px', borderRight: '1px solid #e8e8e0' }}>
            {invoice.bankDetails && <>
              <p style={{ fontSize: '10px', fontWeight: '700', color: '#1c1c18', margin: '0 0 4px' }}>Bank Details</p>
              <p style={{ fontSize: '11px', color: '#1c1c18', margin: 0, lineHeight: 1.6 }}>{invoice.bankDetails}</p>
            </>}
            {invoice.termsConditions && <>
              <p style={{ fontSize: '10px', fontWeight: '700', color: '#1c1c18', margin: '10px 0 4px' }}>Terms & Conditions</p>
              <p style={{ fontSize: '11px', color: '#6e6e60', margin: 0, lineHeight: 1.6 }}>{invoice.termsConditions}</p>
            </>}
          </div>
          <div style={{ background: 'white', padding: '10px 14px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontSize: '10px', color: '#6e6e60', margin: '0 0 4px' }}>Receiver Signature:</p>
            <div style={{ flex: 1 }} />
            <div>
              <p style={{ fontSize: '11px', fontWeight: '700', color: '#1c1c18', margin: '0 0 24px' }}>For {seller?.companyName}</p>
              <p style={{ fontSize: '11px', fontWeight: '600', color: '#1c1c18', margin: 0 }}>Authorized Signatory</p>
            </div>
          </div>
        </div>

      </div>
      <div className="h-12" />
    </div>
  );
}