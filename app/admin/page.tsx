"use client";

import { useEffect, useState } from "react";
import type { EquipmentCatalog, PanelSpec, InverterSpec, BatterySpec } from "@/lib/catalog-types";
import type { ProjectEntry } from "@/lib/projects-store";

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [catalog, setCatalog] = useState<EquipmentCatalog | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [projects, setProjects] = useState<ProjectEntry[] | null>(null);
  const [projectSaveStatus, setProjectSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/session")
      .then((r) => r.json())
      .then((d) => setAuthenticated(d.authenticated));
  }, []);

  useEffect(() => {
    if (authenticated) {
      fetch("/api/catalog")
        .then((r) => r.json())
        .then(setCatalog);
      fetch("/api/projects")
        .then((r) => r.json())
        .then(setProjects);
    }
  }, [authenticated]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      setAuthenticated(true);
    } else {
      setLoginError("Sai mật khẩu.");
    }
  }

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setAuthenticated(false);
    setCatalog(null);
  }

  async function handleSave() {
    if (!catalog) return;
    setSaveStatus("saving");
    const res = await fetch("/api/catalog", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(catalog),
    });
    setSaveStatus(res.ok ? "saved" : "error");
    setTimeout(() => setSaveStatus("idle"), 2000);
  }

  function updateProject(id: string, patch: Partial<ProjectEntry>) {
    setProjects((list) => (list ? list.map((p) => (p.id === id ? { ...p, ...patch } : p)) : list));
  }
  function addProject() {
    setProjects((list) =>
      list
        ? [...list, { id: `proj-${Date.now()}`, capacity: "", type: "", location: "", imageUrl: "" }]
        : list,
    );
  }
  function removeProject(id: string) {
    setProjects((list) => (list ? list.filter((p) => p.id !== id) : list));
  }

  async function handleUploadImage(id: string, file: File) {
    setUploadingId(id);
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/admin/upload", { method: "POST", body: formData });
    const data = await res.json();
    if (res.ok && data.url) {
      updateProject(id, { imageUrl: data.url });
    } else {
      alert(data.error || "Tải ảnh thất bại");
    }
    setUploadingId(null);
  }

  async function handleSaveProjects() {
    if (!projects) return;
    setProjectSaveStatus("saving");
    const res = await fetch("/api/projects", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(projects),
    });
    setProjectSaveStatus(res.ok ? "saved" : "error");
    setTimeout(() => setProjectSaveStatus("idle"), 2000);
  }

  if (authenticated === null) {
    return <div className="flex min-h-screen items-center justify-center bg-surface text-ink/50">Đang kiểm tra…</div>;
  }

  if (!authenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface px-4">
        <form onSubmit={handleLogin} className="w-full max-w-sm rounded-2xl border border-line bg-white p-6">
          <h1 className="font-display text-lg font-semibold text-navy">Đăng nhập quản trị</h1>
          <p className="mt-1 text-[13px] text-ink/55">Chỉ dùng nội bộ Công Thảnh để quản lý bảng giá thiết bị.</p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mật khẩu"
            className="mt-4 w-full rounded-lg border border-line px-3.5 py-2.5 text-sm focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/10"
          />
          {loginError && <p className="mt-2 text-xs text-red-600">{loginError}</p>}
          <button type="submit" className="mt-4 w-full rounded-lg bg-navy py-2.5 text-sm font-semibold text-white">
            Đăng nhập
          </button>
        </form>
      </div>
    );
  }

  if (!catalog) {
    return <div className="flex min-h-screen items-center justify-center bg-surface text-ink/50">Đang tải bảng giá…</div>;
  }

  function updatePanel(id: string, patch: Partial<PanelSpec>) {
    setCatalog((c) => (c ? { ...c, panels: c.panels.map((p) => (p.id === id ? { ...p, ...patch } : p)) } : c));
  }
  function updateInverter(id: string, patch: Partial<InverterSpec>) {
    setCatalog((c) => (c ? { ...c, inverters: c.inverters.map((i) => (i.id === id ? { ...i, ...patch } : i)) } : c));
  }
  function updateBattery(id: string, patch: Partial<BatterySpec>) {
    setCatalog((c) => (c ? { ...c, batteries: c.batteries.map((b) => (b.id === id ? { ...b, ...patch } : b)) } : c));
  }
  function updateOtherPricing<K extends keyof EquipmentCatalog["otherPricing"]>(key: K, value: number) {
    setCatalog((c) => (c ? { ...c, otherPricing: { ...c.otherPricing, [key]: value } } : c));
  }
  function removeRow(kind: "panels" | "inverters" | "batteries", id: string) {
    setCatalog((c) => (c ? { ...c, [kind]: (c[kind] as { id: string }[]).filter((x) => x.id !== id) } : c));
  }
  function addPanel() {
    setCatalog((c) =>
      c ? { ...c, panels: [...c.panels, { id: `panel-${Date.now()}`, brand: "", wattage: 0, lengthMm: 0, widthMm: 0, priceVnd: 0 }] } : c,
    );
  }
  function addInverter() {
    setCatalog((c) => (c ? { ...c, inverters: [...c.inverters, { id: `inv-${Date.now()}`, brand: "", phase: "1_pha", capacityKw: 0, priceVnd: 0 }] } : c));
  }
  function addBattery() {
    setCatalog((c) => (c ? { ...c, batteries: [...c.batteries, { id: `bat-${Date.now()}`, brand: "", moduleKwh: 0, priceVnd: 0 }] } : c));
  }

  return (
    <div className="min-h-screen bg-surface px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold text-navy">Quản lý bảng giá thiết bị</h1>
            <p className="mt-1 text-[13px] text-ink/55">Chỉ dùng nội bộ. Thay đổi ở đây sẽ áp dụng ngay cho trang tính toán.</p>
          </div>
          <button type="button" onClick={handleLogout} className="text-sm font-medium text-ink/60 hover:text-navy">
            Đăng xuất
          </button>
        </div>

        {/* Panels */}
        <CatalogSection title="Tấm pin" onAdd={addPanel}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[13px] text-ink/50">
                <th className="px-3 py-2 font-medium">Thương hiệu</th>
                <th className="px-3 py-2 font-medium">Công suất (Wp)</th>
                <th className="px-3 py-2 font-medium">Dài (mm)</th>
                <th className="px-3 py-2 font-medium">Rộng (mm)</th>
                <th className="px-3 py-2 text-right font-medium">Giá / tấm</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {catalog.panels.map((p) => (
                <tr key={p.id} className="border-t border-line/70">
                  <td className="px-3 py-2">
                    <input value={p.brand} onChange={(e) => updatePanel(p.id, { brand: e.target.value })} className="w-28 rounded-md border border-line px-2 py-1" />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" value={p.wattage} onChange={(e) => updatePanel(p.id, { wattage: Number(e.target.value) || 0 })} className="w-24 rounded-md border border-line px-2 py-1 font-mono" />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" value={p.lengthMm} onChange={(e) => updatePanel(p.id, { lengthMm: Number(e.target.value) || 0 })} className="w-24 rounded-md border border-line px-2 py-1 font-mono" />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" value={p.widthMm} onChange={(e) => updatePanel(p.id, { widthMm: Number(e.target.value) || 0 })} className="w-24 rounded-md border border-line px-2 py-1 font-mono" />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input type="number" value={p.priceVnd} onChange={(e) => updatePanel(p.id, { priceVnd: Number(e.target.value) || 0 })} className="w-28 rounded-md border border-line px-2 py-1 text-right font-mono" />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button type="button" onClick={() => removeRow("panels", p.id)} className="text-xs text-red-500 hover:underline">
                      Xoá
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CatalogSection>

        {/* Inverters */}
        <CatalogSection title="Inverter" onAdd={addInverter}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[13px] text-ink/50">
                <th className="px-3 py-2 font-medium">Thương hiệu</th>
                <th className="px-3 py-2 font-medium">Số pha</th>
                <th className="px-3 py-2 font-medium">Công suất (kW)</th>
                <th className="px-3 py-2 text-right font-medium">Giá / bộ</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {catalog.inverters.map((inv) => (
                <tr key={inv.id} className="border-t border-line/70">
                  <td className="px-3 py-2">
                    <input value={inv.brand} onChange={(e) => updateInverter(inv.id, { brand: e.target.value })} className="w-28 rounded-md border border-line px-2 py-1" />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={inv.phase}
                      onChange={(e) => updateInverter(inv.id, { phase: e.target.value as InverterSpec["phase"] })}
                      className="w-24 rounded-md border border-line px-2 py-1"
                    >
                      <option value="1_pha">1 pha</option>
                      <option value="3_pha">3 pha</option>
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" value={inv.capacityKw} onChange={(e) => updateInverter(inv.id, { capacityKw: Number(e.target.value) || 0 })} className="w-24 rounded-md border border-line px-2 py-1 font-mono" />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input type="number" value={inv.priceVnd} onChange={(e) => updateInverter(inv.id, { priceVnd: Number(e.target.value) || 0 })} className="w-28 rounded-md border border-line px-2 py-1 text-right font-mono" />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button type="button" onClick={() => removeRow("inverters", inv.id)} className="text-xs text-red-500 hover:underline">
                      Xoá
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CatalogSection>

        {/* Batteries */}
        <CatalogSection title="Pin lưu trữ" onAdd={addBattery}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[13px] text-ink/50">
                <th className="px-3 py-2 font-medium">Thương hiệu</th>
                <th className="px-3 py-2 font-medium">Dung lượng (kWh)</th>
                <th className="px-3 py-2 text-right font-medium">Giá / module</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {catalog.batteries.map((b) => (
                <tr key={b.id} className="border-t border-line/70">
                  <td className="px-3 py-2">
                    <input value={b.brand} onChange={(e) => updateBattery(b.id, { brand: e.target.value })} className="w-28 rounded-md border border-line px-2 py-1" />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" value={b.moduleKwh} onChange={(e) => updateBattery(b.id, { moduleKwh: Number(e.target.value) || 0 })} className="w-24 rounded-md border border-line px-2 py-1 font-mono" />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input type="number" value={b.priceVnd} onChange={(e) => updateBattery(b.id, { priceVnd: Number(e.target.value) || 0 })} className="w-28 rounded-md border border-line px-2 py-1 text-right font-mono" />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button type="button" onClick={() => removeRow("batteries", b.id)} className="text-xs text-red-500 hover:underline">
                      Xoá
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CatalogSection>

        {/* Other pricing */}
        <div className="mt-6 rounded-2xl border border-line bg-white">
          <div className="border-b border-line px-5 py-3">
            <h2 className="font-display font-semibold text-navy">Chi phí khác</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
            <PriceField label="Khung/giá đỡ — Áp mái tôn (đ/kWp)" value={catalog.otherPricing.framePerKwpApMai} onChange={(v) => updateOtherPricing("framePerKwpApMai", v)} />
            <PriceField label="Khung/giá đỡ — Giá đỡ nghiêng (đ/kWp)" value={catalog.otherPricing.framePerKwpGiaDoNghieng} onChange={(v) => updateOtherPricing("framePerKwpGiaDoNghieng", v)} />
            <PriceField label="Cáp DC (đ/mét)" value={catalog.otherPricing.dcCablePerMeter} onChange={(v) => updateOtherPricing("dcCablePerMeter", v)} />
            <PriceField label="Cáp AC (đ/mét)" value={catalog.otherPricing.acCablePerMeter} onChange={(v) => updateOtherPricing("acCablePerMeter", v)} />
            <RateField label="Mét cáp DC / kWp (mức phổ biến, để tự tính số mét)" value={catalog.otherPricing.dcCableMetersPerKwp} onChange={(v) => updateOtherPricing("dcCableMetersPerKwp", v)} />
            <RateField label="Mét cáp AC / kWp (mức phổ biến, để tự tính số mét)" value={catalog.otherPricing.acCableMetersPerKwp} onChange={(v) => updateOtherPricing("acCableMetersPerKwp", v)} />
            <PriceField label="Tủ điện AC/DC (đ/hệ)" value={catalog.otherPricing.acDcCabinetPrice} onChange={(v) => updateOtherPricing("acDcCabinetPrice", v)} />
            <PriceField label="Nhân công (đ/kWp)" value={catalog.otherPricing.laborPerKwp} onChange={(v) => updateOtherPricing("laborPerKwp", v)} />
            <PriceField label="Vận chuyển (đ/chuyến)" value={catalog.otherPricing.shippingPerTrip} onChange={(v) => updateOtherPricing("shippingPerTrip", v)} />
          </div>
        </div>

        <div className="sticky bottom-4 mt-8 flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={saveStatus === "saving"}
            className="rounded-full bg-navy px-6 py-3 text-sm font-semibold text-white shadow-lg disabled:opacity-50"
          >
            {saveStatus === "saving" ? "Đang lưu…" : saveStatus === "saved" ? "Đã lưu ✓" : saveStatus === "error" ? "Lỗi, thử lại" : "Lưu bảng giá"}
          </button>
        </div>

        {/* Projects management */}
        <div className="mt-10 rounded-2xl border border-line bg-white">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <h2 className="font-display text-lg font-semibold text-navy">Dự án đã thực hiện (trang chủ)</h2>
            {projects && (
              <button type="button" onClick={addProject} className="text-sm font-medium text-solarblue hover:underline">
                + Thêm dự án
              </button>
            )}
          </div>

          {!projects ? (
            <div className="p-5 text-sm text-ink/50">Đang tải…</div>
          ) : (
            <div className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-3">
              {projects.map((p) => (
                <div key={p.id} className="rounded-xl border border-line p-4">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-surface">
                    {p.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <label className="mt-3 block">
                    <span className="inline-block cursor-pointer rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-navy hover:bg-surface">
                      {uploadingId === p.id ? "Đang tải…" : "Chọn ảnh"}
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUploadImage(p.id, file);
                      }}
                    />
                  </label>

                  <div className="mt-3 space-y-2">
                    <input
                      value={p.capacity}
                      onChange={(e) => updateProject(p.id, { capacity: e.target.value })}
                      placeholder="Công suất (vd: ~8 kWp)"
                      className="w-full rounded-md border border-line px-2.5 py-1.5 text-sm"
                    />
                    <input
                      value={p.type}
                      onChange={(e) => updateProject(p.id, { type: e.target.value })}
                      placeholder="Loại công trình (vd: Hộ gia đình)"
                      className="w-full rounded-md border border-line px-2.5 py-1.5 text-sm"
                    />
                    <input
                      value={p.location}
                      onChange={(e) => updateProject(p.id, { location: e.target.value })}
                      placeholder="Địa điểm"
                      className="w-full rounded-md border border-line px-2.5 py-1.5 text-sm"
                    />
                  </div>

                  <button type="button" onClick={() => removeProject(p.id)} className="mt-3 text-xs text-red-500 hover:underline">
                    Xoá dự án
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="sticky bottom-4 mt-6 flex justify-end">
          <button
            type="button"
            onClick={handleSaveProjects}
            disabled={projectSaveStatus === "saving" || !projects}
            className="rounded-full bg-energy px-6 py-3 text-sm font-semibold text-white shadow-lg disabled:opacity-50"
          >
            {projectSaveStatus === "saving"
              ? "Đang lưu…"
              : projectSaveStatus === "saved"
                ? "Đã lưu ✓"
                : projectSaveStatus === "error"
                  ? "Lỗi, thử lại"
                  : "Lưu dự án"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RateField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="block text-xs text-ink/55">{label}</label>
      <input
        type="number"
        min={0}
        step={0.1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="mt-1.5 w-full rounded-lg border border-line px-3 py-2 text-right font-mono text-sm"
      />
    </div>
  );
}

function PriceField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="block text-xs text-ink/55">{label}</label>
      <input
        type="number"
        min={0}
        step={1000}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="mt-1.5 w-full rounded-lg border border-line px-3 py-2 text-right font-mono text-sm"
      />
    </div>
  );
}

function CatalogSection({ title, onAdd, children }: { title: string; onAdd: () => void; children: React.ReactNode }) {
  return (
    <div className="mt-6 rounded-2xl border border-line bg-white">
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <h2 className="font-display font-semibold text-navy">{title}</h2>
        <button type="button" onClick={onAdd} className="text-sm font-medium text-solarblue hover:underline">
          + Thêm dòng
        </button>
      </div>
      <div className="overflow-x-auto p-3">{children}</div>
    </div>
  );
}
