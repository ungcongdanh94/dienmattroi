"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  calculateSolarSystem,
  FIXED_PEAK_SUN_HOURS,
  type BatteryType,
  type SystemType,
} from "@/lib/solar-calculator";
import {
  EQUIPMENT_COMBOS,
  MOUNTING_FACTOR,
  applyCombo,
  type MountingType,
} from "@/lib/equipment-combos";
import {
  EVN_TARIFF_2026,
  costForKwhSinhHoat,
  kwhForBillSinhHoat,
  costForKwhFlat,
  kwhForBillFlat,
  fetchLatestTariff,
  type EvnTariff,
  type CustomerType,
} from "@/lib/evn-tariff";
import {
  itemTotal,
  subtotal,
  totalAfterDiscount,
  monthlySavingsVnd,
  simplePaybackYears,
  calculateLoan,
  calculateDepreciation,
  estimateIRR,
  buildProjectCashFlows,
  project10YearSavings,
  calculateCarbon,
  generateQuoteCode,
  type QuoteItem,
} from "@/lib/quote-financials";

const SYSTEM_LABEL: Record<SystemType, { title: string; desc: string }> = {
  on_grid: { title: "On-grid", desc: "Hoà lưới, không pin — bù hoá đơn tiền điện" },
  off_grid: { title: "Off-grid", desc: "Độc lập hoàn toàn, không nối lưới" },
  hybrid: { title: "Hybrid", desc: "Hoà lưới + pin backup khi mất điện" },
};

const vnd = (n: number) => Math.round(n).toLocaleString("vi-VN") + " đ";

