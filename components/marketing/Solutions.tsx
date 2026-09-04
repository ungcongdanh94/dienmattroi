import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SOLUTIONS } from "@/lib/site-data";

export default function Solutions() {
  return (
    <section id="giai-phap" className="bg-white py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <h2 className="font-display text-[28px] font-semibold text-navy sm:text-3xl">Giải pháp điện mặt trời</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-ink/60">
            Mỗi công trình có một nhu cầu năng lượng khác nhau. Công Thảnh cung cấp giải pháp phù hợp theo nhu cầu
            sử dụng và ngân sách đầu tư.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {SOLUTIONS.map((s) => (
            <Link
              key={s.id}
              href="/tinh-toan"
              className="group overflow-hidden rounded-card border border-line transition-shadow hover:shadow-lg"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-navy">
                <div className="absolute inset-0 grid grid-cols-5 gap-1 p-4 opacity-70 transition-transform duration-500 group-hover:scale-105">
                  {Array.from({ length: 20 }).map((_, i) => (
                    <div key={i} className="rounded-sm bg-solarblue/40" style={{ opacity: 0.4 + ((i * 5) % 6) * 0.08 }} />
                  ))}
                </div>
              </div>
              <div className="p-6">
                <div className="text-xs font-medium text-solarblue">{s.range}</div>
                <h3 className="font-display mt-1.5 text-lg font-semibold text-navy">{s.title}</h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-ink/60">{s.description}</p>
                <div className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-solarblue">
                  Tìm hiểu thêm
                  <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
