import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { formatDate, numberToWords } from './invoiceUtils';

// ₹ symbol jsPDF mein render nahi hota — Rs. use karo PDF mein
const fmtPDF = (n) => 'Rs.' + (Number(n) || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export const generatePDF = (invoice) => {
  const doc = new jsPDF({ format: 'a4', unit: 'mm', orientation: 'landscape' });
  const pageW = 297;
  const pageH = 210;
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
    `${invoice.seller?.address || ''}   GSTIN: ${invoice.seller?.gstNumber || ''}`, 130
  );
  doc.text(sellerAddrLines, margin, y + 18);

  const metaX = pageW - margin - 75;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...inkDark);
  doc.text(`Invoice No: ${invoice.invoiceNumber}`, metaX, y + 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...inkMid);
  doc.text(`Date: ${formatDate(invoice.invoiceDate)}`, metaX, y + 22);
  doc.text(`Due Date: ${formatDate(invoice.dueDate)}`, metaX, y + 28);

  y = 50;

  // ── Bill To + Supply Details ──
  const boxH = 30;
  doc.setDrawColor(...inkLight);
  doc.setLineWidth(0.3);

  // Bill To box
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
  doc.setTextColor(...inkMid);
  const buyerLines = doc.splitTextToSize(invoice.buyer?.address || '', contentW / 2 - 14);
  doc.text(buyerLines, margin + 3, y + 19);
  doc.text(`GSTIN: ${invoice.buyer?.gstNumber || ''}`, margin + 3, y + 26);

  // Supply Details box
  const stateX = margin + contentW / 2 + 4;
  doc.rect(stateX, y, contentW / 2 - 4, boxH);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...inkMid);
  doc.text('SUPPLY DETAILS', stateX + 3, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...inkDark);
  doc.text(`Seller State: ${invoice.seller?.state || ''}`, stateX + 3, y + 13);
  doc.text(`Buyer State: ${invoice.buyer?.state || ''}`, stateX + 3, y + 19);
  doc.text(`Tax Type: ${invoice.isSameState ? 'CGST + SGST' : 'IGST'}`, stateX + 3, y + 25);

  y += boxH + 6;

  // ── Items Table ──
  const tableHead = invoice.isSameState
    ? [['#', 'Product/Service', 'HSN/SAC', 'UoM', 'Qty', 'Rate', 'Taxable Amt', 'GST%', 'CGST', 'SGST', 'Amount']]
    : [['#', 'Product/Service', 'HSN/SAC', 'UoM', 'Qty', 'Rate', 'Taxable Amt', 'GST%', 'IGST', 'Amount']];

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

  // Column widths
  const colStyles = invoice.isSameState ? {
    0: { cellWidth: 7,  halign: 'center' },
    1: { cellWidth: 45 },
    2: { cellWidth: 18, halign: 'center' },
    3: { cellWidth: 14, halign: 'center' },
    4: { cellWidth: 12, halign: 'right' },
    5: { cellWidth: 20, halign: 'right' },
    6: { cellWidth: 24, halign: 'right' },
    7: { cellWidth: 12, halign: 'center' },
    8: { cellWidth: 20, halign: 'right' },
    9: { cellWidth: 20, halign: 'right' },
    10:{ cellWidth: 24, halign: 'right' },
  } : {
    0: { cellWidth: 7,  halign: 'center' },
    1: { cellWidth: 55 },
    2: { cellWidth: 20, halign: 'center' },
    3: { cellWidth: 16, halign: 'center' },
    4: { cellWidth: 14, halign: 'right' },
    5: { cellWidth: 24, halign: 'right' },
    6: { cellWidth: 28, halign: 'right' },
    7: { cellWidth: 14, halign: 'center' },
    8: { cellWidth: 28, halign: 'right' },
    9: { cellWidth: 28, halign: 'right' },
  };

  doc.autoTable({
    startY: y,
    head: tableHead,
    body: tableBody,
    margin: { left: margin, right: margin },
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      cellPadding: 2.5,
      textColor: inkDark,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: inkDark,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7,
    },
    alternateRowStyles: { fillColor: accentBg },
    columnStyles: colStyles,
    tableLineColor: inkLight,
    tableLineWidth: 0.3,
  });

  y = doc.lastAutoTable.finalY + 6;

  // ── Summary ──
  const summaryX = pageW - margin - 78;
  const summaryW = 78;

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
    y += 7;
  };

  drawRow('Subtotal (Taxable):', fmtPDF(invoice.subtotal));
  if (invoice.isSameState) {
    drawRow('CGST:', fmtPDF(invoice.cgst));
    drawRow('SGST:', fmtPDF(invoice.sgst));
  } else {
    drawRow('IGST:', fmtPDF(invoice.igst));
  }

  const roundOff = Math.round(invoice.grandTotal) - invoice.grandTotal;
  if (Math.abs(roundOff) > 0.001) {
    drawRow('Round Off:', (roundOff >= 0 ? '+' : '') + roundOff.toFixed(2));
  }

  doc.setDrawColor(...inkLight);
  doc.setLineWidth(0.3);
  doc.line(summaryX, y - 2, summaryX + summaryW, y - 2);

  drawRow('GRAND TOTAL:', fmtPDF(invoice.grandTotal), true, true);

  y += 4;

  // ── Amount in words ──
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(...inkMid);
  const wordsLine = doc.splitTextToSize(
    `Amount in words: ${numberToWords(invoice.grandTotal)}`, contentW - 85
  );
  doc.text(wordsLine, margin, y);
  y += wordsLine.length * 4 + 4;

  // ── Notes ──
  if (invoice.notes) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...inkMid);
    doc.text('Notes:', margin, y);
    const noteLines = doc.splitTextToSize(invoice.notes, 140);
    doc.text(noteLines, margin, y + 4);
    y += 4 + noteLines.length * 4;
  }

  // ── Footer ──
  const footerY = pageH - 24;
  doc.setDrawColor(...inkLight);
  doc.line(margin, footerY, pageW - margin, footerY);

  doc.setFillColor(...accentBg);
  doc.rect(pageW - margin - 58, footerY + 3, 58, 16, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...inkMid);
  doc.text(
    'For ' + (invoice.seller?.companyName || ''),
    pageW - margin - 29, footerY + 8, { align: 'center' }
  );
  doc.line(pageW - margin - 53, footerY + 14, pageW - margin - 5, footerY + 14);
  doc.text('Authorized Signatory', pageW - margin - 29, footerY + 19, { align: 'center' });

  doc.setFontSize(7);
  doc.setTextColor(...inkMid);
  doc.text('This is a computer-generated invoice.', pageW / 2, pageH - 3, { align: 'center' });

  doc.save(`Invoice-${invoice.invoiceNumber}.pdf`);
};