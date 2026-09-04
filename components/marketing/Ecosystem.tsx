import { PanelsTopLeft, Cpu, BatteryCharging, Plug } from "lucide-react";
import { BRAND_PARTNERS } from "@/lib/site-data";

const FLOW = [
  { icon: PanelsTopLeft, label: "Tấm pin" },
  { icon: Cpu, label: "Inverter" },
  { icon: BatteryCharging, label: "Pin lưu trữ" },
  { icon: Plug, label: "Thiết bị tiêu thụ" },
];

export default function Ecosystem() {
  return (
    <section id="he-sinh-thai" className="bg-white py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="font-display text-center text-[28px] font-semibold text-navy sm:text-3xl">Một hệ thống hoàn chỉnh</h2>

        <div className="mt-14 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {FLOW.map(({ icon: Icon, label }, i) => (
            <div key={label} className="flex items-center gap-3">
              <div className="flex flex-col items-center gap-2.5">
                <div className="flex h-16 w-16 items-center justify-center rounded-full border border-line bg-surface text-navy">
                  <Icon size={26} strokeWidth={1.5} />
                </div>
                <span className="text-[13.5px] font-medium text-ink/70">{label}</span>
              </div>
              {i < FLOW.length - 1 && <div className="hidden h-px w-10 bg-line sm:block" />}
            </div>
          ))}
        </div>

        <div className="mt-16 border-t border-line pt-10">
          <p className="text-center text-xs uppercase tracking-[0.14em] text-ink/40">Thiết bị từ các thương hiệu</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {BRAND_PARTNERS.map((brand) => (
              <span key={brand} className="font-display text-lg font-medium text-ink/35">
                {brand}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
