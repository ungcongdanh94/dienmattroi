/**
 * BẢNG GIÁ ĐIỆN EVN — Sinh hoạt / Sản xuất / Kinh doanh
 * Sinh hoạt (5 bậc) và Sản xuất: Quyết định 2892/QĐ-BCT ngày 31/10/2026, hiệu lực từ 01/11/2026
 * (EVN giảm 2% giá bán lẻ bình quân còn 2.159,9037 đ/kWh — QĐ 1305/QĐ-EVN).
 * Kinh doanh: GIỮ NGUYÊN số cũ (QĐ 1279/QĐ-BCT) — chưa có bảng giá mới, cần cập nhật khi có.
 * Khung giờ cao điểm/thấp điểm: Quyết định 963/QĐ-BCT, Bộ Công Thương.
 *
 * ⚠️ QUAN TRỌNG: Giá điện SINH HOẠT áp dụng chung cho cả 1 pha và 3 pha — không có
 * bảng giá riêng theo số pha. Yếu tố thực sự tạo ra sự khác biệt về giá là MỤC ĐÍCH
 * SỬ DỤNG (sinh hoạt / sản xuất / kinh doanh) và, với sản xuất-kinh doanh, CẤP ĐIỆN ÁP
 * đấu nối + KHUNG GIỜ dùng điện. Số pha chỉ ảnh hưởng công suất tải kéo được, không ảnh
 * hưởng đơn giá.
 *
 * ⚠️ EVN không có API công khai để tự động lấy giá theo thời gian thực — bảng này cần
 * cập nhật thủ công khi có Quyết định giá mới (Nghị định 72/2025/NĐ-CP: tối đa 4 lần/năm).
 */

export type CustomerType = "sinh_hoat" | "san_xuat" | "kinh_doanh";

export interface TariffTier {
  maxKwh: number;
  pricePerKwh: number;
  label: string;
}

export interface TimeOfUsePrice {
  voltageLabel: string;
  offPeak: number; // giờ thấp điểm, đ/kWh chưa VAT
  normal: number; // giờ bình thường
  peak: number; // giờ cao điểm
}

export interface EvnTariff {
  effectiveFrom: string;
  source: string;
  vatRate: number;
  sinhHoatTiers: TariffTier[];
  sanXuatByVoltage: TimeOfUsePrice[];
  kinhDoanhByVoltage: TimeOfUsePrice[];
}

/** Ngưỡng kWh coi như "không giới hạn" cho bậc cuối — dùng số lớn hữu hạn thay vì
 * Infinity, vì Infinity bị mất khi chuyển qua JSON (JSON.stringify(Infinity) === "null"),
 * làm hỏng phép tính sau khi bảng giá được tải qua API /api/tariff. */
const UNBOUNDED_KWH = 1_000_000;

export const EVN_TARIFF_2026: EvnTariff = {
  effectiveFrom: "2026-11-01",
  source:
    "QĐ 2892/QĐ-BCT ngày 31/10/2026 (sinh hoạt 5 bậc, sản xuất); kinh doanh: QĐ 1279/QĐ-BCT (chưa cập nhật)",
  vatRate: 0.08,

  // Sinh hoạt: 5 bậc lũy tiến (từ 01/11/2026) — áp dụng chung cho 1 pha và 3 pha, giá chưa VAT
  sinhHoatTiers: [
    { maxKwh: 100, pricePerKwh: 1901, label: "Bậc 1: 0 - 100 kWh" },
    { maxKwh: 200, pricePerKwh: 2289, label: "Bậc 2: 101 - 200 kWh" },
    { maxKwh: 400, pricePerKwh: 2894, label: "Bậc 3: 201 - 400 kWh" },
    { maxKwh: 700, pricePerKwh: 3456, label: "Bậc 4: 401 - 700 kWh" },
    { maxKwh: UNBOUNDED_KWH, pricePerKwh: 3844, label: "Bậc 5: Trên 700 kWh" },
  ],

  // Sản xuất: 4 cấp điện áp × 3 khung giờ (từ 01/11/2026), giá cố định, chưa VAT
  sanXuatByVoltage: [
    { voltageLabel: "Hạ áp (đến 1 kV)", offPeak: 1274, normal: 1966, peak: 3586 },
    { voltageLabel: "Trung áp (trên 1 kV đến 35 kV)", offPeak: 1166, normal: 1814, peak: 3348 },
    { voltageLabel: "Trên 35 kV đến dưới 220 kV", offPeak: 1123, normal: 1792, peak: 3218 },
    { voltageLabel: "Từ 220 kV trở lên", offPeak: 1101, normal: 1771, peak: 3110 },
  ],

  // Kinh doanh: 3 cấp điện áp × 3 khung giờ, giá cố định (không lũy tiến)
  kinhDoanhByVoltage: [
    { voltageLabel: "Dưới 6 kV", offPeak: 1918, normal: 3152, peak: 5422 },
    { voltageLabel: "6 kV - dưới 22 kV", offPeak: 1829, normal: 3108, peak: 5202 },
    { voltageLabel: "Từ 22 kV trở lên", offPeak: 1609, normal: 2887, peak: 5025 },
  ],
};

