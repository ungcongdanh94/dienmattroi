"use client";

import { useEffect, useState } from "react";
import type { EquipmentCatalog, PanelSpec, InverterSpec, BatterySpec } from "@/lib/catalog-types";

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [catalog, setCatalog] = useState<EquipmentCatalog | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

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
  function removeRow(kind: "panels" | "inverters" | "batteries", id: string) {
    setCatalog((c) => (c ? { ...c, [kind]: (c[kind] as { id: string }[]).filter((x) => x.id !== id) } : c));
  }
  function addPanel() {
    setCatalog((c) =>
      c ? { ...c, panels: [...c.panels, { id: `panel-${Date.now()}`, brand: "", wattage: 0, lengthMm: 0, widthMm: 0, priceVnd: 0 }] } : c,
    );
  }
  function addInverter() {
    setCatalog((c) => (c ? { ...c, inverters: [...c.inverters, { id: `inv-${Date.now()}`, brand: "", capacityKw: 0, priceVnd: 0 }] } : c));
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
      </div>
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
