/**
 * TÍNH TOÁN TÀI CHÍNH BÁO GIÁ — CÔNG THẢNH
 * ----------------------------------------------------------------
 * Các công thức ở đây là ước tính đơn giản cho mục đích tư vấn, KHÔNG phải tư vấn
 * đầu tư/tài chính chính thức. Số liệu cần đối chiếu lại với kế toán trước khi gửi khách.
 */

export interface QuoteItem {
  id: string;
  label: string;
  brandModel: string;
  qty: number;
  unit: string;
  unitPriceVnd: number;
}

export function itemTotal(item: QuoteItem): number {
  return item.qty * item.unitPriceVnd;
}

export function subtotal(items: QuoteItem[]): number {
  return items.reduce((sum, it) => sum + itemTotal(it), 0);
}

export function totalAfterDiscount(sub: number, discountPercent: number): number {
  return Math.round(sub * (1 - discountPercent / 100));
}

// ---------- Tiết kiệm & hoàn vốn ----------

export interface SavingsInput {
  systemType: "on_grid" | "off_grid" | "hybrid";
  currentBillVnd: number;
  offsetPercent: number; // % bù hoá đơn (on_grid/hybrid)
}

/** Tiết kiệm tiền điện ước tính mỗi tháng */
export function monthlySavingsVnd({ systemType, currentBillVnd, offsetPercent }: SavingsInput): number {
  if (systemType === "off_grid") return currentBillVnd; // không còn phụ thuộc lưới
  return Math.round(currentBillVnd * (offsetPercent / 100));
}

export function simplePaybackYears(totalInvestmentVnd: number, monthlySavings: number): number {
  if (monthlySavings <= 0) return Infinity;
  return round1(totalInvestmentVnd / (monthlySavings * 12));
}

// ---------- Vay vốn ----------

export interface LoanInput {
  totalInvestmentVnd: number;
  loanPercent: number; // % vay trên tổng đầu tư
  interestRatePercent: number; // %/năm
  annualSavingsVnd: number;
}

export interface LoanResult {
  ownCapitalVnd: number;
  loanAmountVnd: number;
  year1InterestVnd: number;
  netYear1Vnd: number;
  paybackWithLoanYears: number;
}

export function calculateLoan({
  totalInvestmentVnd,
  loanPercent,
  interestRatePercent,
  annualSavingsVnd,
}: LoanInput): LoanResult {
  const loanAmountVnd = Math.round(totalInvestmentVnd * (loanPercent / 100));
  const ownCapitalVnd = totalInvestmentVnd - loanAmountVnd;
  const year1InterestVnd = Math.round(loanAmountVnd * (interestRatePercent / 100));
  const netYear1Vnd = annualSavingsVnd - year1InterestVnd;
  const paybackWithLoanYears = netYear1Vnd > 0 ? round1(ownCapitalVnd / netYear1Vnd) : Infinity;
  return { ownCapitalVnd, loanAmountVnd, year1InterestVnd, netYear1Vnd, paybackWithLoanYears };
}

// ---------- Khấu hao tài sản (đường thẳng) ----------

export interface DepreciationRow {
  label: string;
  originalValueVnd: number;
  years: number;
  perYearVnd: number;
  perMonthVnd: number;
}

export function calculateDepreciation(items: { label: string; valueVnd: number }[], years: number): DepreciationRow[] {
  return items.map((it) => ({
    label: it.label,
    originalValueVnd: it.valueVnd,
    years,
    perYearVnd: Math.round(it.valueVnd / years),
    perMonthVnd: Math.round(it.valueVnd / years / 12),
  }));
}

// ---------- IRR (ước tính, bisection) ----------

/** Tính IRR (%/năm) từ dòng tiền: cashFlows[0] là vốn đầu tư ban đầu (âm), các năm sau là dòng tiền dương */
export function estimateIRR(cashFlows: number[]): number | null {
  const npv = (rate: number) =>
    cashFlows.reduce((sum, cf, t) => sum + cf / Math.pow(1 + rate, t), 0);

  let low = -0.5;
  let high = 2.0; // 200%/năm là biên trên hợp lý cho bisection
  if (npv(low) * npv(high) > 0) return null; // không hội tụ trong khoảng này

  for (let i = 0; i < 100; i++) {
    const mid = (low + high) / 2;
    const val = npv(mid);
    if (Math.abs(val) < 1) return round1(mid * 100);
    if (npv(low) * val < 0) high = mid;
    else low = mid;
  }
  return round1(((low + high) / 2) * 100);
}

export function buildProjectCashFlows(
  totalInvestmentVnd: number,
  annualSavingsVnd: number,
  years: number,
  inflationPercent: number,
  degradationPercentPerYear = 0.5,
): number[] {
  const flows = [-totalInvestmentVnd];
  for (let y = 1; y <= years; y++) {
    const inflationFactor = Math.pow(1 + inflationPercent / 100, y - 1);
    const degradationFactor = Math.pow(1 - degradationPercentPerYear / 100, y - 1);
    flows.push(Math.round(annualSavingsVnd * inflationFactor * degradationFactor));
  }
  return flows;
}

// ---------- Dự báo giá điện 10 năm & tiết kiệm luỹ kế ----------

export interface YearProjectionRow {
  year: number;
  avgPriceVndPerKwh: number;
  savingsThisYearVnd: number;
  cumulativeSavingsVnd: number;
}

export function project10YearSavings(
  currentPriceVndPerKwh: number,
  annualSavingsVndYear1: number,
  inflationPercent: number,
  years = 10,
): YearProjectionRow[] {
  const rows: YearProjectionRow[] = [];
  let cumulative = 0;
  for (let y = 1; y <= years; y++) {
    const factor = Math.pow(1 + inflationPercent / 100, y - 1);
    const price = Math.round(currentPriceVndPerKwh * factor);
    const savingsThisYear = Math.round(annualSavingsVndYear1 * factor);
    cumulative += savingsThisYear;
    rows.push({
      year: y,
      avgPriceVndPerKwh: price,
      savingsThisYearVnd: savingsThisYear,
      cumulativeSavingsVnd: cumulative,
    });
  }
  return rows;
}

// ---------- CO2 & tín chỉ carbon ----------

/** Hệ số phát thải lưới điện VN — tham khảo, nên cập nhật theo công bố mới nhất của Bộ TN&MT/Cục BĐKH */
export const GRID_EMISSION_FACTOR_KG_PER_KWH = 0.661;

export interface CarbonResult {
  co2TonPerYear: number;
  co2Ton25Year: number;
  creditValuePerYearVnd: number;
  creditValue25YearVnd: number;
}

export function calculateCarbon(
  annualProductionKwh: number,
  priceUsdPerTon: number,
  usdToVndRate: number,
  years = 25,
): CarbonResult {
  const co2TonPerYear = round2((annualProductionKwh * GRID_EMISSION_FACTOR_KG_PER_KWH) / 1000);
  const co2Ton25Year = round2(co2TonPerYear * years);
  const creditValuePerYearVnd = Math.round(co2TonPerYear * priceUsdPerTon * usdToVndRate);
  const creditValue25YearVnd = Math.round(co2Ton25Year * priceUsdPerTon * usdToVndRate);
  return { co2TonPerYear, co2Ton25Year, creditValuePerYearVnd, creditValue25YearVnd };
}

// ---------- Mã báo giá ----------

export function generateQuoteCode(prefix = "CT"): string {
  const now = new Date();
  const y = String(now.getFullYear()).slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(100 + Math.random() * 900);
  return `${prefix}${y}${m}${d}-${rand}`;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
