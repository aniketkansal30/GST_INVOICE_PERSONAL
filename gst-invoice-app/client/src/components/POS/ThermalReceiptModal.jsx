import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X, Download, Check, Sparkles, Save, Trash2, Plus, Minus } from 'lucide-react';
import { formatCurrency, formatDate, DEFAULT_STORE_DETAILS } from '../../utils/invoiceUtils';

// ── PAPER WIDTH FIX ──
// Pehle yahan hardcoded '80mm' tha, jisse @page size bhi 80mm force ho jaata
// tha — chahe printer mein 58mm roll lagi ho. Ab hum koi fixed mm size force
// nahi karte; receipt hamesha available width ka 100% leta hai, aur asli
// paper size printer driver decide karta hai (@page { size: auto } neeche).
// Isse 58mm, 80mm, ya koi bhi custom thermal roll — sab par bina cutting ke
// print hoga.
const RECEIPT_WIDTH = '100%';

// Recomputes subtotal / GST / grand total from a list of cart-style items.
// `item.rate` is treated as the MRP (GST-inclusive) per-unit price, so GST
// is reverse-extracted out of it — same logic used on the POS billing screen.
function computeTotals(items, isSameState) {
  let subtotal = 0;
  let totalGst = 0;

  const processed = items.map((item) => {
    const qty = Number(item.qty) || 0;
    const rate = Number(item.rate) || 0;
    const gstPct = Number(item.gstPct) || 0;
    const discountPct = Number(item.discountPct) || 0;

    const lineMrpBeforeDiscount = qty * rate;
    const lineDiscount = (lineMrpBeforeDiscount * discountPct) / 100;
    const lineMrpTotal = lineMrpBeforeDiscount - lineDiscount;

    const lineTaxable = gstPct > 0 ? lineMrpTotal / (1 + gstPct / 100) : lineMrpTotal;
    const lineGst = lineMrpTotal - lineTaxable;

    subtotal += lineTaxable;
    totalGst += lineGst;

    return {
      ...item,
      qty,
      rate,
      gstPct,
      discountPct,
      discountAmount: Number(lineDiscount.toFixed(2)),
      baseAmount: Number(lineTaxable.toFixed(2)),
      gstAmount: Number(lineGst.toFixed(2)),
      lineTotal: Number(lineMrpTotal.toFixed(2)),
    };
  });

  const cgstCalc = isSameState ? totalGst / 2 : 0;
  const sgstCalc = isSameState ? totalGst / 2 : 0;
  const igstCalc = !isSameState ? totalGst : 0;
  const grandTotalCalc = Math.max(0, Math.round(subtotal + totalGst));

  return { processed, subtotal, totalGst, cgstCalc, sgstCalc, igstCalc, grandTotalCalc };
}

