import * as XLSX from "xlsx";
import type { PanelSpec, InverterSpec, BatterySpec, Phase, InverterKind } from "./catalog-types";

/** Bỏ dấu tiếng Việt, chữ thường, bỏ khoảng trắng/ký tự đặc biệt — dùng để so khớp tiêu đề cột và giá trị linh hoạt. */
export function normalizeVi(s: unknown): string {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]/g, "");
}

function parseNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const cleaned = String(v).trim().replace(/[^\d.,-]/g, "").replace(/,/g, "");
  if (!cleaned) return null;
  const num = parseFloat(cleaned);
  return Number.isNaN(num) ? null : num;
}

function parsePhase(v: unknown): Phase | null {
  const n = normalizeVi(v);
  if (n.includes("1pha")) return "1_pha";
  if (n.includes("3pha")) return "3_pha";
  return null;
}

function parseKind(v: unknown): InverterKind | null {
  const n = normalizeVi(v);
  if (n.includes("hoaluoi") || n === "ongrid" || n === "ongridpv") return "on_grid";
  if (n.includes("hybrid")) return "hybrid";
  if (n.includes("offgrid") || n.includes("doclap")) return "off_grid";
  return null;
}

/** Đọc file Excel/CSV, trả về danh sách dòng dạng {tiêu đề gốc: giá trị}, hàng đầu tiên là tiêu đề cột. */
export async function readExcelRows(file: File): Promise<Record<string, unknown>[]> {
  const buf = await file.arrayBuffer();
  const workbook = XLSX.read(buf, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
}

/** Tìm giá trị của 1 cột trong 1 dòng bằng cách so khớp tiêu đề đã chuẩn hoá (bỏ dấu, ký tự đặc biệt). */
function getCell(row: Record<string, unknown>, ...candidates: string[]): unknown {
  const keys = Object.keys(row);
  for (const candidate of candidates) {
    const key = keys.find((k) => normalizeVi(k) === candidate);
    if (key !== undefined) return row[key];
  }
  return undefined;
}

export interface ImportResult<T> {
  ok: boolean;
  rows: T[];
  errors: string[];
}

export function parsePanelRows(rawRows: Record<string, unknown>[], existing: PanelSpec[]): ImportResult<Omit<PanelSpec, "id">> {
  const errors: string[] = [];
  const parsed: Omit<PanelSpec, "id">[] = [];
  const seenKeys = new Map<string, number>();
  const existingKeys = new Set(existing.map((p) => `${normalizeVi(p.brand)}|${p.wattage}`));

  rawRows.forEach((row, idx) => {
    const rowNum = idx + 2; // hàng 1 là tiêu đề
    const brand = String(getCell(row, "thuonghieu") ?? "").trim();
    const wattage = parseNumber(getCell(row, "congsuatwp", "congsuat"));
    const lengthMm = parseNumber(getCell(row, "daimm", "dai"));
    const widthMm = parseNumber(getCell(row, "rongmm", "rong"));
    const priceVnd = parseNumber(getCell(row, "giatam", "gia"));

    if (!brand || wattage === null || lengthMm === null || widthMm === null || priceVnd === null) {
      errors.push(`Dòng ${rowNum}: thiếu hoặc sai dữ liệu (cần Thương hiệu, Công suất (Wp), Dài (mm), Rộng (mm), Giá / tấm).`);
      return;
    }

    const key = `${normalizeVi(brand)}|${wattage}`;
    if (existingKeys.has(key)) {
      errors.push(`Dòng ${rowNum}: "${brand} ${wattage}Wp" đã có sẵn trong bảng giá.`);
      return;
    }
    if (seenKeys.has(key)) {
      errors.push(`Dòng ${rowNum}: trùng với dòng ${seenKeys.get(key)} trong cùng file (${brand} ${wattage}Wp).`);
      return;
    }
    seenKeys.set(key, rowNum);
    parsed.push({ brand, wattage, lengthMm, widthMm, priceVnd });
  });

  return { ok: errors.length === 0, rows: parsed, errors };
}

export function parseInverterRows(
  rawRows: Record<string, unknown>[],
  existing: InverterSpec[],
): ImportResult<Omit<InverterSpec, "id">> {
  const errors: string[] = [];
  const parsed: Omit<InverterSpec, "id">[] = [];
  const seenKeys = new Map<string, number>();
  const existingKeys = new Set(existing.map((i) => `${normalizeVi(i.brand)}|${i.phase}|${i.kind}|${i.capacityKw}`));

  rawRows.forEach((row, idx) => {
    const rowNum = idx + 2;
    const brand = String(getCell(row, "thuonghieu") ?? "").trim();
    const phase = parsePhase(getCell(row, "sopha"));
    const kind = parseKind(getCell(row, "loai"));
    const capacityKw = parseNumber(getCell(row, "congsuatkw", "congsuat"));
    const priceVnd = parseNumber(getCell(row, "giabo", "gia"));

    if (!brand || !phase || !kind || capacityKw === null || priceVnd === null) {
      errors.push(
        `Dòng ${rowNum}: thiếu hoặc sai dữ liệu (cần Thương hiệu, Loại [Hoà lưới/Hybrid/Off-grid], Số pha [1 pha/3 pha], Công suất (kW), Giá / bộ).`,
      );
      return;
    }

    const key = `${normalizeVi(brand)}|${phase}|${kind}|${capacityKw}`;
    if (existingKeys.has(key)) {
      errors.push(`Dòng ${rowNum}: "${brand} ${capacityKw}kW (${phase === "1_pha" ? "1 pha" : "3 pha"})" đã có sẵn trong bảng giá.`);
      return;
    }
    if (seenKeys.has(key)) {
      errors.push(`Dòng ${rowNum}: trùng với dòng ${seenKeys.get(key)} trong cùng file (${brand} ${capacityKw}kW).`);
      return;
    }
    seenKeys.set(key, rowNum);
    parsed.push({ brand, phase, kind, capacityKw, priceVnd });
  });

  return { ok: errors.length === 0, rows: parsed, errors };
}

export function parseBatteryRows(rawRows: Record<string, unknown>[], existing: BatterySpec[]): ImportResult<Omit<BatterySpec, "id">> {
  const errors: string[] = [];
  const parsed: Omit<BatterySpec, "id">[] = [];
  const seenKeys = new Map<string, number>();
  const existingKeys = new Set(existing.map((b) => `${normalizeVi(b.brand)}|${b.moduleKwh}`));

  rawRows.forEach((row, idx) => {
    const rowNum = idx + 2;
    const brand = String(getCell(row, "thuonghieu") ?? "").trim();
    const moduleKwh = parseNumber(getCell(row, "dungluongkwh", "dungluong"));
    const priceVnd = parseNumber(getCell(row, "giamodule", "gia"));

    if (!brand || moduleKwh === null || priceVnd === null) {
      errors.push(`Dòng ${rowNum}: thiếu hoặc sai dữ liệu (cần Thương hiệu, Dung lượng (kWh), Giá / module).`);
      return;
    }

    const key = `${normalizeVi(brand)}|${moduleKwh}`;
    if (existingKeys.has(key)) {
      errors.push(`Dòng ${rowNum}: "${brand} ${moduleKwh}kWh" đã có sẵn trong bảng giá.`);
      return;
    }
    if (seenKeys.has(key)) {
      errors.push(`Dòng ${rowNum}: trùng với dòng ${seenKeys.get(key)} trong cùng file (${brand} ${moduleKwh}kWh).`);
      return;
    }
    seenKeys.set(key, rowNum);
    parsed.push({ brand, moduleKwh, priceVnd });
  });

  return { ok: errors.length === 0, rows: parsed, errors };
}

export function downloadTemplate(kind: "panels" | "inverters" | "batteries") {
  let headers: string[];
  let sample: (string | number)[][];
  let filename: string;

  if (kind === "panels") {
    headers = ["Thương hiệu", "Công suất (Wp)", "Dài (mm)", "Rộng (mm)", "Giá / tấm"];
    sample = [["Jinko", 550, 2278, 1134, 2500000]];
    filename = "mau-tam-pin.xlsx";
  } else if (kind === "inverters") {
    headers = ["Thương hiệu", "Loại", "Số pha", "Công suất (kW)", "Giá / bộ"];
    sample = [["Deye", "Hybrid", "1 pha", 5, 25000000]];
    filename = "mau-inverter.xlsx";
  } else {
    headers = ["Thương hiệu", "Dung lượng (kWh)", "Giá / module"];
    sample = [["Pylontech", 3.5, 18000000]];
    filename = "mau-pin-luu-tru.xlsx";
  }

  const ws = XLSX.utils.aoa_to_sheet([headers, ...sample]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data");
  XLSX.writeFile(wb, filename);
}
