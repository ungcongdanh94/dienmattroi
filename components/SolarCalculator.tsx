"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  calculateSolarSystem,
  FIXED_PEAK_SUN_HOURS,
  type BatteryType,
  type SystemType,
} from "@/lib/solar-calculator";
import {
  MOUNTING_FACTOR,
  computeEquipmentSelection,
  findCabinetTier,
  type MountingType,
  type EquipmentCatalog,
  type PanelSpec,
  type InverterSpec,
  type BatterySpec,
} from "@/lib/catalog-types";
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

const FALLBACK_CATALOG: EquipmentCatalog = {
  panels: [{ id: "aiko-655", brand: "AIKO", wattage: 655, lengthMm: 2382, widthMm: 1134, priceVnd: 0 }],
  inverters: [{ id: "solis-5", brand: "Solis", phase: "1_pha", capacityKw: 5, priceVnd: 0 }],
  batteries: [{ id: "dyness-14336", brand: "Dyness", moduleKwh: 14.336, priceVnd: 0 }],
  otherPricing: {
    framePerKwpApMai: 0,
    framePerKwpGiaDoNghieng: 0,
    dcCablePerMeter: 0,
    acCablePerMeter: 0,
    dcCableMetersPerKwp: 3,
    acCableMetersPerKwp: 1.5,
    cabinetTiers: [
      { id: "cab-1pha-3-12", phase: "1_pha", minKwp: 3, maxKwp: 12, priceVnd: 0 },
      { id: "cab-3pha-8-20", phase: "3_pha", minKwp: 8, maxKwp: 20, priceVnd: 0 },
      { id: "cab-3pha-25-50", phase: "3_pha", minKwp: 25, maxKwp: 50, priceVnd: 0 },
    ],
    laborPerKwp: 0,
    shippingPerTrip: 0,
  },
};

const vnd = (n: number) => Math.round(n).toLocaleString("vi-VN") + " đ";
const round1 = (n: number) => Math.round(n * 10) / 10;

