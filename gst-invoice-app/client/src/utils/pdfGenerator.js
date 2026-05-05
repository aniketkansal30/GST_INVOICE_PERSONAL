import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { formatCurrency, formatDate, numberToWords } from './invoiceUtils';

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

  // Header
  doc.setFillColor(...accentBg);
  doc.rect(0, 0, pageW, 45, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...inkDark);
  doc.text(invoice.seller.companyName || 'Company Name', margin, y + 10);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...inkMid);
  doc.text('TAX INVOICE', pageW - margin, y + 6, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...inkMid);
  const sellerAddrLines = doc.splitTextToSize(invoice.seller.address || '', 120);
  doc.text(sellerAddrLines, margin, y + 18);
  doc.text(`GSTIN: ${invoice.seller.gstNumber || ''}`, margin, y + 24);
  doc.text(invoice.seller.contact || '', margin, y + 30);

  const metaX = pageW - margin - 80;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...inkDark);
  doc.text(`Invoice No: ${invoice.invoiceNumber}`, metaX, y + 16);
  doc.setFont('helvetica', 'normal');
  doc.text(`Date: ${formatDate(invoice.invoiceDate)}`, metaX, y + 22);
  doc.text(`Due Date: ${formatDate(invoice.dueDate)}`, metaX, y + 28);

  y = 50;

  // Buyer / Seller boxes
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
  doc.text(invoice.buyer.clientName || '', margin + 3, y + 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...inkMid);
  const buyerLines = doc.splitTextToSize(invoice.buyer.address || '', contentW / 2 - 14);
  doc.text(buyerLines, margin + 3, y + 19);
  doc.text(`GSTIN: ${invoice.buyer.gstNumber || ''}`, margin + 3, y + 27);

  const stateX = margin + contentW / 2 + 4;
  doc.rect(stateX, y, contentW / 2 - 4, boxH);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...inkMid);
  doc.text('SUPPLY DETAILS', stateX + 3, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...inkDark);
  doc.text(`Seller State: ${invoice.seller.state || ''}`, stateX + 3, y + 13);
  doc.text(`Buyer State: ${invoice.buyer.state || ''}`, stateX + 3, y + 19);
  doc.text(`Tax Type: ${invoice.isSameState ? 'CGST + SGST' : 'IGST'}`, stateX + 3, y + 25);

  y += boxH + 8;

  // Table - dynamic columns based on isSameState
  const tableHead = invoice.isSameState
    ? [['#', 'Product/Service', 'HSN/SAC', 'UoM', 'QTY', 'Unit Price', 'Taxable Amt', 'GST %', 'CGST', 'SGST', 'Amount']]
    : [['#', 'Product/Service', 'HSN/SAC', 'UoM', 'QTY', 'Unit Price', 'Taxable Amt', 'GST %', 'IGST', 'Amount']];

  const tableBody = invoice.items.map((item, i) => {
    const base = (Number(item.qty) || 0) * (Number(item.rate) || 0);
    const totalGst = (base * (Number(item.gstPct) || 0)) / 100;
    const cgst = invoice.isSameState ? totalGst / 2 : 0;
    const sgst = invoice.isSameState ? totalGst / 2 : 0;
    const igst = !invoice.isSameState ? totalGst : 0;
    const total = base + totalGst;

    const row = [
      String(i + 1),
      item.name || '',
      item.hsn || '',
      item.unit || 'Nos',
      String(item.qty),
      base > 0 ? Number(item.rate).toFixed(2) : '0.00',
      base.toFixed(2),
      `${item.gstPct}%`,
    ];

    if (invoice.isSameState) {
      row.push(cgst.toFixed(2), sgst.toFixed(2));
    } else {
      row.push(igst.toFixed(2));
    }
    row.push(total.toFixed(2));
    return row;
  });

  const colStyles = invoice.isSameState ? {
    0:  { cellWidth: 8,  halign: 'center' },
    1:  { cellWidth: 35 },
    2:  { cellWidth: 18, halign: 'center' },
    3:  { cellWidth: 30 },
    4:  { cellWidth: 12, halign: 'center' },
    5:  { cellWidth: 12, halign: 'center' },
    6:  { cellWidth: 22, halign: 'right' },
    7:  { cellWidth: 22, halign: 'right' },
    8:  { cellWidth: 14, halign: 'center' },
    9:  { cellWidth: 20, halign: 'right' },
    10: { cellWidth: 20, halign: 'right' },
    11: { cellWidth: 22, halign: 'right' },
  } : {
    0:  { cellWidth: 8,  halign: 'center' },
    1:  { cellWidth: 40 },
    2:  { cellWidth: 20, halign: 'center' },
    3:  { cellWidth: 35 },
    4:  { cellWidth: 14, halign: 'center' },
    5:  { cellWidth: 14, halign: 'center' },
    6:  { cellWidth: 25, halign: 'right' },
    7:  { cellWidth: 25, halign: 'right' },
    8:  { cellWidth: 14, halign: 'center' },
    9:  { cellWidth: 25, halign: 'right' },
    10: { cellWidth: 25, halign: 'right' },
  };

  doc.autoTable({
    startY: y,
    head: tableHead,
    body: tableBody,
    margin: { left: margin, right: margin },
    styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 2.5, textColor: inkDark },
    headStyles: { fillColor: inkDark, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 },
    alternateRowStyles: { fillColor: accentBg },
    columnStyles: colStyles,
    tableLineColor: inkLight,
    tableLineWidth: 0.3,
  });

  y = doc.lastAutoTable.finalY + 6;

  // Summary
  const summaryX = pageW - margin - 80;
  const summaryW = 80;

  const drawRow = (label, value, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...(bold ? inkDark : inkMid));
    doc.text(label, summaryX + 3, y);
    doc.text(value, summaryX + summaryW - 3, y, { align: 'right' });
    y += 6;
  };

  drawRow('Subtotal (Taxable):', formatCurrency(invoice.subtotal));
  if (invoice.isSameState) {
    drawRow('CGST:', formatCurrency(invoice.cgst));
    drawRow('SGST:', formatCurrency(invoice.sgst));
  } else {
    drawRow('IGST:', formatCurrency(invoice.igst));
  }
  drawRow('Total GST:', formatCurrency(invoice.totalGst));
  const roundOff = Math.round(invoice.grandTotal) - invoice.grandTotal;
  drawRow('Round Off:', (roundOff >= 0 ? '+ ' : '') + Math.abs(roundOff).toFixed(2));

  doc.setDrawColor(...inkLight);
  doc.setLineWidth(0.3);
  doc.line(summaryX, y, summaryX + summaryW, y);
  y += 4;

  doc.setFillColor(...inkDark);
  doc.rect(summaryX, y - 1, summaryW, 10, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text('GRAND TOTAL:', summaryX + 3, y + 6);
  doc.text(formatCurrency(invoice.grandTotal), summaryX + summaryW - 3, y + 6, { align: 'right' });
  y += 14;

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(...inkMid);
  doc.text(`Amount in words: ${numberToWords(invoice.grandTotal)}`, margin, y);
  y += 10;

  if (invoice.notes) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...inkMid);
    doc.text('Notes:', margin, y);
    const noteLines = doc.splitTextToSize(invoice.notes, 140);
    doc.text(noteLines, margin, y + 5);
    y += 5 + noteLines.length * 4;
  }

  // Footer
  y = pageH - 30;
  doc.line(margin, y, pageW - margin, y);
  y += 6;

  doc.setFillColor(...accentBg);
  doc.rect(pageW - margin - 60, y - 2, 60, 20, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...inkMid);
  doc.text('For ' + (invoice.seller.companyName || ''), pageW - margin - 30, y + 4, { align: 'center' });
  doc.line(pageW - margin - 55, y + 12, pageW - margin - 5, y + 12);
  doc.text('Authorized Signatory', pageW - margin - 30, y + 17, { align: 'center' });

  doc.setFontSize(7);
  doc.text('This is a computer-generated invoice.', pageW / 2, pageH - 5, { align: 'center' });

  doc.save(`Invoice-${invoice.invoiceNumber}.pdf`);
};