import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { formatDate, numberToWords } from './invoiceUtils';

const fmt = (n) => (Number(n) || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const fmtPDF = (n) => 'Rs.' + fmt(n);

const FIXED_BANK = 'Bank of Baroda\nA/C No.: 83760200001223\nIFSC Code: BARB0VJSIME\nBranch: Siwaya Pallavpuram Phase 2nd, UttarPradesh - 250110';

export const generatePDF = (invoice) => {
  const doc = new jsPDF({ format: 'a4', unit: 'mm', orientation: 'portrait' });
  const pageW = 210;
  const margin = 12;
  const contentW = pageW - margin * 2;

  const inkDark = [28, 28, 24];
  const inkLight = [232, 232, 224];
  const accentBg = [244, 244, 240];
  const blue = [37, 99, 235];
  const amber = [217, 119, 6];

  let y = margin;

  // ── HEADER ──
  const headerH = 42;
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageW, headerH, 'F');
  doc.setDrawColor(...inkLight);
  doc.setLineWidth(0.4);
  doc.line(0, headerH, pageW, headerH);

  // TAX INVOICE label
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(...inkDark);
  doc.text('TAX INVOICE', pageW / 2, y + 6, { align: 'center' });

  // Company name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...inkDark);
  doc.text(invoice.seller?.companyName || 'Company Name', pageW / 2, y + 15, { align: 'center' });

  // Address
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...inkDark);
  doc.text(invoice.seller?.address || '', pageW / 2, y + 23, { align: 'center' });

  // Contact line
  const contactLine = 'Tel. : ' + (invoice.seller?.contact || '') + '   |   email : abhiyantsalescorporation@gmail.com';
  doc.setFontSize(7);
  doc.text(contactLine, pageW / 2, y + 31, { align: 'center' });

  y = headerH + 3;

  // ── GSTIN + INVOICE DETAILS (left) | TRANSPORT (right) ──
  const boxH = 38;
  const halfW = contentW / 2;

  doc.setDrawColor(...inkLight);
  doc.setLineWidth(0.3);
  doc.rect(margin, y, contentW, boxH);
  doc.line(margin + halfW, y, margin + halfW, y + boxH);

  // Left column — Invoice details
  const leftRows = [
    ['GSTIN', invoice.seller?.gstNumber || ''],
    ['Invoice No.', invoice.invoiceNumber || ''],
    ['Date of Invoice', formatDate(invoice.invoiceDate)],
    ['Place of Supply', invoice.seller?.state || ''],
    ['Reverse Charge', invoice.reverseCharge || 'No'],
    ['GR/RR No.', invoice.grRrNo || '-'],
  ];

  leftRows.forEach((row, i) => {
    const ry = y + 6 + i * 5.4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...inkDark);
    doc.text(row[0], margin + 3, ry);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...inkDark);
    doc.text(': ' + row[1], margin + halfW * 0.52, ry);
  });

  // Right column — Transport details
  const rightRows = [
    ['Transport', invoice.transport || '-'],
    ['Vehicle No', invoice.vehicleNo || '-'],
    ['Station', invoice.station || '-'],
    ['NUG', invoice.nug || '-'],
    ['P O No.', invoice.poNo || '-'],
  ];

  rightRows.forEach((row, i) => {
    const ry = y + 6 + i * 5.4;
    const rx = margin + halfW + 3;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...inkDark);
    doc.text(row[0], rx, ry);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...inkDark);
    doc.text(': ' + row[1], rx + 24, ry);
  });

  y += boxH + 4;

  // ── BILL TO + SHIP TO ──
  const partyBoxH = 34;
  const partyHalfW = (contentW - 4) / 2;

  // Bill To
  doc.setDrawColor(...inkLight);
  doc.setLineWidth(0.25);
  doc.rect(margin, y, partyHalfW, partyBoxH);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...inkDark);
  doc.text('BILLED TO', margin + 3, y + 5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...inkDark);
  const buyerNameLines = doc.splitTextToSize(invoice.buyer?.clientName || '', partyHalfW - 6);
  doc.text(buyerNameLines, margin + 3, y + 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  const buyerAddrY = y + 11 + buyerNameLines.length * 4;
  const buyerAddrLines = doc.splitTextToSize(invoice.buyer?.address || '', partyHalfW - 6);
  doc.text(buyerAddrLines, margin + 3, buyerAddrY);

  if (invoice.buyer?.gstNumber) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    const gstY = Math.min(buyerAddrY + buyerAddrLines.length * 3.5, y + partyBoxH - 4);
    doc.text('GSTIN / UIN : ' + invoice.buyer.gstNumber, margin + 3, gstY);
  }

  // Ship To
  const shipToData = invoice.shipTo?.clientName ? invoice.shipTo : invoice.buyer;
  const supX = margin + partyHalfW + 4;

  doc.rect(supX, y, partyHalfW, partyBoxH);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...inkDark);
  doc.text('SHIPPED TO', supX + 3, y + 5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  const shipNameLines = doc.splitTextToSize(shipToData?.clientName || '', partyHalfW - 6);
  doc.text(shipNameLines, supX + 3, y + 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  const shipAddrY = y + 11 + shipNameLines.length * 4;
  const shipAddrLines = doc.splitTextToSize(shipToData?.address || '', partyHalfW - 6);
  doc.text(shipAddrLines, supX + 3, shipAddrY);

  if (shipToData?.gstNumber) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    const gstY = Math.min(shipAddrY + shipAddrLines.length * 3.5, y + partyBoxH - 4);
    doc.text('GSTIN / UIN : ' + shipToData.gstNumber, supX + 3, gstY);
  }

  y += partyBoxH + 6;

  // ── ITEMS TABLE ──
  const isSame = invoice.isSameState;

  const tableHead = isSame
    ? [['S.No.', 'Product / Service', 'HSN', 'Unit', 'Qty', 'Rate', 'Taxable', 'GST%', 'CGST', 'SGST', 'Amount']]
    : [['S.No.', 'Product / Service', 'HSN', 'Unit', 'Qty', 'Rate', 'Taxable', 'GST%', 'IGST', 'Amount']];

  const tableBody = (invoice.items || []).map((item, i) => {
    const base = (Number(item.qty) || 0) * (Number(item.rate) || 0);
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
    0: { cellWidth: 7, halign: 'center' },
    1: { cellWidth: 42, halign: 'left' },
    2: { cellWidth: 14, halign: 'center' },
    3: { cellWidth: 11, halign: 'center' },
    4: { cellWidth: 9, halign: 'right' },
    5: { cellWidth: 18, halign: 'right' },
    6: { cellWidth: 21, halign: 'right' },
    7: { cellWidth: 10, halign: 'center' },
    8: { cellWidth: 18, halign: 'right' },
    9: { cellWidth: 18, halign: 'right' },
    10: { cellWidth: 18, halign: 'right' },
  } : {
    0: { cellWidth: 7, halign: 'center' },
    1: { cellWidth: 52, halign: 'left' },
    2: { cellWidth: 16, halign: 'center' },
    3: { cellWidth: 12, halign: 'center' },
    4: { cellWidth: 10, halign: 'right' },
    5: { cellWidth: 22, halign: 'right' },
    6: { cellWidth: 24, halign: 'right' },
    7: { cellWidth: 10, halign: 'center' },
    8: { cellWidth: 13, halign: 'right' },
    9: { cellWidth: 20, halign: 'right' },
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
        const taxCol1 = 8;
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

  const exactTotal = (Number(invoice.subtotal) || 0)
    + (isSame
      ? (Number(invoice.cgst) || 0) + (Number(invoice.sgst) || 0)
      : (Number(invoice.igst) || 0));
  const roundedTotal = Math.round(exactTotal);
  const roundOff = roundedTotal - exactTotal;

  const summaryRows = [
    { label: 'Subtotal (Taxable)', value: fmtPDF(invoice.subtotal) },
    ...(isSame
      ? [
        { label: 'CGST', value: fmtPDF(invoice.cgst), color: blue },
        { label: 'SGST', value: fmtPDF(invoice.sgst), color: blue },
      ]
      : [{ label: 'IGST', value: fmtPDF(invoice.igst), color: amber }]
    ),
  ];

  if (Math.abs(roundOff) >= 0.001) {
    summaryRows.push({ label: 'Round Off', value: (roundOff >= 0 ? '+' : '') + roundOff.toFixed(2) });
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
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...(row.color || inkDark));
    doc.text(row.label, sumX + 3, ry + 5);
    doc.setFont('helvetica', 'bold');
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

  y = gtY + 14;

  // ── AMOUNT IN WORDS ──
  doc.setFillColor(...accentBg);
  doc.rect(margin, y, contentW, 11, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...inkDark);
  const wordsText = 'Amount in words: ' + numberToWords(roundedTotal);
  const wordsLines = doc.splitTextToSize(wordsText, contentW - 6);
  doc.text(wordsLines, margin + 3, y + 7);
  y += Math.max(11, wordsLines.length * 4.5) + 4;

  // ── NOTES ──
  if (invoice.notes) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...inkDark);
    doc.text('Notes:', margin, y + 4);
    doc.setFont('helvetica', 'normal');
    const noteLines = doc.splitTextToSize(invoice.notes, contentW - 6);
    doc.text(noteLines, margin, y + 9);
    y += 9 + noteLines.length * 4 + 4;
  }

  // ── BANK DETAILS + TERMS + SIGNATURE ──
  const bankText = invoice.bankDetails || FIXED_BANK;
  const bankLines = doc.splitTextToSize(bankText, (contentW / 2) - 8);
  const termsLines = invoice.termsConditions
    ? doc.splitTextToSize(invoice.termsConditions, (contentW / 2) - 8)
    : [];

  // Calculate footer height dynamically
  const leftContentH = 6 + bankLines.length * 4
    + (termsLines.length > 0 ? 8 + termsLines.length * 4 : 0);
  const footerH = Math.max(leftContentH + 8, 40);

  const halfFW = contentW / 2;

  doc.setDrawColor(...inkLight);
  doc.setLineWidth(0.25);
  doc.rect(margin, y, contentW, footerH);
  doc.line(margin + halfFW, y, margin + halfFW, y + footerH);

  // Left — Bank Details
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...inkDark);
  doc.text('Bank Details', margin + 3, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...inkDark);
  doc.text(bankLines, margin + 3, y + 11);

  if (termsLines.length > 0) {
    const termsStartY = y + 11 + bankLines.length * 4 + 3;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text('Terms & Conditions', margin + 3, termsStartY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.text(termsLines, margin + 3, termsStartY + 5);
  }

  // Right — Signature
  const sigX = margin + halfFW;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...inkDark);
  doc.text('Receiver Signature:', sigX + 3, y + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('For ' + (invoice.seller?.companyName || ''), sigX + halfFW / 2, y + footerH - 12, { align: 'center' });
  doc.setLineWidth(0.3);
  doc.setDrawColor(...inkDark);
  doc.line(sigX + 8, y + footerH - 6, sigX + halfFW - 8, y + footerH - 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...inkDark);
  doc.text('Authorized Signatory', sigX + halfFW / 2, y + footerH - 2, { align: 'center' });

  doc.save('Invoice-' + invoice.invoiceNumber + '.pdf');
};