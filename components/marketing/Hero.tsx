import Link from "next/link";
import { ArrowRight } from "lucide-react";
import PanelIllustration from "./PanelIllustration";

export default function Hero() {
  return (
    <section id="top" className="relative overflow-hidden bg-navy pb-20 pt-32 lg:pb-28 lg:pt-40">
      {/* Subtle radial glow, not a heavy gradient */}
      <div className="pointer-events-none absolute -right-40 -top-40 h-[560px] w-[560px] rounded-full bg-solarblue/20 blur-3xl" />

      <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-14 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-gold">Giải pháp năng lượng thông minh</p>
          <h1 className="font-display mt-4 text-[40px] font-semibold leading-[1.08] text-white sm:text-5xl lg:text-[56px]">
            Tối ưu chi phí,
            <br />
            chủ động năng lượng
          </h1>
          <p className="mt-6 max-w-md text-base leading-relaxed text-white/70 lg:text-lg">
            Giải pháp điện mặt trời và lưu trữ năng lượng phù hợp cho gia đình, doanh nghiệp và nhà xưởng.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/tinh-toan"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-gold px-6 py-3.5 text-sm font-semibold text-navy transition-transform hover:scale-[1.02]"
            >
              Tính toán hệ thống
              <ArrowRight size={16} />
            </Link>
            <a
              href="#giai-phap"
              className="inline-flex items-center justify-center rounded-full border border-white/25 px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              Xem giải pháp
            </a>
          </div>
        </div>

        {/* Illustrative visual — refined panel array, not a stock photo */}
        <div className="relative">
          <div className="aspect-[4/3] overflow-hidden rounded-card border border-white/10 shadow-2xl shadow-black/30">
            <PanelIllustration variant="business" />
          </div>

          <div className="absolute -bottom-6 -left-6 rounded-2xl border border-line bg-white p-4 shadow-xl sm:-left-10">
            <div className="text-xs text-ink/50">Công suất</div>
            <div className="font-mono text-2xl font-semibold text-navy">10.2 kWp</div>
          </div>

          <div className="absolute -right-2 -top-6 rounded-2xl border border-line bg-white p-4 shadow-xl sm:-right-8">
            <div className="text-xs text-ink/50">Tiết kiệm dự kiến</div>
            <div className="font-mono text-2xl font-semibold text-energy">~8.3 triệu/tháng</div>
          </div>
        </div>
      </div>
    </section>
  );
}
