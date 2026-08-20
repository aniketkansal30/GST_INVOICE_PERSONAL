import React, { useRef, useState } from 'react';
import { Printer, X, Download, Check, Sparkles } from 'lucide-react';
import { formatCurrency, formatDate, DEFAULT_STORE_DETAILS } from '../../utils/invoiceUtils';

export default function ThermalReceiptModal({ invoice, user, onClose, autoPrint = false }) {
  const [paperWidth, setPaperWidth] = useState('80mm'); // '80mm' or '58mm'
  const receiptRef = useRef(null);

  if (!invoice) return null;

  const seller = invoice.seller || {
    companyName: user?.companyName || DEFAULT_STORE_DETAILS.companyName,
    address: user?.address || DEFAULT_STORE_DETAILS.address,
    gstNumber: user?.gstNumber || DEFAULT_STORE_DETAILS.gstNumber,
    panNumber: user?.panNumber || DEFAULT_STORE_DETAILS.panNumber,
    contact: user?.contact || DEFAULT_STORE_DETAILS.contact,
    state: user?.state || DEFAULT_STORE_DETAILS.state,
  };

  const sellerPan = seller.panNumber || user?.panNumber || (seller.gstNumber && seller.gstNumber.length >= 12 ? seller.gstNumber.substring(2, 12) : '') || DEFAULT_STORE_DETAILS.panNumber;

  const buyer = invoice.buyer || {
    clientName: 'Walk-in Customer',
    contact: '',
  };

  const items = invoice.items || [];
  const grandTotal = invoice.grandTotal || 0;
  const subtotal = invoice.subtotal || 0;
  const cgst = invoice.cgst || 0;
  const sgst = invoice.sgst || 0;
  const igst = invoice.igst || 0;
  const totalGst = invoice.totalGst || (cgst + sgst + igst);
  const payments = invoice.payments || [];
  const paymentMode = payments.length > 0 ? payments[0].mode?.toUpperCase() : 'CASH';

  // Group items by GST rate / HSN for Tax summary
  const taxSummary = Object.values(items.reduce((acc, item) => {
    const rate = Number(item.gstPct) || 0;
    const key = `${item.hsn || '6205'}_${rate}`;
    const base = Number(item.baseAmount) || ((Number(item.qty) || 1) * (Number(item.rate) || 0));
    const tax = Number(item.gstAmount) || ((base * rate) / 100);
    if (!acc[key]) {
      acc[key] = {
        hsn: item.hsn || '6205',
        gstPct: rate,
        taxable: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        totalTax: 0,
      };
    }
    acc[key].taxable += base;
    if (igst > 0) {
      acc[key].igst += tax;
    } else {
      acc[key].cgst += tax / 2;
      acc[key].sgst += tax / 2;
    }
    acc[key].totalTax += tax;
    return acc;
  }, {}));

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/70 backdrop-blur-sm animate-fade-in no-print-bg">
      <div className="bg-white dark:bg-ink-900 rounded-2xl border border-ink-200 dark:border-ink-800 shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-ink-100 dark:border-ink-800 no-print">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <Printer size={18} />
            </div>
            <div>
              <h3 className="font-semibold text-ink-900 dark:text-ink-100 text-sm">Thermal POS Bill</h3>
              <p className="text-xs text-ink-400 font-mono">Invoice #{invoice.invoiceNumber || 'BILL'}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Paper Size selector */}
            <div className="flex bg-ink-100 dark:bg-ink-800 p-0.5 rounded-lg text-xs font-mono">
              <button
                onClick={() => setPaperWidth('58mm')}
                className={`px-2 py-1 rounded transition-all ${paperWidth === '58mm' ? 'bg-white dark:bg-ink-700 shadow-xs font-bold text-ink-900 dark:text-white' : 'text-ink-500'}`}
              >
                58mm
              </button>
              <button
                onClick={() => setPaperWidth('80mm')}
                className={`px-2 py-1 rounded transition-all ${paperWidth === '80mm' ? 'bg-white dark:bg-ink-700 shadow-xs font-bold text-ink-900 dark:text-white' : 'text-ink-500'}`}
              >
                80mm
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-ink-400 hover:text-ink-700 dark:hover:text-ink-200 hover:bg-ink-100 dark:hover:bg-ink-800 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Receipt Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 flex justify-center bg-ink-50 dark:bg-ink-950/40">
          <div
            ref={receiptRef}
            id="thermal-receipt-printable"
            style={{ width: paperWidth === '58mm' ? '58mm' : '80mm', minWidth: paperWidth === '58mm' ? '58mm' : '80mm' }}
            className="bg-white text-black font-mono text-[11px] leading-tight p-3 shadow-md rounded-sm border border-dashed border-ink-300 print:shadow-none print:border-none print:m-0 print:p-1"
          >
            {/* Store Header */}
            <div className="text-center pb-2 border-b border-dashed border-black space-y-0.5">
              <p className="font-bold text-sm tracking-tight uppercase">{seller.companyName || user?.companyName || DEFAULT_STORE_DETAILS.companyName}</p>
              {seller.address && <p className="text-[10px] leading-3 text-neutral-700">{seller.address}</p>}
              {seller.contact && <p className="text-[10px]">Mobile: {seller.contact}</p>}
              {seller.gstNumber && <p className="text-[10px] font-semibold">GSTIN: {seller.gstNumber}</p>}
              {sellerPan && <p className="text-[10px] font-semibold">PAN No: {sellerPan}</p>}
              {seller.state && <p className="text-[10px]">State: {seller.state}</p>}
            </div>

            {/* Bill Details */}
            <div className="py-1.5 border-b border-dashed border-black text-[10px] space-y-0.5">
              <div className="flex justify-between">
                <span>Bill No: <strong className="font-bold">{invoice.invoiceNumber}</strong></span>
                <span>{invoice.invoiceDate ? new Date(invoice.invoiceDate).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-neutral-600">
                <span>Time: {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                <span>Mode: <strong>{paymentMode}</strong></span>
              </div>
              {buyer.clientName && buyer.clientName !== 'Walk-in Customer' && (
                <div className="pt-0.5 text-neutral-800">
                  <span>Customer: {buyer.clientName} {buyer.contact ? `(${buyer.contact})` : ''}</span>
                </div>
              )}
            </div>

            {/* Item Table Header */}
            <div className="py-1 border-b border-black text-[10px] font-bold">
              <div className="flex justify-between">
                <span className="flex-1">ITEM (SIZE/CLR)</span>
                <span className="w-8 text-center">QTY</span>
                <span className="w-12 text-right">RATE</span>
                <span className="w-14 text-right">AMT</span>
              </div>
            </div>

            {/* Items List */}
            <div className="py-1 border-b border-dashed border-black space-y-1">
              {items.map((item, idx) => {
                const itemTotal = (Number(item.qty) || 0) * (Number(item.rate) || 0);
                const tagInfo = [item.size ? `Sz:${item.size}` : '', item.color ? item.color : ''].filter(Boolean).join('/');
                return (
                  <div key={idx} className="text-[10px]">
                    <div className="flex justify-between font-semibold">
                      <span className="flex-1 truncate pr-1">
                        {item.name}
                      </span>
                      <span className="w-8 text-center font-normal">{item.qty}</span>
                      <span className="w-12 text-right font-normal">{Number(item.rate).toFixed(2)}</span>
                      <span className="w-14 text-right">{itemTotal.toFixed(2)}</span>
                    </div>
                    {tagInfo && (
                      <div className="text-[9px] text-neutral-600 flex justify-between">
                        <span>[{tagInfo}] {item.hsn ? `HSN:${item.hsn}` : ''}</span>
                        <span>GST {item.gstPct || 5}%</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Totals Section */}
            <div className="py-1.5 border-b border-dashed border-black text-[11px] space-y-1">
              <div className="flex justify-between">
                <span>Items Count ({items.reduce((s, i) => s + (Number(i.qty) || 0), 0)} pcs):</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>

              {cgst > 0 && (
                <div className="flex justify-between text-[10px] text-neutral-700">
                  <span>CGST:</span>
                  <span>₹{cgst.toFixed(2)}</span>
                </div>
              )}
              {sgst > 0 && (
                <div className="flex justify-between text-[10px] text-neutral-700">
                  <span>SGST:</span>
                  <span>₹{sgst.toFixed(2)}</span>
                </div>
              )}
              {igst > 0 && (
                <div className="flex justify-between text-[10px] text-neutral-700">
                  <span>IGST:</span>
                  <span>₹{igst.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between pt-1 border-t border-black font-bold text-sm">
                <span>NET TOTAL:</span>
                <span>₹{grandTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* GST Tax Summary Table */}
            <div className="py-1 border-b border-dashed border-black text-[9px] text-neutral-700">
              <p className="font-bold text-[9px] uppercase mb-0.5">GST Tax Summary:</p>
              <div className="flex justify-between font-semibold border-b border-dotted border-neutral-400 pb-0.5">
                <span>HSN/Rate</span>
                <span>Taxable</span>
                <span>CGST</span>
                <span>SGST</span>
                <span>Total Tax</span>
              </div>
              {taxSummary.map((t, i) => (
                <div key={i} className="flex justify-between pt-0.5">
                  <span>{t.hsn} ({t.gstPct}%)</span>
                  <span>{t.taxable.toFixed(1)}</span>
                  <span>{t.cgst.toFixed(1)}</span>
                  <span>{t.sgst.toFixed(1)}</span>
                  <span className="font-semibold">{t.totalTax.toFixed(1)}</span>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="pt-2 text-center text-[10px] space-y-1">
              <p className="font-bold tracking-wider">*** THANK YOU! VISIT AGAIN ***</p>
              <p className="text-[8px] text-neutral-600">
                Goods once sold can be exchanged within 7 days with bill & intact barcode tags.
              </p>
              <div className="pt-1 flex justify-center">
                <div className="font-mono text-[9px] tracking-widest bg-neutral-100 px-3 py-1 border border-neutral-300 rounded-xs">
                  *{invoice.invoiceNumber}*
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="p-4 border-t border-ink-100 dark:border-ink-800 bg-white dark:bg-ink-900 flex items-center justify-between gap-3 no-print">
          <button
            onClick={onClose}
            className="btn-secondary text-xs"
          >
            Close (Esc)
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="btn-primary px-6 py-2.5 text-sm bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:text-ink-950 font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/20"
            >
              <Printer size={16} />
              Print Thermal Bill (Enter)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
