import ExcelJS from 'exceljs';

/**
 * sheets: [{ name: 'Sheet1', columns: [{header, key, width, format}], rows: [{...}] }]
 * format options per column: 'currency' | 'percent' | 'number' | undefined(text)
 */
export async function exportStyledExcel(sheets, filename) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'GST Studio';
  wb.created = new Date();

  sheets.forEach(({ name, columns, rows }) => {
    const ws = wb.addWorksheet(name.slice(0, 31)); // Excel sheet name limit
    ws.columns = columns.map(c => ({
      header: c.header,
      key: c.key,
      width: c.width || 16,
    }));

    // Header row styling
    const headerRow = ws.getRow(1);
    headerRow.height = 22;
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1C1C18' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } },
      };
    });

    // Data rows
    rows.forEach((r) => ws.addRow(r));

    // Style data rows: borders, zebra stripes, number formats
    columns.forEach((col, colIdx) => {
      const excelCol = ws.getColumn(colIdx + 1);
      if (col.format === 'currency') excelCol.numFmt = '₹#,##0.00';
      else if (col.format === 'percent') excelCol.numFmt = '0"%"';
      else if (col.format === 'number') excelCol.numFmt = '#,##0';
    });

    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // header already styled
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          right: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        };
        cell.alignment = { vertical: 'middle' };
      });
      if (rowNumber % 2 === 0) {
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F7F4' } };
        });
      }
    });

    // Freeze header row
    ws.views = [{ state: 'frozen', ySplit: 1 }];

    // Total row bold (if last row's first cell text is 'TOTAL')
    const lastRow = ws.lastRow;
    if (lastRow && String(lastRow.getCell(1).value).toUpperCase() === 'TOTAL') {
      lastRow.eachCell((cell) => {
        cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDEDE5' } };
      });
    }
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}