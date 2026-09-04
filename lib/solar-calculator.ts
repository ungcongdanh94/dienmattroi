/**
 * SOLAR SIZING CALCULATOR — CÔNG THẢNH
 * ----------------------------------------------------------------
 * Ước tính công suất hệ thống điện mặt trời (on-grid / off-grid / hybrid)
 * dựa trên sản lượng điện tiêu thụ hàng tháng (kWh) và tỷ lệ dùng ban ngày/ban đêm.
 * Đây là công thức ƯỚC TÍNH NHANH cho mục đích tư vấn sơ bộ, không thay thế khảo sát thực tế.
 */

export const FIXED_PEAK_SUN_HOURS = 4;
export const NIGHT_HOURS = 12;

export type SystemType = "on_grid" | "off_grid" | "hybrid";
export type BatteryType = "lithium" | "acid";

export const BATTERY_DOD: Record<BatteryType, number> = {
  lithium: 0.9,
  acid: 0.5,
};

export const DEFAULT_BATTERY_EFFICIENCY = 0.95;
export const OFF_GRID_SAFETY_FACTOR = 1.25;
export const ROOF_AREA_PER_KWP = 5.5;
export const DEFAULT_PANEL_WATTAGE = 550;

/** Ngưỡng công suất inverter để phân biệt nên dùng điện 1 pha hay 3 pha.
 * Inverter 1 pha phổ biến trên thị trường thường tới 6-8kW; trên ngưỡng này
 * cần điện 3 pha (hoặc chia nhiều inverter 1 pha). */
const SINGLE_PHASE_MAX_KW = 8;

export interface SolarCalcInput {
  monthlyKwh: number;
  dayUsagePercent: number;
  systemType: SystemType;
  offsetPercent?: number;
  batteryType?: BatteryType;
  autonomyDays?: number;
  backupHours?: number;
  backupLoadPercent?: number;
  panelWattage?: number;
}

export interface EquipmentAdvisory {
  phase: { recommended: "1 pha" | "3 pha"; reason: string };
  inverterType: { label: string; reason: string };
  batteryChemistry: { recommended: BatteryType | null; reason: string };
}

export interface SolarCalcResult {
  dailyKwh: number;
  dayKwh: number;
  nightKwh: number;
  peakSunHours: number;
  pvSizeKwp: number;
  panelCount: number;
  estimatedRoofAreaM2: number;
  inverterSizeKw: number;
  batteryCapacityKwh: number | null;
  batteryDod: number | null;
  notes: string[];
  recommendation: {
    suggestedType: SystemType | null;
    matchesSelection: boolean;
    message: string;
  };
  equipmentAdvisory: EquipmentAdvisory;
}

function getSystemRecommendation(
  dayUsagePercent: number,
  systemType: SystemType,
): SolarCalcResult["recommendation"] {
  if (systemType === "off_grid") {
    return {
      suggestedType: null,
      matchesSelection: true,
      message: "Off-grid không phụ thuộc tỷ lệ ngày/đêm theo giá điện lưới vì không nối lưới.",
    };
  }
  let suggestedType: SystemType;
  let message: string;
  if (dayUsagePercent >= 60) {
    suggestedType = "on_grid";
    message = `Khách dùng điện chủ yếu ban ngày (${dayUsagePercent}%) — tự tiêu trực tiếp từ PV, on-grid đã hiệu quả, chưa cần đầu tư thêm pin.`;
  } else if (dayUsagePercent >= 35) {
    suggestedType = "hybrid";
    message = `Tỷ lệ dùng ban đêm khá cao (${100 - dayUsagePercent}%) — nên xem xét hybrid: sạc pin ban ngày để dùng ban đêm, tránh bán điện dư giá thấp (~845đ/kWh) rồi mua lại điện lưới giá cao.`;
  } else {
    suggestedType = "hybrid";
    message = `Khách dùng điện chủ yếu ban đêm (${100 - dayUsagePercent}%) — on-grid sẽ kém hiệu quả vì phần lớn điện PV phát ra ban ngày phải bán rẻ lên lưới. Hybrid (có pin) phù hợp hơn để giữ giá trị tự tiêu.`;
  }
  return { suggestedType, matchesSelection: suggestedType === systemType, message };
}

/** Gợi ý pha, loại inverter, loại pin lưu trữ dựa trên kết quả tính toán. */
function getEquipmentAdvisory(
  systemType: SystemType,
  inverterSizeKw: number,
  batteryCapacityKwh: number | null,
): EquipmentAdvisory {
  const phase =
    inverterSizeKw <= SINGLE_PHASE_MAX_KW
      ? {
          recommended: "1 pha" as const,
          reason: `Công suất inverter ${inverterSizeKw}kW nằm trong ngưỡng phổ biến của inverter 1 pha (thường tới ${SINGLE_PHASE_MAX_KW}kW). Có thể dùng điện 1 pha hiện có, không cần nâng cấp.`,
        }
      : {
          recommended: "3 pha" as const,
          reason: `Công suất inverter ${inverterSizeKw}kW vượt ngưỡng inverter 1 pha thông dụng (~${SINGLE_PHASE_MAX_KW}kW) — nên dùng điện 3 pha, hoặc chia nhiều inverter 1 pha nếu nhà/xưởng chỉ có điện 1 pha.`,
        };

  const inverterType =
    systemType === "on_grid"
      ? {
          label: "Inverter hoà lưới (on-grid / string inverter)",
          reason: "Không cần pin, chỉ chuyển đổi DC-AC và hoà thẳng vào lưới điện — chi phí thấp nhất.",
        }
      : systemType === "off_grid"
        ? {
            label: "Inverter độc lập (off-grid inverter)",
            reason: "Hoạt động không cần lưới điện, bắt buộc phải có pin lưu trữ đi kèm để cấp điện liên tục.",
          }
        : {
            label: "Inverter hybrid (tích hợp sạc/xả pin)",
            reason: "Vừa hoà lưới vừa quản lý sạc/xả pin, tự chuyển mạch sang dùng pin khi mất điện lưới.",
          };

  const batteryChemistry: EquipmentAdvisory["batteryChemistry"] =
    batteryCapacityKwh === null
      ? { recommended: null, reason: "Hệ on-grid không cần pin lưu trữ." }
      : {
          recommended: "lithium",
          reason:
            "Pin Lithium (LFP) có tuổi thọ 6.000-8.000+ chu kỳ, cao hơn nhiều so với pin Acid/chì (~500-1.500 chu kỳ) — nên chọn Lithium cho đầu tư dài hạn. Pin Acid/chì chỉ phù hợp khi cần giảm chi phí ban đầu và chấp nhận thay pin sớm hơn.",
        };

  return { phase, inverterType, batteryChemistry };
}