/** Đơn giá trung bình có trọng số theo % sản lượng dùng ở mỗi khung giờ (đ/kWh, chưa VAT) */
export function weightedTouPrice(
  tou: TimeOfUsePrice,
  peakPercent: number,
  offPeakPercent: number,
): number {
  const normalPercent = Math.max(100 - peakPercent - offPeakPercent, 0);
  return (
    (tou.peak * peakPercent + tou.offPeak * offPeakPercent + tou.normal * normalPercent) /
    100
  );
}

/** Tính tiền điện (đã gồm VAT) cho sinh hoạt theo bậc thang lũy tiến */
export function costForKwhSinhHoat(kwh: number, tariff: EvnTariff = EVN_TARIFF_2026): number {
  let remaining = Math.max(kwh, 0);
  let prevMax = 0;
  let cost = 0;
  for (const tier of tariff.sinhHoatTiers) {
    const tierWidth = tier.maxKwh - prevMax;
    const tierKwh = Math.min(remaining, tierWidth);
    cost += tierKwh * tier.pricePerKwh;
    remaining -= tierKwh;
    prevMax = tier.maxKwh;
    if (remaining <= 0) break;
  }
  return cost * (1 + tariff.vatRate);
}

/** Quy đổi ngược: tiền điện (đã VAT) -> kWh, cho sinh hoạt (bậc thang) */
export function kwhForBillSinhHoat(billVnd: number, tariff: EvnTariff = EVN_TARIFF_2026): number {
  const target = Math.max(billVnd, 0) / (1 + tariff.vatRate);
  let prevMax = 0;
  let costSoFar = 0;
  for (const tier of tariff.sinhHoatTiers) {
    const tierWidth = tier.maxKwh - prevMax;
    const tierCost = tierWidth * tier.pricePerKwh;
    if (costSoFar + tierCost >= target) {
      const remainingCost = target - costSoFar;
      return prevMax + remainingCost / tier.pricePerKwh;
    }
    costSoFar += tierCost;
    prevMax = tier.maxKwh;
  }
  return prevMax;
}

/** Tính tiền điện (đã gồm VAT) cho sản xuất/kinh doanh, giá cố định theo cấp điện áp + khung giờ */
export function costForKwhFlat(
  kwh: number,
  tou: TimeOfUsePrice,
  peakPercent: number,
  offPeakPercent: number,
  vatRate: number,
): number {
  const price = weightedTouPrice(tou, peakPercent, offPeakPercent);
  return kwh * price * (1 + vatRate);
}

/** Quy đổi ngược: tiền điện (đã VAT) -> kWh, cho sản xuất/kinh doanh (giá cố định) */
export function kwhForBillFlat(
  billVnd: number,
  tou: TimeOfUsePrice,
  peakPercent: number,
  offPeakPercent: number,
  vatRate: number,
): number {
  const price = weightedTouPrice(tou, peakPercent, offPeakPercent);
  const preVat = Math.max(billVnd, 0) / (1 + vatRate);
  return preVat / price;
}

/**
 * "Cập nhật bảng giá": gọi API nội bộ /api/tariff để lấy bảng giá hiện hành
 * (nguồn dữ liệu do admin công ty cập nhật khi EVN ban hành giá mới).
 * EVN không có API public nên KHÔNG THỂ tự động đồng bộ trực tiếp từ EVN.
 */
export async function fetchLatestTariff(): Promise<EvnTariff> {
  const res = await fetch("/api/tariff", { cache: "no-store" });
  if (!res.ok) throw new Error("Không lấy được bảng giá mới nhất");
  return res.json();
}
