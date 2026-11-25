"use client";

import { useMemo, useState, type ReactNode } from "react";
import { PHASE_LABEL, type EquipmentCatalog, type InverterKind } from "@/lib/catalog-types";
import { TOU_SCHEDULE, type EvnTariff } from "@/lib/evn-tariff";
import {
  calculateStorageArbitrage,
  projectStorage,
  suggestStorageConfig,
  DEFAULT_C_RATE,
  DEFAULT_STORAGE_PARAMS,
  type StorageLimit,
  type StorageParams,
} from "@/lib/storage-arbitrage";
import { itemTotal, subtotal, totalAfterDiscount, type QuoteItem } from "@/lib/quote-financials";
import { COMPANY } from "@/lib/site-data";
import type { QuoteExportData } from "@/lib/quote-export";

const KIND_LABEL: Record<InverterKind, string> = { on_grid: "Hoà lưới", hybrid: "Hybrid", off_grid: "Off-grid" };
const SYSTEM_LABEL = "Chỉ lưu trữ (không tấm pin)";

const vnd = (n: number) => Math.round(n).toLocaleString("vi-VN") + " đ";
const round1 = (n: number) => Math.round(n * 10) / 10;
const num1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString("vi-VN");

const LIMIT_TEXT: Record<StorageLimit, string> = {
  battery: "Dung lượng pin đang là yếu tố giới hạn — tăng số pin để xả được nhiều hơn.",
  inverter_discharge: "Công suất inverter đang giới hạn lượng điện xả trong 5 giờ cao điểm — tăng inverter hoặc giảm số pin.",
  inverter_charge: "Công suất inverter đang giới hạn lượng điện sạc trong 6 giờ thấp điểm — tăng inverter.",
  dc_discharge: "Công suất xả DC tối đa của pin đang giới hạn lượng điện xả trong 5 giờ cao điểm — tăng số pin hoặc nâng mức xả DC tối đa.",
  dc_charge: "Công suất sạc DC tối đa của pin đang giới hạn lượng điện sạc trong 6 giờ thấp điểm — tăng số pin hoặc nâng mức sạc DC tối đa.",
  load: "Pin đã đủ bù hết điện dùng giờ cao điểm của khách; thêm pin sẽ không tăng thêm tiết kiệm.",
  none: "",
};

