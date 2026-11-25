/**
 * ĐIỆN MẶT TRỜI — TỔN HAO, SUY GIẢM THEO NĂM VÀ PIN LƯU TRỮ TÍNH RA TIỀN (hệ hybrid)
 *
 * - Sản lượng PV nhân hiệu suất inverter DC→AC; tấm pin suy giảm mỗi năm.
 * - Pin lưu trữ tạo thêm tiết kiệm bằng 2 nguồn: (1) điện mặt trời phát dư so với nhu cầu (nếu bỏ đi thì lãng phí),
 *   (2) tuỳ chọn sạc từ lưới giờ thấp điểm. Điện xả vào giờ cao điểm (khách TOU) hoặc theo giá điện trung bình (sinh hoạt).
 * - Pin suy giảm dung lượng mỗi năm; giá điện tăng theo lạm phát.
 */
import { calculateActualEnergy, MAX_DC_AC_RATIO, type SystemType } from "@/lib/solar-calculator";
import { TOU_SCHEDULE } from "@/lib/evn-tariff";

export interface PvTechParams {
  /** Hiệu suất inverter DC→AC (0–1) — áp cho sản lượng PV và điện xả từ pin */
  inverterDcAcEff: number;
  /** Hiệu suất inverter AC→DC (0–1) — khi sạc pin từ lưới / điện dư */
  inverterAcDcEff: number;
  /** Hiệu suất sạc–xả của bản thân pin (0–1) */
  batteryRoundTripEff: number;
  dod: number;
  panelFadePercent: number;
  batteryFadePercent: number;
}

export const DEFAULT_PV_TECH: PvTechParams = {
  inverterDcAcEff: 0.97,
  inverterAcDcEff: 0.97,
  batteryRoundTripEff: 0.96,
  dod: 0.9,
  panelFadePercent: 0.5,
  batteryFadePercent: 2,
};

const clamp = (x: number) => Math.min(1, Math.max(0.01, x));

export interface PvBatteryInput {
  batteryNominalKwh: number;
  inverterTotalKw: number;
  /** Điện AC phát dư mỗi ngày (kWh) */
  surplusKwhPerDay: number;
  /** Điện khách dùng trong khung xả mỗi ngày (kWh) */
  peakLoadKwhPerDay: number;
  /** Giá điện mà 1 kWh xả ra thay thế (đã gồm VAT, đ/kWh) */
  valuePerKwh: number;
  gridChargeEnabled: boolean;
  /** Giá mua điện thấp điểm (đã gồm VAT, đ/kWh) */
  offPeakPerKwh: number;
  daysPerYear: number;
  params: PvTechParams;
  /** Dung lượng pin còn lại so với ban đầu (0–1) */
  retention?: number;
}

export interface PvBatteryValue {
  usableKwh: number;
  fromPvKwhPerDay: number;
  fromGridKwhPerDay: number;
  dischargeKwhPerDay: number;
  gridBuyKwhPerDay: number;
  savingsPerDayVnd: number;
  savingsPerYearVnd: number;
}

export function batteryValue(i: PvBatteryInput): PvBatteryValue {
  const p = i.params;
  const eAc = clamp(p.inverterAcDcEff);
  const eDc = clamp(p.inverterDcAcEff);
  const eBat = clamp(p.batteryRoundTripEff);
  const eSide = Math.sqrt(eBat);
  const eTotal = eAc * eBat * eDc;
  const usable = Math.max(0, i.batteryNominalKwh) * clamp(p.dod) * (i.retention ?? 1);
  const cap = Math.max(0, Math.min(i.peakLoadKwhPerDay, Math.max(0, i.inverterTotalKw) * TOU_SCHEDULE.peakHoursPerDay));

  const pvStored = Math.min(Math.max(0, i.surplusKwhPerDay) * eAc * eSide, usable);
  let acFromPv = pvStored * eSide * eDc;
  let acFromGrid = i.gridChargeEnabled ? (usable - pvStored) * eSide * eDc : 0;
  if (acFromPv >= cap) {
    acFromPv = cap;
    acFromGrid = 0;
  } else {
    acFromGrid = Math.min(acFromGrid, cap - acFromPv);
  }
  const gridBuy = acFromGrid / eTotal;
  const discharge = acFromPv + acFromGrid;
  const savingsPerDay = discharge * i.valuePerKwh - gridBuy * i.offPeakPerKwh;
  return {
    usableKwh: usable,
    fromPvKwhPerDay: acFromPv,
    fromGridKwhPerDay: acFromGrid,
    dischargeKwhPerDay: discharge,
    gridBuyKwhPerDay: gridBuy,
    savingsPerDayVnd: savingsPerDay,
    savingsPerYearVnd: savingsPerDay * i.daysPerYear,
  };
}

export interface PvProjectInput {
  pvKwp: number;
  inverterTotalKw: number;
  monthlyKwh: number;
  systemType: SystemType;
  billVnd: number;
  params: PvTechParams;
  inflationPercent: number;
  battery: Omit<PvBatteryInput, "surplusKwhPerDay" | "inverterTotalKw" | "params" | "retention"> | null;
  years: number;
}

