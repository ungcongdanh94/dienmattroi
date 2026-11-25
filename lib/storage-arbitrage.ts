/**
 * LƯU TRỮ ĐIỆN — MUA ĐIỆN THẤP ĐIỂM, XẢ GIỜ CAO ĐIỂM (không dùng tấm pin NLMT)
 * Ước tính tham khảo cho khách sản xuất / kinh doanh có công tơ 3 giá. Giá tính ĐÃ GỒM VAT
 * (cùng cách tính với phần còn lại của ứng dụng). Pin chỉ xả bù tải của khách, không bán ngược lên lưới.
 *
 * Chuỗi hiệu suất: điện lưới (AC) → inverter (AC→DC) → pin (sạc/xả) → inverter (DC→AC) → tải.
 * Hiệu suất sạc–xả của pin chia đều cho chiều sạc và chiều xả (căn bậc hai mỗi chiều).
 * Dung lượng pin suy giảm theo năm (lũy tiến), công suất sạc/xả DC tối đa chỉnh được.
 */
import { BATTERY_DOD } from "@/lib/solar-calculator";
import { TOU_SCHEDULE } from "@/lib/evn-tariff";

export interface StorageParams {
  /** Hiệu suất inverter khi sạc, AC → DC (0–1) */
  acToDcEff: number;
  /** Hiệu suất inverter khi xả, DC → AC (0–1) */
  dcToAcEff: number;
  /** Hiệu suất sạc–xả của bản thân pin (round-trip, 0–1) */
  batteryRoundTripEff: number;
  /** Độ sâu xả cho phép (0–1) */
  dod: number;
  /** Suy giảm dung lượng pin mỗi năm (%), tính lũy tiến */
  annualFadePercent: number;
  /** Công suất sạc DC tối đa của cụm pin (kW) */
  maxChargeDcKw: number;
  /** Công suất xả DC tối đa của cụm pin (kW) */
  maxDischargeDcKw: number;
}

export const DEFAULT_STORAGE_PARAMS = {
  acToDcEff: 0.97,
  dcToAcEff: 0.97,
  batteryRoundTripEff: 0.96,
  dod: BATTERY_DOD.lithium,
  annualFadePercent: 2,
} as const;

/** Mặc định công suất sạc/xả DC tối đa = 0,5C (một nửa dung lượng pin mỗi giờ) */
export const DEFAULT_C_RATE = 0.5;

export interface StorageInput {
  batteryNominalKwh: number;
  inverterTotalKw: number;
  /** Điện khách dùng trong giờ cao điểm mỗi ngày (kWh) — pin chỉ xả tối đa bằng mức này */
  peakLoadKwhPerDay: number;
  offPeakPriceVnd: number; // đ/kWh chưa VAT
  peakPriceVnd: number; // đ/kWh chưa VAT
  vatRate: number;
  params: StorageParams;
}

export type StorageLimit =
  | "battery"
  | "inverter_discharge"
  | "inverter_charge"
  | "dc_discharge"
  | "dc_charge"
  | "load"
  | "none";

export interface StorageResult {
  usableKwh: number;
  /** Hiệu suất tổng cả chuỗi: AC→DC × pin × DC→AC */
  totalEfficiency: number;
  /** Điện xả ra (AC) trong giờ cao điểm mỗi ngày (kWh) */
  dischargeKwhPerDay: number;
  /** Điện mua (AC) vào giờ thấp điểm mỗi ngày để sạc pin (kWh) */
  chargeKwhPerDay: number;
  limit: StorageLimit;
  costPerDayVnd: number;
  valuePerDayVnd: number;
  savingsPerDayVnd: number;
  savingsPerMonthVnd: number;
  savingsPerYearVnd: number;
  /** Gợi ý để bù hết tải cao điểm */
  suggestedBatteryKwh: number;
  suggestedInverterKw: number;
  spreadVndPerKwh: number;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0.01, x));

