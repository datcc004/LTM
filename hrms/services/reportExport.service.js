'use strict';

/** Xuất báo cáo ra Excel/PDF. Font PDF được dò theo thứ tự để render đúng tiếng Việt. */

const fs = require('node:fs');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const env = require('../config/env');
const { formatDateTime } = require('../utils/helpers');

/** env → Windows Arial → DejaVu/Liberation/Noto (Linux) → null (Helvetica fallback). */
function resolvePdfFont() {
  const candidates = [];
  if (env.paths.pdfFont) candidates.push(env.paths.pdfFont);

  if (process.platform === 'win32') {
    const winDir = process.env.WINDIR || 'C:\\Windows';
    candidates.push(`${winDir}\\Fonts\\arial.ttf`);
  } else {
    candidates.push(
      '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
      '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
      '/usr/share/fonts/opentype/noto/NotoSans-Regular.ttf'
    );
  }

  for (const candidate of candidates) {
    try {
      if (candidate && fs.existsSync(candidate) && fs.statSync(candidate).size > 0) {
        return candidate;
      }
    } catch {
      // Bỏ qua đường dẫn không đọc được, thử cái tiếp theo.
    }
  }
  return null;
}

/** Trả về định nghĩa cột ExcelJS hợp lệ. Không đặt `header`: dòng tiêu đề được thêm thủ công. */
function styleColumn(header) {
  const text = String(header || '');
  const alignment = { vertical: 'middle', horizontal: 'left' };
  const style = { alignment };
  let width = 16;

  if (/lương|thực lãnh|bhxh|thuế|phụ cấp|thưởng|làm thêm|khấu trừ/i.test(text)) {
    style.numFmt = '#,##0';
    alignment.horizontal = 'right';
    width = 18;
  } else if (/ngày|từ|đến/i.test(text)) {
    width = 14;
  } else if (/nhân viên|tên|lý do|kỳ lương/i.test(text)) {
    width = 24;
  }

  return { width, style };
}

/** Trả về Buffer xlsx từ { sheetName, header, rows }. */
async function buildExcel(table, title) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'KIDS PARK HRMS';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(table.sheetName, {
    views: [{ state: 'frozen', ySplit: 3 }],
  });
  sheet.columns = table.header.map(styleColumn);

  const titleRow = sheet.addRow([title]);
  titleRow.font = { bold: true, size: 14, color: { argb: 'FF1E40AF' } };
  sheet.mergeCells(1, 1, 1, Math.max(1, table.header.length));

  const stampRow = sheet.addRow([`Xuất lúc: ${formatDateTime(new Date())}`]);
  stampRow.font = { italic: true, size: 9, color: { argb: 'FF6B7280' } };
  sheet.mergeCells(2, 1, 2, Math.max(1, table.header.length));

  const headerRow = sheet.addRow(table.header);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  headerRow.height = 24;

  for (const row of table.rows) sheet.addRow(row);

  const lastRow = sheet.rowCount;
  if (lastRow >= 4) {
    sheet.autoFilter = { from: { row: 3, column: 1 }, to: { row: lastRow, column: table.header.length } };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function drawTable(doc, header, rows, regularFont, boldFont) {
  const margin = doc.page.margins.left;
  const usable = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const colWidth = Math.max(30, usable / header.length);
  const fontSize = header.length > 9 ? 7 : header.length > 6 ? 8 : 9;
  const rowHeight = fontSize + 8;
  let y = doc.y;

  function ensureSpace() {
    if (y + rowHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      y = doc.page.margins.top;
    }
  }

  function drawRow(cells, isHeader, background) {
    ensureSpace();
    doc.rect(margin, y, colWidth * header.length, rowHeight).fill(background);
    doc.font(isHeader ? boldFont : regularFont).fontSize(fontSize);
    cells.forEach((cell, index) => {
      const value = cell === null || cell === undefined ? '' : String(cell);
      doc.fillColor(isHeader ? '#FFFFFF' : '#111827')
        .text(value, margin + index * colWidth + 3, y + 3, {
          width: colWidth - 6,
          height: rowHeight - 4,
          ellipsis: true,
          lineBreak: false,
        });
    });
    y += rowHeight;
    doc.y = y;
  }

  drawRow(header, true, '#1E40AF');
  rows.forEach((row, index) => {
    drawRow(row, false, index % 2 === 1 ? '#F3F4F6' : '#FFFFFF');
  });
}

/** Trả về Buffer PDF. Dùng font TTF khi có để giữ dấu tiếng Việt. */
function buildPdf(table, title) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      layout: table.header.length > 7 ? 'landscape' : 'portrait',
      margin: 36,
      info: { Title: title, Author: 'KIDS PARK HRMS' },
    });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const fontPath = resolvePdfFont();
    const regularFont = fontPath ? 'Vietnamese' : 'Helvetica';
    const boldFont = fontPath ? 'Vietnamese' : 'Helvetica-Bold';
    if (fontPath) doc.registerFont('Vietnamese', fontPath);

    doc.font(boldFont).fontSize(16).text(title, { align: 'center' });
    doc.moveDown(0.4);
    doc.font(regularFont).fontSize(9)
      .fillColor('#6B7280')
      .text(`Xuất lúc: ${formatDateTime(new Date())}`, { align: 'center' });
    doc.moveDown(1);
    doc.fillColor('#111827');

    drawTable(doc, table.header, table.rows, regularFont, boldFont);
    doc.end();
  });
}

module.exports = { resolvePdfFont, buildExcel, buildPdf };
