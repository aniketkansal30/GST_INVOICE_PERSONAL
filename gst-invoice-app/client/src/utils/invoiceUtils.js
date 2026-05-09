export const GST_RATES = [0, 5, 18];

export const HSN_SUGGESTIONS = {
  'software': { hsn: '998314', gst: 18 },
  'consulting': { hsn: '998311', gst: 18 },
  'design': { hsn: '998311', gst: 18 },
  'hardware': { hsn: '847130', gst: 18 },
  'laptop': { hsn: '847130', gst: 18 },
  'mobile': { hsn: '851712', gst: 12 },
  'food': { hsn: '210690', gst: 5 },
  'textile': { hsn: '520100', gst: 5 },
  'medicine': { hsn: '300490', gst: 5 },
  'furniture': { hsn: '940360', gst: 28 },
  'car': { hsn: '870322', gst: 28 },
};

export const getHSNSuggestion = (itemName) => {
  const lower = itemName.toLowerCase();
  for (const [key, val] of Object.entries(HSN_SUGGESTIONS)) {
    if (lower.includes(key)) return val;
  }
  return null;
};

export const calcItemAmount = (qty, rate, gstPct) => {
  const base = qty * rate;
  const gstAmt = (base * gstPct) / 100;
  return { base, gstAmt, total: base + gstAmt };
};

export const calcInvoiceTotals = (items, sellerState, buyerState) => {
  let subtotal = 0;
  let totalGst = 0;

  const processedItems = items.map(item => {
    const { base, gstAmt } = calcItemAmount(
      Number(item.qty) || 0,
      Number(item.rate) || 0,
      Number(item.gstPct) || 0
    );
    subtotal += base;
    totalGst += gstAmt;
    return { ...item, baseAmount: base, gstAmount: gstAmt };
  });

  const isSameState = sellerState && buyerState &&
    sellerState.trim().toLowerCase() === buyerState.trim().toLowerCase();

  const cgst = isSameState ? totalGst / 2 : 0;
  const sgst = isSameState ? totalGst / 2 : 0;
  const igst = !isSameState ? totalGst : 0;
  const grandTotal = subtotal + totalGst;

  return { processedItems, subtotal, cgst, sgst, igst, totalGst, grandTotal, isSameState };
};

export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount || 0);
};

export const formatDate = (dateStr) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
};

export const generateInvoiceNumber = (prefix = 'INV') => {
  const date = new Date();
  const yr = date.getFullYear().toString().slice(-2);
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const rand = String(Math.floor(Math.random() * 9000) + 1000);
  return `${prefix}-${yr}${mo}-${rand}`;
};

export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli',
  'Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
];

export const numberToWords = (num) => {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen',
    'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  if (num === 0) return 'Zero';

  const convert = (n) => {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convert(n % 100) : '');
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '');
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '');
  };

  const rupees = Math.floor(num);
  const paise = Math.round((num - rupees) * 100);
  let result = 'Rupees ' + convert(rupees);
  if (paise > 0) result += ' and ' + convert(paise) + ' Paise';
  return result + ' Only';
};


