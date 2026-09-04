/**
 * BẢNG GIÁ ĐIỆN EVN — Sinh hoạt / Sản xuất / Kinh doanh
 * Theo Quyết định 14/2025/QĐ-TTg (cơ cấu %), Quyết định 1279/QĐ-BCT (đơn giá đồng/kWh)
 * và Quyết định 963/QĐ-BCT (khung giờ cao điểm/thấp điểm), Bộ Công Thương.
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
  effectiveFrom: "2025-05-29",
  source:
    "QĐ 14/2025/QĐ-TTg, QĐ 1279/QĐ-BCT (giá bình quân 2.204,06 đ/kWh), QĐ 963/QĐ-BCT (khung giờ)",
  vatRate: 0.08,

  // Sinh hoạt: 6 bậc lũy tiến — áp dụng chung cho 1 pha và 3 pha
  // Đã đối chiếu khớp 100% với hóa đơn điện tử thực tế (kỳ 7/2026, An Giang):
  // 1.285.560đ chưa thuế + 8% VAT = 1.388.405đ tổng thanh toán ✓
  sinhHoatTiers: [
    { maxKwh: 50, pricePerKwh: 1984, label: "Bậc 1: 0 - 50 kWh" },
    { maxKwh: 100, pricePerKwh: 2050, label: "Bậc 2: 51 - 100 kWh" },
    { maxKwh: 200, pricePerKwh: 2380, label: "Bậc 3: 101 - 200 kWh" },
    { maxKwh: 300, pricePerKwh: 2998, label: "Bậc 4: 201 - 300 kWh" },
    { maxKwh: 400, pricePerKwh: 3350, label: "Bậc 5: 301 - 400 kWh" },
    { maxKwh: UNBOUNDED_KWH, pricePerKwh: 3460, label: "Bậc 6: Từ 401 kWh" },
  ],

  // Sản xuất: 4 cấp điện áp × 3 khung giờ, giá cố định (không lũy tiến)
  sanXuatByVoltage: [
    { voltageLabel: "Dưới 6 kV", offPeak: 1300, normal: 1987, peak: 3640 },
    { voltageLabel: "6 kV - dưới 22 kV", offPeak: 1234, normal: 1899, peak: 3508 },
    { voltageLabel: "22 kV - dưới 110 kV", offPeak: 1190, normal: 1833, peak: 3398 },
    { voltageLabel: "Từ 110 kV trở lên", offPeak: 1146, normal: 1811, peak: 3266 },
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
