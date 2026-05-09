import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { formatDate, numberToWords } from './invoiceUtils';

const fmtPDF = (n) => 'Rs.' + (Number(n) || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export const generatePDF = (invoice) => {
  const doc = new jsPDF({ format: 'a4', unit: 'mm', orientation: 'portrait' });
  const pageW = 210;
  const margin = 14;
  const contentW = pageW - margin * 2;

  const inkDark = [28, 28, 24];
  const inkMid = [110, 110, 96];
  const inkLight = [232, 232, 224];
  const accentBg = [244, 244, 240];

  let y = margin;

  // ── Header ──
  doc.setFillColor(...accentBg);
  doc.rect(0, 0, pageW, 52, 'F');

  // Company name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...inkDark);
  doc.text(invoice.seller?.companyName || 'Company Name', margin, y + 10);

  // TAX INVOICE label
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...inkMid);
  doc.text('TAX INVOICE', pageW - margin, y + 6, { align: 'right' });

  // Seller address — fixed below company name
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...inkMid);
  const sellerAddr = invoice.seller?.address || '';
  const sellerAddrLines = doc.splitTextToSize(sellerAddr, 110);
  doc.text(sellerAddrLines, margin, y + 18);

  // GSTIN — always below address, never overlapping
  const gstinY = y + 18 + (sellerAddrLines.length * 4.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...inkDark);
  doc.text(`GSTIN: ${invoice.seller?.gstNumber || ''}`, margin, gstinY);

  // Contact below GSTIN
  if (invoice.seller?.contact || invoice.seller?.email) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...inkMid);
    doc.text(`${invoice.seller?.contact || ''} | ${invoice.seller?.email || ''}`, margin, gstinY + 5);
  }

  // Invoice meta — right side
  const metaX = pageW - margin;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...inkDark);
  doc.text(`Invoice No: ${invoice.invoiceNumber}`, metaX, y + 16, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...inkMid);
  doc.text(`Date: ${formatDate(invoice.invoiceDate)}`, metaX, y + 23, { align: 'right' });
  if (invoice.dueDate) doc.text(`Due Date: ${formatDate(invoice.dueDate)}`, metaX, y + 30, { align: 'right' });

  y = 57;

  // ── Bill To + Supply Details ──
  const boxH = 36;
  const halfW = contentW / 2 - 2;

  doc.setDrawColor(...inkLight);
  doc.setLineWidth(0.3);

  // Bill To box
  doc.rect(margin, y, halfW, boxH);
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
  const buyerLines = doc.splitTextToSize(invoice.buyer?.address || '', halfW - 8);
  doc.text(buyerLines, margin + 3, y + 20);
  doc.setFont('helvetica', 'bold');
  doc.text(`GSTIN: ${invoice.buyer?.gstNumber || ''}`, margin + 3, y + boxH - 4);

  // Supply Details box
  const stateX = margin + halfW + 4;
  doc.rect(stateX, y, halfW, boxH);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...inkMid);
  doc.text('SUPPLY DETAILS', stateX + 3, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...inkDark);
  doc.text(`Seller State: ${invoice.seller?.state || ''}`, stateX + 3, y + 14);
  doc.text(`Buyer State:  ${invoice.buyer?.state || ''}`, stateX + 3, y + 21);
  doc.text(`Tax Type: ${invoice.isSameState ? 'CGST + SGST' : 'IGST'}`, stateX + 3, y + 28);

  y += boxH + 6;

  // ── Items Table ──
  const isSame = invoice.isSameState;

  const tableHead = isSame
    ? [['#', 'Product / Service', 'HSN', 'Unit', 'Qty', 'Rate', 'Taxable', 'GST%', 'CGST', 'SGST', 'Amount']]
    : [['#', 'Product / Service', 'HSN', 'Unit', 'Qty', 'Rate', 'Taxable', 'GST%', 'IGST', 'Amount']];

  const tableBody = invoice.items.map((item, i) => {
    const base = (Number(item.qty) || 0) * (Number(item.rate) || 0);
    const totalGst = (base * (Number(item.gstPct) || 0)) / 100;
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
    if (isSame) {
      row.push((totalGst / 2).toFixed(2), (totalGst / 2).toFixed(2));
    } else {
      row.push(totalGst.toFixed(2));
    }
    row.push((base + totalGst).toFixed(2));
    return row;
  });

  // Column widths — total must = contentW (182mm)
  const colStyles = isSame ? {
    0:  { cellWidth: 8,  halign: 'center' },
    1:  { cellWidth: 38, halign: 'left'   },
    2:  { cellWidth: 14, halign: 'center' },
    3:  { cellWidth: 10, halign: 'center' },
    4:  { cellWidth: 8,  halign: 'center' },
    5:  { cellWidth: 18, halign: 'right'  },
    6:  { cellWidth: 20, halign: 'right'  },
    7:  { cellWidth: 10, halign: 'center' },
    8:  { cellWidth: 18, halign: 'right'  },
    9:  { cellWidth: 18, halign: 'right'  },
    10: { cellWidth: 20, halign: 'right'  },
  } : {
    0: { cellWidth: 8,  halign: 'center' },
    1: { cellWidth: 48, halign: 'left'   },
    2: { cellWidth: 16, halign: 'center' },
    3: { cellWidth: 12, halign: 'center' },
    4: { cellWidth: 10, halign: 'center' },
    5: { cellWidth: 20, halign: 'right'  },
    6: { cellWidth: 22, halign: 'right'  },
    7: { cellWidth: 10, halign: 'center' },
    8: { cellWidth: 18, halign: 'right'  },
    9: { cellWidth: 18, halign: 'right'  },
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
      cellPadding: 2.5,
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
      overflow: 'hidden',
    },
    alternateRowStyles: { fillColor: accentBg },
    columnStyles: colStyles,
    tableLineColor: inkLight,
    tableLineWidth: 0.3,
  });

  y = doc.lastAutoTable.finalY + 8;

  // ── Summary ──
  const summaryW = 82;
  const summaryX = pageW - margin - summaryW;

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

  const exactTotal = (Number(invoice.subtotal) || 0) +
    (isSame
      ? (Number(invoice.cgst) || 0) + (Number(invoice.sgst) || 0)
      : (Number(invoice.igst) || 0));
  const roundedTotal = Math.round(exactTotal);
  const roundOff = roundedTotal - exactTotal;

  drawRow('Subtotal (Taxable):', fmtPDF(invoice.subtotal));
  if (isSame) {
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
  y += 2;
  drawRow('GRAND TOTAL:', fmtPDF(roundedTotal), true, true);

  y += 6;

  // ── Amount in words ──
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(...inkDark);
  const wordsLine = doc.splitTextToSize(`Amount in words: ${numberToWords(roundedTotal)}`, contentW - summaryW - 6);
  doc.text(wordsLine, margin, y);
  y += wordsLine.length * 4.5 + 4;

  // ── Notes ──
  if (invoice.notes) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...inkDark);
    doc.text('Notes:', margin, y);
    doc.setFont('helvetica', 'normal');
    const noteLines = doc.splitTextToSize(invoice.notes, contentW - summaryW - 6);
    doc.text(noteLines, margin, y + 5);
    y += 5 + noteLines.length * 4.5;
  }

  y += 10;

  // ── Footer ──
  doc.setDrawColor(...inkLight);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageW - margin, y);
  y += 5;

  doc.setFillColor(...accentBg);
  doc.rect(pageW - margin - 65, y, 65, 22, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...inkMid);
  doc.text('For ' + (invoice.seller?.companyName || ''), pageW - margin - 32, y + 7, { align: 'center' });
  doc.line(pageW - margin - 58, y + 17, pageW - margin - 5, y + 17);
  doc.text('Authorized Signatory', pageW - margin - 32, y + 21, { align: 'center' });

  doc.save(`Invoice-${invoice.invoiceNumber}.pdf`);
};
