export interface PanelSpec {
  id: string;
  brand: string;
  wattage: number;
  lengthMm: number;
  widthMm: number;
  priceVnd: number;
  /** Thời hạn bảo hành theo chính sách nhà sản xuất, vd. "12 năm sản phẩm / 25 năm hiệu suất". */
  warranty: string;
}

/**
 * Số pha của inverter. Một số hãng (vd. Solis) bán 3 pha thành 2 dòng LV/HV — cùng kW nhưng
 * giá khác nhau thật sự, nên có 2 giá trị riêng để không gộp nhầm khi kiểm tra trùng dữ liệu.
 * Hãng nào chỉ có 1 dòng 3 pha (không phân biệt LV/HV) thì dùng "3_pha" bình thường.
 */
export type Phase = "1_pha" | "3_pha" | "3_pha_lv" | "3_pha_hv";
/** Nhóm pha ở mức thô — dùng cho những chỗ chỉ cần phân biệt 1 pha / 3 pha (vd. giá tủ điện). */
export type PhaseGroup = "1_pha" | "3_pha";

export const PHASE_LABEL: Record<Phase, string> = {
  "1_pha": "1 pha",
  "3_pha": "3 pha",
  "3_pha_lv": "3 pha LV",
  "3_pha_hv": "3 pha HV",
};

export function phaseGroup(phase: Phase): PhaseGroup {
  return phase === "1_pha" ? "1_pha" : "3_pha";
}

/** Chuẩn hoá giá trị phase đọc từ dữ liệu cũ/không rõ nguồn về 1 trong các giá trị hợp lệ. */
export function normalizePhase(value: unknown): Phase {
  if (value === "1_pha" || value === "3_pha" || value === "3_pha_lv" || value === "3_pha_hv") return value;
  return "1_pha";
}

/** Loại inverter theo cách hệ thống hoạt động — khớp với SystemType ở lib/solar-calculator.ts */
export type InverterKind = "on_grid" | "hybrid" | "off_grid";

export interface InverterSpec {
  id: string;
  brand: string;
  phase: Phase;
  kind: InverterKind;
  capacityKw: number;
  priceVnd: number;
  /** Thời hạn bảo hành theo chính sách nhà sản xuất, vd. "5 năm" hoặc "10 năm". */
  warranty: string;
}

export interface BatterySpec {
  id: string;
  brand: string;
  moduleKwh: number;
  priceVnd: number;
  /** Thời hạn bảo hành theo chính sách nhà sản xuất, vd. "10 năm" hoặc "6.000 chu kỳ". */
  warranty: string;
}

export interface CabinetPriceTier {
  id: string;
  /** Giá tủ điện chỉ phụ thuộc 1 pha / 3 pha (không phân biệt LV/HV). */
  phase: PhaseGroup;
  minKwp: number;
  maxKwp: number;
  priceVnd: number;
}

export interface OtherPricing {
  /** đ/kWp — khung áp mái tôn/mái dốc */
  framePerKwpApMai: number;
  /** đ/kWp — khung giá đỡ nghiêng */
  framePerKwpGiaDoNghieng: number;
  /** đ/mét cáp DC */
  dcCablePerMeter: number;
  /** đ/mét cáp AC */
  acCablePerMeter: number;
  /** mét cáp DC / kWp — dùng để tự tính số mét cần, theo mức phổ biến */
  dcCableMetersPerKwp: number;
  /** mét cáp AC / kWp — dùng để tự tính số mét cần, theo mức phổ biến */
  acCableMetersPerKwp: number;
  /** Giá tủ điện AC/DC theo pha + khoảng công suất hệ thống */
  cabinetTiers: CabinetPriceTier[];
  /** đ/kWp nhân công lắp đặt */
  laborPerKwp: number;
  /** đ/chuyến vận chuyển */
  shippingPerTrip: number;
}

export interface EquipmentCatalog {
  panels: PanelSpec[];
  inverters: InverterSpec[];
  batteries: BatterySpec[];
  otherPricing: OtherPricing;
}

export type MountingType = "ap_mai" | "gia_do_nghieng";

export const MOUNTING_FACTOR: Record<MountingType, { factor: number; label: string; note: string }> = {
  ap_mai: {
    factor: 1.12,
    label: "Áp mái tôn/mái dốc có sẵn",
    note: "Khung song song mái, gần như không cách hàng — chỉ cộng ~12% cho ray nhôm/khoảng hở kỹ thuật.",
  },
  gia_do_nghieng: {
    factor: 2.0,
    label: "Giá đỡ nghiêng (mái bằng/sân thượng)",
    note: "Cần chừa khoảng cách giữa các hàng để tránh che bóng lẫn nhau — diện tích gần gấp đôi footprint tấm pin (dao động 1.8-2.2 lần tuỳ góc nghiêng).",
  },
};

export function findCabinetTier(
  tiers: CabinetPriceTier[],
  phase: Phase,
  pvSizeKwp: number,
): CabinetPriceTier | null {
  const group = phaseGroup(phase);
  const exact = tiers.find((t) => t.phase === group && pvSizeKwp >= t.minKwp && pvSizeKwp <= t.maxKwp);
  if (exact) return exact;
  // Không khớp khoảng nào — lấy mức gần nhất cùng pha để không bỏ trống giá
  const samePhase = tiers.filter((t) => t.phase === group);
  if (samePhase.length === 0) return null;
  return samePhase.reduce((closest, t) => {
    const distClosest = pvSizeKwp < closest.minKwp ? closest.minKwp - pvSizeKwp : pvSizeKwp - closest.maxKwp;
    const distT = pvSizeKwp < t.minKwp ? t.minKwp - pvSizeKwp : pvSizeKwp - t.maxKwp;
    return Math.abs(distT) < Math.abs(distClosest) ? t : closest;
  });
}

export interface EquipmentSelectionResult {
  panelCount: number;
  panelAreaM2: number;
  footprintAreaM2: number;
  installedAreaM2: number;
  batteryModuleCount: number | null;
}

export function computeEquipmentSelection(
  panel: PanelSpec,
  battery: BatterySpec | null,
  pvSizeKwp: number,
  batteryCapacityKwh: number | null,
  mountingType: MountingType,
): EquipmentSelectionResult {
  const panelCount = Math.ceil((pvSizeKwp * 1000) / panel.wattage);
  const panelAreaM2 = (panel.lengthMm / 1000) * (panel.widthMm / 1000);
  const footprintAreaM2 = panelCount * panelAreaM2;
  const installedAreaM2 = footprintAreaM2 * MOUNTING_FACTOR[mountingType].factor;

  const batteryModuleCount =
    battery && batteryCapacityKwh !== null ? Math.ceil(batteryCapacityKwh / battery.moduleKwh) : null;

  return {
    panelCount,
    panelAreaM2: round2(panelAreaM2),
    footprintAreaM2: round2(footprintAreaM2),
    installedAreaM2: round2(installedAreaM2),
    batteryModuleCount,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
