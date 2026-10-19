/**
 * XUẤT BÁO GIÁ (PDF / EXCEL) — CÔNG THẢNH
 * ----------------------------------------------------------------
 * Hai bộ dựng file độc lập với giao diện: nhận vào QuoteExportData đã tính sẵn từ calculator.
 *  - buildQuotePdf: PDF vector (chữ chọn/copy được), font Be Vietnam Pro nhúng để hiển thị đủ dấu tiếng Việt.
 *  - buildQuoteXlsx: Excel có định dạng sẵn, các dòng thành tiền/tổng dùng công thức để sửa số lượng là tự nhảy.
 * `showPrices = false` (khách xem) thì ẩn đơn giá từng hạng mục, chỉ hiện cấu hình thiết bị + tổng thanh toán —
 * giống quy tắc đang áp dụng cho bảng kê vật tư ở trang tính toán.
 */

import type { QuoteItem } from "./quote-financials";

export interface QuoteExportData {
  quoteCode: string;
  /** dd/mm/yyyy */
  dateStr: string;
  customerName: string;
  customerPhone: string;
  siteAddress: string;
  systemLabel: string;

  panel: { brand: string; wattage: number; qty: number; warranty: string };
  inverter: { brand: string; kindLabel: string; phaseLabel: string; capacityKw: number; qty: number; warranty: string };
  battery: { brand: string; moduleKwh: number; qty: number; warranty: string } | null;

  totalKwp: number;
  savingsPerMonthVnd: number;
  savingsPerYearVnd: number;
  /** null khi không hoàn vốn được */
  paybackYears: number | null;
  offsetPercent: number | null;

  items: QuoteItem[];
  subtotalVnd: number;
  discountPercent: number;
  totalPaymentVnd: number;
  showPrices: boolean;

  company: { fullName: string; hotline: string; website: string; address: string };
}

export interface QuoteFonts {
  /** base64 của file TTF */
  regular: string;
  semibold: string;
  bold: string;
}

// ---------- định dạng số ----------