export default function SolarCalculator() {
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [saleName, setSaleName] = useState("");
  const [salePhone, setSalePhone] = useState("");
  const [quoteCode] = useState(() => generateQuoteCode());

  const [inputMode, setInputMode] = useState<"kwh" | "bill">("bill");
  const [monthlyKwhRaw, setMonthlyKwhRaw] = useState<number>(600);
  const [monthlyBillVnd, setMonthlyBillVnd] = useState<number>(1500000);
  const [tariff, setTariff] = useState<EvnTariff>(EVN_TARIFF_2026);
  const [tariffStatus, setTariffStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [customerType, setCustomerType] = useState<CustomerType>("sinh_hoat");
  const [voltageIndex, setVoltageIndex] = useState<number>(0);
  const [peakPercent, setPeakPercent] = useState<number>(15);
  const [offPeakPercent, setOffPeakPercent] = useState<number>(20);

  const [systemType, setSystemType] = useState<SystemType>("on_grid");
  const [offsetPercent, setOffsetPercent] = useState<number>(100);
  const [batteryType, setBatteryType] = useState<BatteryType>("lithium");
  const [autonomyDays, setAutonomyDays] = useState<number>(1.5);
  const [backupHours, setBackupHours] = useState<number>(6);
  const [backupLoadPercent, setBackupLoadPercent] = useState<number>(40);
  const [dayUsagePercent, setDayUsagePercent] = useState<number>(60);
  const [mountingType, setMountingType] = useState<MountingType>("ap_mai");
  const [selectedComboId, setSelectedComboId] = useState<string>(EQUIPMENT_COMBOS[0].id);

  const [unitPrices, setUnitPrices] = useState<Record<string, number>>({});
  const [dcCableM, setDcCableM] = useState<number>(20);
  const [acCableM, setAcCableM] = useState<number>(15);
  const [shippingTrips, setShippingTrips] = useState<number>(1);
  const [discountPercent, setDiscountPercent] = useState<number>(0);

  const [loanPercent, setLoanPercent] = useState<number>(70);
  const [interestRatePercent, setInterestRatePercent] = useState<number>(9);
  const [depreciationYears, setDepreciationYears] = useState<number>(10);
  const [inflationPercent, setInflationPercent] = useState<number>(5);
  const [bankSavingsRatePercent, setBankSavingsRatePercent] = useState<number>(5);
  const [carbonPriceUsd, setCarbonPriceUsd] = useState<number>(8);
  const [usdVndRate, setUsdVndRate] = useState<number>(25500);

  const reportRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState<"png" | "pdf" | null>(null);

  const voltageList =
    customerType === "san_xuat" ? tariff.sanXuatByVoltage : customerType === "kinh_doanh" ? tariff.kinhDoanhByVoltage : [];
  const selectedVoltage = voltageList[voltageIndex] ?? voltageList[0];

  function costForKwh(kwh: number): number {
    if (customerType === "sinh_hoat") return costForKwhSinhHoat(kwh, tariff);
    return costForKwhFlat(kwh, selectedVoltage, peakPercent, offPeakPercent, tariff.vatRate);
  }
  function kwhForBill(vndAmount: number): number {
    if (customerType === "sinh_hoat") return kwhForBillSinhHoat(vndAmount, tariff);
    return kwhForBillFlat(vndAmount, selectedVoltage, peakPercent, offPeakPercent, tariff.vatRate);
  }

  const monthlyKwh = useMemo(
    () => (inputMode === "kwh" ? monthlyKwhRaw : Math.round(kwhForBill(monthlyBillVnd) * 10) / 10),
    [inputMode, monthlyKwhRaw, monthlyBillVnd, tariff, customerType, voltageIndex, peakPercent, offPeakPercent],
  );
  const estimatedBillVnd = useMemo(
    () => Math.round(costForKwh(monthlyKwh)),
    [monthlyKwh, tariff, customerType, voltageIndex, peakPercent, offPeakPercent],
  );

  async function refreshTariff() {
    setTariffStatus("loading");
    try {
      const latest = await fetchLatestTariff();
      setTariff(latest);
      setTariffStatus("ok");
    } catch {
      setTariffStatus("error");
    }
  }
  useEffect(() => {
    refreshTariff();
  }, []);

  const result = useMemo(
    () =>
      calculateSolarSystem({
        monthlyKwh,
        dayUsagePercent,
        systemType,
        offsetPercent,
        batteryType,
        autonomyDays,
        backupHours,
        backupLoadPercent,
      }),
    [monthlyKwh, dayUsagePercent, systemType, offsetPercent, batteryType, autonomyDays, backupHours, backupLoadPercent],
  );

  const comboResults = useMemo(
    () => EQUIPMENT_COMBOS.map((combo) => applyCombo(combo, result.pvSizeKwp, result.inverterSizeKw, result.batteryCapacityKwh, mountingType)),
    [result, mountingType],
  );
  const selectedCombo = comboResults.find((cr) => cr.combo.id === selectedComboId) ?? comboResults[0];

  const items: QuoteItem[] = useMemo(() => {
    const list: QuoteItem[] = [
      {
        id: "panel",
        label: `Tấm pin ${selectedCombo.combo.panelWattage}Wp`,
        brandModel: selectedCombo.combo.panelBrand,
        qty: selectedCombo.panelCount,
        unit: "tấm",
        unitPriceVnd: unitPrices.panel ?? 0,
      },
      {
        id: "inverter",
        label: `Inverter ~${selectedCombo.inverterCapacityKw}kW`,
        brandModel: selectedCombo.combo.inverterBrand,
        qty: 1,
        unit: "bộ",
        unitPriceVnd: unitPrices.inverter ?? 0,
      },
    ];
    if (selectedCombo.batteryModuleCount !== null) {
      list.push({
        id: "battery",
        label: `Pin ${selectedCombo.combo.batteryModuleKwh}kWh`,
        brandModel: selectedCombo.combo.batteryBrand,
        qty: selectedCombo.batteryModuleCount,
        unit: "bộ",
        unitPriceVnd: unitPrices.battery ?? 0,
      });
    }
    list.push(
      {
        id: "frame",
        label: "Khung/giá đỡ",
        brandModel: MOUNTING_FACTOR[mountingType].label,
        qty: result.pvSizeKwp,
        unit: "kWp",
        unitPriceVnd: unitPrices.frame ?? 0,
      },
      { id: "dc_cable", label: "Cáp DC", brandModel: "-", qty: dcCableM, unit: "m", unitPriceVnd: unitPrices.dc_cable ?? 0 },
      { id: "ac_cable", label: "Cáp AC", brandModel: "-", qty: acCableM, unit: "m", unitPriceVnd: unitPrices.ac_cable ?? 0 },
      { id: "ac_dc_cabinet", label: "Tủ điện AC/DC", brandModel: "-", qty: 1, unit: "hệ", unitPriceVnd: unitPrices.ac_dc_cabinet ?? 0 },
      { id: "labor", label: "Nhân công", brandModel: "-", qty: result.pvSizeKwp, unit: "kWp", unitPriceVnd: unitPrices.labor ?? 0 },
      { id: "shipping", label: "Vận chuyển", brandModel: "-", qty: shippingTrips, unit: "chuyến", unitPriceVnd: unitPrices.shipping ?? 0 },
    );
    return list;
  }, [selectedCombo, mountingType, result.pvSizeKwp, dcCableM, acCableM, shippingTrips, unitPrices]);

  const sub = subtotal(items);
  const totalPayment = totalAfterDiscount(sub, discountPercent);

  const savingsPerMonth = monthlySavingsVnd({ systemType, currentBillVnd: estimatedBillVnd, offsetPercent });
  const savingsPerYear = savingsPerMonth * 12;
  const paybackYears = simplePaybackYears(totalPayment, savingsPerMonth);
  const loan = calculateLoan({ totalInvestmentVnd: totalPayment, loanPercent, interestRatePercent, annualSavingsVnd: savingsPerYear });

  const depreciationRows = calculateDepreciation(
    [
      { label: "Tấm pin (PV)", valueVnd: itemTotal(items[0]) },
      { label: "Inverter", valueVnd: itemTotal(items[1]) },
      ...(selectedCombo.batteryModuleCount !== null ? [{ label: "Pin lưu trữ", valueVnd: itemTotal(items[2]) }] : []),
      {
        label: "Khung/cáp/tủ/NC/ship",
        valueVnd: items.slice(selectedCombo.batteryModuleCount !== null ? 3 : 2).reduce((s, it) => s + itemTotal(it), 0),
      },
    ],
    depreciationYears,
  );
  const totalDepreciationPerYear = depreciationRows.reduce((s, r) => s + r.perYearVnd, 0);
  const totalDepreciationPerMonth = depreciationRows.reduce((s, r) => s + r.perMonthVnd, 0);

  const cashFlows = buildProjectCashFlows(totalPayment, savingsPerYear, 25, inflationPercent);
  const irr = estimateIRR(cashFlows);
  const irrConclusion =
    irr === null
      ? "Không đủ dữ liệu"
      : irr >= interestRatePercent
        ? "Tốt hơn vay NH"
        : irr >= bankSavingsRatePercent
          ? "Tốt hơn gửi tiết kiệm"
          : "Cân nhắc lại";

  const priceVndPerKwh = monthlyKwh > 0 ? Math.round(estimatedBillVnd / monthlyKwh) : 0;
  const projection10Y = project10YearSavings(priceVndPerKwh, savingsPerYear, inflationPercent);

  const annualProductionKwh = systemType === "off_grid" ? monthlyKwh * 12 : monthlyKwh * 12 * (offsetPercent / 100);
  const carbon = calculateCarbon(annualProductionKwh, carbonPriceUsd, usdVndRate);

  function setUnitPrice(id: string, value: number) {
    setUnitPrices((prev) => ({ ...prev, [id]: value }));
  }

  async function handleExport(kind: "png" | "pdf") {
    if (!reportRef.current) return;
    setExporting(kind);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(reportRef.current, { backgroundColor: "#F7F8FA", scale: 2 });
      if (kind === "png") {
        const link = document.createElement("a");
        link.download = `bao-gia-${quoteCode}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
      } else {
        const { jsPDF } = await import("jspdf");
        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF({ orientation: "p", unit: "px", format: [canvas.width, canvas.height] });
        pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
        pdf.save(`bao-gia-${quoteCode}.pdf`);
      }
    } finally {
      setExporting(null);
    }
  }

  return (
    <div ref={reportRef} className="mx-auto w-full max-w-5xl bg-[#F7F8FA] p-6 text-[#1F2933]">
      <header className="mb-6 border-b border-[#1F2933]/10 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#F5A623]">Công Thảnh · Báo giá điện mặt trời</p>
            <h1 className="mt-1 text-2xl font-bold text-[#1B3A4B]">Máy tính & báo giá hệ thống</h1>
          </div>
          <div className="rounded-md bg-[#1B3A4B] px-3 py-1.5 text-xs font-mono text-white">#{quoteCode}</div>
        </div>
      </header>

      <div className="mb-6 grid grid-cols-1 gap-4 rounded-lg border border-[#1F2933]/10 bg-white p-5 md:grid-cols-2">
        <TextField label="Tên khách hàng" value={customerName} onChange={setCustomerName} placeholder="Anh/Chị Khách Hàng" />
        <TextField label="SĐT khách" value={customerPhone} onChange={setCustomerPhone} placeholder="09xx xxx xxx" />
        <TextField label="Địa danh công trình" value={siteAddress} onChange={setSiteAddress} placeholder="VD: Long Xuyên, An Giang" />
        <div className="grid grid-cols-2 gap-4">
          <TextField label="Tên sale" value={saleName} onChange={setSaleName} placeholder="Tên bạn" />
          <TextField label="SĐT sale" value={salePhone} onChange={setSalePhone} placeholder="09xx xxx xxx" />
        </div>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-2">
        {(Object.keys(SYSTEM_LABEL) as SystemType[]).map((key) => {
          const active = systemType === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSystemType(key)}
              className={["rounded-lg border px-3 py-3 text-left transition-colors", active ? "border-[#F5A623] bg-[#1B3A4B] text-white" : "border-[#1F2933]/15 bg-white text-[#1F2933] hover:border-[#F5A623]/60"].join(" ")}
            >
              <div className="text-sm font-semibold">{SYSTEM_LABEL[key].title}</div>
              <div className={["mt-0.5 text-xs", active ? "text-white/70" : "text-[#1F2933]/60"].join(" ")}>{SYSTEM_LABEL[key].desc}</div>
            </button>
          );
        })}
      </div>

      {result.recommendation.suggestedType && (
        <div className={["mb-6 rounded-lg border-l-4 p-4 text-sm", result.recommendation.matchesSelection ? "border-[#2E8B57] bg-[#2E8B57]/10" : "border-[#F5A623] bg-[#F5A623]/10"].join(" ")}>
          <div className="font-semibold">
            {result.recommendation.matchesSelection ? "✓ Lựa chọn phù hợp" : `⚠ Gợi ý: nên xem xét ${SYSTEM_LABEL[result.recommendation.suggestedType].title}`}
          </div>
          <p className="mt-1 text-[#1F2933]/80">{result.recommendation.message}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-[#1F2933]/10 bg-white p-5">
          <label className="block text-sm font-medium">Loại khách hàng điện</label>
          <p className="mt-0.5 text-xs text-[#1F2933]/50">
            Sinh hoạt (1 pha/3 pha) dùng chung 1 biểu giá bậc thang. Sản xuất/Kinh doanh tính theo cấp điện áp + khung giờ.
          </p>
          <select
            value={customerType}
            onChange={(e) => {
              setCustomerType(e.target.value as CustomerType);
              setVoltageIndex(0);
            }}
            className="mt-2 w-full rounded-md border border-[#1F2933]/20 px-3 py-2"
          >
            <option value="sinh_hoat">Sinh hoạt (hộ gia đình, 1 pha/3 pha)</option>
            <option value="san_xuat">Sản xuất (nhà xưởng, nhà máy)</option>
            <option value="kinh_doanh">Kinh doanh (cửa hàng, dịch vụ)</option>
          </select>

          {customerType !== "sinh_hoat" && (
            <div className="mt-4 space-y-4 rounded-md bg-[#F7F8FA] p-4">
              <div>
                <label className="block text-sm font-medium">Cấp điện áp đấu nối</label>
                <select value={voltageIndex} onChange={(e) => setVoltageIndex(Number(e.target.value))} className="mt-2 w-full rounded-md border border-[#1F2933]/20 px-3 py-2">
                  {voltageList.map((v, i) => (
                    <option key={v.voltageLabel} value={i}>
                      {v.voltageLabel}
                    </option>
                  ))}
                </select>
              </div>
              <SliderField label={`% giờ cao điểm: ${peakPercent}%`} value={peakPercent} min={0} max={100 - offPeakPercent} onChange={setPeakPercent} accent="#F5A623" />
              <SliderField label={`% giờ thấp điểm: ${offPeakPercent}%`} value={offPeakPercent} min={0} max={100 - peakPercent} onChange={setOffPeakPercent} accent="#2E8B57" />
            </div>
          )}

          <div className="mt-5 flex items-center justify-between">
            <label className="block text-sm font-medium">Nhập theo</label>
            <button type="button" onClick={refreshTariff} disabled={tariffStatus === "loading"} className="text-xs font-medium text-[#1B3A4B] underline-offset-2 hover:underline disabled:opacity-50">
              {tariffStatus === "loading" ? "Đang cập nhật…" : "↻ Cập nhật bảng giá EVN"}
            </button>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <ToggleButton active={inputMode === "bill"} onClick={() => setInputMode("bill")} label="Tiền điện (VNĐ)" />
            <ToggleButton active={inputMode === "kwh"} onClick={() => setInputMode("kwh")} label="Số kWh" />
          </div>

          {inputMode === "bill" ? (
            <>
              <label className="mt-4 block text-sm font-medium">Số tiền hoá đơn trung bình / tháng (VNĐ, đã gồm VAT)</label>
              <input type="number" min={0} step={1000} value={monthlyBillVnd} onChange={(e) => setMonthlyBillVnd(Number(e.target.value) || 0)} className="mt-2 w-full rounded-md border border-[#1F2933]/20 px-3 py-2 font-mono text-lg" />
              <p className="mt-1 text-xs text-[#1F2933]/50">
                ≈ <span className="font-mono">{monthlyKwh}</span> kWh/tháng · hiệu lực từ {tariff.effectiveFrom}
              </p>
            </>
          ) : (
            <>
              <label className="mt-4 block text-sm font-medium">Sản lượng tiêu thụ trung bình / tháng (kWh)</label>
              <input type="number" min={0} value={monthlyKwhRaw} onChange={(e) => setMonthlyKwhRaw(Number(e.target.value) || 0)} className="mt-2 w-full rounded-md border border-[#1F2933]/20 px-3 py-2 font-mono text-lg" />
              <p className="mt-1 text-xs text-[#1F2933]/50">≈ <span className="font-mono">{vnd(estimatedBillVnd)}</span>/tháng</p>
            </>
          )}

          <SliderField
            label={`Tỷ lệ dùng điện ban ngày: ${dayUsagePercent}% (đêm: ${100 - dayUsagePercent}%)`}
            value={dayUsagePercent}
            min={0}
            max={100}
            onChange={setDayUsagePercent}
            accent="#F5A623"
            className="mt-5"
          />

          {systemType !== "off_grid" && (
            <SliderField label={`Mức bù hoá đơn mong muốn: ${offsetPercent}%`} value={offsetPercent} min={20} max={100} onChange={setOffsetPercent} accent="#F5A623" className="mt-5" />
          )}

          {systemType !== "on_grid" && (
            <div className="mt-5 space-y-4 rounded-md bg-[#F7F8FA] p-4">
              <div>
                <label className="block text-sm font-medium">Loại pin lưu trữ</label>
                <select value={batteryType} onChange={(e) => setBatteryType(e.target.value as BatteryType)} className="mt-2 w-full rounded-md border border-[#1F2933]/20 px-3 py-2">
                  <option value="lithium">Lithium (DoD 90%)</option>
                  <option value="acid">Acid / chì (DoD 50%)</option>
                </select>
              </div>
              {systemType === "off_grid" && (
                <SliderField label={`Số ngày tự trị: ${autonomyDays} ngày`} value={autonomyDays} min={0.5} max={3} step={0.5} onChange={setAutonomyDays} accent="#2E8B57" />
              )}
              {systemType === "hybrid" && (
                <>
                  <SliderField label={`Số giờ backup: ${backupHours} giờ`} value={backupHours} min={1} max={12} onChange={setBackupHours} accent="#2E8B57" />
                  <SliderField label={`% tải ban đêm cần backup: ${backupLoadPercent}%`} value={backupLoadPercent} min={10} max={100} step={5} onChange={setBackupLoadPercent} accent="#2E8B57" />
                </>
              )}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-[#1B3A4B]/20 bg-[#1B3A4B] p-5 text-white">
          <div className="text-xs uppercase tracking-[0.2em] text-white/50">Công suất hệ thống đề xuất</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-5xl font-bold tabular-nums text-[#F5A623]">{result.pvSizeKwp}</span>
            <span className="text-lg text-white/70">kWp</span>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <Stat label="Số tấm pin" value={`${result.panelCount} tấm`} />
            <Stat label="Công suất Inverter" value={`${result.inverterSizeKw} kW`} />
            <Stat label="Tiêu thụ / ngày" value={`${result.dailyKwh} kWh`} />
            <Stat label="Tiêu thụ ban ngày" value={`${result.dayKwh} kWh`} />
            <Stat label="Tiêu thụ ban đêm" value={`${result.nightKwh} kWh`} />
            {result.batteryCapacityKwh !== null && <Stat label="Dung lượng pin" value={`${result.batteryCapacityKwh} kWh`} accent="#2E8B57" />}
          </div>
          <div className="mt-5 space-y-1.5 border-t border-white/15 pt-4">
            {result.notes.map((note, i) => (
              <p key={i} className="text-xs leading-relaxed text-white/60">· {note}</p>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-bold text-[#1B3A4B]">Phương án thiết bị gợi ý</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          <AdvisoryCard title="Điện áp / số pha" value={result.equipmentAdvisory.phase.recommended} reason={result.equipmentAdvisory.phase.reason} />
          <AdvisoryCard title="Loại Inverter" value={result.equipmentAdvisory.inverterType.label} reason={result.equipmentAdvisory.inverterType.reason} />
          <AdvisoryCard
            title="Loại pin lưu trữ"
            value={result.equipmentAdvisory.batteryChemistry.recommended === "lithium" ? "Lithium (LFP)" : result.equipmentAdvisory.batteryChemistry.recommended === "acid" ? "Acid / chì" : "Không cần pin"}
            reason={result.equipmentAdvisory.batteryChemistry.reason}
          />
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-bold text-[#1B3A4B]">Chọn combo thiết bị cho báo giá</h2>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
          {(Object.keys(MOUNTING_FACTOR) as MountingType[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setMountingType(key)}
              className={["rounded-lg border px-3 py-2 text-left text-sm transition-colors", mountingType === key ? "border-[#F5A623] bg-[#1B3A4B] text-white" : "border-[#1F2933]/15 bg-white hover:border-[#F5A623]/60"].join(" ")}
            >
              <div className="font-semibold">{MOUNTING_FACTOR[key].label}</div>
              <div className={mountingType === key ? "mt-0.5 text-xs text-white/70" : "mt-0.5 text-xs text-[#1F2933]/60"}>{MOUNTING_FACTOR[key].note}</div>
            </button>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
          {comboResults.map((cr) => {
            const active = cr.combo.id === selectedComboId;
            return (
              <button
                key={cr.combo.id}
                type="button"
                onClick={() => setSelectedComboId(cr.combo.id)}
                className={["rounded-lg border p-4 text-left transition-colors", active ? "border-[#F5A623] ring-2 ring-[#F5A623]/40" : "border-[#1F2933]/10 hover:border-[#F5A623]/50", "bg-white"].join(" ")}
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-[#1B3A4B]">{cr.combo.name}</div>
                  {active && <span className="rounded-full bg-[#F5A623] px-2 py-0.5 text-[10px] font-semibold text-white">ĐANG CHỌN</span>}
                </div>
                <div className="text-xs text-[#1F2933]/50">
                  {cr.combo.panelBrand} {cr.combo.panelWattage}W · {cr.combo.inverterBrand} · {cr.combo.batteryBrand}
                </div>
                <div className="mt-3 space-y-2 text-sm">
                  <Row label={`Tấm pin (${cr.panelAreaM2} m²/tấm)`} value={`${cr.panelCount} tấm`} />
                  <Row label="Diện tích mái cần lắp" value={`${cr.installedAreaM2} m²`} accent="#F5A623" />
                  <Row label="Inverter" value={`${cr.inverterCapacityKw} kW`} />
                  {cr.batteryModuleCount !== null && <Row label="Pin lưu trữ" value={`${cr.batteryModuleCount} module`} />}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-bold text-[#1B3A4B]">Bảng kê vật tư & báo giá</h2>
        <p className="mt-1 text-xs text-[#1F2933]/50">Nhập đơn giá từng hạng mục — số lượng đã tự tính theo công suất.</p>
        <div className="mt-3 overflow-x-auto rounded-lg border border-[#1F2933]/10 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1F2933]/10 bg-[#F7F8FA] text-left text-xs uppercase text-[#1F2933]/50">
                <th className="px-3 py-2">Hạng mục</th>
                <th className="px-3 py-2">Hãng</th>
                <th className="px-3 py-2 text-right">SL</th>
                <th className="px-3 py-2 text-right">Đơn giá (đ)</th>
                <th className="px-3 py-2 text-right">Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-b border-[#1F2933]/5">
                  <td className="px-3 py-2">{it.label}</td>
                  <td className="px-3 py-2 text-[#1F2933]/60">{it.brandModel}</td>
                  <td className="px-3 py-2 text-right font-mono">
                    {it.id === "dc_cable" ? (
                      <input type="number" min={0} value={dcCableM} onChange={(e) => setDcCableM(Number(e.target.value) || 0)} className="w-16 rounded border border-[#1F2933]/20 px-1 py-0.5 text-right font-mono" />
                    ) : it.id === "ac_cable" ? (
                      <input type="number" min={0} value={acCableM} onChange={(e) => setAcCableM(Number(e.target.value) || 0)} className="w-16 rounded border border-[#1F2933]/20 px-1 py-0.5 text-right font-mono" />
                    ) : it.id === "shipping" ? (
                      <input type="number" min={0} value={shippingTrips} onChange={(e) => setShippingTrips(Number(e.target.value) || 0)} className="w-16 rounded border border-[#1F2933]/20 px-1 py-0.5 text-right font-mono" />
                    ) : (
                      `${it.qty}${it.unit === "kWp" ? " kWp" : ""}`
                    )}
                    {it.id !== "dc_cable" && it.id !== "ac_cable" && it.id !== "shipping" ? "" : ` ${it.unit}`}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      value={it.unitPriceVnd || ""}
                      placeholder="0"
                      onChange={(e) => setUnitPrice(it.id, Number(e.target.value) || 0)}
                      className="w-28 rounded border border-[#1F2933]/20 px-2 py-1 text-right font-mono"
                    />
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-medium">{vnd(itemTotal(it))}</td>
                </tr>
              ))}
              <tr className="border-t border-[#1F2933]/10">
                <td colSpan={4} className="px-3 py-2 text-right font-medium">Tổng trước chiết khấu</td>
                <td className="px-3 py-2 text-right font-mono font-semibold">{vnd(sub)}</td>
              </tr>
              <tr className="bg-[#F5A623]/10">
                <td colSpan={3} className="px-3 py-2 text-right font-medium">Chiết khấu thương mại</td>
                <td className="px-3 py-2 text-right">
                  <input type="number" min={0} max={100} value={discountPercent} onChange={(e) => setDiscountPercent(Number(e.target.value) || 0)} className="w-16 rounded border border-[#1F2933]/20 px-2 py-1 text-right font-mono" />%
                </td>
                <td className="px-3 py-2 text-right font-mono">-{vnd(sub - totalPayment)}</td>
              </tr>
              <tr className="bg-[#2E8B57]/10">
                <td colSpan={4} className="px-3 py-2 text-right text-base font-bold">TỔNG THANH TOÁN</td>
                <td className="px-3 py-2 text-right font-mono text-base font-bold text-[#2E8B57]">{vnd(totalPayment)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-bold text-[#1B3A4B]">Phân tích tài chính (ROI)</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <MetricCard label="Sản lượng bù/tháng" value={`${Math.round(monthlyKwh * (systemType === "off_grid" ? 1 : offsetPercent / 100))} kWh`} />
          <MetricCard label="Tiết kiệm/tháng" value={vnd(savingsPerMonth)} accent="#2E8B57" />
          <MetricCard label="Tổng đầu tư" value={vnd(totalPayment)} />
          <MetricCard label="Hoàn vốn (không vay)" value={paybackYears === Infinity ? "—" : `${paybackYears} năm`} accent="#F5A623" />
        </div>

        <div className="mt-4 rounded-lg border border-[#F5A623]/30 bg-[#F5A623]/5 p-4">
          <div className="text-sm font-semibold text-[#1B3A4B]">🏦 Phương án vay & hoàn vốn</div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <NumberField label="Tỉ lệ vay (%)" value={loanPercent} onChange={setLoanPercent} />
            <NumberField label="Lãi vay (%/năm)" value={interestRatePercent} onChange={setInterestRatePercent} />
            <div className="rounded-md bg-white p-3 text-sm">
              <div className="text-xs text-[#1F2933]/50">Hoàn vốn (có vay)</div>
              <div className="mt-1 font-mono text-lg font-bold text-[#F5A623]">{loan.paybackWithLoanYears === Infinity ? "—" : `${loan.paybackWithLoanYears} năm`}</div>
            </div>
          </div>
          <p className="mt-3 text-xs text-[#1F2933]/60">
            Vốn tự có {vnd(loan.ownCapitalVnd)} · Vay {vnd(loan.loanAmountVnd)} · Lãi năm 1 {vnd(loan.year1InterestVnd)} · Net năm 1 {vnd(loan.netYear1Vnd)}
          </p>
          <p className="mt-1 text-xs text-[#1F2933]/40">Hoàn vốn = vốn tự có ÷ (tiết kiệm năm 1 − lãi vay năm 1). Ước tính đơn giản, chưa tính trả gốc dần theo lịch vay thực tế.</p>
        </div>

        <div className="mt-4 rounded-lg border border-[#1F2933]/10 bg-white">
          <div className="border-b border-[#1F2933]/10 bg-[#1B3A4B] px-4 py-2 text-sm font-semibold text-white">Bảng khấu hao tài sản (đường thẳng)</div>
          <div className="flex items-center justify-end gap-2 px-4 pt-3 text-xs">
            <span>Số năm khấu hao</span>
            <input type="number" min={1} max={30} value={depreciationYears} onChange={(e) => setDepreciationYears(Number(e.target.value) || 1)} className="w-14 rounded border border-[#1F2933]/20 px-2 py-1 text-right font-mono" />
          </div>
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-[#1F2933]/50">
                <th className="px-4 py-2">Hạng mục</th>
                <th className="px-4 py-2 text-right">Nguyên giá</th>
                <th className="px-4 py-2 text-right">KH/năm</th>
                <th className="px-4 py-2 text-right">KH/tháng</th>
              </tr>
            </thead>
            <tbody>
              {depreciationRows.map((r) => (
                <tr key={r.label} className="border-t border-[#1F2933]/5">
                  <td className="px-4 py-2">{r.label}</td>
                  <td className="px-4 py-2 text-right font-mono">{vnd(r.originalValueVnd)}</td>
                  <td className="px-4 py-2 text-right font-mono">{vnd(r.perYearVnd)}</td>
                  <td className="px-4 py-2 text-right font-mono">{vnd(r.perMonthVnd)}</td>
                </tr>
              ))}
              <tr className="border-t border-[#1F2933]/10 font-semibold">
                <td className="px-4 py-2" colSpan={2}>Tổng khấu hao/năm</td>
                <td className="px-4 py-2 text-right font-mono">{vnd(totalDepreciationPerYear)}</td>
                <td className="px-4 py-2 text-right font-mono">{vnd(totalDepreciationPerMonth)}</td>
              </tr>
            </tbody>
          </table>
          <p className="px-4 pb-3 text-xs text-[#1F2933]/40">Khấu hao đường thẳng, giá trị thanh lý = 0. Chỉ tham khảo kế toán nội bộ.</p>
        </div>

        <div className="mt-4 rounded-lg border border-[#1F2933]/10 bg-white p-4">
          <div className="text-sm font-semibold text-[#1B3A4B]">% IRR — So sánh đầu tư</div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-md bg-[#F7F8FA] p-3">
              <div className="text-xs text-[#1F2933]/50">IRR dự án (25 năm)</div>
              <div className="mt-1 font-mono text-lg font-bold text-[#1B3A4B]">{irr === null ? "—" : `${irr}%/năm`}</div>
            </div>
            <NumberField label="Lãi vay NH (%/năm)" value={interestRatePercent} onChange={setInterestRatePercent} />
            <NumberField label="Gửi TK (%/năm)" value={bankSavingsRatePercent} onChange={setBankSavingsRatePercent} />
            <div className="rounded-md bg-[#F7F8FA] p-3">
              <div className="text-xs text-[#1F2933]/50">Kết luận</div>
              <div className="mt-1 text-sm font-bold text-[#2E8B57]">{irrConclusion}</div>
            </div>
          </div>
          <p className="mt-2 text-xs text-[#1F2933]/40">Ước tính dựa trên dòng tiền tiết kiệm điện 25 năm, có tính lạm phát giá điện và suy hao tấm pin ~0,5%/năm.</p>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-bold text-[#1B3A4B]">Giả lập giá điện 10 năm tới & CO₂</h2>
        <div className="mt-3 rounded-lg border border-[#1F2933]/10 bg-white">
          <div className="flex items-center justify-between border-b border-[#1F2933]/10 bg-[#1B3A4B] px-4 py-2">
            <span className="text-sm font-semibold text-white">Bảng dự báo</span>
            <div className="flex items-center gap-2 text-xs text-white">
              <span>Lạm phát</span>
              <input type="number" min={0} max={30} value={inflationPercent} onChange={(e) => setInflationPercent(Number(e.target.value) || 0)} className="w-14 rounded border-none px-2 py-1 text-right font-mono text-[#1F2933]" />
              <span>%/năm</span>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-[#1F2933]/50">
                <th className="px-4 py-2">Năm</th>
                <th className="px-4 py-2 text-right">Giá TB (đ/kWh)</th>
                <th className="px-4 py-2 text-right">Tiết kiệm/năm</th>
                <th className="px-4 py-2 text-right">Luỹ kế</th>
              </tr>
            </thead>
            <tbody>
              {projection10Y.map((r) => (
                <tr key={r.year} className="border-t border-[#1F2933]/5">
                  <td className="px-4 py-2">Năm {r.year}</td>
                  <td className="px-4 py-2 text-right font-mono">{r.avgPriceVndPerKwh.toLocaleString("vi-VN")}</td>
                  <td className="px-4 py-2 text-right font-mono text-[#2E8B57]">{vnd(r.savingsThisYearVnd)}</td>
                  <td className="px-4 py-2 text-right font-mono font-semibold">{vnd(r.cumulativeSavingsVnd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <MetricCard label="CO₂ / năm" value={`${carbon.co2TonPerYear} tấn`} accent="#2E8B57" />
          <MetricCard label="CO₂ / 25 năm" value={`${carbon.co2Ton25Year} tấn`} accent="#2E8B57" />
          <MetricCard label="Giá trị tín chỉ / năm" value={vnd(carbon.creditValuePerYearVnd)} />
          <MetricCard label="Giá trị tín chỉ / 25 năm" value={vnd(carbon.creditValue25YearVnd)} />
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <NumberField label="Giá tín chỉ carbon (USD/tCO₂)" value={carbonPriceUsd} onChange={setCarbonPriceUsd} />
          <NumberField label="Tỷ giá (đ/USD)" value={usdVndRate} onChange={setUsdVndRate} />
        </div>
        <p className="mt-2 text-xs text-[#1F2933]/40">Tín chỉ thị trường tự nguyện (VCM) — tham khảo, chưa phải cam kết đăng ký dự án. Hệ số lưới ≈ 0,661 kg CO₂/kWh.</p>
      </div>

      <div className="mt-8 flex gap-3">
        <button type="button" onClick={() => handleExport("png")} disabled={exporting !== null} className="flex-1 rounded-lg bg-[#2E8B57] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">
          {exporting === "png" ? "Đang xuất…" : "🖼 Xuất PNG"}
        </button>
        <button type="button" onClick={() => handleExport("pdf")} disabled={exporting !== null} className="flex-1 rounded-lg bg-[#1B3A4B] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">
          {exporting === "pdf" ? "Đang xuất…" : "📄 Xuất PDF"}
        </button>
      </div>
    </div>
  );
}

function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium">{label}</label>
      <input type="text" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="mt-2 w-full rounded-md border border-[#1F2933]/20 px-3 py-2" />
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="rounded-md bg-white p-3 text-sm">
      <label className="block text-xs text-[#1F2933]/50">{label}</label>
      <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value) || 0)} className="mt-1 w-full rounded border border-[#1F2933]/20 px-2 py-1 font-mono" />
    </div>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step = 5,
  onChange,
  accent,
  className = "",
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  accent: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium">{label}</label>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-2 w-full" style={{ accentColor: accent }} />
    </div>
  );
}

function ToggleButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className={["rounded-md border px-3 py-2 text-sm font-medium", active ? "border-[#F5A623] bg-[#1B3A4B] text-white" : "border-[#1F2933]/15 bg-white"].join(" ")}>
      {label}
    </button>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex justify-between border-b border-[#1F2933]/5 pb-2">
      <span className="text-[#1F2933]/60">{label}</span>
      <span className="font-mono font-medium" style={accent ? { color: accent } : undefined}>
        {value}
      </span>
    </div>
  );
}

function AdvisoryCard({ title, value, reason }: { title: string; value: string; reason: string }) {
  return (
    <div className="rounded-lg border border-[#1F2933]/10 bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-[#1F2933]/50">{title}</div>
      <div className="mt-1 text-base font-semibold text-[#1B3A4B]">{value}</div>
      <p className="mt-2 text-xs leading-relaxed text-[#1F2933]/60">{reason}</p>
    </div>
  );
}

function MetricCard({ label, value, accent = "#1B3A4B" }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-lg border border-[#1F2933]/10 bg-white p-3">
      <div className="text-xs text-[#1F2933]/50">{label}</div>
      <div className="mt-1 font-mono text-base font-bold" style={{ color: accent }}>
        {value}
      </div>
    </div>
  );
}

function Stat({ label, value, accent = "#F5A623" }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-md bg-white/5 p-3">
      <div className="text-[11px] text-white/50">{label}</div>
      <div className="mt-0.5 font-mono text-base font-semibold tabular-nums" style={{ color: accent }}>
        {value}
      </div>
    </div>
  );
}