// `editable`  — show qty/rate/discount as inputs + a Save button instead of Print.
// `onSave(id, payload)` — called with the recomputed invoice payload when Save is clicked.
export default function ThermalReceiptModal({ invoice, user, onClose, autoPrint = false, editable = false, onSave }) {
  const [saving, setSaving] = useState(false);
  const receiptRef = useRef(null);

  const isSameState = invoice ? (invoice.isSameState !== undefined ? invoice.isSameState : true) : true;

  // Local editable copy of the items — only used/mutated when editable=true.
  const [editableItems, setEditableItems] = useState(() => (invoice?.items || []).map((i) => ({ ...i })));
  useEffect(() => {
    setEditableItems((invoice?.items || []).map((i) => ({ ...i })));
  }, [invoice?._id]);

  if (!invoice) return null;

  const seller = invoice.seller || {
    companyName: DEFAULT_STORE_DETAILS.companyName || user?.companyName,
    address: DEFAULT_STORE_DETAILS.address || user?.address,
    gstNumber: DEFAULT_STORE_DETAILS.gstNumber || user?.gstNumber,
    panNumber: DEFAULT_STORE_DETAILS.panNumber || user?.panNumber,
    contact: DEFAULT_STORE_DETAILS.contact || user?.contact,
    state: DEFAULT_STORE_DETAILS.state || user?.state,
  };

  const sellerPan = seller.panNumber || DEFAULT_STORE_DETAILS.panNumber || user?.panNumber || (seller.gstNumber && seller.gstNumber.length >= 12 ? seller.gstNumber.substring(2, 12) : '');

  const buyer = invoice.buyer || {
    clientName: 'Walk-in Customer',
    contact: '',
  };

  // In edit mode, everything below is recomputed live from editableItems.
  // In view mode, we just use the saved invoice values as-is.
  const liveTotals = editable ? computeTotals(editableItems, isSameState) : null;
  const items = editable ? liveTotals.processed : (invoice.items || []);
  const grandTotal = editable ? liveTotals.grandTotalCalc : (invoice.grandTotal || 0);
  const subtotal = editable ? liveTotals.subtotal : (invoice.subtotal || 0);
  const cgst = editable ? liveTotals.cgstCalc : (invoice.cgst || 0);
  const sgst = editable ? liveTotals.sgstCalc : (invoice.sgst || 0);
  const igst = editable ? liveTotals.igstCalc : (invoice.igst || 0);
  const totalGst = editable ? liveTotals.totalGst : (invoice.totalGst || (cgst + sgst + igst));
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

  // FIX: total discount across all items (was wrongly using a single undefined "item" before)
  const totalDiscountAmount = items.reduce((s, i) => s + (Number(i.discountAmount) || 0), 0);
  const hasDiscount = totalDiscountAmount > 0;

  const handlePrint = () => {
    window.print();
  };

  // ── Edit-mode field handlers ──
  const updateEditableField = (idx, field, val) => {
    setEditableItems((prev) => {
      const updated = [...prev];
      const num = val === '' ? 0 : Number(val);
      if (isNaN(num) || num < 0) return prev;
      updated[idx] = { ...updated[idx], [field]: num };
      return updated;
    });
  };

  const bumpQty = (idx, delta) => {
    setEditableItems((prev) => {
      const updated = [...prev];
      const newQty = (Number(updated[idx].qty) || 0) + delta;
      if (newQty <= 0) return prev.filter((_, i) => i !== idx);
      updated[idx] = { ...updated[idx], qty: newQty };
      return updated;
    });
  };

  const removeEditableItem = (idx) => {
    setEditableItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSaveClick = async () => {
    if (!onSave) return;
    if (editableItems.length === 0) {
      return;
    }
    setSaving(true);
    try {
      const t = computeTotals(editableItems, isSameState);
      const payload = {
        invoiceDate: invoice.invoiceDate,
        status: invoice.status || 'paid',
        seller: invoice.seller,
        buyer: invoice.buyer,
        items: t.processed,
        subtotal: Number(t.subtotal.toFixed(2)),
        cgst: Number(t.cgstCalc.toFixed(2)),
        sgst: Number(t.sgstCalc.toFixed(2)),
        igst: Number(t.igstCalc.toFixed(2)),
        totalGst: Number(t.totalGst.toFixed(2)),
        grandTotal: t.grandTotalCalc,
        isSameState,
        payments: invoice.payments || [],
        amountPaid: invoice.amountPaid || 0,
        amountDue: Math.max(0, t.grandTotalCalc - (invoice.amountPaid || 0)),
      };
      await onSave(invoice._id, payload);
    } finally {
      setSaving(false);
    }
  };

  // ── PRINT FIX ──
  // Render this modal through a React Portal directly under `document.body`.
  // During print we hide every other direct child of body and show only
  // this portal — no leftover invisible-but-tall background content to
  // cause pagination issues.
  //
  // ── WIDTH FIX ──
  // @page { size: auto } lets the browser/print driver use whatever paper
  // is actually loaded (58mm, 80mm, or anything else) instead of forcing a
  // hardcoded mm size that gets clipped on narrower rolls. The printable
  // area itself is width:100%, so it always fills whatever paper width the
  // driver gives it.
  const modalContent = (
    <div id="thermal-print-portal">
      <style>{`
        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            width: 100% !important;
          }
          body > *:not(#thermal-print-portal) {
            display: none !important;
          }
          #thermal-print-portal {
            display: block !important;
            width: 100% !important;
          }
          #thermal-print-portal .no-print {
            display: none !important;
          }
          /* Neutralize the modal's dark backdrop / centering box for print —
             do NOT display:none this, since the receipt itself lives inside it. */
          #thermal-print-portal .print-overlay {
            position: static !important;
            inset: auto !important;
            background: none !important;
            backdrop-filter: none !important;
            padding: 0 !important;
            display: block !important;
            width: 100% !important;
          }
          #thermal-print-portal .print-card {
            max-height: none !important;
            overflow: visible !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            width: 100% !important;
            max-width: none !important;
            background: none !important;
          }
          #thermal-print-portal .print-scroll-area {
            overflow: visible !important;
            padding: 0 !important;
            background: none !important;
            display: block !important;
            width: 100% !important;
          }
          #thermal-receipt-printable {
            position: static !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 2mm !important;
            box-shadow: none !important;
            border: none !important;
            color: #000 !important;
            background: #fff !important;
            box-sizing: border-box !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            filter: contrast(1.4) !important;
          }
          #thermal-receipt-printable * {
            color: #000 !important;
            box-sizing: border-box !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            font-weight: 600 !important;
          }
          #thermal-receipt-printable strong,
          #thermal-receipt-printable .font-bold {
            font-weight: 900 !important;
          }
          /* size: auto = "use whatever paper width the printer driver has
             configured" — this is the actual fix for cutting on non-80mm
             rolls. Do NOT hardcode a mm value here. */
          @page {
            size: auto;
            margin: 0;
          }
        }
      `}</style>

      <div className="print-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/70 backdrop-blur-sm animate-fade-in no-print-bg">
        <div className="print-card bg-white dark:bg-ink-900 rounded-2xl border border-ink-200 dark:border-ink-800 shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden">
          {/* Modal Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-ink-100 dark:border-ink-800 no-print">
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${editable ? 'bg-blue-500/10 text-blue-600' : 'bg-emerald-500/10 text-emerald-600'}`}>
                <Printer size={18} />
              </div>
              <div>
                <h3 className="font-semibold text-ink-900 dark:text-ink-100 text-sm">
                  {editable ? 'Edit Thermal Bill' : 'Thermal POS Bill'}
                </h3>
                <p className="text-xs text-ink-400 font-mono">Invoice #{invoice.invoiceNumber || 'BILL'}</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-ink-400 hover:text-ink-700 dark:hover:text-ink-200 hover:bg-ink-100 dark:hover:bg-ink-800 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Receipt Scroll Area */}
          <div className="print-scroll-area flex-1 min-h-0 overflow-y-auto p-4 flex justify-center bg-ink-50 dark:bg-ink-950/40">
            <div
              ref={receiptRef}
              id="thermal-receipt-printable"
              style={{ width: RECEIPT_WIDTH, maxWidth: '80mm' }}
              className="bg-white text-black font-mono text-[11px] leading-tight p-3 shadow-md rounded-sm border border-dashed border-ink-300 print:shadow-none print:border-none print:m-0 print:p-1"
            >
              {/* Store Header */}
              <div className="text-center pb-2 border-b border-dashed border-black space-y-0.5">
                <p className="font-bold text-sm tracking-tight uppercase">{seller.companyName || DEFAULT_STORE_DETAILS.companyName || user?.companyName}</p>
                {seller.address && <p className="text-[10px] leading-3 text-black">{seller.address}</p>}
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
                <div className="flex justify-between text-black">
                  <span>Time: {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                  <span>Mode: <strong>{paymentMode}</strong></span>
                </div>
                {invoice.salesman && (
                  <div className="flex justify-between text-black">
                    <span>Salesman: <span className="font-normal">{invoice.salesman}</span></span>
                  </div>
                )}
                {buyer.clientName && buyer.clientName !== 'Walk-in Customer' && (
                  <div className="pt-0.5 text-black">
                    <span>Customer: <strong className="font-bold">{buyer.clientName}</strong> {buyer.contact ? `(${buyer.contact})` : ''}</span>
                  </div>
                )}
              </div>

              {/* Item Table Header — percentage-based columns instead of
                  fixed px widths, so they scale down proportionally on
                  narrower paper instead of overflowing and getting cut. */}
              <div className="flex items-center gap-1 py-1 border-b border-black text-[10px] font-bold">
                <span className="flex-1 min-w-0">ITEM (SIZE/CLR)</span>
                <span className="w-[12%] shrink-0 text-center">QTY</span>
                <span className="w-[22%] shrink-0 text-right">RATE</span>
                <span className="w-[22%] shrink-0 text-right">AMT</span>
                {editable && <span className="w-[8%] shrink-0" />}
              </div>

              {/* Items List */}
              <div className="py-1 border-b border-dashed border-black space-y-1.5">
                {items.map((item, idx) => {
                  const itemTotal = (Number(item.qty) || 0) * (Number(item.rate) || 0);
                  const tagInfo = [item.size ? `Sz:${item.size}` : '', item.color ? item.color : ''].filter(Boolean).join('/');
                  return (
                    <div key={idx} className="text-[10px]">
                      <div className="flex items-center gap-1 font-semibold">
                        <span className="flex-1 min-w-0 truncate pr-1">
                          {item.name}
                        </span>
                        {editable ? (
                          <>
                            <span className="w-[20%] shrink-0 flex items-center justify-center gap-0.5 font-normal">
                              <button
                                type="button"
                                onClick={() => bumpQty(idx, -1)}
                                className="w-3.5 h-3.5 flex items-center justify-center bg-neutral-200 rounded-xs no-print"
                              >
                                <Minus size={8} />
                              </button>
                              <input
                                type="number"
                                min="1"
                                value={item.qty}
                                onChange={(e) => updateEditableField(idx, 'qty', e.target.value)}
                                className="w-6 text-center bg-transparent border-b border-dashed border-neutral-400 focus:outline-hidden no-print"
                              />
                              <button
                                type="button"
                                onClick={() => bumpQty(idx, 1)}
                                className="w-3.5 h-3.5 flex items-center justify-center bg-neutral-200 rounded-xs no-print"
                              >
                                <Plus size={8} />
                              </button>
                            </span>
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              value={item.rate}
                              onChange={(e) => updateEditableField(idx, 'rate', e.target.value)}
                              className="w-[22%] shrink-0 text-right font-normal bg-transparent border-b border-dashed border-neutral-400 focus:outline-hidden no-print"
                            />
                          </>
                        ) : (
                          <>
                            <span className="w-[12%] shrink-0 text-center font-normal">{item.qty}</span>
                            <span className="w-[22%] shrink-0 text-right font-normal tabular-nums">{Number(item.rate).toFixed(2)}</span>
                          </>
                        )}
                        <span className="w-[22%] shrink-0 text-right tabular-nums">{itemTotal.toFixed(2)}</span>
                        {editable && (
                          <button
                            type="button"
                            onClick={() => removeEditableItem(idx)}
                            className="w-[8%] shrink-0 flex items-center justify-center text-red-600 no-print"
                            title="Remove item"
                          >
                            <Trash2 size={11} />
                          </button>
                        )}
                      </div>
                      {tagInfo && (
                        <div className="text-[9px] text-black flex justify-between">
                          <span>[{tagInfo}] {item.hsn ? `HSN:${item.hsn}` : ''}</span>
                          <span>GST {item.gstPct || 5}%</span>
                        </div>
                      )}
                      {editable ? (
                        <div className="text-[9px] text-black flex justify-between items-center">
                          <span>Discount %:</span>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={item.discountPct || ''}
                            placeholder="0"
                            onChange={(e) => updateEditableField(idx, 'discountPct', e.target.value)}
                            className="w-12 text-right bg-transparent border-b border-dashed border-neutral-400 focus:outline-hidden no-print"
                          />
                        </div>
                      ) : (
                        Number(item.discountPct) > 0 && (
                          <div className="text-[9px] text-black flex justify-between">
                            <span>Discount:</span>
                            <span>-{item.discountPct}% (₹{Number(item.discountAmount || 0).toFixed(2)})</span>
                          </div>
                        )
                      )}
                    </div>
                  );
                })}
                {editable && items.length === 0 && (
                  <p className="text-[10px] text-red-600 text-center py-2 no-print">Sab items hata diye — kam se kam 1 item rakhein.</p>
                )}
              </div>

              {/* Totals Section */}
              <div className="py-1.5 border-b border-dashed border-black text-[11px] space-y-1">
                <div className="flex justify-between">
                  <span>Items Count ({items.reduce((s, i) => s + (Number(i.qty) || 0), 0)} pcs):</span>
                  <span className="tabular-nums">₹{subtotal.toFixed(2)}</span>
                </div>

                {cgst > 0 && (
                  <div className="flex justify-between text-[10px] text-black">
                    <span>CGST:</span>
                    <span className="tabular-nums">₹{cgst.toFixed(2)}</span>
                  </div>
                )}
                {sgst > 0 && (
                  <div className="flex justify-between text-[10px] text-black">
                    <span>SGST:</span>
                    <span className="tabular-nums">₹{sgst.toFixed(2)}</span>
                  </div>
                )}
                {igst > 0 && (
                  <div className="flex justify-between text-[10px] text-black">
                    <span>IGST:</span>
                    <span className="tabular-nums">₹{igst.toFixed(2)}</span>
                  </div>
                )}
                {hasDiscount && (
                  <div className="text-[9px] text-black flex justify-between">
                    <span>Discount Applied:</span>
                    <span className="tabular-nums">-₹{totalDiscountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-1 border-t border-black font-bold text-sm">
                  <span>NET TOTAL:</span>
                  <span className="tabular-nums">₹{grandTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* GST Tax Summary Table */}
              <div className="py-1 border-b border-dashed border-black text-[9px] text-black">
                <p className="font-bold text-[9px] uppercase mb-0.5">GST Tax Summary:</p>
                <div className="flex justify-between font-semibold border-b border-dotted border-neutral-400 pb-0.5 gap-1">
                  <span className="flex-1 min-w-0">HSN/Rate</span>
                  <span className="w-[18%] shrink-0 text-right">Taxable</span>
                  <span className="w-[15%] shrink-0 text-right">CGST</span>
                  <span className="w-[15%] shrink-0 text-right">SGST</span>
                  <span className="w-[20%] shrink-0 text-right">Total Tax</span>
                </div>
                {taxSummary.map((t, i) => (
                  <div key={i} className="flex justify-between pt-0.5 gap-1">
                    <span className="flex-1 min-w-0">{t.hsn} ({t.gstPct}%)</span>
                    <span className="w-[18%] shrink-0 text-right tabular-nums">{t.taxable.toFixed(1)}</span>
                    <span className="w-[15%] shrink-0 text-right tabular-nums">{t.cgst.toFixed(1)}</span>
                    <span className="w-[15%] shrink-0 text-right tabular-nums">{t.sgst.toFixed(1)}</span>
                    <span className="w-[20%] shrink-0 text-right font-semibold tabular-nums">{t.totalTax.toFixed(1)}</span>
                  </div>
                ))}
              </div>

              {/* Terms & Conditions */}
              <div className="py-1.5 border-b border-dashed border-black text-[9px] text-black text-left space-y-0.5">
                <p className="font-bold text-[9px] uppercase mb-0.5">Sale Terms &amp; Conditions:</p>
                <p>1. All disputes are subject to exclusive jurisdiction of the courts of Meerut , {seller.state || 'the applicable jurisdiction'}.</p>
                <p>2. It is the responsibility of the customer to check the condition and quantity of purchased items before leaving the store. No claim will be entertained once the customer has left the store premises.</p>
                <p>3. Customer is responsible to check balance cash received before leaving the store.</p>
                <p>4. No cash/credit card refunds shall be made for returns once goods are sold.</p>
                <p className="font-bold text-[9px] uppercase mt-1.5 mb-0.5">Exchange Terms &amp; Conditions:</p>
                <p>1. Exchange can only be done within 7 days of purchase, against production of original invoice.</p>
                <p>2. No exchange will be entertained after 7 days.</p>
              </div>

              {/* Footer */}
              <div className="pt-2 text-center text-[10px] space-y-1">
                <p className="font-bold tracking-wider">*** THANK YOU! VISIT AGAIN ***</p>
                <p className="text-[8px] text-black">
                  Goods once sold can be exchanged within 7 days with bill &amp; intact barcode tags.
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
              {editable ? (
                <button
                  onClick={handleSaveClick}
                  disabled={saving || editableItems.length === 0}
                  className="btn-primary px-6 py-2.5 text-sm bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:text-ink-950 font-bold flex items-center gap-2 shadow-lg shadow-blue-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Save size={16} />
                  )}
                  Save Changes
                </button>
              ) : (
                <button
                  onClick={handlePrint}
                  className="btn-primary px-6 py-2.5 text-sm bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:text-ink-950 font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/20"
                >
                  <Printer size={16} />
                  Print Thermal Bill (Enter)
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}