import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useInvoices } from '../context/InvoiceContext';
import {
  Scan, Search, Plus, Minus, Trash2, Printer, CheckCircle2,
  AlertCircle, Sparkles, User, CreditCard, Banknote, QrCode,
  RotateCcw, PauseCircle, PlayCircle, ShoppingBag, ArrowRight,
  Receipt, ArrowUpRight, Zap, Edit2, ArrowLeft
} from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { formatCurrency, GST_RATES, DEFAULT_STORE_DETAILS } from '../utils/invoiceUtils';
import ThermalReceiptModal from '../components/POS/ThermalReceiptModal';

export default function PosBillingPage() {
  const { user } = useAuth();
  const { createInvoice, updateInvoice, getInvoice } = useInvoices();
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditMode = !!id;

  // Barcode input & state
  const [barcodeInput, setBarcodeInput] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const barcodeInputRef = useRef(null);

  // Cart / Bill Items
  const [cart, setCart] = useState([]);

  // Customer details (optional)
  const [customer, setCustomer] = useState({
    name: 'Walk-in Customer',
    contact: '',
    state: user?.state || 'Uttar Pradesh',
  });
  const [showCustomerFields, setShowCustomerFields] = useState(false);

  // Payment details
  const [splitPayments, setSplitPayments] = useState([{ mode: 'cash', amount: '' }]); // 'cash', 'upi', 'card', 'credit'
  const [paymentTouched, setPaymentTouched] = useState(false);
  const [cashTendered, setCashTendered] = useState('');

  // ── Edit / View mode: loaded invoice metadata (id, number, original date, status) ──
  const [loadingInvoice, setLoadingInvoice] = useState(isEditMode);
  const [invoiceMeta, setInvoiceMeta] = useState(null);

  const addPaymentLine = () => {
    setSplitPayments(prev => [...prev, { mode: 'cash', amount: '' }]);
  };

  const removePaymentLine = (idx) => {
    setSplitPayments(prev => prev.filter((_, i) => i !== idx));
  };

  const updatePaymentLine = (idx, field, val) => {
    if (field === 'amount') setPaymentTouched(true);
    setSplitPayments(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: val };
      return updated;
    });
  };

  const totalTendered = splitPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  // NOTE: `remainingToPay` needs grandTotal, which is only known after the
  // cart/GST calculations below — it is computed further down, right after
  // grandTotal is defined, instead of here (grandTotal doesn't exist yet at this point).

  // Whether cash / upi mode is currently part of the split payment lines
  // (replaces the old single `paymentMode` state that no longer exists).
  const hasCashLine = splitPayments.some(p => p.mode === 'cash');
  const hasUpiLine = splitPayments.some(p => p.mode === 'upi');

  // Catalogue search modal (for items without readable barcode)
  const [showCatalogue, setShowCatalogue] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [allProducts, setAllProducts] = useState([]);
  const [loadingCatalogue, setLoadingCatalogue] = useState(false);

  // Quick Add new clothing item modal (if barcode not found)
  const [quickAddModal, setQuickAddModal] = useState(false);
  const [unknownBarcode, setUnknownBarcode] = useState('');
  const [newQuickProduct, setNewQuickProduct] = useState({
    name: '',
    barcode: '',
    size: 'M',
    color: 'Blue',
    sellingPrice: '',
    gstPct: 5,
    hsn: '6205',
    openingStock: 20,
  });
  const [savingQuickProduct, setSavingQuickProduct] = useState(false);

  // Parked / Held Carts
  const [heldCarts, setHeldCarts] = useState([]);

  // Printing & Success State
  const [completing, setCompleting] = useState(false);
  const [completedInvoice, setCompletedInvoice] = useState(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // Focus barcode input on mount and keydown handlers
  useEffect(() => {
    focusBarcodeInput();
    loadAllProducts();

    const handleKeyDown = (e) => {
      // F2 -> Print / Complete Bill (or Update Bill in edit mode)
      if (e.key === 'F2') {
        e.preventDefault();
        handleSubmitBill();
      }
      // F3 -> Search Catalogue
      if (e.key === 'F3') {
        e.preventDefault();
        setShowCatalogue(true);
      }
      // F4 -> Quick Customer Toggle
      if (e.key === 'F4') {
        e.preventDefault();
        setShowCustomerFields(prev => !prev);
      }
      // Esc -> Clear / Close
      if (e.key === 'Escape') {
        if (showCatalogue) setShowCatalogue(false);
        else if (quickAddModal) setQuickAddModal(false);
        else if (showReceiptModal) setShowReceiptModal(false);
        else focusBarcodeInput();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Held carts persistence (moved here from inside the JSX return, where a
  // bare `useEffect(...)` call is invalid syntax and breaks the render).
  useEffect(() => {
    const saved = localStorage.getItem('pos_held_carts');
    if (saved) {
      try { setHeldCarts(JSON.parse(saved)); } catch (e) { }
    }
  }, []);
  // Jab tak manager manually amount na chhede, single payment line ko
  // hamesha grandTotal se auto-fill rakho.

  useEffect(() => {
    localStorage.setItem('pos_held_carts', JSON.stringify(heldCarts));
  }, [heldCarts]);

  // ── Load existing invoice into the cart when opened via Dashboard's
  // View / Edit (route has an :id) — same POS screen, pre-filled. ──
  useEffect(() => {
    if (!id) {
      setLoadingInvoice(false);
      return;
    }
    setLoadingInvoice(true);
    getInvoice(id)
      .then((inv) => {
        setInvoiceMeta({
          _id: inv._id,
          invoiceNumber: inv.invoiceNumber,
          invoiceDate: inv.invoiceDate,
          status: inv.status,
        });

        const buyer = inv.buyer || {};
        setCustomer({
          name: buyer.clientName || 'Walk-in Customer',
          contact: buyer.contact || '',
          state: buyer.state || user?.state || 'Uttar Pradesh',
        });
        setShowCustomerFields(!!(buyer.clientName && buyer.clientName !== 'Walk-in Customer') || !!buyer.contact);

        setCart((inv.items || []).map((item) => ({
          productId: item.productId,
          name: item.name,
          barcode: item.barcode || '',
          size: item.size || '',
          color: item.color || '',
          hsn: item.hsn || '6205',
          unit: item.unit || 'Nos',
          rate: Number(item.rate) || 0,
          qty: Number(item.qty) || 1,
          gstPct: Number(item.gstPct) || 0,
          discountPct: Number(item.discountPct) || 0,
        })));

        if (inv.payments && inv.payments.length > 0) {
          setSplitPayments(inv.payments.map(p => ({ mode: p.mode || 'cash', amount: String(p.amount ?? '') })));
        }
      })
      .catch(() => {
        toast.error('Invoice not found');
        navigate('/dashboard');
      })
      .finally(() => setLoadingInvoice(false));
  }, [id]);

  const focusBarcodeInput = () => {
    setTimeout(() => {
      if (barcodeInputRef.current) {
        barcodeInputRef.current.focus();
        barcodeInputRef.current.select();
      }
    }, 50);
  };

  const loadAllProducts = async () => {
    try {
      const res = await api.get('/products');
      setAllProducts(res.data);
    } catch (err) {
      console.warn('Could not prefetch product catalogue');
    }
  };

  // Builds a WhatsApp-friendly plain-text version of the printed thermal
  // bill: store header, item lines (with per-item discount if any), GST
  // breakdown, and net total — so what the customer receives on WhatsApp
  // matches the paper receipt they were handed.
  const sendBillOnWhatsApp = (invoice) => {
    const phone = (customer.contact || '').replace(/\D/g, ''); // sirf digits
    if (!phone || phone.length < 10) {
      toast.error('Customer ka mobile number nahi mila');
      return;
    }
    const fullPhone = phone.length === 10 ? `91${phone}` : phone;

    const seller = invoice.seller || {};
    const companyName = seller.companyName || user?.companyName || DEFAULT_STORE_DETAILS.companyName;
    const address = seller.address || user?.address || DEFAULT_STORE_DETAILS.address;
    const gstNumber = seller.gstNumber || user?.gstNumber || DEFAULT_STORE_DETAILS.gstNumber;

    const billDate = invoice.invoiceDate ? new Date(invoice.invoiceDate) : new Date();
    const dateStr = billDate.toLocaleDateString('en-IN');
    const timeStr = billDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const paymentMode = (invoice.payments?.[0]?.mode || 'cash').toUpperCase();

    // Plain dashes as a separator — safe on every phone/WhatsApp client,
    // unlike emoji which can render as "?" boxes on some devices.
    const line = '--------------------------------';

    // Item lines, matching the thermal bill: name, qty/rate/amt, discount if any
    const itemLines = (invoice.items || []).map((i) => {
      const itemAmt = (Number(i.qty) || 0) * (Number(i.rate) || 0);
      let block = `${i.name}${i.size ? ` (${i.size})` : ''}\n`;
      block += `  Qty: ${i.qty}  Rate: Rs.${Number(i.rate).toFixed(2)}  Amt: Rs.${itemAmt.toFixed(2)}\n`;
      if (Number(i.discountPct) > 0) {
        block += `  Discount: -${i.discountPct}% (Rs.${Number(i.discountAmount || 0).toFixed(2)})\n`;
      }
      return block;
    }).join('\n');

    const cgst = invoice.cgst || 0;
    const sgst = invoice.sgst || 0;
    const igst = invoice.igst || 0;
    const totalDiscount = (invoice.items || []).reduce((s, i) => s + (Number(i.discountAmount) || 0), 0);

    let taxLines = '';
    if (cgst > 0) taxLines += `CGST: Rs.${cgst.toFixed(2)}\n`;
    if (sgst > 0) taxLines += `SGST: Rs.${sgst.toFixed(2)}\n`;
    if (igst > 0) taxLines += `IGST: Rs.${igst.toFixed(2)}\n`;
    if (totalDiscount > 0) taxLines += `Discount Applied: -Rs.${totalDiscount.toFixed(2)}\n`;

    const message =
      `*${companyName}*\n` +
      `${address}\n` +
      `GSTIN: ${gstNumber}\n` +
      `${line}\n` +
      `Bill No: *${invoice.invoiceNumber}*\n` +
      `Date: ${dateStr}   Time: ${timeStr}\n` +
      `Mode: ${paymentMode}\n` +
      `${line}\n` +
      `${itemLines}` +
      `${line}\n` +
      `Subtotal: Rs.${Number(invoice.subtotal || 0).toFixed(2)}\n` +
      `${taxLines}` +
      `${line}\n` +
      `*NET TOTAL: Rs.${Number(invoice.grandTotal || 0).toFixed(2)}*\n` +
      `${line}\n` +
      `Thank you! Visit again.`;

    const waLink = `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`;
    window.open(waLink, '_blank');
  };

  // 1. Barcode Submission Handler (USB Scanner / Typing + Enter)
  const handleBarcodeSubmit = async (e) => {
    if (e) e.preventDefault();
    const cleanCode = barcodeInput.trim();
    if (!cleanCode) return;

    setIsScanning(true);
    try {
      // Check if product exists via barcode API
      const res = await api.get(`/products/barcode/${encodeURIComponent(cleanCode)}`);
      const product = res.data;

      if (product) {
        addProductToCart(product);
        setBarcodeInput('');
      }
    } catch (err) {
      // Barcode not found in database
      const notFoundMsg = err.response?.data?.message || `Barcode "${cleanCode}" not registered`;
      toast.error(notFoundMsg, { id: 'barcode-error', duration: 3000 });

      // Offer 1-click quick add with this barcode
      setUnknownBarcode(cleanCode);
      setNewQuickProduct(prev => ({
        ...prev,
        barcode: cleanCode,
        name: '',
        sellingPrice: '',
      }));
      setQuickAddModal(true);
    } finally {
      setIsScanning(false);
      focusBarcodeInput();
    }
  };

  // 2. Add or Increment Product in Cart
  const addProductToCart = (product) => {
    setCart((prevCart) => {
      const existingIdx = prevCart.findIndex(
        (item) => item.productId === product._id || (item.barcode && item.barcode === product.barcode)
      );

      if (existingIdx > -1) {
        // Increment quantity of existing line
        const updated = [...prevCart];
        const currentQty = updated[existingIdx].qty;

        // Stock check — block overselling by default; only proceed if the
        // user explicitly confirms (e.g. for a manual override).
        if (product.currentStock !== undefined && currentQty + 1 > product.currentStock) {
          const proceed = window.confirm(
            `⚠️ Stock Alert!\n\n"${product.name}" mein sirf ${product.currentStock} pcs bache hain, lekin bill mein ${currentQty + 1} pcs jaa rahe hain.\n\nPhir bhi aage badhein? (Stock negative ho jayega)`
          );
          if (!proceed) {
            toast.error('Item add nahi kiya — stock kam hai', { id: 'stock-blocked' });
            return prevCart;
          }
        }

        updated[existingIdx] = {
          ...updated[existingIdx],
          qty: currentQty + 1,
        };
        toast.success(`+1 ${product.name} (Total: ${currentQty + 1})`, { duration: 1500 });
        return updated;
      } else {
        // Add new line item
        // NOTE: `rate` is treated as the MRP (GST-inclusive) selling price of the product.
        const rate = Number(product.sellingPrice) || 0;
        const gstPct = Number(product.gstPct) !== undefined ? Number(product.gstPct) : 5;

        // Stock check for a brand-new line (e.g. product already at 0 stock)
        if (product.currentStock !== undefined && product.currentStock <= 0) {
          const proceed = window.confirm(
            `⚠️ Stock Alert!\n\n"${product.name}" ka stock khatam ho chuka hai (${product.currentStock} pcs).\n\nPhir bhi bill mein add karein? (Stock negative ho jayega)`
          );
          if (!proceed) {
            toast.error('Item add nahi kiya — stock khatam hai', { id: 'stock-blocked' });
            return prevCart;
          }
        }

        toast.success(`Added ${product.name}`, { icon: '🛍️', duration: 1500 });
        return [
          ...prevCart,
          {
            productId: product._id,
            name: product.name,
            barcode: product.barcode || '',
            size: product.size || '',
            color: product.color || '',
            hsn: product.hsn || '6205',
            unit: product.unit || 'Nos',
            rate: rate,
            qty: 1,
            gstPct: gstPct,
            discountPct: 0,
            currentStock: product.currentStock,
          },
        ];
      }
    });

    focusBarcodeInput();
  };

  // 3. Update Cart Item Quantity
  const handleUpdateQty = (index, delta) => {
    setCart((prev) => {
      const updated = [...prev];
      const item = updated[index];
      const newQty = item.qty + delta;
      if (newQty <= 0) {
        return updated.filter((_, i) => i !== index);
      }
      // Block increasing beyond available stock unless user confirms.
      if (delta > 0 && item.currentStock !== undefined && newQty > item.currentStock) {
        const proceed = window.confirm(
          `⚠️ Stock Alert!\n\n"${item.name}" mein sirf ${item.currentStock} pcs bache hain, lekin qty ${newQty} ho rahi hai.\n\nPhir bhi aage badhein?`
        );
        if (!proceed) return prev;
      }
      updated[index] = { ...item, qty: newQty };
      return updated;
    });
    focusBarcodeInput();
  };

  const handleDirectQtyChange = (index, val) => {
    const num = parseInt(val, 10);
    if (isNaN(num) || num <= 0) return;
    setCart((prev) => {
      const item = prev[index];
      if (item.currentStock !== undefined && num > item.currentStock) {
        const proceed = window.confirm(
          `⚠️ Stock Alert!\n\n"${item.name}" mein sirf ${item.currentStock} pcs bache hain, lekin qty ${num} type ki hai.\n\nPhir bhi aage badhein?`
        );
        if (!proceed) return prev;
      }
      const updated = [...prev];
      updated[index] = { ...updated[index], qty: num };
      return updated;
    });
  };

  const handleUpdateRate = (index, val) => {
    const num = parseFloat(val);
    if (isNaN(num) || num < 0) return;
    setCart((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], rate: num };
      return updated;
    });
  };
  const handleUpdateDiscount = (index, val) => {
    // Allow the box to go fully empty while typing/backspacing — treat
    // empty as 0 instead of ignoring the update (which was making the
    // field get "stuck" on the last digit).
    if (val === '') {
      setCart((prev) => {
        const updated = [...prev];
        updated[index] = { ...updated[index], discountPct: 0 };
        return updated;
      });
      return;
    }
    const num = parseFloat(val);
    if (isNaN(num) || num < 0 || num > 100) return;
    setCart((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], discountPct: num };
      return updated;
    });
  };

  const handleRemoveItem = (index) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
    focusBarcodeInput();
  };

  const handleClearCart = () => {
    if (cart.length === 0) return;
    if (window.confirm('Clear all items from current bill?')) {
      setCart([]);
      setCashTendered('');
      setPaymentTouched(false);                          // 👈 ADD
      setSplitPayments([{ mode: 'cash', amount: '' }]);
      focusBarcodeInput();
    }
  };

  // 4. Hold / Park Bill
  const handleHoldCart = () => {
    if (cart.length === 0) return toast.error('Cart is empty');
    setHeldCarts((prev) => [
      ...prev,
      {
        id: Date.now(),
        time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        items: cart,
        customer: { ...customer },
      },
    ]);
    setCart([]);
    toast.success('Bill parked on hold!');
    focusBarcodeInput();
  };

  const handleResumeHeldCart = (held) => {
    if (cart.length > 0) {
      if (!window.confirm('Current cart will be replaced with held bill. Continue?')) return;
    }
    setCart(held.items);
    setCustomer(held.customer);
    setHeldCarts((prev) => prev.filter((h) => h.id !== held.id));
    toast.success('Held bill restored');
    focusBarcodeInput();
  };

  // 5. Quick Add Product to Database
  const handleSaveQuickProduct = async (e) => {
    e.preventDefault();
    if (!newQuickProduct.name.trim()) return toast.error('Item name required');
    if (!newQuickProduct.sellingPrice || Number(newQuickProduct.sellingPrice) <= 0) {
      return toast.error('Selling price required');
    }

    setSavingQuickProduct(true);
    try {
      const res = await api.post('/products', {
        ...newQuickProduct,
        sellingPrice: Number(newQuickProduct.sellingPrice),
        openingStock: Number(newQuickProduct.openingStock) || 10,
      });

      const created = res.data;
      toast.success(`Product "${created.name}" created!`);
      setQuickAddModal(false);
      loadAllProducts();

      // Automatically add newly created product to the cart
      addProductToCart(created);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save product');
    } finally {
      setSavingQuickProduct(false);
      focusBarcodeInput();
    }
  };

  // 6. Calculations
  // IMPORTANT: `item.rate` is the final MRP per unit (GST already included).
  // So the taxable value and GST are REVERSE-calculated out of the rate,
  // instead of being added on top. This keeps qty*rate == line total always.
  const isSameState = !customer.state || !user?.state ||
    customer.state.trim().toLowerCase() === user?.state.trim().toLowerCase();

  let subtotal = 0;   // sum of taxable (ex-GST) values
  let totalGst = 0;   // sum of GST extracted from MRP

  const processedItems = cart.map((item) => {
    const qty = Number(item.qty) || 0;
    const rate = Number(item.rate) || 0;
    const gstPct = Number(item.gstPct) || 0;
    const discountPct = Number(item.discountPct) || 0;   // 👈 naya

    const lineMrpBeforeDiscount = qty * rate;
    const lineDiscount = (lineMrpBeforeDiscount * discountPct) / 100;   // 👈 naya
    const lineMrpTotal = lineMrpBeforeDiscount - lineDiscount;           // 👈 discount ke baad

    const lineTaxable = gstPct > 0 ? lineMrpTotal / (1 + gstPct / 100) : lineMrpTotal;
    const lineGst = lineMrpTotal - lineTaxable;

    subtotal += lineTaxable;
    totalGst += lineGst;

    return {
      productId: item.productId,
      name: item.name,
      barcode: item.barcode,
      size: item.size,
      color: item.color,
      hsn: item.hsn,
      unit: item.unit || 'Nos',
      qty: qty,
      rate: rate,
      gstPct: gstPct,
      discountPct: discountPct,                          // 👈 invoice mein save karo
      discountAmount: Number(lineDiscount.toFixed(2)),    // 👈 invoice mein save karo
      baseAmount: Number(lineTaxable.toFixed(2)),
      gstAmount: Number(lineGst.toFixed(2)),
      lineTotal: Number(lineMrpTotal.toFixed(2)),
    };
  });
  const cgst = isSameState ? totalGst / 2 : 0;
  const sgst = isSameState ? totalGst / 2 : 0;
  const igst = !isSameState ? totalGst : 0;

  // subtotal + totalGst always reconstructs back to sum(qty*rate) since GST
  // was extracted from the MRP rather than added on top.
  const totalBeforeDiscount = subtotal + totalGst;
  const grandTotal = Math.max(0, Math.round(totalBeforeDiscount));

  // Now that grandTotal exists, we can safely compute how much is left to pay.
  const remainingToPay = grandTotal - totalTendered;
  useEffect(() => {
  setSplitPayments(prev => {
    if (paymentTouched || prev.length !== 1) return prev;
    return [{ ...prev[0], amount: grandTotal > 0 ? String(grandTotal) : '' }];
  });
}, [grandTotal, paymentTouched]);

  // Change calculator
  const tenderedNum = Number(cashTendered) || 0;
  const changeToReturn = tenderedNum > grandTotal ? tenderedNum - grandTotal : 0;

  // 7. SAVE BILL — creates a new POS sale, or (in edit mode) updates the
  // existing invoice loaded above, instead of always creating a new one.
  const handleSubmitBill = async () => {
    if (cart.length === 0) {
      toast.error('Scan or add at least one clothing item to print bill', { id: 'empty-cart' });
      focusBarcodeInput();
      return;
    }

    setCompleting(true);
    try {
      // Prepare invoice payload compatible with existing Invoice model
      const invoicePayload = {
        invoiceDate: (isEditMode && invoiceMeta?.invoiceDate) ? invoiceMeta.invoiceDate : new Date(),
        status: 'paid',
        seller: {
          companyName: user?.companyName || DEFAULT_STORE_DETAILS.companyName,
          gstNumber: user?.gstNumber || DEFAULT_STORE_DETAILS.gstNumber,
          panNumber: user?.panNumber || DEFAULT_STORE_DETAILS.panNumber,
          address: user?.address || DEFAULT_STORE_DETAILS.address,
          state: user?.state || DEFAULT_STORE_DETAILS.state,
          contact: user?.contact || DEFAULT_STORE_DETAILS.contact,
          email: user?.email || '',
        },
        buyer: {
          clientName: customer.name || 'Walk-in Customer',
          contact: customer.contact || '',
          state: customer.state || user?.state || 'Uttar Pradesh',
        },
        items: processedItems,
        subtotal: Number(subtotal.toFixed(2)),
        cgst: Number(cgst.toFixed(2)),
        sgst: Number(sgst.toFixed(2)),
        igst: Number(igst.toFixed(2)),
        totalGst: Number(totalGst.toFixed(2)),
        grandTotal: grandTotal,
        isSameState: isSameState,
        payments: splitPayments
          .filter(p => Number(p.amount) > 0)
          .map(p => ({
            amount: Number(p.amount),
            mode: p.mode,
            date: new Date(),
            note: `POS Counter ${p.mode.toUpperCase()}`,
          })),
        amountPaid: totalTendered,
        amountDue: Math.max(0, grandTotal - totalTendered),
      };

      if (isEditMode) {
        const updated = await updateInvoice(id, invoicePayload);
        toast.success(`Bill #${updated.invoiceNumber} updated!`, { icon: '✅', duration: 3000 });
        navigate('/dashboard');
        return;
      }

      const savedInvoice = await createInvoice(invoicePayload);

      setCompletedInvoice(savedInvoice);
      setShowReceiptModal(true);
      if (customer.contact && customer.contact.trim()) {
        setTimeout(() => sendBillOnWhatsApp(savedInvoice), 500);
      }

      // Reset Billing state
      setCart([]);
      setCashTendered('');
      setPaymentTouched(false);                          // 👈 ADD
      setSplitPayments([{ mode: 'cash', amount: '' }]);
      setCustomer({
        name: 'Walk-in Customer',
        contact: '',
        state: user?.state || 'Uttar Pradesh',
      });
      loadAllProducts(); // refresh stock numbers

      toast.success(`Bill #${savedInvoice.invoiceNumber} created & stock deducted!`, {
        icon: '🧾',
        duration: 3000,
      });
    } catch (err) {
      toast.error(err.response?.data?.message || (isEditMode ? 'Error updating bill' : 'Error creating POS bill'));
    } finally {
      setCompleting(false);
    }
  };

  // Filtered products for quick search catalogue
  const filteredProducts = allProducts.filter((p) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.name?.toLowerCase().includes(q) ||
      p.barcode?.toLowerCase().includes(q) ||
      p.size?.toLowerCase().includes(q) ||
      p.color?.toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q)
    );
  });

  if (loadingInvoice) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-ink-800 dark:border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Top Shop Banner & Status Bar */}
      <div className="bg-white dark:bg-ink-900 rounded-2xl border border-ink-200 dark:border-ink-800 p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {isEditMode && (
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-400 transition-all"
              title="Back to Dashboard"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div className="w-11 h-11 rounded-xl bg-ink-800 dark:bg-amber-500 text-white dark:text-ink-950 flex items-center justify-center font-bold shadow-md">
            <ShoppingBag size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-xl font-bold text-ink-900 dark:text-ink-50 tracking-tight">
                {user?.companyName || DEFAULT_STORE_DETAILS.companyName}
              </h1>
              {isEditMode ? (
                <span className="bg-blue-500/10 text-blue-700 dark:text-blue-400 font-mono text-[11px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Edit2 size={12} /> Editing Bill #{invoiceMeta?.invoiceNumber || id}
                </span>
              ) : (
                <span className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-mono text-[11px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> POS Counter Active
                </span>
              )}
            </div>
            <p className="text-xs text-ink-500 dark:text-ink-400 font-mono flex items-center gap-2 mt-0.5 flex-wrap">
              <span>GSTIN: {user?.gstNumber || DEFAULT_STORE_DETAILS.gstNumber}</span>
              <span>•</span>
              <span>PAN: {user?.panNumber || DEFAULT_STORE_DETAILS.panNumber}</span>
              <span>•</span>
              <span>Ph: {user?.contact || DEFAULT_STORE_DETAILS.contact}</span>
              <span>•</span>
              <span>{user?.state || DEFAULT_STORE_DETAILS.state}</span>
            </p>
          </div>
        </div>

        {/* Shortcuts Bar & Held Carts */}
        <div className="flex items-center gap-2 flex-wrap">
          {heldCarts.length > 0 && (
            <div className="flex items-center gap-1.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 px-3 py-1.5 rounded-xl border border-amber-500/20 text-xs font-semibold">
              <PauseCircle size={14} />
              <span>{heldCarts.length} Held Bill(s):</span>
              {heldCarts.map((h, i) => (
                <button
                  key={h.id}
                  onClick={() => handleResumeHeldCart(h)}
                  className="bg-amber-500 text-white px-2 py-0.5 rounded hover:bg-amber-600 text-[11px] font-mono"
                >
                  Resume #{i + 1} ({h.items.length} items)
                </button>
              ))}
            </div>
          )}

          <button
            onClick={() => setShowCatalogue(true)}
            className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5"
            title="Search Catalogue (F3)"
          >
            <Search size={14} /> Catalogue (F3)
          </button>

          {!isEditMode && (
            <button
              onClick={handleHoldCart}
              disabled={cart.length === 0}
              className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5 disabled:opacity-40"
              title="Hold current customer bill"
            >
              <PauseCircle size={14} /> Park Bill
            </button>
          )}

          <button
            onClick={handleClearCart}
            disabled={cart.length === 0}
            className="btn-secondary text-xs px-3 py-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-1.5 disabled:opacity-40"
            title="Clear Cart"
          >
            <RotateCcw size={14} /> Clear (Esc)
          </button>
        </div>
      </div>

      {/* Main Counter Layout: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Barcode Scanner + Cart Table (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Prominent Barcode Scanner Section */}
          <div className="bg-linear-to-r from-ink-900 to-ink-800 dark:from-ink-900 dark:to-ink-950 text-white rounded-2xl p-4 sm:p-5 shadow-lg border border-ink-700">
            <form onSubmit={handleBarcodeSubmit} className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs sm:text-sm font-semibold text-ink-200 flex items-center gap-2">
                  <Scan size={16} className="text-amber-400 animate-pulse" />
                  SCAN BARCODE OR ENTER CODE
                </label>
                <span className="text-[11px] font-mono text-ink-400 hidden sm:inline-block">
                  Auto-increments quantity on repeat scan
                </span>
              </div>

              <div className="relative flex items-center">
                <input
                  ref={barcodeInputRef}
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  placeholder="Scan clothing barcode (e.g. 8901234567890)..."
                  className="w-full bg-ink-950/80 text-amber-300 font-mono text-base sm:text-lg tracking-wider px-4 py-3 sm:py-3.5 pr-28 rounded-xl border-2 border-amber-500/50 focus:border-amber-400 focus:outline-hidden focus:ring-4 focus:ring-amber-500/20 placeholder:text-ink-500 placeholder:text-sm placeholder:font-sans"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={isScanning || !barcodeInput.trim()}
                  className="absolute right-2 top-2 bottom-2 px-4 bg-amber-500 hover:bg-amber-400 text-ink-950 font-bold text-xs sm:text-sm rounded-lg transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-40"
                >
                  <Plus size={16} /> Add Item
                </button>
              </div>

              {/* Quick Barcode Demo Chips for instant testing */}
              <div className="pt-1 flex items-center gap-2 flex-wrap">
                <span className="text-[11px] text-ink-400 font-medium">Quick Demo Scans:</span>
                {[
                  { code: '8901234567890', label: "Men's Shirt (L) - ₹999" },
                  { code: '8901234567891', label: "Slim Jeans (32) - ₹1499" },
                  { code: '8901234567892', label: 'Polo T-Shirt (M) - ₹599' },
                ].map((demo) => (
                  <button
                    key={demo.code}
                    type="button"
                    onClick={() => {
                      setBarcodeInput(demo.code);
                      setTimeout(() => {
                        handleBarcodeSubmit();
                      }, 50);
                    }}
                    className="text-[11px] bg-ink-800 hover:bg-ink-700 text-ink-200 hover:text-white px-2.5 py-1 rounded-lg border border-ink-600 font-mono transition-colors"
                  >
                    + {demo.label}
                  </button>
                ))}
              </div>
            </form>
          </div>

          {/* Cart Items Table */}
          <div className="bg-white dark:bg-ink-900 rounded-2xl border border-ink-200 dark:border-ink-800 shadow-sm overflow-hidden flex flex-col min-h-[380px]">
            <div className="px-5 py-3.5 border-b border-ink-100 dark:border-ink-800 flex items-center justify-between bg-ink-50/50 dark:bg-ink-900/50">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-ink-800 dark:text-ink-100 text-sm">Bill Items</h2>
                <span className="bg-ink-200 dark:bg-ink-800 text-ink-700 dark:text-ink-300 text-xs font-mono px-2 py-0.5 rounded-full font-semibold">
                  {cart.reduce((s, i) => s + i.qty, 0)} pcs ({cart.length} unique)
                </span>
              </div>
              <p className="text-xs text-ink-400 font-mono">Product | Qty | Rate | GST | Amount</p>
            </div>

            {cart.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-ink-100 dark:bg-ink-800 flex items-center justify-center text-ink-400 mb-3">
                  <Scan size={32} />
                </div>
                <h3 className="font-semibold text-ink-700 dark:text-ink-200 text-base">Cart is Empty</h3>
                <p className="text-xs text-ink-400 max-w-xs mt-1">
                  Point USB barcode scanner at clothing price tag or click a demo scan above to start bill.
                </p>
                <button
                  onClick={() => setShowCatalogue(true)}
                  className="mt-4 btn-secondary text-xs px-4 py-2 flex items-center gap-1.5"
                >
                  <Search size={14} /> Open Product Catalogue (F3)
                </button>
              </div>
            ) : (
              <div className="flex-1 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-ink-50 dark:bg-ink-800/60 text-ink-500 dark:text-ink-400 uppercase font-mono text-[10px] border-b border-ink-100 dark:border-ink-800">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold"># Product Name</th>
                      <th className="py-2.5 px-3 font-semibold text-center">Qty</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Rate (₹)</th>
                      <th className="py-2.5 px-3 font-semibold text-center">GST %</th>
                      <th className="py-2.5 px-3 font-semibold text-center">Disc %</th>
                      <th className="py-2.5 px-4 font-semibold text-right">Amount (₹)</th>
                      <th className="py-2.5 px-2 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                    {cart.map((item, idx) => {
                      // `item.rate` is MRP (GST-inclusive) per unit, so the
                      // displayed line "Amount" is simply qty * rate — the
                      // taxable/GST split is reverse-derived from it.
                      const lineTotal = (Number(item.qty) || 0) * (Number(item.rate) || 0);
                      const lineBase = item.gstPct > 0 ? lineTotal / (1 + item.gstPct / 100) : lineTotal;
                      const lineTax = lineTotal - lineBase;

                      return (
                        <tr key={idx} className="hover:bg-ink-50/70 dark:hover:bg-ink-800/40 transition-colors">
                          {/* Product Info */}
                          <td className="py-3 px-4">
                            <div className="font-semibold text-ink-900 dark:text-ink-100 text-sm">
                              {item.name}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              {item.size && (
                                <span className="bg-amber-500/10 text-amber-700 dark:text-amber-400 px-1.5 py-0.2 text-[10px] font-bold rounded">
                                  Size: {item.size}
                                </span>
                              )}
                              {item.color && (
                                <span className="bg-sky-500/10 text-sky-700 dark:text-sky-400 px-1.5 py-0.2 text-[10px] font-medium rounded">
                                  {item.color}
                                </span>
                              )}
                              {item.barcode && (
                                <span className="text-ink-400 font-mono text-[10px]">
                                  [{item.barcode}]
                                </span>
                              )}
                              {item.hsn && (
                                <span className="text-ink-400 font-mono text-[10px]">
                                  HSN: {item.hsn}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Quantity Controls */}
                          <td className="py-3 px-3">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleUpdateQty(idx, -1)}
                                className="w-6 h-6 rounded bg-ink-100 dark:bg-ink-800 hover:bg-ink-200 text-ink-700 dark:text-ink-200 flex items-center justify-center font-bold text-xs"
                              >
                                <Minus size={12} />
                              </button>
                              <input
                                type="number"
                                min="1"
                                value={item.qty}
                                onChange={(e) => handleDirectQtyChange(idx, e.target.value)}
                                className="w-10 text-center font-mono font-bold text-sm bg-transparent border border-ink-200 dark:border-ink-700 rounded py-0.5 focus:outline-hidden"
                              />
                              <button
                                onClick={() => handleUpdateQty(idx, 1)}
                                className="w-6 h-6 rounded bg-ink-100 dark:bg-ink-800 hover:bg-ink-200 text-ink-700 dark:text-ink-200 flex items-center justify-center font-bold text-xs"
                              >
                                <Plus size={12} />
                              </button>
                            </div>
                          </td>

                          {/* Rate input */}
                          <td className="py-3 px-3 text-right">
                            <div className="inline-flex items-center justify-end font-mono">
                              <input
                                type="number"
                                min="0"
                                step="0.5"
                                value={item.rate}
                                onChange={(e) => handleUpdateRate(idx, e.target.value)}
                                className="w-16 text-right font-mono font-semibold bg-transparent border-b border-dashed border-ink-300 dark:border-ink-700 focus:border-amber-500 focus:outline-hidden"
                              />
                            </div>
                          </td>

                          {/* GST % */}
                          <td className="py-3 px-3 text-center">
                            <span className="font-mono text-xs text-ink-600 dark:text-ink-300 bg-ink-100 dark:bg-ink-800 px-2 py-0.5 rounded">
                              {item.gstPct}%
                            </span>
                          </td>
                          {/* Discount % - naya */}
                          <td className="py-3 px-3 text-center">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={item.discountPct || ''}
                              onChange={(e) => handleUpdateDiscount(idx, e.target.value)}
                              placeholder="0"
                              className="w-14 text-center font-mono font-semibold bg-transparent border-b border-dashed border-ink-300 dark:border-ink-700 focus:border-amber-500 focus:outline-hidden"
                            />
                          </td>

                          {/* Line Total (this stays qty*rate — GST is inside it now, not added) */}
                          <td className="py-3 px-4 text-right font-mono font-bold text-ink-900 dark:text-ink-100 text-sm">
                            ₹{lineTotal.toFixed(2)}
                          </td>

                          {/* Delete Action */}
                          <td className="py-3 px-2 text-center">
                            <button
                              onClick={() => handleRemoveItem(idx)}
                              className="p-1 text-ink-400 hover:text-rose-600 rounded transition-colors"
                              title="Remove item"
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Totals, Customer, Payment & Print Button (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Customer / Walk-in Toggle Bar */}
          <div className="bg-white dark:bg-ink-900 rounded-2xl border border-ink-200 dark:border-ink-800 p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User size={16} className="text-ink-500" />
                <span className="text-xs font-bold text-ink-800 dark:text-ink-200 uppercase tracking-wider">
                  Customer Information
                </span>
              </div>
              <button
                onClick={() => setShowCustomerFields(prev => !prev)}
                className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline"
              >
                {showCustomerFields ? 'Hide Details' : 'Add Name / Mobile (F4)'}
              </button>
            </div>

            {showCustomerFields ? (
              <div className="grid grid-cols-2 gap-2 pt-1 animate-slide-up">
                <div>
                  <label className="text-[11px] font-medium text-ink-500">Customer Name</label>
                  <input
                    type="text"
                    value={customer.name}
                    onChange={(e) => setCustomer(c => ({ ...c, name: e.target.value }))}
                    placeholder="Customer Name"
                    className="input text-xs py-1.5 mt-0.5"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-ink-500">Mobile (For WhatsApp)</label>
                  <input
                    type="text"
                    value={customer.contact}
                    onChange={(e) => setCustomer(c => ({ ...c, contact: e.target.value }))}
                    placeholder="e.g. 9876543210"
                    className="input text-xs py-1.5 mt-0.5"
                  />
                </div>
              </div>
            ) : (
              <div className="text-xs text-ink-500 dark:text-ink-400 font-mono flex items-center justify-between">
                <span>Buyer: <strong className="text-ink-800 dark:text-ink-200">{customer.name}</strong></span>
                <span>POS Retail Sale</span>
              </div>
            )}
          </div>

          {/* Bill Calculation & Summary Box */}
          <div className="bg-white dark:bg-ink-900 rounded-2xl border border-ink-200 dark:border-ink-800 p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-ink-400 dark:text-ink-500 uppercase tracking-wider">
              Payment Summary
            </h3>

            {/* Calculations Breakdown */}
            <div className="space-y-2 text-xs font-mono border-b border-ink-100 dark:border-ink-800 pb-3">
              <div className="flex justify-between text-ink-600 dark:text-ink-300">
                <span>Subtotal (Taxable Value):</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>

              {cgst > 0 && (
                <div className="flex justify-between text-ink-500 dark:text-ink-400">
                  <span>CGST (Central Tax):</span>
                  <span>₹{cgst.toFixed(2)}</span>
                </div>
              )}
              {sgst > 0 && (
                <div className="flex justify-between text-ink-500 dark:text-ink-400">
                  <span>SGST (State Tax):</span>
                  <span>₹{sgst.toFixed(2)}</span>
                </div>
              )}
              {igst > 0 && (
                <div className="flex justify-between text-ink-500 dark:text-ink-400">
                  <span>IGST (Inter-state Tax):</span>
                  <span>₹{igst.toFixed(2)}</span>
                </div>
              )}

              {cart.some(i => i.discountPct > 0) && (
                <div className="flex justify-between text-rose-500 dark:text-rose-400">
                  <span>Total Discount Given:</span>
                  <span>- ₹{cart.reduce((s, i) => s + (((Number(i.qty) * Number(i.rate)) * (Number(i.discountPct) || 0)) / 100), 0).toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Big Grand Total Display */}
            <div className="bg-emerald-500/10 border border-emerald-500/20 dark:bg-emerald-950/30 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-mono uppercase font-bold text-emerald-800 dark:text-emerald-400">
                  Total Amount Payable
                </p>
                <p className="text-xs text-emerald-600/80 dark:text-emerald-500 font-mono">
                  Includes all GST taxes
                </p>
              </div>
              <div className="text-right">
                <p className="font-display text-3xl font-black text-emerald-700 dark:text-emerald-400 tracking-tight">
                  ₹{grandTotal.toLocaleString('en-IN')}
                </p>
              </div>
            </div>

            {/* Split Payment */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-ink-500 uppercase tracking-wider">
                  Payment (Split allowed)
                </label>
                <button type="button" onClick={addPaymentLine} className="text-xs text-amber-600 font-semibold hover:underline">
                  + Add Payment Mode
                </button>
              </div>

              {splitPayments.map((p, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <select
                    value={p.mode}
                    onChange={(e) => updatePaymentLine(idx, 'mode', e.target.value)}
                    className="input text-xs py-1.5 flex-1"
                  >
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="card">Card</option>
                  </select>
                  <input
                    type="number"
                    min="0"
                    value={p.amount}
                    onChange={(e) => updatePaymentLine(idx, 'amount', e.target.value)}
                    placeholder="Amount"
                    className="input text-xs py-1.5 w-28 font-mono"
                  />
                  {splitPayments.length > 1 && (
                    <button type="button" onClick={() => removePaymentLine(idx)} className="text-rose-500 text-xs">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}

              {splitPayments.length > 1 && (
                <div className="flex items-center justify-between text-xs pt-1 border-t border-ink-200 dark:border-ink-700">
                  <span className="font-semibold text-ink-700 dark:text-ink-200">
                    {remainingToPay > 0 ? 'Remaining:' : remainingToPay < 0 ? 'Extra (Change):' : 'Fully Paid ✓'}
                  </span>
                  <span className={`font-mono font-black ${remainingToPay > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    ₹{Math.abs(remainingToPay).toFixed(2)}
                  </span>
                </div>
              )}
            </div>

            {/* Cash Tendered & Change Return Calculator */}
            {hasCashLine && (
              <div className="bg-ink-50 dark:bg-ink-800/50 p-3 rounded-xl border border-ink-200 dark:border-ink-700 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-ink-600 dark:text-ink-300 font-medium">Cash Received:</span>
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-ink-400">₹</span>
                    <input
                      type="number"
                      value={cashTendered}
                      onChange={(e) => setCashTendered(e.target.value)}
                      placeholder={grandTotal.toString()}
                      className="w-24 px-2 py-1 bg-white dark:bg-ink-900 border border-ink-300 dark:border-ink-700 rounded text-right font-mono font-bold text-sm focus:outline-hidden"
                    />
                  </div>
                </div>

                {tenderedNum > 0 && (
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-ink-200 dark:border-ink-700">
                    <span className="font-semibold text-ink-700 dark:text-ink-200">Change to Return:</span>
                    <span className={`font-mono font-black text-sm ${changeToReturn > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600'}`}>
                      ₹{changeToReturn.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* UPI Mode Info */}
            {hasUpiLine && (
              <div className="bg-ink-50 dark:bg-ink-800/50 p-3 rounded-xl border border-ink-200 dark:border-ink-700 text-center">
                <p className="text-sm font-bold text-ink-800 dark:text-ink-200">
                  UPI: {user?.contact || 'pay@upi'}
                </p>
              </div>
            )}

            {/* HUGE PRINT / UPDATE BILL BUTTON */}
            <button
              onClick={handleSubmitBill}
              disabled={completing || cart.length === 0}
              className={`w-full btn-primary py-4 text-base font-bold flex items-center justify-center gap-2.5 rounded-xl shadow-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all ${isEditMode
                ? 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:text-ink-950 shadow-blue-600/20'
                : 'bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:text-ink-950 shadow-emerald-600/20'
                }`}
            >
              {completing ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : isEditMode ? (
                <CheckCircle2 size={20} />
              ) : (
                <Printer size={20} />
              )}
              <span>{isEditMode ? 'UPDATE BILL (F2)' : 'PRINT BILL & COMPLETE SALE (F2)'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* MODAL 1: Product Catalogue Search (F3) */}
      {showCatalogue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-ink-900 rounded-2xl border border-ink-200 dark:border-ink-800 shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-ink-100 dark:border-ink-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Search size={18} className="text-amber-500" />
                <h3 className="font-semibold text-ink-900 dark:text-ink-100 text-sm">
                  Clothing Product Catalogue
                </h3>
              </div>
              <button onClick={() => setShowCatalogue(false)} className="text-ink-400 hover:text-ink-600">
                Esc to close
              </button>
            </div>

            <div className="p-4 border-b border-ink-100 dark:border-ink-800 bg-ink-50 dark:bg-ink-950/50">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, size (M/L/XL), color (Blue/Black), or barcode..."
                className="input text-sm"
                autoFocus
              />
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2 divide-y divide-ink-100 dark:divide-ink-800">
              {filteredProducts.length === 0 ? (
                <div className="py-8 text-center text-ink-400 text-xs">
                  No matching products found.
                </div>
              ) : (
                filteredProducts.map((prod) => (
                  <div
                    key={prod._id}
                    className="pt-2 first:pt-0 flex items-center justify-between hover:bg-ink-50 dark:hover:bg-ink-800/50 p-2 rounded-xl transition-colors cursor-pointer"
                    onClick={() => {
                      addProductToCart(prod);
                      setShowCatalogue(false);
                    }}
                  >
                    <div>
                      <p className="font-semibold text-ink-800 dark:text-ink-100 text-sm">
                        {prod.name}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-ink-500 font-mono mt-0.5">
                        {prod.size && <span className="text-amber-600 font-bold">Size: {prod.size}</span>}
                        {prod.color && <span>{prod.color}</span>}
                        {prod.barcode && <span>[{prod.barcode}]</span>}
                        <span className="text-ink-400">Stock: {prod.currentStock || 0}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-bold text-ink-900 dark:text-ink-100 text-sm font-mono">
                          ₹{prod.sellingPrice || 0}
                        </p>
                        <p className="text-[10px] text-ink-400 font-mono">GST {prod.gstPct}%</p>
                      </div>
                      <button className="btn-primary text-xs py-1.5 px-3">
                        + Add
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Quick Register New Product on Unrecognized Barcode */}
      {quickAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-ink-900 rounded-2xl border border-ink-200 dark:border-ink-800 shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-ink-100 dark:border-ink-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-amber-500" />
                <h3 className="font-semibold text-ink-900 dark:text-ink-100 text-sm">
                  Register New Clothing Item
                </h3>
              </div>
              <button onClick={() => setQuickAddModal(false)} className="text-ink-400 hover:text-ink-600">
                Cancel
              </button>
            </div>

            <form onSubmit={handleSaveQuickProduct} className="p-5 space-y-3.5">
              <div>
                <label className="label">Barcode</label>
                <input
                  type="text"
                  value={newQuickProduct.barcode}
                  onChange={(e) => setNewQuickProduct(p => ({ ...p, barcode: e.target.value }))}
                  className="input font-mono font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  required
                />
              </div>

              <div>
                <label className="label">Product Name</label>
                <input
                  type="text"
                  value={newQuickProduct.name}
                  onChange={(e) => setNewQuickProduct(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Cotton Casual Shirt"
                  className="input"
                  required
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Size</label>
                  <input
                    type="text"
                    value={newQuickProduct.size}
                    onChange={(e) => setNewQuickProduct(p => ({ ...p, size: e.target.value }))}
                    placeholder="M, L, XL, 32"
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Color</label>
                  <input
                    type="text"
                    value={newQuickProduct.color}
                    onChange={(e) => setNewQuickProduct(p => ({ ...p, color: e.target.value }))}
                    placeholder="Navy Blue"
                    className="input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Selling Price (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={newQuickProduct.sellingPrice}
                    onChange={(e) => setNewQuickProduct(p => ({ ...p, sellingPrice: e.target.value }))}
                    placeholder="999"
                    className="input font-mono font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="label">GST Rate (%)</label>
                  <select
                    value={newQuickProduct.gstPct}
                    onChange={(e) => setNewQuickProduct(p => ({ ...p, gstPct: Number(e.target.value) }))}
                    className="input font-mono"
                  >
                    <option value={5}>5% (Standard Apparel)</option>
                    <option value={12}>12% (Premium Apparel)</option>
                    <option value={18}>18%</option>
                    <option value={0}>0% (Exempt)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setQuickAddModal(false)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingQuickProduct}
                  className="btn-primary text-xs"
                >
                  {savingQuickProduct ? 'Saving...' : 'Save & Add to Bill'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Thermal Receipt Preview & Print Modal */}
      {showReceiptModal && completedInvoice && (
        <ThermalReceiptModal
          invoice={completedInvoice}
          user={user}
          onClose={() => {
            setShowReceiptModal(false);
            focusBarcodeInput();
          }}
        />
      )}
    </div>
  );
}