function groupThousands(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
export function fmtVnd(n: number): string {
  return `${groupThousands(n)} đ`;
}
function fmtNum(n: number, digits = 1): string {
  const r = Math.round(n * 10 ** digits) / 10 ** digits;
  return r.toString().replace(".", ",");
}
function dash(s: string | undefined | null): string {
  return s && s.trim() ? s.trim() : "—";
}

type RGB = [number, number, number];
const C = {
  navy: [11, 34, 57] as RGB,
  gold: [168, 126, 40] as RGB, // vàng đồng, đủ tương phản trên nền trắng
  goldLight: [244, 182, 63] as RGB, // vàng sáng, dùng trên nền navy
  ink: [31, 41, 55] as RGB,
  mute: [107, 114, 128] as RGB,
  line: [226, 229, 234] as RGB,
  cream: [250, 247, 240] as RGB,
  green: [39, 163, 106] as RGB,
  white: [255, 255, 255] as RGB,
};

const NOTES = [
  "Bảo hành thiết bị theo chính sách của nhà sản xuất.",
  "Báo giá dự toán, đã bao gồm thiết bị, khung/giá đỡ, dây dẫn, nhân công và vận chuyển.",
  "Số mét cáp DC/AC là dự toán ban đầu, sẽ được khảo sát thực tế và báo lại chính xác sau.",
  "Mức tiết kiệm là ước tính theo giờ nắng đỉnh 4h/ngày và biểu giá điện hiện hành; thực tế có thể thay đổi theo điều kiện sử dụng.",
];

// =====================================================================
// PDF
// =====================================================================

export async function buildQuotePdf(data: QuoteExportData, fonts: QuoteFonts) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });

  doc.addFileToVFS("BVP-Regular.ttf", fonts.regular);
  doc.addFileToVFS("BVP-SemiBold.ttf", fonts.semibold);
  doc.addFileToVFS("BVP-Bold.ttf", fonts.bold);
  doc.addFont("BVP-Regular.ttf", "BVP", "normal");
  doc.addFont("BVP-Bold.ttf", "BVP", "bold");
  doc.addFont("BVP-SemiBold.ttf", "BVPSemi", "normal");

  const PW = 210;
  const PH = 297;
  const M = 16;
  const CW = PW - M * 2;
  const FOOTER_H = 19;
  const BOTTOM = PH - FOOTER_H;

  const fill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
  const stroke = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);
  const color = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
  const font = (kind: "regular" | "semi" | "bold", size: number) => {
    if (kind === "regular") doc.setFont("BVP", "normal");
    else if (kind === "semi") doc.setFont("BVPSemi", "normal");
    else doc.setFont("BVP", "bold");
    doc.setFontSize(size);
  };

  let y = 0;

  // ----- Header (trang đầu) -----
  fill(C.navy);
  doc.rect(0, 0, PW, 34, "F");
  fill(C.goldLight);
  doc.rect(0, 34, PW, 1.2, "F");

  font("bold", 21);
  color(C.goldLight);
  doc.text("CÔNG THẢNH", M, 17, { charSpace: 1.6 });
  font("regular", 8);
  color([196, 206, 220]);
  doc.text("Giải pháp điện mặt trời và lưu trữ năng lượng", M, 24);

  font("semi", 9);
  color(C.goldLight);
  doc.text("BÁO GIÁ", PW - M, 12.5, { align: "right", charSpace: 3 });
  font("bold", 12);
  color(C.white);
  doc.text(`#${data.quoteCode}`, PW - M, 19.5, { align: "right" });
  font("regular", 8.5);
  color([196, 206, 220]);
  doc.text(`Ngày ${data.dateStr}`, PW - M, 26, { align: "right" });

  y = 46;

  // ----- Tiêu đề -----
  font("bold", 15);
  color(C.navy);
  doc.text("BÁO GIÁ HỆ THỐNG ĐIỆN MẶT TRỜI", M, y);
  fill(C.gold);
  doc.rect(M, y + 3, 22, 0.8, "F");
  font("regular", 9);
  color(C.mute);
  doc.text(`${data.systemLabel} · Công suất ${fmtNum(data.totalKwp)} kWp`, M, y + 10);
  y += 15;

  // ----- Thông tin khách hàng -----
  fill(C.cream);
  stroke(C.line);
  doc.setLineWidth(0.2);
  doc.roundedRect(M, y, CW, 26, 2, 2, "FD");
  const colW = CW / 2;
  const custRows: [string, string][] = [
    ["KHÁCH HÀNG", data.customerName],
    ["ĐIỆN THOẠI", data.customerPhone],
    ["ĐỊA CHỈ CÔNG TRÌNH", data.siteAddress],
    ["LOẠI HỆ THỐNG", data.systemLabel],
  ];
  custRows.forEach(([label, value], i) => {
    const cx = M + 6 + (i % 2) * colW;
    const cy = y + 8 + Math.floor(i / 2) * 11;
    font("regular", 6.8);
    color(C.gold);
    doc.text(label, cx, cy, { charSpace: 0.6 });
    font("semi", 9.5);
    color(C.ink);
    const v = doc.splitTextToSize(dash(value), colW - 10)[0] as string;
    doc.text(v, cx, cy + 4.8);
  });
  y += 26 + 6;

  // ----- KPI -----
  const gap = 4;
  const tileW = (CW - gap * 3) / 4;
  const kpis: { label: string; value: string; unit: string; c: RGB }[] = [
    { label: "CÔNG SUẤT HỆ THỐNG", value: fmtNum(data.totalKwp), unit: "kWp", c: C.navy },
    { label: "SỐ TẤM PIN", value: groupThousands(data.panel.qty), unit: "tấm", c: C.navy },
    { label: "TIẾT KIỆM / THÁNG", value: groupThousands(data.savingsPerMonthVnd), unit: "đ", c: C.green },
    { label: "TỔNG THANH TOÁN", value: groupThousands(data.totalPaymentVnd), unit: "đ", c: C.navy },
  ];
  kpis.forEach((k, i) => {
    const x = M + i * (tileW + gap);
    fill(C.white);
    stroke(C.line);
    doc.roundedRect(x, y, tileW, 24, 2, 2, "FD");
    fill(C.goldLight);
    doc.rect(x + 3, y, tileW - 6, 0.9, "F");
    font("regular", 6.3);
    color(C.mute);
    doc.text(k.label, x + tileW / 2, y + 8, { align: "center", charSpace: 0.4 });
    // co chữ cho vừa ô khi số tiền lớn
    let size = 13;
    font("bold", size);
    const txt = k.value;
    while (doc.getTextWidth(`${txt} ${k.unit}`) > tileW - 6 && size > 8) {
      size -= 0.5;
      font("bold", size);
    }
    color(k.c);
    doc.text(`${txt} ${k.unit}`, x + tileW / 2, y + 17, { align: "center" });
  });
  y += 24 + 8;

  // ----- helpers bố cục -----
  const ensureSpace = (h: number) => {
    if (y + h <= BOTTOM) return;
    doc.addPage();
    fill(C.navy);
    doc.rect(0, 0, PW, 10, "F");
    font("semi", 7.5);
    color(C.goldLight);
    doc.text("CÔNG THẢNH", M, 6.4, { charSpace: 1 });
    color([196, 206, 220]);
    doc.text(`Báo giá #${data.quoteCode}`, PW - M, 6.4, { align: "right" });
    y = 20;
  };

  const sectionTitle = (text: string) => {
    ensureSpace(14);
    fill(C.gold);
    doc.rect(M, y - 3.2, 1.6, 4.6, "F");
    font("bold", 9.5);
    color(C.navy);
    doc.text(text, M + 4.5, y + 0.4, { charSpace: 0.7 });
    stroke(C.line);
    doc.setLineWidth(0.2);
    doc.line(M, y + 3.2, M + CW, y + 3.2);
    y += 8;
  };

  type Col = { header: string; w: number; align?: "left" | "right" | "center" };
  const drawTable = (cols: Col[], rows: string[][], opts: { boldFirstCol?: boolean } = {}) => {
    const PADX = 2.6;
    const LH = 4.1;
    // header
    ensureSpace(9 + 12);
    fill(C.navy);
    doc.rect(M, y, CW, 8, "F");
    font("semi", 7.6);
    color(C.white);
    let x = M;
    cols.forEach((c) => {
      const tx = c.align === "right" ? x + c.w - PADX : c.align === "center" ? x + c.w / 2 : x + PADX;
      doc.text(c.header, tx, y + 5.2, { align: c.align ?? "left" });
      x += c.w;
    });
    y += 8;

    rows.forEach((row, ri) => {
      font("regular", 8.4);
      const wrapped = row.map((cell, ci) => doc.splitTextToSize(cell, cols[ci].w - PADX * 2) as string[]);
      const lines = Math.max(...wrapped.map((w) => w.length));
      const rh = lines * LH + 4.4;
      ensureSpace(rh);
      if (ri % 2 === 1) {
        fill(C.cream);
        doc.rect(M, y, CW, rh, "F");
      }
      let cx = M;
      wrapped.forEach((w, ci) => {
        const c = cols[ci];
        if (ci === 0 && opts.boldFirstCol) font("semi", 8.4);
        else font("regular", 8.4);
        color(C.ink);
        const tx = c.align === "right" ? cx + c.w - PADX : c.align === "center" ? cx + c.w / 2 : cx + PADX;
        doc.text(w, tx, y + 5.4, { align: c.align ?? "left", lineHeightFactor: 1.15 });
        cx += c.w;
      });
      stroke(C.line);
      doc.setLineWidth(0.15);
      doc.line(M, y + rh, M + CW, y + rh);
      y += rh;
    });
  };

  // ----- Cấu hình thiết bị -----
  sectionTitle("CẤU HÌNH THIẾT BỊ");
  const equipRows: string[][] = [
    [
      "Tấm pin",
      data.panel.brand,
      `${data.panel.wattage} Wp / tấm`,
      `${groupThousands(data.panel.qty)} tấm`,
      `${fmtNum((data.panel.qty * data.panel.wattage) / 1000)} kWp`,
      dash(data.panel.warranty),
    ],
    [
      "Biến tần (Inverter)",
      data.inverter.brand,
      `${fmtNum(data.inverter.capacityKw)} kW · ${data.inverter.phaseLabel} · ${data.inverter.kindLabel}`,
      `${data.inverter.qty} bộ`,
      `${fmtNum(data.inverter.qty * data.inverter.capacityKw)} kW`,
      dash(data.inverter.warranty),
    ],
  ];
  if (data.battery) {
    equipRows.push([
      "Pin lưu trữ",
      data.battery.brand,
      `${fmtNum(data.battery.moduleKwh, 2)} kWh / module`,
      `${data.battery.qty} module`,
      `${fmtNum(data.battery.qty * data.battery.moduleKwh)} kWh`,
      dash(data.battery.warranty),
    ]);
  }
  drawTable(
    [
      { header: "HẠNG MỤC", w: 30 },
      { header: "THƯƠNG HIỆU", w: 26 },
      { header: "CẤU HÌNH", w: 42 },
      { header: "SỐ LƯỢNG", w: 22, align: "right" },
      { header: "CÔNG SUẤT", w: 26, align: "right" },
      { header: "BẢO HÀNH", w: 32 },
    ],
    equipRows,
    { boldFirstCol: true },
  );
  y += 6;

  // ----- Bảng kê chi tiết (chỉ bản nội bộ) -----
  if (data.showPrices) {
    sectionTitle("BẢNG KÊ VẬT TƯ & BÁO GIÁ");
    drawTable(
      [
        { header: "HẠNG MỤC", w: 54 },
        { header: "HÃNG / GHI CHÚ", w: 38 },
        { header: "SỐ LƯỢNG", w: 20, align: "right" },
        { header: "ĐƠN GIÁ", w: 33, align: "right" },
        { header: "THÀNH TIỀN", w: 33, align: "right" },
      ],
      data.items.map((it) => [
        it.label,
        it.brandModel && it.brandModel !== "-" ? it.brandModel : "—",
        `${fmtNum(it.qty)} ${it.unit}`,
        fmtVnd(it.unitPriceVnd),
        fmtVnd(it.qty * it.unitPriceVnd),
      ]),
    );
    // tổng phụ + chiết khấu
    const sumLine = (label: string, value: string, bold = false) => {
      ensureSpace(8);
      font(bold ? "semi" : "regular", 8.6);
      color(C.ink);
      doc.text(label, M + CW - 33 - 4, y + 5.4, { align: "right" });
      doc.text(value, M + CW - 2.6, y + 5.4, { align: "right" });
      y += 7;
    };
    y += 1;
    sumLine("Tổng trước chiết khấu", fmtVnd(data.subtotalVnd));
    if (data.discountPercent > 0) {
      sumLine(`Chiết khấu thương mại (${fmtNum(data.discountPercent)}%)`, `-${fmtVnd(data.subtotalVnd - data.totalPaymentVnd)}`);
    }
    y += 6;
  }

  // ----- Tổng thanh toán -----
  ensureSpace(22);
  fill(C.navy);
  doc.roundedRect(M, y, CW, 17, 2.2, 2.2, "F");
  fill(C.goldLight);
  doc.rect(M, y + 3, 1.2, 11, "F");
  font("semi", 9);
  color([196, 206, 220]);
  doc.text("TỔNG THANH TOÁN (DỰ TOÁN)", M + 8, y + 10.2, { charSpace: 0.8 });
  font("bold", 16);
  color(C.goldLight);
  doc.text(fmtVnd(data.totalPaymentVnd), M + CW - 7, y + 11, { align: "right" });
  y += 17 + 8;

  // ----- Hiệu quả kinh tế -----
  sectionTitle("HIỆU QUẢ KINH TẾ (ƯỚC TÍNH)");
  ensureSpace(24);
  const ecoW = (CW - gap * 2) / 3;
  const eco: { label: string; value: string; c: RGB }[] = [
    { label: "TIẾT KIỆM ĐIỆN / THÁNG", value: fmtVnd(data.savingsPerMonthVnd), c: C.green },
    { label: "TIẾT KIỆM ĐIỆN / NĂM", value: fmtVnd(data.savingsPerYearVnd), c: C.green },
    { label: "THỜI GIAN HOÀN VỐN", value: data.paybackYears === null ? "—" : `${fmtNum(data.paybackYears)} năm`, c: C.navy },
  ];
  eco.forEach((e, i) => {
    const x = M + i * (ecoW + gap);
    fill(C.cream);
    stroke(C.line);
    doc.roundedRect(x, y, ecoW, 17, 2, 2, "FD");
    font("regular", 6.5);
    color(C.gold);
    doc.text(e.label, x + 5, y + 6.2, { charSpace: 0.5 });
    font("bold", 12.5);
    color(e.c);
    doc.text(e.value, x + 5, y + 13.3);
  });
  y += 17;
  if (data.offsetPercent !== null) {
    font("regular", 7.6);
    color(C.mute);
    doc.text(`Mức bù hoá đơn điện ước tính ≈ ${fmtNum(data.offsetPercent)}% theo công suất tấm pin thực tế.`, M, y + 6);
    y += 7;
  }
  y += 5;

  // ----- Ghi chú -----
  ensureSpace(8 + NOTES.length * 6);
  sectionTitle("GHI CHÚ");
  font("regular", 8);
  color(C.mute);
  NOTES.forEach((n) => {
    const lines = doc.splitTextToSize(n, CW - 6) as string[];
    ensureSpace(lines.length * 4 + 2);
    fill(C.gold);
    doc.circle(M + 1.2, y - 0.9, 0.55, "F");
    color(C.mute);
    doc.text(lines, M + 5, y, { lineHeightFactor: 1.2 });
    y += lines.length * 4 + 1.6;
  });

  // ----- Footer mọi trang -----
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    stroke(C.goldLight);
    doc.setLineWidth(0.5);
    doc.line(M, PH - 17, M + CW, PH - 17);
    font("semi", 7.6);
    color(C.navy);
    doc.text(data.company.fullName, M, PH - 12);
    font("regular", 7.3);
    color(C.mute);
    doc.text(`Hotline: ${data.company.hotline}  ·  ${data.company.website}`, M, PH - 7.8);
    doc.text(data.company.address, M, PH - 4);
    doc.text(`Trang ${p}/${pages}`, PW - M, PH - 4, { align: "right" });
  }

  return doc;
}

