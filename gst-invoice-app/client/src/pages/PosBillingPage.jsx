import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useInvoices } from '../context/InvoiceContext';
import {
  Scan, Search, Plus, Minus, Trash2, Printer, CheckCircle2,
  AlertCircle, Sparkles, User, CreditCard, Banknote, QrCode,
  RotateCcw, PauseCircle, PlayCircle, ShoppingBag, ArrowRight,
  Receipt, ArrowUpRight, Zap
} from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { formatCurrency, GST_RATES, DEFAULT_STORE_DETAILS } from '../utils/invoiceUtils';
import ThermalReceiptModal from '../components/POS/ThermalReceiptModal';

export default function PosBillingPage() {
  const { user } = useAuth();
  const { createInvoice } = useInvoices();

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
  const [paymentMode, setPaymentMode] = useState('cash'); // 'cash', 'upi', 'card', 'credit'
  const [cashTendered, setCashTendered] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);

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
      // F2 -> Print / Complete Bill
      if (e.key === 'F2') {
        e.preventDefault();
        handlePrintAndComplete();
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
        
        // Stock check
        if (product.currentStock !== undefined && currentQty + 1 > product.currentStock) {
          toast(`⚠️ Stock alert: Only ${product.currentStock} pcs available`, { icon: '⚠️' });
        }

        updated[existingIdx] = {
          ...updated[existingIdx],
          qty: currentQty + 1,
        };
        toast.success(`+1 ${product.name} (Total: ${currentQty + 1})`, { duration: 1500 });
        return updated;
      } else {
        // Add new line item
        const rate = Number(product.sellingPrice) || 0;
        const gstPct = Number(product.gstPct) !== undefined ? Number(product.gstPct) : 5;

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
      updated[index] = { ...item, qty: newQty };
      return updated;
    });
    focusBarcodeInput();
  };

  const handleDirectQtyChange = (index, val) => {
    const num = parseInt(val, 10);
    if (isNaN(num) || num <= 0) return;
    setCart((prev) => {
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

  const handleRemoveItem = (index) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
    focusBarcodeInput();
  };

  const handleClearCart = () => {
    if (cart.length === 0) return;
    if (window.confirm('Clear all items from current bill?')) {
      setCart([]);
      setCashTendered('');
      setDiscountAmount(0);
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
  const isSameState = !customer.state || !user?.state ||
    customer.state.trim().toLowerCase() === user?.state.trim().toLowerCase();

  let subtotal = 0;
  let totalGst = 0;

  const processedItems = cart.map((item) => {
    const itemTotal = (Number(item.qty) || 0) * (Number(item.rate) || 0);
    const itemGst = (itemTotal * (Number(item.gstPct) || 0)) / 100;
    subtotal += itemTotal;
    totalGst += itemGst;
    return {
      productId: item.productId,
      name: item.name,
      barcode: item.barcode,
      size: item.size,
      color: item.color,
      hsn: item.hsn,
      unit: item.unit || 'Nos',
      qty: Number(item.qty),
      rate: Number(item.rate),
      gstPct: Number(item.gstPct),
      baseAmount: itemTotal,
      gstAmount: itemGst,
    };
  });

  const cgst = isSameState ? totalGst / 2 : 0;
  const sgst = isSameState ? totalGst / 2 : 0;
  const igst = !isSameState ? totalGst : 0;
  const totalBeforeDiscount = subtotal + totalGst;
  const finalDiscount = Number(discountAmount) || 0;
  const grandTotal = Math.max(0, Math.round(totalBeforeDiscount - finalDiscount));

  // Change calculator
  const tenderedNum = Number(cashTendered) || 0;
  const changeToReturn = tenderedNum > grandTotal ? tenderedNum - grandTotal : 0;

  // 7. PRINT BILL & COMPLETE SALE
  const handlePrintAndComplete = async () => {
    if (cart.length === 0) {
      toast.error('Scan or add at least one clothing item to print bill', { id: 'empty-cart' });
      focusBarcodeInput();
      return;
    }

    setCompleting(true);
    try {
      // Prepare invoice payload compatible with existing Invoice model
      const invoicePayload = {
        invoiceDate: new Date(),
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
        payments: [
          {
            amount: grandTotal,
            mode: paymentMode,
            date: new Date(),
            note: `POS Counter ${paymentMode.toUpperCase()}`,
          },
        ],
        amountPaid: grandTotal,
        amountDue: 0,
      };

      const savedInvoice = await createInvoice(invoicePayload);

      setCompletedInvoice(savedInvoice);
      setShowReceiptModal(true);
      
      // Reset Billing state
      setCart([]);
      setCashTendered('');
      setDiscountAmount(0);
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
      toast.error(err.response?.data?.message || 'Error creating POS bill');
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

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Top Shop Banner & Status Bar */}
      <div className="bg-white dark:bg-ink-900 rounded-2xl border border-ink-200 dark:border-ink-800 p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-ink-800 dark:bg-amber-500 text-white dark:text-ink-950 flex items-center justify-center font-bold shadow-md">
            <ShoppingBag size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-xl font-bold text-ink-900 dark:text-ink-50 tracking-tight">
                {user?.companyName || DEFAULT_STORE_DETAILS.companyName}
              </h1>
              <span className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-mono text-[11px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> POS Counter Active
              </span>
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

          <button
            onClick={handleHoldCart}
            disabled={cart.length === 0}
            className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5 disabled:opacity-40"
            title="Hold current customer bill"
          >
            <PauseCircle size={14} /> Park Bill
          </button>

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
                      <th className="py-2.5 px-4 font-semibold text-right">Amount (₹)</th>
                      <th className="py-2.5 px-2 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                    {cart.map((item, idx) => {
                      const lineBase = item.qty * item.rate;
                      const lineTax = (lineBase * item.gstPct) / 100;
                      const lineTotal = lineBase + lineTax;

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

                          {/* Line Total */}
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

              {/* Discount Input */}
              <div className="flex items-center justify-between text-ink-600 dark:text-ink-300 pt-1">
                <span>Discount (₹):</span>
                <input
                  type="number"
                  min="0"
                  value={discountAmount || ''}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                  placeholder="0"
                  className="w-20 text-right font-mono font-semibold bg-ink-50 dark:bg-ink-800 border border-ink-200 dark:border-ink-700 rounded px-2 py-0.5 text-xs focus:outline-hidden"
                />
              </div>
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

            {/* Payment Mode Selector */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-ink-500 uppercase tracking-wider">
                Select Payment Mode
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: 'cash', label: 'Cash', icon: Banknote },
                  { key: 'upi', label: 'UPI / QR', icon: QrCode },
                  { key: 'card', label: 'Card', icon: CreditCard },
                ].map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPaymentMode(key)}
                    className={`py-2.5 px-3 rounded-xl border-2 text-xs font-bold flex flex-col items-center gap-1.5 transition-all ${
                      paymentMode === key
                        ? '!border-black !bg-black !text-white dark:!border-amber-500 dark:!bg-amber-500 dark:!text-black shadow-sm'
                        : 'border-ink-200 dark:border-ink-700 text-ink-600 dark:text-ink-300 hover:border-ink-300'
                    }`}
                  >
                    <Icon size={16} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Cash Tendered & Change Return Calculator */}
            {paymentMode === 'cash' && (
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
            {paymentMode === 'upi' && (
              <div className="bg-ink-50 dark:bg-ink-800/50 p-3 rounded-xl border border-ink-200 dark:border-ink-700 text-center">
                <p className="text-sm font-bold text-ink-800 dark:text-ink-200">
                  UPI: {user?.contact || 'pay@upi'}
                </p>
              </div>
            )}

            {/* HUGE PRINT BILL BUTTON */}
            <button
              onClick={handlePrintAndComplete}
              disabled={completing || cart.length === 0}
              className="w-full btn-primary py-4 text-base font-bold bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:text-ink-950 flex items-center justify-center gap-2.5 rounded-xl shadow-lg shadow-emerald-600/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {completing ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Printer size={20} />
              )}
              <span>PRINT BILL & COMPLETE SALE (F2)</span>
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