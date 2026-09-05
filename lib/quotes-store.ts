import fs from "fs";
import path from "path";

/** ⚠️ Cùng lưu ý như catalog-store.ts / projects-store.ts: cần Railway Volume
 * mount vào /app/data để lịch sử báo giá không bị mất khi deploy lại. */

export interface QuoteRecord {
  id: string;
  createdAt: string; // ISO date
  quoteCode: string;
  customerName: string;
  customerPhone: string;
  siteAddress: string;
  systemType: string;
  pvSizeKwp: number;
  panelBrand: string;
  inverterBrand: string;
  batteryBrand: string | null;
  totalPaymentVnd: number;
  exportKind: "png" | "pdf";
}

const DATA_DIR = path.join(process.cwd(), "data");
const QUOTES_PATH = path.join(DATA_DIR, "quotes.json");
const MAX_RECORDS = 2000; // tránh file phình vô hạn

export function getQuotes(): QuoteRecord[] {
  try {
    if (!fs.existsSync(QUOTES_PATH)) return [];
    const raw = fs.readFileSync(QUOTES_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function appendQuote(record: QuoteRecord): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const list = getQuotes();
  list.unshift(record); // mới nhất lên đầu
  const trimmed = list.slice(0, MAX_RECORDS);
  fs.writeFileSync(QUOTES_PATH, JSON.stringify(trimmed, null, 2), "utf-8");
}
