/**
 * COMBO THIẾT BỊ THEO HÃNG — kèm tính diện tích lắp đặt thực tế
 * ----------------------------------------------------------------
 * 2 lựa chọn combo (tấm pin + inverter + pin lưu trữ) để đội sale đưa ra cho khách.
 * Diện tích lắp đặt tính từ kích thước THẬT của tấm pin.
 *
 * Dung lượng pin lưu trữ (tham khảo, nên đối chiếu lại catalogue/giá nhập hiện tại):
 * - Dyness PowerBrick: 14.336 kWh/module
 * - Sofar SF-16KWH-L1: 16 kWh/module
 */

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

export interface PanelDimensionsMm {
  lengthMm: number;
  widthMm: number;
}

export interface EquipmentCombo {
  id: string;
  name: string;
  panelBrand: string;
  panelWattage: number;
  panelDimensions: PanelDimensionsMm;
  inverterBrand: string;
  batteryBrand: string;
  batteryModuleKwh: number;
}

export const EQUIPMENT_COMBOS: EquipmentCombo[] = [
  {
    id: "combo-1",
    name: "Combo 1",
    panelBrand: "AIKO",
    panelWattage: 655,
    panelDimensions: { lengthMm: 2382, widthMm: 1134 },
    inverterBrand: "Solis",
    batteryBrand: "Dyness",
    batteryModuleKwh: 14.336,
  },
  {
    id: "combo-2",
    name: "Combo 2",
    panelBrand: "LEAPTON",
    panelWattage: 715,
    panelDimensions: { lengthMm: 2384, widthMm: 1303 },
    inverterBrand: "Sofar",
    batteryBrand: "Sofar",
    batteryModuleKwh: 16,
  },
];

export interface ComboResult {
  combo: EquipmentCombo;
  panelCount: number;
  panelAreaM2: number;
  footprintAreaM2: number;
  installedAreaM2: number;
  inverterBrand: string;
  inverterCapacityKw: number;
  batteryModuleCount: number | null;
}

export function applyCombo(
  combo: EquipmentCombo,
  pvSizeKwp: number,
  inverterSizeKw: number,
  batteryCapacityKwh: number | null,
  mountingType: MountingType,
): ComboResult {
  const panelCount = Math.ceil((pvSizeKwp * 1000) / combo.panelWattage);
  const panelAreaM2 =
    (combo.panelDimensions.lengthMm / 1000) * (combo.panelDimensions.widthMm / 1000);
  const footprintAreaM2 = panelCount * panelAreaM2;
  const installedAreaM2 = footprintAreaM2 * MOUNTING_FACTOR[mountingType].factor;

  const batteryModuleCount =
    batteryCapacityKwh !== null ? Math.ceil(batteryCapacityKwh / combo.batteryModuleKwh) : null;

  return {
    combo,
    panelCount,
    panelAreaM2: round2(panelAreaM2),
    footprintAreaM2: round2(footprintAreaM2),
    installedAreaM2: round2(installedAreaM2),
    inverterBrand: combo.inverterBrand,
    inverterCapacityKw: round2(inverterSizeKw),
    batteryModuleCount,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