export function calculateStorageArbitrage(i: StorageInput): StorageResult {
  const p = i.params;
  const eAc = clamp01(p.acToDcEff);
  const eDc = clamp01(p.dcToAcEff);
  const eBat = clamp01(p.batteryRoundTripEff);
  const eSide = Math.sqrt(eBat);
  const eTotal = eAc * eBat * eDc;

  const usableKwh = Math.max(0, i.batteryNominalKwh) * clamp01(p.dod);
  const invKw = Math.max(0, i.inverterTotalKw);
  const chargeHours = TOU_SCHEDULE.offPeakHoursPerDay;
  const dischargeHours = TOU_SCHEDULE.peakHoursPerDay;

  // Điện AC xả ra tối đa theo từng yếu tố giới hạn
  const byBattery = usableKwh * eSide * eDc;
  // Xả: công suất AC ≤ công suất inverter và ≤ công suất xả DC × hiệu suất DC→AC
  const byInverterDischarge = invKw * dischargeHours;
  const byDcDischarge = Math.max(0, p.maxDischargeDcKw) * eDc * dischargeHours;
  // Sạc: công suất DC vào pin ≤ công suất sạc DC tối đa và ≤ công suất inverter × hiệu suất AC→DC
  const inverterChargeDcKw = invKw * eAc;
  const dcChargeKw = Math.min(inverterChargeDcKw, Math.max(0, p.maxChargeDcKw));
  const storedPerNight = dcChargeKw * eSide * chargeHours;
  const byCharge = storedPerNight * eSide * eDc;
  const byLoad = Math.max(0, i.peakLoadKwhPerDay);

  const candidates: [StorageLimit, number][] = [
    ["battery", byBattery],
    ["inverter_discharge", byInverterDischarge],
    ["dc_discharge", byDcDischarge],
    ["inverter_charge", inverterChargeDcKw <= Math.max(0, p.maxChargeDcKw) ? byCharge : Infinity],
    ["dc_charge", inverterChargeDcKw > Math.max(0, p.maxChargeDcKw) ? byCharge : Infinity],
    ["load", byLoad],
  ];
  let limit: StorageLimit = "none";
  let discharge = Infinity;
  for (const [k, v] of candidates) {
    if (v < discharge - 1e-9) {
      discharge = v;
      limit = k;
    }
  }
  if (!isFinite(discharge)) discharge = 0;
  discharge = Math.max(0, discharge);
  const charge = discharge / eTotal;

  const vat = 1 + i.vatRate;
  const costPerDayVnd = charge * i.offPeakPriceVnd * vat;
  const valuePerDayVnd = discharge * i.peakPriceVnd * vat;
  const savingsPerDayVnd = valuePerDayVnd - costPerDayVnd;
  const savingsPerYearVnd = savingsPerDayVnd * TOU_SCHEDULE.peakDaysPerYear;

  return {
    usableKwh,
    totalEfficiency: eTotal,
    dischargeKwhPerDay: discharge,
    chargeKwhPerDay: charge,
    limit,
    costPerDayVnd,
    valuePerDayVnd,
    savingsPerDayVnd,
    savingsPerMonthVnd: savingsPerYearVnd / 12,
    savingsPerYearVnd,
    suggestedBatteryKwh: byLoad / (eSide * eDc * clamp01(p.dod)),
    suggestedInverterKw: Math.max(byLoad / dischargeHours, byLoad / eTotal / chargeHours / eAc),
    spreadVndPerKwh: i.peakPriceVnd - i.offPeakPriceVnd / eTotal,
  };
}

export interface StorageYear {
  year: number;
  /** Dung lượng pin còn lại so với ban đầu (%) */
  retentionPercent: number;
  capacityKwh: number;
  dischargeKwhPerDay: number;
  savingsYearVnd: number;
  cumulativeVnd: number;
}

export interface StorageProjection {
  years: StorageYear[];
  /** Thời gian hoàn vốn (năm, làm tròn 0,1) tính theo tiết kiệm giảm dần từng năm; null nếu > maxYears */
  paybackYears: number | null;
  /** Tổng tiết kiệm trong `horizon` năm đầu */
  totalSavingsHorizonVnd: number;
}

/** Dự báo tiết kiệm từng năm khi dung lượng pin suy giảm lũy tiến; công suất sạc/xả DC giữ nguyên */
export function projectStorage(
  input: StorageInput,
  investmentVnd: number,
  horizon = 10,
  maxYears = 25,
): StorageProjection {
  const fade = Math.min(0.5, Math.max(0, input.params.annualFadePercent / 100));
  const years: StorageYear[] = [];
  let cumulative = 0;
  let payback: number | null = null;
  for (let y = 1; y <= Math.max(horizon, maxYears); y++) {
    const retention = Math.pow(1 - fade, y - 1);
    const r = calculateStorageArbitrage({ ...input, batteryNominalKwh: input.batteryNominalKwh * retention });
    const before = cumulative;
    cumulative += r.savingsPerYearVnd;
    if (payback === null && investmentVnd > 0 && cumulative >= investmentVnd && r.savingsPerYearVnd > 0) {
      payback = Math.round((y - 1 + (investmentVnd - before) / r.savingsPerYearVnd) * 10) / 10;
    }
    if (y <= horizon) {
      years.push({
        year: y,
        retentionPercent: retention * 100,
        capacityKwh: input.batteryNominalKwh * retention,
        dischargeKwhPerDay: r.dischargeKwhPerDay,
        savingsYearVnd: r.savingsPerYearVnd,
        cumulativeVnd: cumulative,
      });
    }
  }
  const totalSavingsHorizonVnd = years.length ? years[years.length - 1].cumulativeVnd : 0;
  return { years, paybackYears: payback, totalSavingsHorizonVnd };
}
