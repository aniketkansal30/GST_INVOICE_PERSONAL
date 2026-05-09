import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { formatDate, numberToWords } from './invoiceUtils';

const fmtPDF = (n) => 'Rs.' + (Number(n) || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export const generatePDF = (invoice) => {
  const doc = new jsPDF({ format: 'a4', unit: 'mm', orientation: 'portrait' });
  const pageW = 210;
  const pageH = 297;
  const margin = 14;
  const contentW = pageW - margin * 2;

  const inkDark = [28, 28, 24];
  const inkMid = [110, 110, 96];
  const inkLight = [232, 232, 224];
  const accentBg = [244, 244, 240];

  let y = margin;

  // ── Header ──
  doc.setFillColor(...accentBg);
  doc.rect(0, 0, pageW, 45, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...inkDark);
  doc.text(invoice.seller?.companyName || 'Company Name', margin, y + 10);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...inkMid);
  doc.text('TAX INVOICE', pageW - margin, y + 6, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...inkMid);
  const sellerAddrLines = doc.splitTextToSize(
    `${invoice.seller?.address || ''}`, 130
  );
  doc.setTextColor(...inkDark);
  doc.text(sellerAddrLines, margin, y + 18);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(`GSTIN: ${invoice.seller?.gstNumber || ''}`, margin, y + 16 + (sellerAddrLines.length * 4));

  const metaX = pageW - margin;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...inkDark);
  doc.text(`Invoice No: ${invoice.invoiceNumber}`, metaX, y + 16, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...inkMid);
  doc.text(`Date: ${formatDate(invoice.invoiceDate)}`, metaX, y + 22, { align: 'right' });
  if (invoice.dueDate) doc.text(`Due Date: ${formatDate(invoice.dueDate)}`, metaX, y + 28, { align: 'right' });

  y = 50;

  // ── Bill To + Supply Details ──
  const boxH = 32;
  doc.setDrawColor(...inkLight);
  doc.setLineWidth(0.3);

  doc.rect(margin, y, contentW / 2 - 4, boxH);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...inkMid);
  doc.text('BILL TO', margin + 3, y + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...inkDark);
  doc.text(invoice.buyer?.clientName || '', margin + 3, y + 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...inkDark);
  const buyerLines = doc.splitTextToSize(invoice.buyer?.address || '', contentW / 2 - 14);
  doc.text(buyerLines, margin + 3, y + 19);
  doc.text(`GSTIN: ${invoice.buyer?.gstNumber || ''}`, margin + 3, y + 28);

  const stateX = margin + contentW / 2 + 4;
  doc.rect(stateX, y, contentW / 2 - 4, boxH);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...inkMid);
  doc.text('SUPPLY DETAILS', stateX + 3, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...inkDark);
  doc.text(`Seller State: ${invoice.seller?.state || ''}`, stateX + 3, y + 14);
  doc.text(`Buyer State: ${invoice.buyer?.state || ''}`, stateX + 3, y + 21);
  doc.text(`Tax Type: ${invoice.isSameState ? 'CGST + SGST' : 'IGST'}`, stateX + 3, y + 28);

  y += boxH + 5;

  // ── Items Table ──
  const tableHead = invoice.isSameState
    ? [['S.No.', 'Product/Service', 'HSN/SAC', 'UNIT', 'Qty', 'Rate', 'Taxable Amt', 'GST%', 'CGST', 'SGST', 'Amount']]
    : [['S.No.', 'Product/Service', 'HSN/SAC', 'UNIT', 'Qty', 'Rate', 'Taxable Amt', 'GST%', 'IGST', 'Amount']];

  const tableBody = invoice.items.map((item, i) => {
    const base = (Number(item.qty) || 0) * (Number(item.rate) || 0);
    const totalGst = (base * (Number(item.gstPct) || 0)) / 100;
    const cgst = totalGst / 2;
    const igst = totalGst;
    const total = base + totalGst;

    const row = [
      String(i + 1),
      item.name || '',
      item.hsn || '',
      item.unit || 'Nos',
      String(item.qty),
      Number(item.rate).toFixed(2),
      base.toFixed(2),
      `${item.gstPct}%`,
    ];
    if (invoice.isSameState) {
      row.push(cgst.toFixed(2), cgst.toFixed(2));
    } else {
      row.push(igst.toFixed(2));
    }
    row.push(total.toFixed(2));
    return row;
  });

  // Total width = 182mm (contentW)
  const colStyles = invoice.isSameState ? {
    0:  { cellWidth: 8,  halign: 'center' },   // S.No.
    1:  { cellWidth: 40, halign: 'left'   },   // Product
    2:  { cellWidth: 13, halign: 'center' },   // HSN
    3:  { cellWidth: 12, halign: 'center' },   // UNIT
    4:  { cellWidth: 10, halign: 'center' },   // Qty
    5:  { cellWidth: 16, halign: 'center' },   // Rate
    6:  { cellWidth: 20, halign: 'center' },   // Taxable
    7:  { cellWidth: 10, halign: 'center' },   // GST%
    8:  { cellWidth: 17, halign: 'center' },   // CGST
    9:  { cellWidth: 17, halign: 'center' },   // SGST
    10: { cellWidth: 19, halign: 'center' },   // Amount
  } : {
    0: { cellWidth: 8,  halign: 'center' },
    1: { cellWidth: 50, halign: 'left'   },
    2: { cellWidth: 15, halign: 'center' },
    3: { cellWidth: 12, halign: 'center' },
    4: { cellWidth: 12, halign: 'center' },
    5: { cellWidth: 20, halign: 'center' },
    6: { cellWidth: 24, halign: 'center' },
    7: { cellWidth: 10, halign: 'center' },
    8: { cellWidth: 22, halign: 'center' },
    9: { cellWidth: 22, halign: 'center' },
  };

  doc.autoTable({
    startY: y,
    head: tableHead,
    body: tableBody,
    margin: { left: margin, right: margin },
    styles: {
      font: 'helvetica',
      fontSize: 7,
      cellPadding: 2,
      textColor: inkDark,
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: {
      fillColor: inkDark,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 6.5,
      cellPadding: { top: 2, bottom: 2, left: 2, right: 2 },
      overflow: 'hidden',
      minCellHeight: 7,
      halign: 'center',
    },
    alternateRowStyles: { fillColor: accentBg },
    columnStyles: colStyles,
    tableLineColor: inkLight,
    tableLineWidth: 0.3,
  });

  y = doc.lastAutoTable.finalY + 8;

  // ── Summary ──
  const summaryX = pageW - margin - 80;
  const summaryW = 80;

  const drawRow = (label, value, bold = false, highlight = false) => {
    if (highlight) {
      doc.setFillColor(...inkDark);
      doc.rect(summaryX, y - 4, summaryW, 9, 'F');
      doc.setTextColor(255, 255, 255);
    } else {
      doc.setTextColor(...(bold ? inkDark : inkMid));
    }
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(bold ? 9 : 8);
    doc.text(label, summaryX + 3, y + 2);
    doc.text(value, summaryX + summaryW - 3, y + 2, { align: 'right' });
    y += 6;
  };

  const exactTotal = (Number(invoice.subtotal) || 0) +
    (invoice.isSameState
      ? (Number(invoice.cgst) || 0) + (Number(invoice.sgst) || 0)
      : (Number(invoice.igst) || 0));

  const roundedTotal = Math.round(exactTotal);
  const roundOff = roundedTotal - exactTotal;

  drawRow('Subtotal (Taxable):', fmtPDF(invoice.subtotal));
  if (invoice.isSameState) {
    drawRow('CGST:', fmtPDF(invoice.cgst));
    drawRow('SGST:', fmtPDF(invoice.sgst));
  } else {
    drawRow('IGST:', fmtPDF(invoice.igst));
  }

  if (Math.abs(roundOff) >= 0.001) {
    drawRow('Round Off:', (roundOff >= 0 ? '+' : '') + roundOff.toFixed(2));
  }

  doc.setDrawColor(...inkLight);
  doc.setLineWidth(0.3);
  doc.line(summaryX, y - 2, summaryX + summaryW, y - 2);
  y += 3;
  drawRow('GRAND TOTAL:', fmtPDF(roundedTotal), true, true);

  y += 6;

  // ── Amount in words ──
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(...inkDark);
  const wordsLine = doc.splitTextToSize(
    `Amount in words: ${numberToWords(roundedTotal)}`, contentW - 80
  );
  doc.text(wordsLine, margin, y);
  y += wordsLine.length * 4 + 5;

  // ── Notes ──
  if (invoice.notes) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...inkDark);
    doc.text('Notes:', margin, y);
    const noteLines = doc.splitTextToSize(invoice.notes, contentW - 80);
    doc.text(noteLines, margin, y + 5);
    y += 5 + noteLines.length * 4;
  }

  y += 8;

  // ── Footer - items ke neeche, fixed position nahi ──
  doc.setDrawColor(...inkLight);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageW - margin, y);

  y += 4;

  doc.setFillColor(...accentBg);
  doc.rect(pageW - margin - 65, y, 65, 20, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...inkMid);
  doc.text(
    'For ' + (invoice.seller?.companyName || ''),
    pageW - margin - 32, y + 7, { align: 'center' }
  );
  doc.line(pageW - margin - 60, y + 15, pageW - margin - 5, y + 15);
  doc.text('Authorized Signatory', pageW - margin - 32, y + 19, { align: 'center' });

  // ✅ "Computer generated invoice" HATAYA

  doc.save(`Invoice-${invoice.invoiceNumber}.pdf`);
};