// =====================================================================
// EXCEL
// =====================================================================

export async function buildQuoteXlsx(data: QuoteExportData): Promise<ArrayBuffer> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Công Thảnh";
  wb.created = new Date();

  const ws = wb.addWorksheet("Báo giá", {
    views: [{ showGridLines: false }],
    pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.3, footer: 0.3 } },
  });

  const NAVY = "FF0B2239";
  const GOLD = "FFA87E28";
  const GOLD_LIGHT = "FFF4B63F";
  const CREAM = "FFFAF7F0";
  const LINE = "FFE2E5EA";
  const INK = "FF1F2937";
  const MUTE = "FF6B7280";
  const GREEN = "FF27A36A";
  const FONT = "Calibri";

  ws.columns = [
    { width: 6 }, // A STT
    { width: 30 }, // B
    { width: 20 }, // C
    { width: 26 }, // D
    { width: 13 }, // E
    { width: 19 }, // F
    { width: 30 }, // G
  ];
  const LASTCOL = 7;

  const solid = (argb: string) => ({ type: "pattern" as const, pattern: "solid" as const, fgColor: { argb } });
  const thinBottom = { bottom: { style: "thin" as const, color: { argb: LINE } } };
  const MONEY = '#,##0" đ"';

  let r = 1;

  // Banner
  for (let i = 0; i < 3; i++) {
    for (let c = 1; c <= LASTCOL; c++) ws.getCell(r + i, c).fill = solid(NAVY);
  }
  ws.getRow(r).height = 10;
  ws.mergeCells(r + 1, 1, r + 1, 4);
  ws.getCell(r + 1, 1).value = "CÔNG THẢNH";
  ws.getCell(r + 1, 1).font = { name: FONT, size: 24, bold: true, color: { argb: GOLD_LIGHT } };
  ws.getCell(r + 1, 1).alignment = { vertical: "middle", indent: 1 };
  ws.mergeCells(r + 1, 5, r + 1, LASTCOL);
  ws.getCell(r + 1, 5).value = "BÁO GIÁ";
  ws.getCell(r + 1, 5).font = { name: FONT, size: 12, bold: true, color: { argb: GOLD_LIGHT } };
  ws.getCell(r + 1, 5).alignment = { vertical: "middle", horizontal: "right", indent: 1 };
  ws.getRow(r + 1).height = 34;
  ws.mergeCells(r + 2, 1, r + 2, 4);
  ws.getCell(r + 2, 1).value = "Giải pháp điện mặt trời và lưu trữ năng lượng";
  ws.getCell(r + 2, 1).font = { name: FONT, size: 10, color: { argb: "FFC4CEDC" } };
  ws.getCell(r + 2, 1).alignment = { vertical: "top", indent: 1 };
  ws.mergeCells(r + 2, 5, r + 2, LASTCOL);
  ws.getCell(r + 2, 5).value = `#${data.quoteCode}   ·   Ngày ${data.dateStr}`;
  ws.getCell(r + 2, 5).font = { name: FONT, size: 10, color: { argb: "FFFFFFFF" } };
  ws.getCell(r + 2, 5).alignment = { vertical: "top", horizontal: "right", indent: 1 };
  ws.getRow(r + 2).height = 22;
  r += 3;
  for (let c = 1; c <= LASTCOL; c++) ws.getCell(r, c).fill = solid(GOLD_LIGHT);
  ws.getRow(r).height = 4;
  r += 2;

  // Tiêu đề
  ws.mergeCells(r, 1, r, LASTCOL);
  ws.getCell(r, 1).value = "BÁO GIÁ HỆ THỐNG ĐIỆN MẶT TRỜI";
  ws.getCell(r, 1).font = { name: FONT, size: 16, bold: true, color: { argb: NAVY } };
  ws.getRow(r).height = 26;
  r += 1;
  ws.mergeCells(r, 1, r, LASTCOL);
  ws.getCell(r, 1).value = `${data.systemLabel}  ·  Công suất ${fmtNum(data.totalKwp)} kWp`;
  ws.getCell(r, 1).font = { name: FONT, size: 10, color: { argb: MUTE } };
  r += 2;

  const section = (text: string) => {
    ws.mergeCells(r, 1, r, LASTCOL);
    const cell = ws.getCell(r, 1);
    cell.value = text;
    cell.font = { name: FONT, size: 11, bold: true, color: { argb: NAVY } };
    cell.alignment = { vertical: "middle", indent: 0 };
    for (let c = 1; c <= LASTCOL; c++) {
      ws.getCell(r, c).border = { bottom: { style: "medium", color: { argb: GOLD_LIGHT } } };
    }
    ws.getRow(r).height = 22;
    r += 1;
  };

  const headerRow = (labels: string[], aligns: ("left" | "right" | "center")[]) => {
    labels.forEach((l, i) => {
      const cell = ws.getCell(r, i + 1);
      cell.value = l;
      cell.fill = solid(NAVY);
      cell.font = { name: FONT, size: 9.5, bold: true, color: { argb: "FFFFFFFF" } };
      cell.alignment = { vertical: "middle", horizontal: aligns[i], wrapText: true, indent: aligns[i] === "left" ? 1 : 0 };
    });
    ws.getRow(r).height = 24;
    r += 1;
  };

  const bodyCell = (row: number, col: number, value: ExcelJS_CellValue, opts: { align?: "left" | "right" | "center"; bold?: boolean; fmt?: string; zebra?: boolean; color?: string } = {}) => {
    const cell = ws.getCell(row, col);
    cell.value = value as never;
    cell.font = { name: FONT, size: 10.5, bold: opts.bold, color: { argb: opts.color ?? INK } };
    cell.alignment = { vertical: "middle", horizontal: opts.align ?? "left", wrapText: true, indent: (opts.align ?? "left") === "left" ? 1 : 0 };
    if (opts.fmt) cell.numFmt = opts.fmt;
    if (opts.zebra) cell.fill = solid(CREAM);
    cell.border = thinBottom;
  };

  // Thông tin khách hàng
  section("THÔNG TIN KHÁCH HÀNG");
  const info: [string, string][] = [
    ["Khách hàng", dash(data.customerName)],
    ["Điện thoại", dash(data.customerPhone)],
    ["Địa chỉ công trình", dash(data.siteAddress)],
  ];
  info.forEach(([label, value]) => {
    ws.mergeCells(r, 1, r, 2);
    ws.getCell(r, 1).value = label;
    ws.getCell(r, 1).font = { name: FONT, size: 10, bold: true, color: { argb: GOLD } };
    ws.getCell(r, 1).alignment = { vertical: "middle", indent: 1 };
    ws.mergeCells(r, 3, r, LASTCOL);
    ws.getCell(r, 3).value = value;
    ws.getCell(r, 3).font = { name: FONT, size: 11, bold: true, color: { argb: INK } };
    ws.getCell(r, 3).alignment = { vertical: "middle", indent: 1 };
    for (let c = 1; c <= LASTCOL; c++) {
      ws.getCell(r, c).fill = solid(CREAM);
      ws.getCell(r, c).border = thinBottom;
    }
    ws.getRow(r).height = 20;
    r += 1;
  });
  r += 1;

  // Tổng quan nhanh (KPI)
  section("TỔNG QUAN HỆ THỐNG");
  const kpiLabels = ["Công suất hệ thống", "Số tấm pin", "Tiết kiệm / tháng", "Tổng thanh toán"];
  const kpiCols: [number, number][] = [
    [1, 2],
    [3, 3],
    [4, 5],
    [6, 7],
  ];
  const kpiVals: { v: ExcelJS_CellValue; fmt?: string; color: string }[] = [
    { v: `${fmtNum(data.totalKwp)} kWp`, color: NAVY },
    { v: `${groupThousands(data.panel.qty)} tấm`, color: NAVY },
    { v: data.savingsPerMonthVnd, fmt: MONEY, color: GREEN },
    { v: data.totalPaymentVnd, fmt: MONEY, color: NAVY },
  ];
  kpiCols.forEach(([c1, c2], i) => {
    if (c2 > c1) {
      ws.mergeCells(r, c1, r, c2);
      ws.mergeCells(r + 1, c1, r + 1, c2);
    }
    const lc = ws.getCell(r, c1);
    lc.value = kpiLabels[i].toUpperCase();
    lc.font = { name: FONT, size: 8.5, bold: true, color: { argb: GOLD } };
    lc.alignment = { horizontal: "center", vertical: "bottom" };
    const vc = ws.getCell(r + 1, c1);
    vc.value = kpiVals[i].v as never;
    if (kpiVals[i].fmt) vc.numFmt = kpiVals[i].fmt!;
    vc.font = { name: FONT, size: 15, bold: true, color: { argb: kpiVals[i].color } };
    vc.alignment = { horizontal: "center", vertical: "middle" };
    for (let c = c1; c <= c2; c++) {
      ws.getCell(r, c).fill = solid(CREAM);
      ws.getCell(r + 1, c).fill = solid(CREAM);
      ws.getCell(r, c).border = { top: { style: "medium", color: { argb: GOLD_LIGHT } } };
    }
  });
  ws.getRow(r).height = 20;
  ws.getRow(r + 1).height = 30;
  r += 3;

  // Cấu hình thiết bị
  section("CẤU HÌNH THIẾT BỊ");
  headerRow(["STT", "Hạng mục", "Thương hiệu", "Cấu hình", "Số lượng", "Tổng công suất", "Bảo hành"], ["center", "left", "left", "left", "right", "right", "left"]);
  const equip: string[][] = [
    ["Tấm pin", data.panel.brand, `${data.panel.wattage} Wp / tấm`, `${groupThousands(data.panel.qty)} tấm`, `${fmtNum((data.panel.qty * data.panel.wattage) / 1000)} kWp`, dash(data.panel.warranty)],
    [
      "Biến tần (Inverter)",
      data.inverter.brand,
      `${fmtNum(data.inverter.capacityKw)} kW · ${data.inverter.phaseLabel} · ${data.inverter.kindLabel}`,
      `${data.inverter.qty} bộ`,
      `${fmtNum(data.inverter.qty * data.inverter.capacityKw)} kW`,
      dash(data.inverter.warranty),
    ],
  ];
  if (data.battery) {
    equip.push([
      "Pin lưu trữ",
      data.battery.brand,
      `${fmtNum(data.battery.moduleKwh, 2)} kWh / module`,
      `${data.battery.qty} module`,
      `${fmtNum(data.battery.qty * data.battery.moduleKwh)} kWh`,
      dash(data.battery.warranty),
    ]);
  }
  equip.forEach((row, i) => {
    const z = i % 2 === 1;
    bodyCell(r, 1, i + 1, { align: "center", zebra: z, color: MUTE });
    bodyCell(r, 2, row[0], { bold: true, zebra: z });
    bodyCell(r, 3, row[1], { zebra: z });
    bodyCell(r, 4, row[2], { zebra: z });
    bodyCell(r, 5, row[3], { align: "right", zebra: z });
    bodyCell(r, 6, row[4], { align: "right", bold: true, zebra: z });
    bodyCell(r, 7, row[5], { zebra: z });
    ws.getRow(r).height = 24;
    r += 1;
  });
  ws.mergeCells(r, 1, r, LASTCOL);
  ws.getCell(r, 1).value = "Bảo hành theo chính sách của nhà sản xuất.";
  ws.getCell(r, 1).font = { name: FONT, size: 9, italic: true, color: { argb: MUTE } };
  ws.getCell(r, 1).alignment = { indent: 1 };
  r += 2;

  // Bảng kê chi tiết
  let totalRef = "";
  if (data.showPrices) {
    section("BẢNG KÊ VẬT TƯ & BÁO GIÁ");
    headerRow(["STT", "Hạng mục", "Hãng / ghi chú", "Đơn vị", "Số lượng", "Đơn giá", "Thành tiền"], ["center", "left", "left", "left", "right", "right", "right"]);
    const first = r;
    data.items.forEach((it, i) => {
      const z = i % 2 === 1;
      bodyCell(r, 1, i + 1, { align: "center", zebra: z, color: MUTE });
      bodyCell(r, 2, it.label, { bold: true, zebra: z });
      bodyCell(r, 3, it.brandModel && it.brandModel !== "-" ? it.brandModel : "—", { zebra: z });
      bodyCell(r, 4, it.unit, { zebra: z });
      bodyCell(r, 5, it.qty, { align: "right", fmt: "#,##0.##", zebra: z });
      bodyCell(r, 6, it.unitPriceVnd, { align: "right", fmt: MONEY, zebra: z });
      bodyCell(r, 7, { formula: `E${r}*F${r}`, result: it.qty * it.unitPriceVnd }, { align: "right", fmt: MONEY, bold: true, zebra: z });
      ws.getRow(r).height = 21;
      r += 1;
    });
    const last = r - 1;

    const sumRow = (label: string, value: ExcelJS_CellValue, opts: { fmt?: string; bold?: boolean } = {}) => {
      ws.mergeCells(r, 1, r, 6);
      ws.getCell(r, 1).value = label;
      ws.getCell(r, 1).font = { name: FONT, size: 10.5, bold: opts.bold, color: { argb: INK } };
      ws.getCell(r, 1).alignment = { horizontal: "right", vertical: "middle", indent: 1 };
      const vc = ws.getCell(r, 7);
      vc.value = value as never;
      vc.numFmt = opts.fmt ?? MONEY;
      vc.font = { name: FONT, size: 10.5, bold: opts.bold, color: { argb: INK } };
      vc.alignment = { horizontal: "right", vertical: "middle", indent: 0 };
      ws.getRow(r).height = 20;
      r += 1;
    };
    sumRow("Tổng trước chiết khấu", { formula: `SUM(G${first}:G${last})`, result: data.subtotalVnd });
    const subRow = r - 1;
    // ô chiết khấu % cho phép sửa trực tiếp
    ws.mergeCells(r, 1, r, 5);
    ws.getCell(r, 1).value = "Chiết khấu thương mại";
    ws.getCell(r, 1).font = { name: FONT, size: 10.5, color: { argb: INK } };
    ws.getCell(r, 1).alignment = { horizontal: "right", vertical: "middle", indent: 1 };
    const pc = ws.getCell(r, 6);
    pc.value = data.discountPercent / 100;
    pc.numFmt = "0.#%";
    pc.font = { name: FONT, size: 10.5, bold: true, color: { argb: "FF1D4ED8" } };
    pc.alignment = { horizontal: "right", vertical: "middle" };
    pc.fill = solid("FFFFFBEB");
    const dc = ws.getCell(r, 7);
    dc.value = { formula: `-G${subRow}*F${r}`, result: -(data.subtotalVnd - data.totalPaymentVnd) } as never;
    dc.numFmt = MONEY;
    dc.font = { name: FONT, size: 10.5, color: { argb: INK } };
    dc.alignment = { horizontal: "right", vertical: "middle" };
    ws.getRow(r).height = 20;
    const discRow = r;
    r += 1;
    totalRef = `G${subRow}+G${discRow}`;
    r += 0;
  }

  // Tổng thanh toán
  ws.mergeCells(r, 1, r, 5);
  const tl = ws.getCell(r, 1);
  tl.value = "TỔNG THANH TOÁN (DỰ TOÁN)";
  tl.font = { name: FONT, size: 11, bold: true, color: { argb: "FFC4CEDC" } };
  tl.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
  ws.mergeCells(r, 6, r, 7);
  const tv = ws.getCell(r, 6);
  tv.value = (totalRef ? { formula: totalRef, result: data.totalPaymentVnd } : data.totalPaymentVnd) as never;
  tv.numFmt = MONEY;
  tv.font = { name: FONT, size: 16, bold: true, color: { argb: GOLD_LIGHT } };
  tv.alignment = { horizontal: "right", vertical: "middle", indent: 1 };
  for (let c = 1; c <= LASTCOL; c++) ws.getCell(r, c).fill = solid(NAVY);
  ws.getRow(r).height = 34;
  r += 2;

  // Hiệu quả kinh tế
  section("HIỆU QUẢ KINH TẾ (ƯỚC TÍNH)");
  const ecoRows: [string, ExcelJS_CellValue, string?][] = [
    ["Tiết kiệm điện / tháng", data.savingsPerMonthVnd, MONEY],
    ["Tiết kiệm điện / năm", data.savingsPerYearVnd, MONEY],
    ["Thời gian hoàn vốn", data.paybackYears === null ? "—" : `${fmtNum(data.paybackYears)} năm`],
  ];
  ecoRows.forEach(([label, value, fmt], i) => {
    ws.mergeCells(r, 1, r, 4);
    ws.getCell(r, 1).value = label;
    ws.getCell(r, 1).font = { name: FONT, size: 10.5, color: { argb: INK } };
    ws.getCell(r, 1).alignment = { vertical: "middle", indent: 1 };
    ws.mergeCells(r, 5, r, LASTCOL);
    const vc = ws.getCell(r, 5);
    vc.value = value as never;
    if (fmt) vc.numFmt = fmt;
    vc.font = { name: FONT, size: 11.5, bold: true, color: { argb: i < 2 ? GREEN : NAVY } };
    vc.alignment = { horizontal: "right", vertical: "middle", indent: 1 };
    for (let c = 1; c <= LASTCOL; c++) {
      ws.getCell(r, c).border = thinBottom;
      if (i % 2 === 1) ws.getCell(r, c).fill = solid(CREAM);
    }
    ws.getRow(r).height = 22;
    r += 1;
  });
  if (data.offsetPercent !== null) {
    ws.mergeCells(r, 1, r, LASTCOL);
    ws.getCell(r, 1).value = `Mức bù hoá đơn điện ước tính ≈ ${fmtNum(data.offsetPercent)}% theo công suất tấm pin thực tế.`;
    ws.getCell(r, 1).font = { name: FONT, size: 9, italic: true, color: { argb: MUTE } };
    ws.getCell(r, 1).alignment = { indent: 1 };
    r += 1;
  }
  r += 1;

  // Ghi chú
  section("GHI CHÚ");
  NOTES.forEach((n) => {
    ws.mergeCells(r, 1, r, LASTCOL);
    ws.getCell(r, 1).value = `•  ${n}`;
    ws.getCell(r, 1).font = { name: FONT, size: 9.5, color: { argb: MUTE } };
    ws.getCell(r, 1).alignment = { vertical: "middle", wrapText: true, indent: 1 };
    ws.getRow(r).height = 18;
    r += 1;
  });
  r += 1;

  // Footer công ty
  for (let c = 1; c <= LASTCOL; c++) ws.getCell(r, c).border = { top: { style: "medium", color: { argb: GOLD_LIGHT } } };
  ws.mergeCells(r, 1, r, LASTCOL);
  ws.getCell(r, 1).value = data.company.fullName;
  ws.getCell(r, 1).font = { name: FONT, size: 10, bold: true, color: { argb: NAVY } };
  ws.getCell(r, 1).alignment = { indent: 1 };
  r += 1;
  ws.mergeCells(r, 1, r, LASTCOL);
  ws.getCell(r, 1).value = `Hotline: ${data.company.hotline}  ·  ${data.company.website}  ·  ${data.company.address}`;
  ws.getCell(r, 1).font = { name: FONT, size: 9, color: { argb: MUTE } };
  ws.getCell(r, 1).alignment = { indent: 1 };

  const buf = await wb.xlsx.writeBuffer();
  return buf as ArrayBuffer;
}

type ExcelJS_CellValue = string | number | { formula: string; result: number };
