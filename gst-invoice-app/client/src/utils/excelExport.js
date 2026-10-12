import ExcelJS from 'exceljs';

/**
 * sheets: [{ name: 'Sheet1', columns: [{header, key, width, format}], rows: [{...}] }]
 * format options per column: 'currency' | 'percent' | 'number' | 'text' | undefined(text)
 * Style: party ke sample report jaisa (halka grey header, plain data, no borders)
 */
const NUM_FORMATS = {
  currency: '0.00',
  percent: '0.0"%"',
  number: '0',
  text: '@',
};

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

    // Header row — light grey, bold, small monospace (sample jaisa)
    const headerRow = ws.getRow(1);
    headerRow.height = 35;
    headerRow.eachCell((cell, colNumber) => {
      cell.font = { name: 'Courier New', size: 8, bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } };
      cell.alignment = {
        vertical: 'middle',
        horizontal: colNumber === 1 ? 'center' : 'left',
        wrapText: true,
      };
      cell.numFmt = '@';
    });

    // Data rows
    rows.forEach((r) => ws.addRow(r));

    // Plain data style: Tahoma 10, no borders, no stripes, number formats per column
    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const col = columns[colNumber - 1];
        cell.font = { name: 'Tahoma', size: 10 };
        cell.alignment = { vertical: 'middle' };
        const fmt = col && NUM_FORMATS[col.format];
        if (fmt) cell.numFmt = fmt;
        else if (typeof cell.value === 'string') cell.numFmt = '@';
      });
    });

    // Freeze header row
    ws.views = [{ state: 'frozen', ySplit: 1 }];

    // TOTAL row bold (agar last row ka pehla cell 'TOTAL' hai)
    const lastRow = ws.lastRow;
    if (lastRow && lastRow.number > 1 && String(lastRow.getCell(1).value).toUpperCase() === 'TOTAL') {
      lastRow.eachCell({ includeEmpty: true }, (cell) => {
        cell.font = { name: 'Tahoma', size: 10, bold: true };
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