export interface PvYearRow {
  year: number;
  productionKwhMonth: number;
  coveredPercent: number;
  surplusKwhMonth: number;
  pvSavingsVnd: number;
  batterySavingsVnd: number;
  totalVnd: number;
  inflationFactor: number;
}

/** Dự báo từng năm: tấm pin và pin lưu trữ suy giảm, giá điện (nên tiết kiệm) tăng theo lạm phát */
export function projectPvSystem(i: PvProjectInput): PvYearRow[] {
  const rows: PvYearRow[] = [];
  for (let y = 1; y <= i.years; y++) {
    const pvRet = Math.pow(1 - i.params.panelFadePercent / 100, y - 1);
    const batRet = Math.pow(1 - i.params.batteryFadePercent / 100, y - 1);
    const infl = Math.pow(1 + i.inflationPercent / 100, y - 1);
    const e = calculateActualEnergy({
      pvKwp: i.pvKwp * pvRet,
      inverterTotalKw: i.inverterTotalKw,
      monthlyKwh: i.monthlyKwh,
      inverterEff: i.params.inverterDcAcEff,
    });
    const pvSavings = i.systemType === "off_grid" ? i.billVnd * 12 : Math.round(i.billVnd * (e.coveredPercent / 100)) * 12;
    let batterySavings = 0;
    if (i.battery && i.systemType === "hybrid") {
      batterySavings = batteryValue({
        ...i.battery,
        inverterTotalKw: i.inverterTotalKw,
        surplusKwhPerDay: e.surplusKwhMonth / 30,
        params: i.params,
        retention: batRet,
      }).savingsPerYearVnd;
    }
    rows.push({
      year: y,
      productionKwhMonth: e.productionKwhMonth,
      coveredPercent: e.coveredPercent,
      surplusKwhMonth: e.surplusKwhMonth,
      pvSavingsVnd: Math.round(pvSavings * infl),
      batterySavingsVnd: Math.round(batterySavings * infl),
      totalVnd: Math.round((pvSavings + batterySavings) * infl),
      inflationFactor: infl,
    });
  }
  return rows;
}

export interface PvSuggestionInput {
  pvKwp: number;
  batteryModuleKwh: number;
  inverterModelKw: number;
  params: PvTechParams;
  surplusKwhPerDay: number;
  peakLoadKwhPerDay: number;
  gridChargeEnabled: boolean;
  /** Số module pin gợi ý theo nhu cầu dự phòng ban đêm (đã có sẵn trong ứng dụng) */
  backupBatteryCount: number;
}

export interface PvSuggestion {
  batteryQty: number;
  inverterQty: number;
  batteryNominalKwh: number;
  usableKwh: number;
  requiredInverterKw: number;
  requiredByPvKw: number;
  requiredDischargeAcKw: number;
  requiredChargeAcKw: number;
  monetizationBatteryQty: number;
  backupBatteryCount: number;
}

/** Gợi ý số pin + số inverter: đủ cho dự phòng ban đêm / nhu cầu xả giờ cao điểm, sạc đầy trong giờ thấp điểm, xả hết trong giờ cao điểm, và DC/AC ≤ 1,5 */
export function suggestPvStorage(i: PvSuggestionInput): PvSuggestion | null {
  if (!(i.inverterModelKw > 0)) return null;
  const hasModule = i.batteryModuleKwh > 0;
  const p = i.params;
  const eAc = clamp(p.inverterAcDcEff);
  const eDc = clamp(p.inverterDcAcEff);
  const eBat = clamp(p.batteryRoundTripEff);
  const eSide = Math.sqrt(eBat);
  const eTotal = eAc * eBat * eDc;
  const dod = clamp(p.dod);
  const perModuleAc = Math.max(1e-9, i.batteryModuleKwh) * dod * eSide * eDc;

  const peakLoad = Math.max(0, i.peakLoadKwhPerDay);
  const target = i.gridChargeEnabled ? peakLoad : Math.min(peakLoad, Math.max(0, i.surplusKwhPerDay) * eTotal);
  const monetizationBatteryQty = hasModule && target > 0 ? Math.max(1, Math.ceil(target / perModuleAc - 1e-9)) : 0;
  const batteryQty = hasModule ? Math.max(0, i.backupBatteryCount, monetizationBatteryQty) : 0;
  const nominal = batteryQty * i.batteryModuleKwh;
  const usable = nominal * dod;

  const requiredByPvKw = Math.max(0, i.pvKwp) / MAX_DC_AC_RATIO;
  const requiredDischargeAcKw = (usable * eSide * eDc) / TOU_SCHEDULE.peakHoursPerDay;
  const requiredChargeAcKw = i.gridChargeEnabled ? usable / eSide / eAc / TOU_SCHEDULE.offPeakHoursPerDay : 0;
  const requiredInverterKw = Math.max(requiredByPvKw, requiredDischargeAcKw, requiredChargeAcKw);
  const inverterQty = Math.max(1, Math.ceil(requiredInverterKw / i.inverterModelKw - 1e-9));
  return {
    batteryQty,
    inverterQty,
    batteryNominalKwh: nominal,
    usableKwh: usable,
    requiredInverterKw,
    requiredByPvKw,
    requiredDischargeAcKw,
    requiredChargeAcKw,
    monetizationBatteryQty,
    backupBatteryCount: i.backupBatteryCount,
  };
}
