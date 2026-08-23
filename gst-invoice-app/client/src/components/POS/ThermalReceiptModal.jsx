import React, { useRef, useState, useEffect } from 'react';
import { Printer, X, Download, Check, Sparkles, Save, Trash2, Plus, Minus } from 'lucide-react';
import { formatCurrency, formatDate, DEFAULT_STORE_DETAILS } from '../../utils/invoiceUtils';

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
  const [paperWidth, setPaperWidth] = useState('80mm'); // '80mm' or '58mm'
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/70 backdrop-blur-sm animate-fade-in no-print-bg">
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #thermal-receipt-printable,
          #thermal-receipt-printable * {
            visibility: visible !important;
          }
          #thermal-receipt-printable {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: ${paperWidth} !important;
            margin: 0 !important;
            padding: 4px !important;
            box-shadow: none !important;
            border: none !important;
          }
          @page {
            size: ${paperWidth} auto;
            margin: 0;
          }
        }
      `}</style>
      <div className="bg-white dark:bg-ink-900 rounded-2xl border border-ink-200 dark:border-ink-800 shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden">
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
                  <span>Salesman: <strong>{invoice.salesman}</strong></span>
                </div>
              )}
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
                {editable && <span className="w-5" />}
              </div>
            </div>

            {/* Items List */}
            <div className="py-1 border-b border-dashed border-black space-y-1">
              {items.map((item, idx) => {
                const itemTotal = (Number(item.qty) || 0) * (Number(item.rate) || 0);
                const tagInfo = [item.size ? `Sz:${item.size}` : '', item.color ? item.color : ''].filter(Boolean).join('/');
                return (
                  <div key={idx} className="text-[10px]">
                    <div className="flex justify-between items-center font-semibold">
                      <span className="flex-1 truncate pr-1">
                        {item.name}
                      </span>
                      {editable ? (
                        <>
                          <span className="w-12 flex items-center justify-center gap-0.5 font-normal">
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
                            className="w-12 text-right font-normal bg-transparent border-b border-dashed border-neutral-400 focus:outline-hidden no-print"
                          />
                        </>
                      ) : (
                        <>
                          <span className="w-8 text-center font-normal">{item.qty}</span>
                          <span className="w-12 text-right font-normal">{Number(item.rate).toFixed(2)}</span>
                        </>
                      )}
                      <span className="w-14 text-right">{itemTotal.toFixed(2)}</span>
                      {editable && (
                        <button
                          type="button"
                          onClick={() => removeEditableItem(idx)}
                          className="w-5 flex items-center justify-center text-red-600 no-print"
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
                <span>₹{subtotal.toFixed(2)}</span>
              </div>

              {cgst > 0 && (
                <div className="flex justify-between text-[10px] text-black">
                  <span>CGST:</span>
                  <span>₹{cgst.toFixed(2)}</span>
                </div>
              )}
              {sgst > 0 && (
                <div className="flex justify-between text-[10px] text-black">
                  <span>SGST:</span>
                  <span>₹{sgst.toFixed(2)}</span>
                </div>
              )}
              {igst > 0 && (
                <div className="flex justify-between text-[10px] text-black">
                  <span>IGST:</span>
                  <span>₹{igst.toFixed(2)}</span>
                </div>
              )}
              {hasDiscount && (
                <div className="text-[9px] text-black flex justify-between">
                  <span>Discount Applied:</span>
                  <span>-₹{totalDiscountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between pt-1 border-t border-black font-bold text-sm">
                <span>NET TOTAL:</span>
                <span>₹{grandTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* GST Tax Summary Table */}
            <div className="py-1 border-b border-dashed border-black text-[9px] text-black">
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

                       {/* Terms & Conditions */}
            <div className="py-1.5 border-b border-dashed border-black text-[9px] text-black text-left space-y-0.5">
              <p className="font-bold text-[9px] uppercase mb-0.5">Sale Terms &amp; Conditions:</p>
              <p>1. All disputes are subject to exclusive jurisdiction of the courts of ,meerut {seller.state || 'the applicable jurisdiction'}.</p>
              <p>2. It is the responsibility of the customer to check the condition and quantity of purchased items before leaving the store. No claim will be entertained once the customer has left the store premises.</p>
              <p>3. Customer is responsible to check balance cash received before leaving the store.</p>
              <p>4. No cash/credit card refunds shall be made for returns once goods are sold.</p>
              <p className="font-bold text-[9px] uppercase mt-1.5 mb-0.5">Exchange Terms &amp; Conditions:</p>
              <p>1. Exchange can only be done within 7 days of purchase, against production of original invoice.</p>
              <p>2. No exchange will be entertained after 7 days.</p>
            </div>

            {/* Footer */}
            <div className="pt-2 text-center text-[10px] space-y-1"></div>
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
  );
}