export function calculateSolarSystem(input: SolarCalcInput): SolarCalcResult {
  const {
    monthlyKwh,
    dayUsagePercent,
    systemType,
    offsetPercent = 100,
    batteryType = "lithium",
    autonomyDays = 1.5,
    backupHours = 6,
    backupLoadPercent = 40,
    panelWattage = DEFAULT_PANEL_WATTAGE,
  } = input;

  const notes: string[] = [];
  const peakSunHours = FIXED_PEAK_SUN_HOURS;
  const dailyKwh = monthlyKwh / 30;
  const dayFraction = Math.min(Math.max(dayUsagePercent, 0), 100) / 100;
  const dayKwh = dailyKwh * dayFraction;
  const nightKwh = dailyKwh - dayKwh;
  const offsetFraction = Math.min(Math.max(offsetPercent, 0), 100) / 100;

  let pvSizeKwp: number;
  let inverterSizeKw: number;
  let batteryCapacityKwh: number | null = null;
  let batteryDod: number | null = null;

  switch (systemType) {
    case "on_grid": {
      pvSizeKwp = (dailyKwh * offsetFraction) / peakSunHours;
      inverterSizeKw = pvSizeKwp;
      notes.push(
        "Hệ on-grid: không có pin lưu trữ, phần điện dư được hoà lưới/bù trừ theo cơ chế mua bán điện hiện hành.",
      );
      break;
    }
    case "off_grid": {
      pvSizeKwp = (dailyKwh / peakSunHours) * OFF_GRID_SAFETY_FACTOR;
      batteryDod = BATTERY_DOD[batteryType];
      batteryCapacityKwh = (nightKwh * autonomyDays) / (batteryDod * DEFAULT_BATTERY_EFFICIENCY);
      const nightAvgLoadKw = nightKwh / NIGHT_HOURS;
      inverterSizeKw = Math.max(nightAvgLoadKw * 1.3, pvSizeKwp * 0.9);
      notes.push(
        "Hệ off-grid: PV cộng thêm hệ số dự phòng ~25% để vừa cấp tải ban ngày vừa sạc pin cho ban đêm.",
      );
      notes.push(
        `Pin tính theo tải BAN ĐÊM (${nightKwh.toFixed(2)} kWh/đêm) × ${autonomyDays} ngày tự trị, dùng pin ${
          batteryType === "lithium" ? "Lithium (DoD 90%)" : "Acid/chì (DoD 50%)"
        }.`,
      );
      break;
    }
    case "hybrid": {
      pvSizeKwp = (dailyKwh * offsetFraction) / peakSunHours;
      const nightAvgLoadKw = nightKwh / NIGHT_HOURS;
      const backupLoadKw = nightAvgLoadKw * (backupLoadPercent / 100);
      batteryDod = BATTERY_DOD[batteryType];
      batteryCapacityKwh = (backupLoadKw * backupHours) / (batteryDod * DEFAULT_BATTERY_EFFICIENCY);
      inverterSizeKw = Math.max(nightAvgLoadKw * 1.3, pvSizeKwp);
      notes.push(
        "Hệ hybrid: PV tính theo % bù hoá đơn (như on-grid), pin chỉ backup tải thiết yếu ban đêm khi mất điện lưới.",
      );
      notes.push(
        `Pin tính cho ${backupHours} giờ backup, ${backupLoadPercent}% tải ban đêm, dùng pin ${
          batteryType === "lithium" ? "Lithium (DoD 90%)" : "Acid/chì (DoD 50%)"
        }.`,
      );
      break;
    }
  }

  const panelCount = Math.ceil((pvSizeKwp * 1000) / panelWattage);
  const estimatedRoofAreaM2 = Math.round(pvSizeKwp * ROOF_AREA_PER_KWP);

  if (offsetFraction < 1 && systemType !== "off_grid") {
    notes.push(`Tính theo mức bù ${offsetPercent}% hoá đơn, không phải bù 100%.`);
  }
  notes.push(`Giờ nắng đỉnh cố định ${peakSunHours}h/ngày, không tính hệ số hiệu suất hệ thống.`);

  return {
    dailyKwh: round2(dailyKwh),
    dayKwh: round2(dayKwh),
    nightKwh: round2(nightKwh),
    peakSunHours,
    pvSizeKwp: round2(pvSizeKwp),
    panelCount,
    estimatedRoofAreaM2,
    inverterSizeKw: round2(inverterSizeKw),
    batteryCapacityKwh: batteryCapacityKwh !== null ? round2(batteryCapacityKwh) : null,
    batteryDod,
    notes,
    recommendation: getSystemRecommendation(dayUsagePercent, systemType),
    equipmentAdvisory: getEquipmentAdvisory(systemType, round2(inverterSizeKw), batteryCapacityKwh),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