function NumInput({ value, onChange, className, min, max, step }: { value: number; onChange: (v: number) => void; className?: string; min?: number; max?: number; step?: number }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      type="number"
      inputMode="decimal"
      min={min}
      max={max}
      step={step}
      value={draft ?? String(value)}
      onChange={(e) => {
        const raw = e.target.value;
        setDraft(raw.replace(/^(-?)0+(?=\d)/, "$1"));
        const n = Number(raw);
        onChange(raw === "" || Number.isNaN(n) ? 0 : n);
      }}
      onBlur={() => setDraft(null)}
      className={className}
    />
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

const selectCls = "mt-2 w-full rounded-lg border border-line px-3.5 py-2.5 text-sm focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/10";
const numCls = "mt-2 w-full rounded-lg border border-line px-3.5 py-2.5 font-mono text-sm focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/10";

export default function StorageOnlyCalculator({
  catalog,
  tariff,
  quoteCode,
  customerName,
  customerPhone,
  siteAddress,
  effectiveCustomerView,
  staffControls,
}: {
  catalog: EquipmentCatalog;
  tariff: EvnTariff;
  quoteCode: string;
  customerName: string;
  customerPhone: string;
  siteAddress: string;
  effectiveCustomerView: boolean;
  staffControls: ReactNode;
}) {
  const [group, setGroup] = useState<"kinh_doanh" | "san_xuat">("kinh_doanh");
  const [voltageIndex, setVoltageIndex] = useState(0);
  const [peakLoadKwhPerDay, setPeakLoadKwhPerDay] = useState(60);
  const [invBrand, setInvBrand] = useState("");
  const [invId, setInvId] = useState("");
  const [invQty, setInvQty] = useState(1);
  const [batBrand, setBatBrand] = useState("");
  const [batId, setBatId] = useState("");
  const [batQty, setBatQty] = useState(4);
  const [otherCostVnd, setOtherCostVnd] = useState(0);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [exporting, setExporting] = useState<"pdf" | "xlsx" | null>(null);

  // ----- Thông số kỹ thuật (hiệu chỉnh được) -----
  const [acToDcPct, setAcToDcPct] = useState<number>(DEFAULT_STORAGE_PARAMS.acToDcEff * 100);
  const [dcToAcPct, setDcToAcPct] = useState<number>(DEFAULT_STORAGE_PARAMS.dcToAcEff * 100);
  const [batteryEffPct, setBatteryEffPct] = useState<number>(DEFAULT_STORAGE_PARAMS.batteryRoundTripEff * 100);
  const [dodPct, setDodPct] = useState<number>(Math.round(DEFAULT_STORAGE_PARAMS.dod * 100));
  const [fadePctPerYear, setFadePctPerYear] = useState<number>(DEFAULT_STORAGE_PARAMS.annualFadePercent);
  const [chargeAuto, setChargeAuto] = useState(true);
  const [dischargeAuto, setDischargeAuto] = useState(true);
  const [maxChargeManualKw, setMaxChargeManualKw] = useState<number>(0);
  const [maxDischargeManualKw, setMaxDischargeManualKw] = useState<number>(0);

  // ----- Biểu giá -----
  const touList = group === "kinh_doanh" ? tariff.kinhDoanhByVoltage : tariff.sanXuatByVoltage;
  const tou = touList[voltageIndex] ?? touList[0];

  // ----- Thiết bị -----
  const inverterPool = useMemo(() => {
    const hybrid = catalog.inverters.filter((i) => i.kind === "hybrid");
    return hybrid.length > 0 ? hybrid : catalog.inverters;
  }, [catalog]);
  const invBrands = useMemo(() => Array.from(new Set(inverterPool.map((i) => i.brand))), [inverterPool]);
  const activeInvBrand = invBrands.includes(invBrand) ? invBrand : invBrands[0] ?? "";
  const invModels = inverterPool.filter((i) => i.brand === activeInvBrand);
  const inverter = invModels.find((i) => i.id === invId) ?? invModels[0];

  const batBrands = useMemo(() => Array.from(new Set(catalog.batteries.map((b) => b.brand))), [catalog]);
  const activeBatBrand = batBrands.includes(batBrand) ? batBrand : batBrands[0] ?? "";
  const batModels = catalog.batteries.filter((b) => b.brand === activeBatBrand);
  const battery = batModels.find((b) => b.id === batId) ?? batModels[0];

  const batteryKwh = battery ? battery.moduleKwh * Math.max(0, batQty) : 0;
  const inverterKw = inverter ? inverter.capacityKw * Math.max(0, invQty) : 0;

  const autoDcKw = Math.round(batteryKwh * DEFAULT_C_RATE * 10) / 10;
  const maxChargeDcKw = chargeAuto ? autoDcKw : maxChargeManualKw;
  const maxDischargeDcKw = dischargeAuto ? autoDcKw : maxDischargeManualKw;

  const params: StorageParams = useMemo(
    () => ({
      acToDcEff: acToDcPct / 100,
      dcToAcEff: dcToAcPct / 100,
      batteryRoundTripEff: batteryEffPct / 100,
      dod: dodPct / 100,
      annualFadePercent: fadePctPerYear,
      maxChargeDcKw,
      maxDischargeDcKw,
    }),
    [acToDcPct, dcToAcPct, batteryEffPct, dodPct, fadePctPerYear, maxChargeDcKw, maxDischargeDcKw],
  );

  const storageInput = useMemo(
    () => ({
      batteryNominalKwh: batteryKwh,
      inverterTotalKw: inverterKw,
      peakLoadKwhPerDay,
      offPeakPriceVnd: tou?.offPeak ?? 0,
      peakPriceVnd: tou?.peak ?? 0,
      vatRate: tariff.vatRate,
      params,
    }),
    [batteryKwh, inverterKw, peakLoadKwhPerDay, tou, tariff.vatRate, params],
  );
  const calc = useMemo(() => calculateStorageArbitrage(storageInput), [storageInput]);
  const suggestion = useMemo(
    () =>
      suggestStorageConfig({
        peakLoadKwhPerDay,
        batteryModuleKwh: battery?.moduleKwh ?? 0,
        inverterModelKw: inverter?.capacityKw ?? 0,
        params: { acToDcEff: params.acToDcEff, dcToAcEff: params.dcToAcEff, batteryRoundTripEff: params.batteryRoundTripEff, dod: params.dod, annualFadePercent: params.annualFadePercent },
        maxChargeDcKw: chargeAuto ? null : maxChargeManualKw,
        maxDischargeDcKw: dischargeAuto ? null : maxDischargeManualKw,
      }),
    [peakLoadKwhPerDay, battery, inverter, params, chargeAuto, dischargeAuto, maxChargeManualKw, maxDischargeManualKw],
  );

  // ----- Báo giá -----
  const items: QuoteItem[] = useMemo(() => {
    const list: QuoteItem[] = [];
    if (battery) {
      list.push({
        id: "battery",
        label: `Pin lưu trữ ${battery.moduleKwh}kWh`,
        brandModel: battery.brand,
        qty: Math.max(0, batQty),
        unit: "bộ",
        unitPriceVnd: battery.priceVnd,
        warranty: battery.warranty,
      });
    }
    if (inverter) {
      list.push({
        id: "inverter",
        label: `Inverter ${inverter.capacityKw}kW ${PHASE_LABEL[inverter.phase]}`,
        brandModel: inverter.brand,
        qty: Math.max(0, invQty),
        unit: "bộ",
        unitPriceVnd: inverter.priceVnd,
        warranty: inverter.warranty,
      });
    }
    if (otherCostVnd > 0) {
      list.push({ id: "other", label: "Tủ điện, cáp, nhân công, vận chuyển", brandModel: "-", qty: 1, unit: "gói", unitPriceVnd: otherCostVnd });
    }
    return list;
  }, [battery, inverter, batQty, invQty, otherCostVnd]);

  const sub = subtotal(items);
  const totalPayment = totalAfterDiscount(sub, discountPercent);
  const projection = useMemo(() => projectStorage(storageInput, totalPayment, 10, 25), [storageInput, totalPayment]);
  const paybackYears = projection.paybackYears;
  const effPct = Math.round(calc.totalEfficiency * 1000) / 10;

  const ecoNote =
    `Mua điện giờ thấp điểm (${tou ? vnd(tou.offPeak) : "-"}/kWh) để sạc pin, xả bù tải giờ cao điểm (${tou ? vnd(tou.peak) : "-"}/kWh), chưa VAT. ` +
    `Tính ${calc.dischargeKwhPerDay.toFixed(1)} kWh xả/ngày × ${TOU_SCHEDULE.peakDaysPerYear} ngày/năm (thứ Hai–thứ Bảy; Chủ nhật không có giờ cao điểm), giá đã gồm VAT 8%, hiệu suất cả chuỗi AC→DC→pin→AC ≈ ${effPct}%. ` +
    `Dung lượng pin suy giảm ${fadePctPerYear}%/năm nên tiết kiệm giảm dần; tổng tiết kiệm 10 năm ước tính ${vnd(projection.totalSavingsHorizonVnd)}, hoàn vốn tính theo từng năm.`;

  function buildExportData(): QuoteExportData | null {
    if (!battery || !inverter) return null;
    const t = new Date();
    const dateStr = `${String(t.getDate()).padStart(2, "0")}/${String(t.getMonth() + 1).padStart(2, "0")}/${t.getFullYear()}`;
    return {
      quoteCode,
      dateStr,
      customerName,
      customerPhone,
      siteAddress,
      systemLabel: SYSTEM_LABEL,
      docTitle: "BÁO GIÁ HỆ THỐNG LƯU TRỮ ĐIỆN",
      subtitle: `${SYSTEM_LABEL} · Dung lượng ${num1(batteryKwh)} kWh`,
      kpiTiles: [
        { label: "DUNG LƯỢNG LƯU TRỮ", value: num1(batteryKwh), unit: "kWh" },
        { label: "CÔNG SUẤT BIẾN TẦN", value: num1(inverterKw), unit: "kW" },
      ],
      ecoNote,
      notes: [
        "Bảo hành thiết bị theo chính sách của nhà sản xuất.",
        "Hệ thống không có tấm pin năng lượng mặt trời: pin được sạc từ lưới vào giờ thấp điểm (0h–6h) và xả bù tải vào giờ cao điểm (17h30–22h30, thứ Hai–thứ Bảy).",
        "Mức tiết kiệm là ước tính theo biểu giá điện hiện hành và lượng điện khách dùng trong giờ cao điểm; thực tế có thể thay đổi theo điều kiện sử dụng và thủ tục đấu nối với điện lực.",
      ],
      panel: null,
      inverter: {
        brand: inverter.brand,
        kindLabel: KIND_LABEL[inverter.kind],
        phaseLabel: PHASE_LABEL[inverter.phase],
        capacityKw: inverter.capacityKw,
        qty: Math.max(0, invQty),
        warranty: inverter.warranty,
      },
      battery: { brand: battery.brand, moduleKwh: battery.moduleKwh, qty: Math.max(0, batQty), warranty: battery.warranty },
      totalKwp: 0,
      savingsPerMonthVnd: Math.round(calc.savingsPerMonthVnd),
      savingsPerYearVnd: Math.round(calc.savingsPerYearVnd),
      paybackYears,
      offsetPercent: null,
      items,
      subtotalVnd: sub,
      discountPercent,
      totalPaymentVnd: totalPayment,
      showPrices: !effectiveCustomerView,
      company: COMPANY,
    };
  }

  function saveQuoteRecord(kind: "pdf" | "xlsx", snapshot: QuoteExportData) {
    fetch("/api/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quoteCode,
        customerName,
        customerPhone,
        siteAddress,
        systemType: "storage_only",
        pvSizeKwp: 0,
        panelBrand: "",
        inverterBrand: inverter?.brand ?? "",
        batteryBrand: battery?.brand ?? null,
        totalPaymentVnd: totalPayment,
        exportKind: kind,
        snapshot,
      }),
    }).catch(() => {});
  }

  async function handleExport(kind: "pdf" | "xlsx") {
    const data = buildExportData();
    if (!data) return;
    setExporting(kind);
    try {
      const { buildQuotePdf, buildQuoteXlsx, loadQuoteFonts } = await import("@/lib/quote-export");
      let blob: Blob;
      let filename: string;
      if (kind === "pdf") {
        const fonts = await loadQuoteFonts();
        const doc = await buildQuotePdf(data, fonts);
        blob = doc.output("blob");
        filename = `bao-gia-luu-tru-${quoteCode}.pdf`;
      } else {
        const buf = await buildQuoteXlsx(data);
        blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        filename = `bao-gia-luu-tru-${quoteCode}.xlsx`;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      saveQuoteRecord(kind, data);
    } catch (err) {
      console.error(err);
      alert("Không xuất được file báo giá, vui lòng thử lại.");
    } finally {
      setExporting(null);
    }
  }

  const peakWarn = peakLoadKwhPerDay <= 0;

  return (
    <div className="space-y-8">
      {/* Giới thiệu + biểu giá */}
      <section className="rounded-2xl border border-line bg-white p-6">
        <h2 className="font-display text-[15px] font-semibold text-navy">Mua điện thấp điểm – xả giờ cao điểm (không dùng tấm pin)</h2>
        <p className="mt-1 text-[13px] text-ink/55">
          Pin lưu trữ được sạc từ lưới vào giờ thấp điểm ({TOU_SCHEDULE.offPeakLabel}) và xả bù tải vào giờ cao điểm ({TOU_SCHEDULE.peakLabel}). Chỉ áp dụng cho khách sản xuất / kinh doanh có công tơ 3 giá — điện sinh hoạt không chia khung giờ.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-ink">Loại khách hàng điện</label>
            <select
              value={group}
              onChange={(e) => {
                setGroup(e.target.value as "kinh_doanh" | "san_xuat");
                setVoltageIndex(0);
              }}
              className={selectCls}
            >
              <option value="kinh_doanh">Kinh doanh</option>
              <option value="san_xuat">Sản xuất</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-ink">Nhóm giá / cấp điện áp</label>
            <select value={voltageIndex} onChange={(e) => setVoltageIndex(Number(e.target.value))} className={selectCls}>
              {touList.map((v, i) => (
                <option key={v.voltageLabel} value={i}>
                  {v.voltageLabel}
                </option>
              ))}
            </select>
          </div>
        </div>
        {tou && (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard label="Giá thấp điểm (chưa VAT)" value={`${tou.offPeak.toLocaleString("vi-VN")} đ/kWh`} accent="#27A36A" />
            <MetricCard label="Giá bình thường" value={`${tou.normal.toLocaleString("vi-VN")} đ/kWh`} />
            <MetricCard label="Giá cao điểm (chưa VAT)" value={`${tou.peak.toLocaleString("vi-VN")} đ/kWh`} accent="#C2410C" />
            <MetricCard label="Lãi thực mỗi kWh xả (năm 1)" value={`${Math.round(calc.spreadVndPerKwh).toLocaleString("vi-VN")} đ`} accent="#E8A33D" />
          </div>
        )}
        <p className="mt-2 text-xs text-ink/40">
          Lãi thực mỗi kWh = giá cao điểm − giá thấp điểm ÷ hiệu suất cả chuỗi ({effPct}%), chưa VAT.
        </p>
      </section>

      {/* Tải & thiết bị */}
      <section className="rounded-2xl border border-line bg-white p-6">
        <h2 className="font-display text-[15px] font-semibold text-navy">Nhu cầu &amp; thiết bị</h2>
        <div className="mt-4">
          <label className="block text-sm font-medium text-ink">Điện khách dùng trong giờ cao điểm mỗi ngày (kWh)</label>
          <NumInput min={0} step={1} value={peakLoadKwhPerDay} onChange={setPeakLoadKwhPerDay} className={numCls} />
          <p className="mt-1.5 text-xs text-ink/50">
            Pin chỉ xả bù phần điện khách đang dùng, không bán ngược lên lưới. Lấy từ hoá đơn/công tơ (số kWh giờ cao điểm trong tháng ÷ số ngày thứ Hai–thứ Bảy).
          </p>
          {peakWarn && <p className="mt-1 text-xs text-red-600">Nhập điện dùng giờ cao điểm lớn hơn 0 để tính tiết kiệm.</p>}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="space-y-3 rounded-xl bg-surface p-4">
            <div className="text-sm font-semibold text-navy">Inverter / bộ chuyển đổi (hybrid)</div>
            <select value={activeInvBrand} onChange={(e) => { setInvBrand(e.target.value); setInvId(""); }} className={selectCls}>
              {invBrands.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            <select value={inverter?.id ?? ""} onChange={(e) => setInvId(e.target.value)} className={selectCls}>
              {invModels.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.capacityKw} kW · {PHASE_LABEL[i.phase]}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-ink/60">Số lượng</span>
              <NumInput min={1} step={1} value={invQty} onChange={(v) => setInvQty(Math.max(0, Math.round(v)))} className="w-20 rounded-md border border-line px-2.5 py-1.5 text-right font-mono" />
              <span className="text-ink/50">= {num1(inverterKw)} kW</span>
            </div>
          </div>
          <div className="space-y-3 rounded-xl bg-surface p-4">
            <div className="text-sm font-semibold text-navy">Pin lưu trữ</div>
            <select value={activeBatBrand} onChange={(e) => { setBatBrand(e.target.value); setBatId(""); }} className={selectCls}>
              {batBrands.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            <select value={battery?.id ?? ""} onChange={(e) => setBatId(e.target.value)} className={selectCls}>
              {batModels.map((b) => (
                <option key={b.id} value={b.id}>{b.moduleKwh} kWh / module</option>
              ))}
            </select>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-ink/60">Số lượng</span>
              <NumInput min={1} step={1} value={batQty} onChange={(v) => setBatQty(Math.max(0, Math.round(v)))} className="w-20 rounded-md border border-line px-2.5 py-1.5 text-right font-mono" />
              <span className="text-ink/50">= {num1(batteryKwh)} kWh (dùng được ≈ {num1(calc.usableKwh)} kWh)</span>
            </div>
          </div>
        </div>
        <details className="mt-5 rounded-xl border border-line bg-white p-4" open>
          <summary className="cursor-pointer text-sm font-semibold text-navy">Thông số kỹ thuật (có thể hiệu chỉnh)</summary>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {([
              ["Hiệu suất inverter AC→DC (sạc), %", acToDcPct, setAcToDcPct],
              ["Hiệu suất inverter DC→AC (xả), %", dcToAcPct, setDcToAcPct],
              ["Hiệu suất sạc–xả của pin, %", batteryEffPct, setBatteryEffPct],
              ["Độ sâu xả (DoD), %", dodPct, setDodPct],
              ["Pin suy giảm dung lượng, %/năm", fadePctPerYear, setFadePctPerYear],
            ] as [string, number, (v: number) => void][]).map(([label, val, set]) => (
              <div key={label} className="rounded-xl bg-surface p-3">
                <div className="text-xs text-ink/50">{label}</div>
                <NumInput min={0} max={100} step={0.5} value={val} onChange={(v) => set(Math.min(100, Math.max(0, v)))} className="mt-1 w-full rounded-md border border-line bg-white px-2.5 py-1.5 font-mono focus:border-navy focus:outline-none" />
              </div>
            ))}
            <div className="rounded-xl bg-surface p-3">
              <div className="text-xs text-ink/50">Hiệu suất cả chuỗi (AC→DC→pin→AC)</div>
              <div className="mt-1 py-1.5 font-mono text-[15px] font-semibold text-navy">{effPct}%</div>
            </div>
            <div className="rounded-xl bg-surface p-3">
              <div className="flex items-center justify-between text-xs text-ink/50">
                <span>Sạc DC tối đa (kW)</span>
                <label className="flex items-center gap-1">
                  <input type="checkbox" checked={chargeAuto} onChange={(e) => { setChargeAuto(e.target.checked); if (!e.target.checked) setMaxChargeManualKw(autoDcKw); }} />
                  Tự động {DEFAULT_C_RATE}C
                </label>
              </div>
              <NumInput min={0} step={0.5} value={chargeAuto ? autoDcKw : maxChargeManualKw} onChange={(v) => { setChargeAuto(false); setMaxChargeManualKw(Math.max(0, v)); }} className="mt-1 w-full rounded-md border border-line bg-white px-2.5 py-1.5 font-mono focus:border-navy focus:outline-none" />
            </div>
            <div className="rounded-xl bg-surface p-3">
              <div className="flex items-center justify-between text-xs text-ink/50">
                <span>Xả DC tối đa (kW)</span>
                <label className="flex items-center gap-1">
                  <input type="checkbox" checked={dischargeAuto} onChange={(e) => { setDischargeAuto(e.target.checked); if (!e.target.checked) setMaxDischargeManualKw(autoDcKw); }} />
                  Tự động {DEFAULT_C_RATE}C
                </label>
              </div>
              <NumInput min={0} step={0.5} value={dischargeAuto ? autoDcKw : maxDischargeManualKw} onChange={(v) => { setDischargeAuto(false); setMaxDischargeManualKw(Math.max(0, v)); }} className="mt-1 w-full rounded-md border border-line bg-white px-2.5 py-1.5 font-mono focus:border-navy focus:outline-none" />
            </div>
          </div>
          <p className="mt-2 text-xs text-ink/45">
            Mặc định: inverter 97% mỗi chiều, pin 96% sạc–xả (cả chuỗi ≈ 90%), DoD 90%, suy giảm 2%/năm, sạc/xả DC tối đa = {DEFAULT_C_RATE}C (một nửa dung lượng pin mỗi giờ). Nhập theo datasheet của thiết bị thực tế để chính xác hơn.
          </p>
        </details>
        {suggestion && (
          <div className="mt-4 rounded-xl border border-energy/40 bg-[#FFF9EC] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-semibold text-navy">
                Gợi ý: {suggestion.batteryQty} pin {battery?.moduleKwh} kWh ({num1(suggestion.batteryNominalKwh)} kWh) + {suggestion.inverterQty} inverter {inverter?.capacityKw} kW ({num1(suggestion.inverterQty * (inverter?.capacityKw ?? 0))} kW)
              </div>
              <button
                type="button"
                onClick={() => {
                  setBatQty(suggestion.batteryQty);
                  setInvQty(suggestion.inverterQty);
                }}
                disabled={batQty === suggestion.batteryQty && invQty === suggestion.inverterQty}
                className="rounded-full bg-navy px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
              >
                {batQty === suggestion.batteryQty && invQty === suggestion.inverterQty ? "Đang áp dụng" : "Áp dụng gợi ý"}
              </button>
            </div>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-[13px] text-ink/65">
              <li>
                Bù hết {num1(peakLoadKwhPerDay)} kWh điện giờ cao điểm cần pin dùng được ≈ {num1(suggestion.usableKwh)} kWh (xả ra {num1(suggestion.dischargeAcKwh)} kWh sau tổn hao).
              </li>
              <li>
                Sạc đầy trong {TOU_SCHEDULE.offPeakHoursPerDay} giờ thấp điểm cần inverter ≥ {num1(suggestion.requiredChargeAcKw)} kW (AC) · sạc DC ≥ {num1(suggestion.requiredChargeDcKw)} kW.
              </li>
              <li>
                Xả hết trong {TOU_SCHEDULE.peakHoursPerDay} giờ cao điểm cần inverter ≥ {num1(suggestion.requiredDischargeAcKw)} kW (AC) · xả DC ≥ {num1(suggestion.requiredDischargeDcKw)} kW.
              </li>
              {suggestion.batteryQtyAfterFade > suggestion.batteryQty && (
                <li>
                  Pin suy giảm {fadePctPerYear}%/năm: để sau {suggestion.years} năm vẫn bù đủ tải cần {suggestion.batteryQtyAfterFade} pin ({num1(suggestion.batteryQtyAfterFade * (battery?.moduleKwh ?? 0))} kWh) — đầu tư thêm {suggestion.batteryQtyAfterFade - suggestion.batteryQty} pin.
                </li>
              )}
              {(suggestion.chargeDcTooLow || suggestion.dischargeDcTooLow) && (
                <li className="text-red-600">
                  Mức {suggestion.chargeDcTooLow ? `sạc DC tối đa (${num1(suggestion.maxChargeDcKw)} kW)` : ""}
                  {suggestion.chargeDcTooLow && suggestion.dischargeDcTooLow ? " và " : ""}
                  {suggestion.dischargeDcTooLow ? `xả DC tối đa (${num1(suggestion.maxDischargeDcKw)} kW)` : ""} đang thấp hơn mức cần — nâng thông số trong khung bên dưới hoặc chọn thêm pin.
                </li>
              )}
            </ul>
            <p className="mt-2 text-xs text-ink/45">Gợi ý dùng đúng loại inverter và pin đang chọn ở trên và các thông số kỹ thuật trong khung bên dưới.</p>
          </div>
        )}
      </section>

      {/* Kết quả */}
      <section>
        <h2 className="font-display text-lg font-semibold text-navy">Hiệu quả ước tính</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricCard label="Điện xả giờ cao điểm/ngày" value={`${calc.dischargeKwhPerDay.toFixed(1)} kWh`} />
          <MetricCard label="Tiết kiệm/tháng (năm 1)" value={vnd(calc.savingsPerMonthVnd)} accent="#27A36A" />
          <MetricCard label="Tiết kiệm/năm (năm 1)" value={vnd(calc.savingsPerYearVnd)} accent="#27A36A" />
          <MetricCard label="Hoàn vốn (có suy giảm pin)" value={paybackYears === null ? "Trên 25 năm" : `${paybackYears} năm`} accent="#E8A33D" />
        </div>
        {LIMIT_TEXT[calc.limit] && peakLoadKwhPerDay > 0 && <p className="mt-2 text-[13px] text-ink/60">{LIMIT_TEXT[calc.limit]}</p>}
        <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-white">
          <div className="border-b border-line px-5 py-3 text-sm font-semibold text-navy">Dự báo 10 năm (pin suy giảm {fadePctPerYear}%/năm)</div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="text-left text-[13px] text-ink/50">
                  <th className="px-5 py-2 font-medium">Năm</th>
                  <th className="px-5 py-2 text-right font-medium">Dung lượng pin còn</th>
                  <th className="px-5 py-2 text-right font-medium">Điện xả/ngày</th>
                  <th className="px-5 py-2 text-right font-medium">Tiết kiệm/năm</th>
                  <th className="px-5 py-2 text-right font-medium">Lũy kế</th>
                </tr>
              </thead>
              <tbody>
                {projection.years.map((y) => (
                  <tr key={y.year} className="border-t border-line/70">
                    <td className="px-5 py-2">Năm {y.year}</td>
                    <td className="px-5 py-2 text-right font-mono">{y.retentionPercent.toFixed(0)}% ({num1(y.capacityKwh)} kWh)</td>
                    <td className="px-5 py-2 text-right font-mono">{y.dischargeKwhPerDay.toFixed(1)} kWh</td>
                    <td className="px-5 py-2 text-right font-mono text-[#27A36A]">{vnd(y.savingsYearVnd)}</td>
                    <td className="px-5 py-2 text-right font-mono">{vnd(y.cumulativeVnd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="mt-3 rounded-xl bg-surface p-3.5 text-xs leading-relaxed text-ink/60">
          <div className="mb-1 font-medium text-ink/75">Ghi chú cách tính</div>
          <ul className="list-disc space-y-1 pl-4">
            <li>Chuỗi hiệu suất: điện lưới → inverter AC→DC ({acToDcPct}%) → pin sạc–xả ({batteryEffPct}%) → inverter DC→AC ({dcToAcPct}%) → tải. Hiệu suất cả chuỗi ≈ {effPct}%, nên muốn xả 1 kWh phải mua khoảng {(1 / calc.totalEfficiency).toFixed(2)} kWh giờ thấp điểm.</li>
            <li>Điện xả mỗi ngày = nhỏ nhất của: pin dùng được (dung lượng × DoD {dodPct}%) sau tổn hao; công suất xả (inverter, xả DC tối đa) × 5 giờ cao điểm; công suất sạc (inverter, sạc DC tối đa) × 6 giờ thấp điểm sau tổn hao; và điện khách dùng giờ cao điểm.</li>
            <li>Tiền tiết kiệm mỗi ngày = điện xả × giá cao điểm − điện mua để sạc × giá thấp điểm (đã gồm VAT {Math.round(tariff.vatRate * 100)}%). Tiết kiệm/năm = tiết kiệm mỗi ngày × {TOU_SCHEDULE.peakDaysPerYear} ngày (thứ Hai–thứ Bảy, Chủ nhật không có giờ cao điểm).</li>
            <li>Dung lượng pin giảm {fadePctPerYear}% mỗi năm (lũy tiến); công suất inverter và mức sạc/xả DC tối đa giữ nguyên. Hoàn vốn = năm mà tổng tiết kiệm cộng dồn bù đủ Tổng thanh toán; quá 25 năm thì hiển thị "Trên 25 năm".</li>
            <li>Chưa tính chi phí thay pin/inverter, thay đổi giá điện và thủ tục đấu nối với điện lực. Số liệu chỉ là ước tính tham khảo.</li>
          </ul>
        </div>
      </section>

      {/* Báo giá */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold text-navy">Bảng kê vật tư &amp; báo giá</h2>
          {staffControls}
        </div>

        {effectiveCustomerView ? (
          <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-white">
            <div className="border-b border-line bg-navy px-6 py-4 text-white">
              <div className="text-sm text-white/60">
                Hệ thống lưu trữ: {battery?.brand} {num1(batteryKwh)} kWh · {inverter?.brand} {invQty > 1 ? `${invQty}×` : ""}
                {inverter?.capacityKw}kW
              </div>
              <div className="mt-1 text-xs text-white/40">Báo giá dự toán, đã bao gồm thiết bị, tủ điện, dây dẫn, nhân công và vận chuyển.</div>
            </div>
            <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-3">
              <MetricCard label="Dung lượng lưu trữ" value={`${num1(batteryKwh)} kWh`} />
              <MetricCard label="Công suất inverter" value={`${num1(inverterKw)} kW`} />
              <MetricCard label="Tiết kiệm/tháng ước tính" value={vnd(calc.savingsPerMonthVnd)} accent="#27A36A" />
            </div>
            <div className="border-t border-line px-6 py-4">
              <div className="text-xs font-medium text-ink/50">Bảo hành thiết bị</div>
              <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-ink/70">
                {inverter?.warranty && <span>Inverter: <span className="font-medium text-navy">{inverter.warranty}</span></span>}
                {battery?.warranty && <span>Pin lưu trữ: <span className="font-medium text-navy">{battery.warranty}</span></span>}
              </div>
              <div className="mt-1 text-[11px] text-ink/40">Bảo hành theo chính sách của nhà sản xuất.</div>
            </div>
            <div className="flex items-baseline justify-between gap-4 border-t border-line bg-surface px-6 py-5">
              <div className="text-sm font-medium text-navy">Tổng thanh toán</div>
              <div className="text-right">
                <div className="font-mono text-2xl font-semibold text-navy">{vnd(totalPayment)}</div>
                {discountPercent > 0 && <div className="mt-1 text-xs text-ink/40">Đã áp dụng chiết khấu {discountPercent}%</div>}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-white">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="text-left text-[13px] text-ink/50">
                    <th className="px-5 py-2.5 font-medium">Hạng mục</th>
                    <th className="px-5 py-2.5 font-medium">Thương hiệu</th>
                    <th className="px-5 py-2.5 text-right font-medium">SL</th>
                    <th className="px-5 py-2.5 text-right font-medium">Đơn giá</th>
                    <th className="px-5 py-2.5 text-right font-medium">Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.id} className="border-t border-line/70">
                      <td className="px-5 py-2.5">{it.label}</td>
                      <td className="px-5 py-2.5 text-ink/60">{it.brandModel}</td>
                      <td className="px-5 py-2.5 text-right font-mono">{it.qty} {it.unit}</td>
                      <td className="px-5 py-2.5 text-right font-mono">{vnd(it.unitPriceVnd)}</td>
                      <td className="px-5 py-2.5 text-right font-mono">{vnd(itemTotal(it))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-3 border-t border-line bg-surface px-5 py-4 text-sm">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-ink/60">Chi phí khác (tủ điện, cáp, nhân công, vận chuyển)</span>
                <NumInput min={0} step={100000} value={otherCostVnd} onChange={(v) => setOtherCostVnd(Math.max(0, v))} className="w-40 rounded-md border border-line px-2.5 py-1.5 text-right font-mono" />
                <span className="text-ink/50">đ</span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-ink/60">Chiết khấu</span>
                <NumInput min={0} max={100} value={discountPercent} onChange={(v) => setDiscountPercent(Math.min(100, Math.max(0, v)))} className="w-16 rounded-md border border-line px-2.5 py-1.5 text-right font-mono" />
                <span className="text-ink/50">%</span>
              </div>
              <div className="flex items-baseline justify-between gap-4 border-t border-line pt-3">
                <span className="font-medium text-navy">Tổng thanh toán</span>
                <span className="font-mono text-xl font-semibold text-navy">{vnd(totalPayment)}</span>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Xuất file */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => handleExport("pdf")}
          disabled={exporting !== null || !battery || !inverter}
          className="rounded-xl bg-navy px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {exporting === "pdf" ? "Đang xuất…" : "Xuất báo giá PDF"}
        </button>
        <button
          type="button"
          onClick={() => handleExport("xlsx")}
          disabled={exporting !== null || !battery || !inverter}
          className="rounded-xl bg-energy px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {exporting === "xlsx" ? "Đang xuất…" : "Xuất báo giá Excel"}
        </button>
      </div>
    </div>
  );
}
