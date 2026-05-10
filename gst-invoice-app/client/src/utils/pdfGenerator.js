import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { formatDate, numberToWords } from './invoiceUtils';

const fmt = (n) => (Number(n) || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const fmtPDF = (n) => 'Rs.' + fmt(n);

export const generatePDF = (invoice) => {
  const doc = new jsPDF({ format: 'a4', unit: 'mm', orientation: 'portrait' });
  const pageW = 210;
  const margin = 12;
  const contentW = pageW - margin * 2;

  const inkDark  = [28, 28, 24];
  const inkMid   = [110, 110, 96];
  const inkLight = [232, 232, 224];
  const accentBg = [244, 244, 240];
  const blue     = [37, 99, 235];
  const amber    = [217, 119, 6];

  let y = margin;

  // ── HEADER ──
  doc.setFillColor(...accentBg);
  doc.rect(0, 0, pageW, 48, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...inkDark);
  doc.text(invoice.seller?.companyName || 'Company Name', margin, y + 9);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...inkMid);
  doc.text('TAX INVOICE', pageW - margin, y + 5, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...inkDark);
  doc.text(invoice.invoiceNumber || '', pageW - margin, y + 13, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...inkMid);
  doc.text('Date: ' + formatDate(invoice.invoiceDate), pageW - margin, y + 20, { align: 'right' });
  if (invoice.dueDate) {
    doc.text('Due: ' + formatDate(invoice.dueDate), pageW - margin, y + 26, { align: 'right' });
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...inkMid);
  const maxAddrW = contentW * 0.55;
  const addrLines = doc.splitTextToSize(invoice.seller?.address || '', maxAddrW);
  doc.text(addrLines, margin, y + 17);

  const gstinY = y + 17 + addrLines.length * 3.8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...inkDark);
  doc.text('GSTIN: ' + (invoice.seller?.gstNumber || ''), margin, gstinY);

  if (invoice.seller?.contact) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...inkMid);
    doc.text(invoice.seller.contact, margin, gstinY + 4);
  }

  y = 52;

  // ✅ BILL TO + SHIP TO (Supply Details hataya)
  const boxH = 32;
  const halfW = (contentW - 4) / 2;
  doc.setDrawColor(...inkLight);
  doc.setLineWidth(0.25);

  // ── Bill To box ──
  doc.rect(margin, y, halfW, boxH);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...inkMid);
  doc.text('BILLED TO', margin + 3, y + 5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...inkDark);
  const clientName = invoice.buyer?.clientName || '';
  const clientNameLines = doc.splitTextToSize(clientName, halfW - 6);
  doc.text(clientNameLines, margin + 3, y + 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...inkMid);
  const buyerAddrLines = doc.splitTextToSize(invoice.buyer?.address || '', halfW - 6);
  const buyerAddrY = y + 11 + clientNameLines.length * 4;
  doc.text(buyerAddrLines, margin + 3, buyerAddrY);

  if (invoice.buyer?.gstNumber) {
    const buyerGstY = buyerAddrY + buyerAddrLines.length * 3.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...inkDark);
    doc.text('GSTIN / UIN : ' + invoice.buyer.gstNumber, margin + 3, Math.min(buyerGstY, y + boxH - 3));
  }

  // ── Ship To box ──
  // ✅ Fallback — purane invoices ke liye buyer use karo
  const shipToData = invoice.shipTo?.clientName ? invoice.shipTo : invoice.buyer;

  const supX = margin + halfW + 4;
  doc.rect(supX, y, halfW, boxH);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...inkMid);
  doc.text('SHIPPED TO', supX + 3, y + 5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...inkDark);
  const shipName = shipToData?.clientName || '';
  const shipNameLines = doc.splitTextToSize(shipName, halfW - 6);
  doc.text(shipNameLines, supX + 3, y + 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...inkMid);
  const shipAddrLines = doc.splitTextToSize(shipToData?.address || '', halfW - 6);
  const shipAddrY = y + 11 + shipNameLines.length * 4;
  doc.text(shipAddrLines, supX + 3, shipAddrY);

  if (shipToData?.gstNumber) {
    const shipGstY = shipAddrY + shipAddrLines.length * 3.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...inkDark);
    doc.text('GSTIN / UIN : ' + shipToData.gstNumber, supX + 3, Math.min(shipGstY, y + boxH - 3));
  }

  y += boxH + 6;

  // ── ITEMS TABLE ──
  const isSame = invoice.isSameState;

  const tableHead = isSame
    ? [['#', 'Product / Service', 'HSN', 'Unit', 'Qty', 'Rate', 'Taxable', 'GST%', 'CGST', 'SGST', 'Amount']]
    : [['#', 'Product / Service', 'HSN', 'Unit', 'Qty', 'Rate', 'Taxable', 'GST%', 'IGST', 'Amount']];

  const tableBody = (invoice.items || []).map((item, i) => {
    const base     = (Number(item.qty) || 0) * (Number(item.rate) || 0);
    const totalGst = (base * (Number(item.gstPct) || 0)) / 100;
    const row = [
      String(i + 1),
      item.name || '',
      item.hsn || '-',
      item.unit || 'Nos',
      String(item.qty),
      fmt(item.rate),
      fmt(base),
      (item.gstPct || 0) + '%',
    ];
    if (isSame) {
      row.push(fmt(totalGst / 2), fmt(totalGst / 2));
    } else {
      row.push(fmt(totalGst));
    }
    row.push(fmt(base + totalGst));
    return row;
  });

  const colStyles = isSame ? {
    0:  { cellWidth: 7,  halign: 'center' },
    1:  { cellWidth: 42, halign: 'left'   },
    2:  { cellWidth: 14, halign: 'center' },
    3:  { cellWidth: 11, halign: 'center' },
    4:  { cellWidth: 9,  halign: 'right'  },
    5:  { cellWidth: 18, halign: 'right'  },
    6:  { cellWidth: 21, halign: 'right'  },
    7:  { cellWidth: 10, halign: 'center' },
    8:  { cellWidth: 18, halign: 'right'  },
    9:  { cellWidth: 18, halign: 'right'  },
    10: { cellWidth: 18, halign: 'right'  },
  } : {
    0: { cellWidth: 7,  halign: 'center' },
    1: { cellWidth: 52, halign: 'left'   },
    2: { cellWidth: 16, halign: 'center' },
    3: { cellWidth: 12, halign: 'center' },
    4: { cellWidth: 10, halign: 'right'  },
    5: { cellWidth: 22, halign: 'right'  },
    6: { cellWidth: 24, halign: 'right'  },
    7: { cellWidth: 10, halign: 'center' },
    8: { cellWidth: 13, halign: 'right'  },
    9: { cellWidth: 20, halign: 'right'  },
  };

  doc.autoTable({
    startY: y,
    head: tableHead,
    body: tableBody,
    margin: { left: margin, right: margin },
    tableWidth: contentW,
    styles: {
      font: 'helvetica',
      fontSize: 7,
      cellPadding: { top: 2, bottom: 2, left: 2, right: 2 },
      textColor: inkDark,
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: {
      fillColor: inkDark,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 6.5,
      halign: 'center',
      minCellHeight: 8,
    },
    alternateRowStyles: { fillColor: accentBg },
    columnStyles: colStyles,
    tableLineColor: inkLight,
    tableLineWidth: 0.25,
    didParseCell: (data) => {
      if (data.section === 'body') {
        const lastDataCol = isSame ? 10 : 9;
        const taxCol1 = isSame ? 8 : 8;
        const taxCol2 = isSame ? 9 : null;
        if (data.column.index === taxCol1 || (taxCol2 && data.column.index === taxCol2)) {
          data.cell.styles.textColor = isSame ? blue : amber;
        }
        if (data.column.index === lastDataCol) {
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });

  y = doc.lastAutoTable.finalY + 6;

  // ── TOTALS SUMMARY ──
  const sumW = 82;
  const sumX = pageW - margin - sumW;
  const rowH = 7;

  const summaryRows = [
    { label: 'Subtotal (Taxable)', value: fmtPDF(invoice.subtotal), bold: false },
    ...(isSame
      ? [{ label: 'CGST', value: fmtPDF(invoice.cgst), bold: false, color: blue },
         { label: 'SGST', value: fmtPDF(invoice.sgst), bold: false, color: blue }]
      : [{ label: 'IGST', value: fmtPDF(invoice.igst), bold: false, color: amber }]
    ),
  ];

  const exactTotal = (Number(invoice.subtotal) || 0)
    + (isSame ? (Number(invoice.cgst) || 0) + (Number(invoice.sgst) || 0) : (Number(invoice.igst) || 0));
  const roundedTotal = Math.round(exactTotal);
  const roundOff = roundedTotal - exactTotal;
  if (Math.abs(roundOff) >= 0.001) {
    summaryRows.push({ label: 'Round Off', value: (roundOff >= 0 ? '+' : '') + roundOff.toFixed(2), bold: false });
  }

  doc.setDrawColor(...inkLight);
  doc.setLineWidth(0.25);
  doc.rect(sumX, y, sumW, rowH * summaryRows.length + 1, 'S');

  summaryRows.forEach((row, idx) => {
    const ry = y + idx * rowH;
    if (idx > 0) {
      doc.setDrawColor(...inkLight);
      doc.line(sumX, ry, sumX + sumW, ry);
    }
    doc.setFont('helvetica', row.bold ? 'bold' : 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...(row.color || inkMid));
    doc.text(row.label, sumX + 3, ry + 5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...(row.color || inkDark));
    doc.text(row.value, sumX + sumW - 3, ry + 5, { align: 'right' });
  });

  const gtY = y + rowH * summaryRows.length + 1;
  doc.setFillColor(...inkDark);
  doc.rect(sumX, gtY, sumW, 10, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text('GRAND TOTAL', sumX + 3, gtY + 7);
  doc.text(fmtPDF(roundedTotal), sumX + sumW - 3, gtY + 7, { align: 'right' });

  y = gtY + 16;

  // ── AMOUNT IN WORDS ──
  doc.setFillColor(...accentBg);
  doc.rect(margin, y, contentW, 10, 'F');
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(...inkDark);
  const wordsText = 'Amount in words: ' + numberToWords(roundedTotal);
  const wordsLines = doc.splitTextToSize(wordsText, contentW - 6);
  doc.text(wordsLines, margin + 3, y + 6);
  y += Math.max(10, wordsLines.length * 4) + 4;

  // ── NOTES ──
  if (invoice.notes) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...inkMid);
    doc.text('Notes:', margin, y + 4);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...inkDark);
    const noteLines = doc.splitTextToSize(invoice.notes, contentW - 6);
    doc.text(noteLines, margin, y + 9);
    y += 9 + noteLines.length * 3.8;
  }

  y += 6;

  // ── FOOTER / SIGNATURE ──
  doc.setDrawColor(...inkLight);
  doc.setLineWidth(0.25);
  doc.line(margin, y, pageW - margin, y);
  y += 4;

  doc.setFillColor(...accentBg);
  doc.rect(pageW - margin - 68, y, 68, 22, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...inkMid);
  doc.text('For ' + (invoice.seller?.companyName || ''), pageW - margin - 34, y + 6, { align: 'center' });
  doc.line(pageW - margin - 62, y + 17, pageW - margin - 5, y + 17);
  doc.text('Authorized Signatory', pageW - margin - 34, y + 21, { align: 'center' });

  doc.save('Invoice-' + invoice.invoiceNumber + '.pdf');
};