export default function SolarCalculator() {
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
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
  const [catalog, setCatalog] = useState<EquipmentCatalog>(FALLBACK_CATALOG);
  const [panelBrand, setPanelBrand] = useState<string>(FALLBACK_CATALOG.panels[0].brand);
  const [panelId, setPanelId] = useState<string>(FALLBACK_CATALOG.panels[0].id);
  const [inverterBrand, setInverterBrand] = useState<string>(FALLBACK_CATALOG.inverters[0].brand);
  const [inverterPhase, setInverterPhase] = useState<"1_pha" | "3_pha">(FALLBACK_CATALOG.inverters[0].phase);
  const [inverterId, setInverterId] = useState<string>(FALLBACK_CATALOG.inverters[0].id);
  const [batteryBrand, setBatteryBrand] = useState<string>(FALLBACK_CATALOG.batteries[0].brand);
  const [batteryId, setBatteryId] = useState<string>(FALLBACK_CATALOG.batteries[0].id);

  useEffect(() => {
    fetch("/api/catalog")
      .then((r) => r.json())
      .then((data: Partial<EquipmentCatalog>) => {
        if (!data?.panels?.length) return;
        const safe: EquipmentCatalog = {
          panels: data.panels,
          inverters: data.inverters?.length ? data.inverters : FALLBACK_CATALOG.inverters,
          batteries: data.batteries?.length ? data.batteries : FALLBACK_CATALOG.batteries,
          otherPricing: { ...FALLBACK_CATALOG.otherPricing, ...(data.otherPricing ?? {}) },
        };
        setCatalog(safe);
        setPanelBrand(safe.panels[0].brand);
        setPanelId(safe.panels[0].id);
        setInverterBrand(safe.inverters[0]?.brand ?? "");
        setInverterPhase(safe.inverters[0]?.phase ?? "1_pha");
        setInverterId(safe.inverters[0]?.id ?? "");
        setBatteryBrand(safe.batteries[0]?.brand ?? "");
        setBatteryId(safe.batteries[0]?.id ?? "");
      })
      .catch(() => {});
  }, []);

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
  const [customerView, setCustomerView] = useState<boolean>(false);

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

  const panelBrands = useMemo(() => Array.from(new Set(catalog.panels.map((p) => p.brand))), [catalog]);
  const inverterBrands = useMemo(() => Array.from(new Set(catalog.inverters.map((i) => i.brand))), [catalog]);
  const batteryBrands = useMemo(() => Array.from(new Set(catalog.batteries.map((b) => b.brand))), [catalog]);

  const panelsForBrand = catalog.panels.filter((p) => p.brand === panelBrand);
  const invertersForBrand = catalog.inverters.filter((i) => i.brand === inverterBrand && i.phase === inverterPhase);
  const batteriesForBrand = catalog.batteries.filter((b) => b.brand === batteryBrand);

  const selectedPanel: PanelSpec | undefined = panelsForBrand.find((p) => p.id === panelId) ?? panelsForBrand[0];
  const selectedInverter: InverterSpec | undefined = invertersForBrand.find((i) => i.id === inverterId) ?? invertersForBrand[0];
  const selectedBattery: BatterySpec | undefined = batteriesForBrand.find((b) => b.id === batteryId) ?? batteriesForBrand[0];

  function handlePanelBrandChange(brand: string) {
    setPanelBrand(brand);
    const first = catalog.panels.find((p) => p.brand === brand);
    if (first) setPanelId(first.id);
  }
  function handleInverterBrandChange(brand: string) {
    setInverterBrand(brand);
    const first = catalog.inverters.find((i) => i.brand === brand && i.phase === inverterPhase) ?? catalog.inverters.find((i) => i.brand === brand);
    if (first) {
      setInverterId(first.id);
      setInverterPhase(first.phase);
    }
  }
  function handleInverterPhaseChange(phase: "1_pha" | "3_pha") {
    setInverterPhase(phase);
    const first = catalog.inverters.find((i) => i.brand === inverterBrand && i.phase === phase);
    if (first) setInverterId(first.id);
  }
  function handleBatteryBrandChange(brand: string) {
    setBatteryBrand(brand);
    const first = catalog.batteries.find((b) => b.brand === brand);
    if (first) setBatteryId(first.id);
  }

  const inverterMeetsRequirement = selectedInverter ? selectedInverter.capacityKw >= result.inverterSizeKw : false;

  const equipment = useMemo(
    () =>
      selectedPanel
        ? computeEquipmentSelection(
            selectedPanel,
            result.batteryCapacityKwh !== null ? selectedBattery ?? null : null,
            result.pvSizeKwp,
            result.batteryCapacityKwh,
            mountingType,
          )
        : null,
    [selectedPanel, selectedBattery, result, mountingType],
  );

  const items: QuoteItem[] = useMemo(() => {
    if (!selectedPanel || !selectedInverter || !equipment) return [];

    // Công suất THỰC LẮP (số tấm × công suất/tấm) — dùng cho khung/cáp/tủ điện/nhân công,
    // vì thường lớn hơn công suất yêu cầu (result.pvSizeKwp) do làm tròn số tấm lên.
    const actualCapacityKwp = (equipment.panelCount * selectedPanel.wattage) / 1000;

    const list: QuoteItem[] = [
      {
        id: "panel",
        label: `Tấm pin ${selectedPanel.wattage}Wp`,
        brandModel: selectedPanel.brand,
        qty: equipment.panelCount,
        unit: "tấm",
        unitPriceVnd: selectedPanel.priceVnd,
      },
      {
        id: "inverter",
        label: `Inverter ${selectedInverter.capacityKw}kW ${selectedInverter.phase === "1_pha" ? "1 pha" : "3 pha"}`,
        brandModel: selectedInverter.brand,
        qty: 1,
        unit: "bộ",
        unitPriceVnd: selectedInverter.priceVnd,
      },
    ];
    if (equipment.batteryModuleCount !== null && selectedBattery) {
      list.push({
        id: "battery",
        label: `Pin ${selectedBattery.moduleKwh}kWh`,
        brandModel: selectedBattery.brand,
        qty: equipment.batteryModuleCount,
        unit: "bộ",
        unitPriceVnd: selectedBattery.priceVnd,
      });
    }
    const op = catalog.otherPricing;
    const dcCableM = Math.max(1, Math.round(actualCapacityKwp * op.dcCableMetersPerKwp));
    const acCableM = Math.max(1, Math.round(actualCapacityKwp * op.acCableMetersPerKwp));
    list.push(
      {
        id: "frame",
        label: "Khung/giá đỡ",
        brandModel: MOUNTING_FACTOR[mountingType].label,
        qty: round1(actualCapacityKwp),
        unit: "kWp",
        unitPriceVnd: mountingType === "ap_mai" ? op.framePerKwpApMai : op.framePerKwpGiaDoNghieng,
      },
      { id: "dc_cable", label: "Cáp DC (dự toán)", brandModel: "-", qty: dcCableM, unit: "m", unitPriceVnd: op.dcCablePerMeter },
      { id: "ac_cable", label: "Cáp AC (dự toán)", brandModel: "-", qty: acCableM, unit: "m", unitPriceVnd: op.acCablePerMeter },
      {
        id: "ac_dc_cabinet",
        label: "Tủ điện AC/DC",
        brandModel: selectedInverter
          ? `${selectedInverter.phase === "1_pha" ? "1 pha" : "3 pha"} · ${round1(actualCapacityKwp)} kWp`
          : "-",
        qty: 1,
        unit: "hệ",
        unitPriceVnd: selectedInverter
          ? findCabinetTier(op.cabinetTiers, selectedInverter.phase, actualCapacityKwp)?.priceVnd ?? 0
          : 0,
      },
      { id: "labor", label: "Nhân công", brandModel: "-", qty: round1(actualCapacityKwp), unit: "kWp", unitPriceVnd: op.laborPerKwp },
      { id: "shipping", label: "Vận chuyển", brandModel: "-", qty: shippingTrips, unit: "chuyến", unitPriceVnd: op.shippingPerTrip },
    );
    return list;
  }, [equipment, selectedPanel, selectedInverter, selectedBattery, mountingType, shippingTrips, catalog.otherPricing]);

  const sub = subtotal(items);
  const totalPayment = totalAfterDiscount(sub, discountPercent);

  const savingsPerMonth = monthlySavingsVnd({ systemType, currentBillVnd: estimatedBillVnd, offsetPercent });
  const savingsPerYear = savingsPerMonth * 12;
  const paybackYears = simplePaybackYears(totalPayment, savingsPerMonth);
  const loan = calculateLoan({ totalInvestmentVnd: totalPayment, loanPercent, interestRatePercent, annualSavingsVnd: savingsPerYear });

  const hasBatteryItem = items.some((it) => it.id === "battery");
  const depreciationRows = calculateDepreciation(
    items.length === 0
      ? []
      : [
          { label: "Tấm pin (PV)", valueVnd: itemTotal(items[0]) },
          { label: "Inverter", valueVnd: itemTotal(items[1]) },
          ...(hasBatteryItem ? [{ label: "Pin lưu trữ", valueVnd: itemTotal(items[2]) }] : []),
          {
            label: "Khung/cáp/tủ/NC/ship",
            valueVnd: items.slice(hasBatteryItem ? 3 : 2).reduce((s, it) => s + itemTotal(it), 0),
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

      // Lưu lại báo giá này vào hệ thống (xem được trong /admin)
      fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteCode,
          customerName,
          customerPhone,
          siteAddress,
          systemType,
          pvSizeKwp: result.pvSizeKwp,
          panelBrand: selectedPanel?.brand ?? "",
          inverterBrand: selectedInverter?.brand ?? "",
          batteryBrand: selectedBattery?.brand ?? null,
          totalPaymentVnd: totalPayment,
          exportKind: kind,
        }),
      }).catch(() => {});
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="min-h-screen bg-surface font-body text-ink">
      <div ref={reportRef} className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-line pb-6">
          <div>
            <div className="text-sm font-medium text-navy/70">Công Thảnh</div>
            <h1 className="font-display mt-1 text-[28px] font-semibold leading-tight text-navy sm:text-3xl">
              Máy tính &amp; báo giá điện mặt trời
            </h1>
          </div>
          <div className="rounded-md border border-line bg-white px-3 py-1.5 font-mono text-xs text-ink/60">
            #{quoteCode}
          </div>
        </header>

        {/* Customer info */}
        <section className="mb-8 rounded-2xl border border-line bg-white p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Tên khách hàng" value={customerName} onChange={setCustomerName} placeholder="Anh/Chị Khách Hàng" />
            <Field label="Số điện thoại khách" value={customerPhone} onChange={setCustomerPhone} placeholder="09xx xxx xxx" />
            <Field label="Địa chỉ công trình" value={siteAddress} onChange={setSiteAddress} placeholder="Long Xuyên, An Giang" />
          </div>
        </section>

        {/* System type */}
        <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {(Object.keys(SYSTEM_LABEL) as SystemType[]).map((key) => {
            const active = systemType === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSystemType(key)}
                className={[
                  "rounded-xl border px-4 py-3 text-left transition-colors",
                  active ? "border-navy bg-navy text-white" : "border-line bg-white text-ink hover:border-navy/40",
                ].join(" ")}
              >
                <div className="font-display text-[15px] font-semibold">{SYSTEM_LABEL[key].title}</div>
                <div className={["mt-0.5 text-[13px]", active ? "text-white/70" : "text-ink/55"].join(" ")}>
                  {SYSTEM_LABEL[key].desc}
                </div>
              </button>
            );
          })}
        </div>

        {result.recommendation.suggestedType && (
          <div
            className={[
              "mb-8 rounded-xl border p-4 text-sm",
              result.recommendation.matchesSelection ? "border-energy/30 bg-energy/[0.06]" : "border-gold/40 bg-gold/[0.08]",
            ].join(" ")}
          >
            <div className="font-medium text-ink">
              {result.recommendation.matchesSelection
                ? "Lựa chọn phù hợp"
                : `Đáng cân nhắc: ${SYSTEM_LABEL[result.recommendation.suggestedType].title}`}
            </div>
            <p className="mt-1 text-ink/70">{result.recommendation.message}</p>
          </div>
        )}

        {/* Form + sticky meter */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
          {/* Left: inputs */}
          <div className="space-y-6 rounded-2xl border border-line bg-white p-6">
            <div>
              <h2 className="font-display text-[15px] font-semibold text-navy">Loại khách hàng điện</h2>
              <p className="mt-1 text-[13px] text-ink/55">
                Sinh hoạt (1 pha/3 pha) dùng chung 1 biểu giá bậc thang. Sản xuất/Kinh doanh tính theo cấp điện áp và khung giờ.
              </p>
              <select
                value={customerType}
                onChange={(e) => {
                  setCustomerType(e.target.value as CustomerType);
                  setVoltageIndex(0);
                }}
                className="mt-3 w-full rounded-lg border border-line px-3.5 py-2.5 text-sm focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/10"
              >
                <option value="sinh_hoat">Sinh hoạt (hộ gia đình, 1 pha/3 pha)</option>
                <option value="san_xuat">Sản xuất (nhà xưởng, nhà máy)</option>
                <option value="kinh_doanh">Kinh doanh (cửa hàng, dịch vụ)</option>
              </select>

              {customerType !== "sinh_hoat" && (
                <div className="mt-4 space-y-4 rounded-xl bg-surface p-4">
                  <div>
                    <Label>Cấp điện áp đấu nối</Label>
                    <select
                      value={voltageIndex}
                      onChange={(e) => setVoltageIndex(Number(e.target.value))}
                      className="mt-2 w-full rounded-lg border border-line px-3.5 py-2.5 text-sm focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/10"
                    >
                      {voltageList.map((v, i) => (
                        <option key={v.voltageLabel} value={i}>
                          {v.voltageLabel}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Slider label={`Giờ cao điểm: ${peakPercent}%`} value={peakPercent} min={0} max={100 - offPeakPercent} onChange={setPeakPercent} accent="#E8A33D" />
                  <Slider label={`Giờ thấp điểm: ${offPeakPercent}%`} value={offPeakPercent} min={0} max={100 - peakPercent} onChange={setOffPeakPercent} accent="#2F8F5B" />
                </div>
              )}
            </div>

            <div className="border-t border-line pt-6">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-[15px] font-semibold text-navy">Sản lượng tiêu thụ</h2>
                <button
                  type="button"
                  onClick={refreshTariff}
                  disabled={tariffStatus === "loading"}
                  className="text-xs font-medium text-navy/70 underline-offset-2 hover:text-navy hover:underline disabled:opacity-50"
                >
                  {tariffStatus === "loading" ? "Đang cập nhật…" : "Cập nhật bảng giá EVN"}
                </button>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <ToggleButton active={inputMode === "bill"} onClick={() => setInputMode("bill")} label="Tiền điện (VNĐ)" />
                <ToggleButton active={inputMode === "kwh"} onClick={() => setInputMode("kwh")} label="Số kWh" />
              </div>

              {inputMode === "bill" ? (
                <>
                  <Label className="mt-4">Hoá đơn trung bình / tháng (đã gồm VAT)</Label>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={monthlyBillVnd}
                    onChange={(e) => setMonthlyBillVnd(Number(e.target.value) || 0)}
                    className="mt-2 w-full rounded-lg border border-line px-3.5 py-2.5 font-mono text-lg focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/10"
                  />
                  <p className="mt-1.5 text-[13px] text-ink/50">
                    ≈ <span className="font-mono text-ink/70">{monthlyKwh}</span> kWh/tháng · biểu giá hiệu lực từ {tariff.effectiveFrom}
                  </p>
                </>
              ) : (
                <>
                  <Label className="mt-4">Sản lượng trung bình / tháng</Label>
                  <input
                    type="number"
                    min={0}
                    value={monthlyKwhRaw}
                    onChange={(e) => setMonthlyKwhRaw(Number(e.target.value) || 0)}
                    className="mt-2 w-full rounded-lg border border-line px-3.5 py-2.5 font-mono text-lg focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/10"
                  />
                  <p className="mt-1.5 text-[13px] text-ink/50">≈ <span className="font-mono text-ink/70">{vnd(estimatedBillVnd)}</span>/tháng</p>
                </>
              )}

              <Slider
                label={`Dùng ban ngày: ${dayUsagePercent}% · ban đêm ${100 - dayUsagePercent}%`}
                value={dayUsagePercent}
                min={0}
                max={100}
                onChange={setDayUsagePercent}
                accent="#E8A33D"
                className="mt-5"
              />

              {systemType !== "off_grid" && (
                <Slider label={`Mức bù hoá đơn: ${offsetPercent}%`} value={offsetPercent} min={20} max={100} onChange={setOffsetPercent} accent="#E8A33D" className="mt-5" />
              )}
            </div>

            {systemType !== "on_grid" && (
              <div className="border-t border-line pt-6">
                <h2 className="font-display text-[15px] font-semibold text-navy">Pin lưu trữ</h2>
                <div className="mt-3 space-y-4 rounded-xl bg-surface p-4">
                  <div>
                    <Label>Loại pin</Label>
                    <select
                      value={batteryType}
                      onChange={(e) => setBatteryType(e.target.value as BatteryType)}
                      className="mt-2 w-full rounded-lg border border-line px-3.5 py-2.5 text-sm focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/10"
                    >
                      <option value="lithium">Lithium (DoD 90%)</option>
                      <option value="acid">Acid / chì (DoD 50%)</option>
                    </select>
                  </div>
                  {systemType === "off_grid" && (
                    <Slider label={`Số ngày tự trị: ${autonomyDays} ngày`} value={autonomyDays} min={0.5} max={3} step={0.5} onChange={setAutonomyDays} accent="#2F8F5B" />
                  )}
                  {systemType === "hybrid" && (
                    <>
                      <Slider label={`Số giờ backup: ${backupHours} giờ`} value={backupHours} min={1} max={12} onChange={setBackupHours} accent="#2F8F5B" />
                      <Slider label={`Tải ban đêm cần backup: ${backupLoadPercent}%`} value={backupLoadPercent} min={10} max={100} step={5} onChange={setBackupLoadPercent} accent="#2F8F5B" />
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right: sticky meter readout */}
          <div className="lg:sticky lg:top-6">
            <div className="rounded-2xl bg-navy p-6 text-white">
              <div className="text-[13px] text-white/55">Công suất hệ thống đề xuất</div>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className="font-mono text-[44px] font-semibold leading-none tabular-nums text-gold">{result.pvSizeKwp}</span>
                <span className="text-base text-white/60">kWp</span>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2.5 text-sm">
                <Readout label="Số tấm pin" value={`${result.panelCount} tấm`} />
                <Readout label="Inverter" value={`${result.inverterSizeKw} kW`} />
                <Readout label="Tiêu thụ/ngày" value={`${result.dailyKwh} kWh`} />
                <Readout label="Ban ngày" value={`${result.dayKwh} kWh`} />
                <Readout label="Ban đêm" value={`${result.nightKwh} kWh`} />
                {result.batteryCapacityKwh !== null && <Readout label="Pin lưu trữ" value={`${result.batteryCapacityKwh} kWh`} accent="#2F8F5B" />}
              </div>

              <div className="mt-5 space-y-1.5 border-t border-white/10 pt-4">
                {result.notes.map((note, i) => (
                  <p key={i} className="text-[12.5px] leading-relaxed text-white/50">
                    {note}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Equipment advisory */}
        <section className="mt-8">
          <h2 className="font-display text-lg font-semibold text-navy">Phương án thiết bị gợi ý</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <AdvisoryCard title="Điện áp / số pha" value={result.equipmentAdvisory.phase.recommended} reason={result.equipmentAdvisory.phase.reason} />
            <AdvisoryCard title="Loại inverter" value={result.equipmentAdvisory.inverterType.label} reason={result.equipmentAdvisory.inverterType.reason} />
            <AdvisoryCard
              title="Loại pin lưu trữ"
              value={
                result.equipmentAdvisory.batteryChemistry.recommended === "lithium"
                  ? "Lithium (LFP)"
                  : result.equipmentAdvisory.batteryChemistry.recommended === "acid"
                    ? "Acid / chì"
                    : "Không cần pin"
              }
              reason={result.equipmentAdvisory.batteryChemistry.reason}
            />
          </div>
        </section>

        {/* Equipment selection */}
        <section className="mt-8">
          <h2 className="font-display text-lg font-semibold text-navy">Chọn combo thiết bị</h2>
          <p className="mt-1 text-[13px] text-ink/55">Chọn riêng từng loại thiết bị — diện tích tính theo kích thước tấm pin thật.</p>

          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(Object.keys(MOUNTING_FACTOR) as MountingType[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setMountingType(key)}
                className={[
                  "rounded-xl border px-4 py-2.5 text-left text-sm transition-colors",
                  mountingType === key ? "border-navy bg-navy text-white" : "border-line bg-white text-ink hover:border-navy/40",
                ].join(" ")}
              >
                <div className="font-medium">{MOUNTING_FACTOR[key].label}</div>
                <div className={mountingType === key ? "mt-0.5 text-xs text-white/65" : "mt-0.5 text-xs text-ink/50"}>{MOUNTING_FACTOR[key].note}</div>
              </button>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-6 rounded-2xl border border-line bg-white p-5 sm:grid-cols-3">
            {/* Tấm pin */}
            <div className="space-y-3">
              <div>
                <Label>Thương hiệu tấm pin</Label>
                <select
                  value={panelBrand}
                  onChange={(e) => handlePanelBrandChange(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-line px-3.5 py-2.5 text-sm focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/10"
                >
                  {panelBrands.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Công suất tấm pin</Label>
                <select
                  value={panelId}
                  onChange={(e) => setPanelId(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-line px-3.5 py-2.5 text-sm focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/10"
                >
                  {panelsForBrand.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.wattage} Wp
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Inverter */}
            <div className="space-y-3">
              <div>
                <Label>Thương hiệu inverter</Label>
                <select
                  value={inverterBrand}
                  onChange={(e) => handleInverterBrandChange(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-line px-3.5 py-2.5 text-sm focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/10"
                >
                  {inverterBrands.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Số pha</Label>
                <select
                  value={inverterPhase}
                  onChange={(e) => handleInverterPhaseChange(e.target.value as "1_pha" | "3_pha")}
                  className="mt-2 w-full rounded-lg border border-line px-3.5 py-2.5 text-sm focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/10"
                >
                  <option value="1_pha">1 pha</option>
                  <option value="3_pha">3 pha</option>
                </select>
              </div>
              <div>
                <Label>Công suất inverter</Label>
                <select
                  value={inverterId}
                  onChange={(e) => setInverterId(e.target.value)}
                  className={[
                    "mt-2 w-full rounded-lg border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2",
                    inverterMeetsRequirement ? "border-line focus:border-navy focus:ring-navy/10" : "border-red-400 focus:border-red-500 focus:ring-red-100",
                  ].join(" ")}
                >
                  {invertersForBrand.length === 0 && <option value="">Không có model phù hợp</option>}
                  {invertersForBrand.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.capacityKw} kW
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Pin lưu trữ */}
            <div className="space-y-3">
              <div>
                <Label>Thương hiệu pin lưu trữ</Label>
                <select
                  value={batteryBrand}
                  onChange={(e) => handleBatteryBrandChange(e.target.value)}
                  disabled={result.batteryCapacityKwh === null}
                  className="mt-2 w-full rounded-lg border border-line px-3.5 py-2.5 text-sm focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/10 disabled:bg-surface disabled:text-ink/40"
                >
                  {batteryBrands.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Công suất pin lưu trữ</Label>
                <select
                  value={batteryId}
                  onChange={(e) => setBatteryId(e.target.value)}
                  disabled={result.batteryCapacityKwh === null}
                  className="mt-2 w-full rounded-lg border border-line px-3.5 py-2.5 text-sm focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/10 disabled:bg-surface disabled:text-ink/40"
                >
                  {batteriesForBrand.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.moduleKwh} kWh
                    </option>
                  ))}
                </select>
                {result.batteryCapacityKwh === null && <p className="mt-1.5 text-xs text-ink/40">Hệ on-grid không cần pin.</p>}
              </div>
            </div>
          </div>

          {!inverterMeetsRequirement && selectedInverter && (
            <div className="mt-3 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">
              <strong>Lỗi:</strong> Inverter {selectedInverter.brand} {selectedInverter.capacityKw}kW không đủ công suất —
              hệ thống cần tối thiểu <strong>{result.inverterSizeKw} kW</strong>. Vui lòng chọn công suất lớn hơn.
            </div>
          )}

          {equipment && selectedPanel && selectedInverter && (
            <div className="mt-4 rounded-2xl border border-line bg-white p-5">
              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-4">
                <Row label={`Tấm pin (${equipment.panelAreaM2} m²/tấm)`} value={`${equipment.panelCount} tấm`} />
                <Row label="Diện tích mái cần lắp" value={`${equipment.installedAreaM2} m²`} accent="#F4B63F" />
                <Row label="Inverter" value={`${selectedInverter.capacityKw} kW · ${selectedInverter.phase === "1_pha" ? "1 pha" : "3 pha"}`} accent={inverterMeetsRequirement ? undefined : "#DC2626"} />
                {equipment.batteryModuleCount !== null && <Row label="Pin lưu trữ" value={`${equipment.batteryModuleCount} module`} />}
              </div>
            </div>
          )}
        </section>

        {/* Quote table */}
        <section className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold text-navy">Bảng kê vật tư &amp; báo giá</h2>
            <button
              type="button"
              onClick={() => setCustomerView((v) => !v)}
              className={[
                "rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors",
                customerView ? "border-navy bg-navy text-white" : "border-line bg-white text-ink/70 hover:border-navy/40",
              ].join(" ")}
            >
              {customerView ? "Đang xem: Khách hàng (chỉ tổng tiền)" : "Đang xem: Nội bộ (đầy đủ chi tiết)"}
            </button>
          </div>
          <p className="mt-1 text-[13px] text-ink/55">
            Toàn bộ đơn giá được quản lý tại{" "}
            <a href="/admin" target="_blank" rel="noreferrer" className="text-solarblue underline-offset-2 hover:underline">
              bảng giá quản trị
            </a>
            . Số mét cáp DC/AC tự tính theo mức phổ biến (dự toán).
          </p>

          {customerView ? (
            <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-white">
              <div className="border-b border-line bg-navy px-6 py-4 text-white">
                <div className="text-sm text-white/60">Combo: {selectedPanel?.brand} {selectedPanel?.wattage}Wp · {selectedInverter?.brand} {selectedInverter?.capacityKw}kW{selectedBattery && equipment?.batteryModuleCount !== null ? ` · Pin ${selectedBattery.brand}` : ""}</div>
                <div className="mt-1 text-xs text-white/40">Báo giá dự toán, đã bao gồm thiết bị, khung/giá đỡ, dây dẫn, nhân công và vận chuyển.</div>
              </div>
              <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-3">
                <MetricCard label="Công suất hệ thống" value={`${result.pvSizeKwp} kWp`} />
                <MetricCard label="Số tấm pin" value={`${equipment?.panelCount ?? 0} tấm`} />
                <MetricCard label="Tiết kiệm/tháng ước tính" value={vnd(savingsPerMonth)} accent="#27A36A" />
              </div>
              <div className="border-t border-line bg-energy/[0.06] px-6 py-5">
                <div className="text-xs text-ink/50">Tổng thanh toán (dự toán)</div>
                <div className="mt-1 font-mono text-2xl font-bold text-energy">{vnd(totalPayment)}</div>
                {discountPercent > 0 && <div className="mt-1 text-xs text-ink/40">Đã áp dụng chiết khấu {discountPercent}%</div>}
              </div>
            </div>
          ) : (
          <div className="mt-3 overflow-x-auto rounded-2xl border border-line bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[13px] text-ink/50">
                  <th className="px-4 py-3 font-medium">Hạng mục</th>
                  <th className="px-4 py-3 font-medium">Hãng</th>
                  <th className="px-4 py-3 text-right font-medium">Số lượng</th>
                  <th className="px-4 py-3 text-right font-medium">Đơn giá</th>
                  <th className="px-4 py-3 text-right font-medium">Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-b border-line/70 last:border-0">
                    <td className="px-4 py-3">{it.label}</td>
                    <td className="px-4 py-3 text-ink/55">{it.brandModel}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      {it.id === "shipping" ? (
                        <>
                          <input type="number" min={0} value={shippingTrips} onChange={(e) => setShippingTrips(Number(e.target.value) || 0)} className="w-16 rounded-md border border-line px-1.5 py-1 text-right font-mono" /> {it.unit}
                        </>
                      ) : it.id === "dc_cable" || it.id === "ac_cable" ? (
                        `${it.qty} ${it.unit}`
                      ) : (
                        `${it.qty}${it.unit === "kWp" ? " kWp" : ""}`
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-mono text-ink/70">{vnd(it.unitPriceVnd)}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-medium">{vnd(itemTotal(it))}</td>
                  </tr>
                ))}
                <tr className="border-t border-line">
                  <td colSpan={4} className="px-4 py-3 text-right text-ink/70">Tổng trước chiết khấu</td>
                  <td className="px-4 py-3 text-right font-mono font-medium">{vnd(sub)}</td>
                </tr>
                <tr className="bg-gold/[0.06]">
                  <td colSpan={3} className="px-4 py-3 text-right text-ink/70">Chiết khấu thương mại</td>
                  <td className="px-4 py-3 text-right">
                    <input type="number" min={0} max={100} value={discountPercent} onChange={(e) => setDiscountPercent(Number(e.target.value) || 0)} className="w-16 rounded-md border border-line px-2.5 py-1.5 text-right font-mono" />%
                  </td>
                  <td className="px-4 py-3 text-right font-mono">-{vnd(sub - totalPayment)}</td>
                </tr>
                <tr className="bg-energy/[0.08]">
                  <td colSpan={4} className="px-4 py-3 text-right text-[15px] font-semibold text-navy">Tổng thanh toán</td>
                  <td className="px-4 py-3 text-right font-mono text-[15px] font-semibold text-energy">{vnd(totalPayment)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          )}
        </section>

        {/* Financial analysis */}
        <section className="mt-8">
          <h2 className="font-display text-lg font-semibold text-navy">Phân tích tài chính</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard label="Sản lượng bù/tháng" value={`${Math.round(monthlyKwh * (systemType === "off_grid" ? 1 : offsetPercent / 100))} kWh`} />
            <MetricCard label="Tiết kiệm/tháng" value={vnd(savingsPerMonth)} accent="#2F8F5B" />
            <MetricCard label="Tổng đầu tư" value={vnd(totalPayment)} />
            <MetricCard label="Hoàn vốn" value={paybackYears === Infinity ? "—" : `${paybackYears} năm`} accent="#E8A33D" />
          </div>

          <div className="mt-4 rounded-2xl border border-line bg-white p-5">
            <div className="font-medium text-navy">Phương án vay &amp; hoàn vốn</div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <NumberField label="Tỉ lệ vay (%)" value={loanPercent} onChange={setLoanPercent} />
              <NumberField label="Lãi vay (%/năm)" value={interestRatePercent} onChange={setInterestRatePercent} />
              <div className="rounded-xl bg-surface p-3">
                <div className="text-xs text-ink/50">Hoàn vốn (có vay)</div>
                <div className="mt-1 font-mono text-lg font-semibold text-gold">{loan.paybackWithLoanYears === Infinity ? "—" : `${loan.paybackWithLoanYears} năm`}</div>
              </div>
            </div>
            <p className="mt-3 text-[13px] text-ink/55">
              Vốn tự có {vnd(loan.ownCapitalVnd)} · Vay {vnd(loan.loanAmountVnd)} · Lãi năm 1 {vnd(loan.year1InterestVnd)} · Net năm 1 {vnd(loan.netYear1Vnd)}
            </p>
            <p className="mt-1.5 text-xs text-ink/40">Hoàn vốn = vốn tự có ÷ (tiết kiệm năm 1 − lãi vay năm 1). Ước tính đơn giản, chưa tính trả gốc dần theo lịch vay thực tế.</p>
          </div>

          <div className="mt-4 rounded-2xl border border-line bg-white">
            <div className="flex items-center justify-between border-b border-line px-5 py-3">
              <div className="font-medium text-navy">Khấu hao tài sản (đường thẳng)</div>
              <div className="flex items-center gap-2 text-xs text-ink/55">
                <span>Số năm</span>
                <input type="number" min={1} max={30} value={depreciationYears} onChange={(e) => setDepreciationYears(Number(e.target.value) || 1)} className="w-14 rounded-md border border-line px-2 py-1 text-right font-mono" />
              </div>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[13px] text-ink/50">
                  <th className="px-5 py-2.5 font-medium">Hạng mục</th>
                  <th className="px-5 py-2.5 text-right font-medium">Nguyên giá</th>
                  <th className="px-5 py-2.5 text-right font-medium">KH/năm</th>
                  <th className="px-5 py-2.5 text-right font-medium">KH/tháng</th>
                </tr>
              </thead>
              <tbody>
                {depreciationRows.map((r) => (
                  <tr key={r.label} className="border-t border-line/70">
                    <td className="px-5 py-2.5">{r.label}</td>
                    <td className="px-5 py-2.5 text-right font-mono">{vnd(r.originalValueVnd)}</td>
                    <td className="px-5 py-2.5 text-right font-mono">{vnd(r.perYearVnd)}</td>
                    <td className="px-5 py-2.5 text-right font-mono">{vnd(r.perMonthVnd)}</td>
                  </tr>
                ))}
                <tr className="border-t border-line font-medium">
                  <td className="px-5 py-2.5" colSpan={2}>Tổng khấu hao/năm</td>
                  <td className="px-5 py-2.5 text-right font-mono">{vnd(totalDepreciationPerYear)}</td>
                  <td className="px-5 py-2.5 text-right font-mono">{vnd(totalDepreciationPerMonth)}</td>
                </tr>
              </tbody>
            </table>
            <p className="px-5 pb-4 pt-2 text-xs text-ink/40">Khấu hao đường thẳng, giá trị thanh lý = 0. Chỉ tham khảo kế toán nội bộ.</p>
          </div>

          <div className="mt-4 rounded-2xl border border-line bg-white p-5">
            <div className="font-medium text-navy">IRR — so sánh đầu tư</div>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl bg-surface p-3">
                <div className="text-xs text-ink/50">IRR dự án (25 năm)</div>
                <div className="mt-1 font-mono text-lg font-semibold text-navy">{irr === null ? "—" : `${irr}%/năm`}</div>
              </div>
              <NumberField label="Lãi vay NH (%/năm)" value={interestRatePercent} onChange={setInterestRatePercent} />
              <NumberField label="Gửi tiết kiệm (%/năm)" value={bankSavingsRatePercent} onChange={setBankSavingsRatePercent} />
              <div className="rounded-xl bg-surface p-3">
                <div className="text-xs text-ink/50">Kết luận</div>
                <div className="mt-1 text-sm font-semibold text-energy">{irrConclusion}</div>
              </div>
            </div>
            <p className="mt-2 text-xs text-ink/40">Ước tính dựa trên dòng tiền tiết kiệm điện 25 năm, có tính lạm phát giá điện và suy hao tấm pin ~0,5%/năm.</p>
          </div>
        </section>

        {/* 10-year projection & CO2 */}
        <section className="mt-8">
          <h2 className="font-display text-lg font-semibold text-navy">Giả lập giá điện 10 năm tới &amp; CO₂</h2>
          <div className="mt-3 rounded-2xl border border-line bg-white">
            <div className="flex items-center justify-between border-b border-line px-5 py-3">
              <div className="font-medium text-navy">Dự báo tiết kiệm</div>
              <div className="flex items-center gap-2 text-xs text-ink/55">
                <span>Lạm phát</span>
                <input type="number" min={0} max={30} value={inflationPercent} onChange={(e) => setInflationPercent(Number(e.target.value) || 0)} className="w-14 rounded-md border border-line px-2 py-1 text-right font-mono" />
                <span>%/năm</span>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[13px] text-ink/50">
                  <th className="px-5 py-2.5 font-medium">Năm</th>
                  <th className="px-5 py-2.5 text-right font-medium">Giá TB (đ/kWh)</th>
                  <th className="px-5 py-2.5 text-right font-medium">Tiết kiệm/năm</th>
                  <th className="px-5 py-2.5 text-right font-medium">Luỹ kế</th>
                </tr>
              </thead>
              <tbody>
                {projection10Y.map((r) => (
                  <tr key={r.year} className="border-t border-line/70">
                    <td className="px-5 py-2.5">Năm {r.year}</td>
                    <td className="px-5 py-2.5 text-right font-mono">{r.avgPriceVndPerKwh.toLocaleString("vi-VN")}</td>
                    <td className="px-5 py-2.5 text-right font-mono text-energy">{vnd(r.savingsThisYearVnd)}</td>
                    <td className="px-5 py-2.5 text-right font-mono font-medium">{vnd(r.cumulativeSavingsVnd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard label="CO₂ / năm" value={`${carbon.co2TonPerYear} tấn`} accent="#2F8F5B" />
            <MetricCard label="CO₂ / 25 năm" value={`${carbon.co2Ton25Year} tấn`} accent="#2F8F5B" />
            <MetricCard label="Giá trị tín chỉ / năm" value={vnd(carbon.creditValuePerYearVnd)} />
            <MetricCard label="Giá trị tín chỉ / 25 năm" value={vnd(carbon.creditValue25YearVnd)} />
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <NumberField label="Giá tín chỉ carbon (USD/tCO₂)" value={carbonPriceUsd} onChange={setCarbonPriceUsd} />
            <NumberField label="Tỷ giá (đ/USD)" value={usdVndRate} onChange={setUsdVndRate} />
          </div>
          <p className="mt-2 text-xs text-ink/40">Tín chỉ thị trường tự nguyện (VCM) — tham khảo, chưa phải cam kết đăng ký dự án. Hệ số lưới ≈ 0,661 kg CO₂/kWh.</p>
        </section>

        {/* Export */}
        <div className="mt-8 flex gap-3">
          <button
            type="button"
            onClick={() => handleExport("png")}
            disabled={exporting !== null}
            className="flex-1 rounded-xl bg-energy px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {exporting === "png" ? "Đang xuất…" : "Xuất PNG"}
          </button>
          <button
            type="button"
            onClick={() => handleExport("pdf")}
            disabled={exporting !== null}
            className="flex-1 rounded-xl bg-navy px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {exporting === "pdf" ? "Đang xuất…" : "Xuất PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- UI primitives ----------

function Label({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <label className={`block text-sm font-medium text-ink ${className}`}>{children}</label>;
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-lg border border-line px-3.5 py-2.5 text-sm focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/10"
      />
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="rounded-xl bg-surface p-3">
      <div className="text-xs text-ink/50">{label}</div>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="mt-1 w-full rounded-md border border-line bg-white px-2.5 py-1.5 font-mono focus:border-navy focus:outline-none"
      />
    </div>
  );
}

function Slider({
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
      <Label>{label}</Label>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-2 w-full" style={{ accentColor: accent }} />
    </div>
  );
}

function ToggleButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={["rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors", active ? "border-navy bg-navy text-white" : "border-line bg-white text-ink hover:border-navy/40"].join(" ")}
    >
      {label}
    </button>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex justify-between border-b border-line/60 pb-2 last:border-0 last:pb-0">
      <span className="text-ink/55">{label}</span>
      <span className="font-mono font-medium" style={accent ? { color: accent } : undefined}>
        {value}
      </span>
    </div>
  );
}

function AdvisoryCard({ title, value, reason }: { title: string; value: string; reason: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <div className="text-[13px] text-ink/50">{title}</div>
      <div className="mt-1 font-display text-base font-semibold text-navy">{value}</div>
      <p className="mt-2 text-[13px] leading-relaxed text-ink/55">{reason}</p>
    </div>
  );
}

function MetricCard({ label, value, accent = "#14324A" }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-line bg-white p-3.5">
      <div className="text-xs text-ink/50">{label}</div>
      <div className="mt-1 font-mono text-[15px] font-semibold" style={{ color: accent }}>
        {value}
      </div>
    </div>
  );
}

function Readout({ label, value, accent = "#E8A33D" }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-lg bg-white/[0.06] p-2.5">
      <div className="text-[11px] text-white/50">{label}</div>
      <div className="mt-0.5 font-mono text-[15px] font-semibold tabular-nums" style={{ color: accent }}>
        {value}
      </div>
    </div>
  );
}
