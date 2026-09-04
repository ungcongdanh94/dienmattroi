import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function SavingsPreview() {
  return (
    <section className="bg-surface py-20">
      <div className="mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
        <h2 className="font-display text-[28px] font-semibold text-navy sm:text-3xl">
          Điện mặt trời giúp bạn tiết kiệm bao nhiêu?
        </h2>

        <div className="mx-auto mt-12 grid max-w-3xl grid-cols-1 items-center gap-6 sm:grid-cols-[1fr_auto_1fr]">
          <div className="rounded-card border border-line bg-white p-6">
            <div className="text-xs text-ink/50">Hoá đơn hiện tại</div>
            <div className="font-mono mt-1 text-2xl font-semibold text-ink">12.500.000 đ<span className="text-sm font-normal text-ink/40">/tháng</span></div>
          </div>

          <ArrowRight className="mx-auto hidden text-ink/30 sm:block" size={22} />
          <div className="text-ink/30 sm:hidden">↓</div>

          <div className="rounded-card border border-line bg-white p-6">
            <div className="text-xs text-ink/50">Sau khi lắp điện mặt trời</div>
            <div className="font-mono mt-1 text-2xl font-semibold text-ink">4.200.000 đ<span className="text-sm font-normal text-ink/40">/tháng</span></div>
          </div>
        </div>

        <div className="mx-auto mt-6 inline-block rounded-full bg-energy/10 px-6 py-3">
          <span className="font-mono text-lg font-semibold text-energy">Tiết kiệm ~8.300.000 đ/tháng</span>
        </div>

        <p className="mx-auto mt-6 max-w-md text-xs text-ink/40">
          * Số liệu minh hoạ. Kết quả thực tế phụ thuộc vào sản lượng tiêu thụ và biểu giá điện của từng khách hàng.
        </p>

        <Link
          href="/tinh-toan"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-navy px-7 py-3.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
        >
          Tính toán cho nhà tôi
          <ArrowRight size={16} />
        </Link>
      </div>
    </section>
  );
}
