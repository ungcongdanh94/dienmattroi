export interface PanelSpec {
  id: string;
  brand: string;
  wattage: number;
  lengthMm: number;
  widthMm: number;
  priceVnd: number;
}

export interface InverterSpec {
  id: string;
  brand: string;
  capacityKw: number;
  priceVnd: number;
}

export interface BatterySpec {
  id: string;
  brand: string;
  moduleKwh: number;
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
  /** đ/hệ tủ điện AC/DC */
  acDcCabinetPrice: number;
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
