import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function CTASection() {
  return (
    <section className="bg-navy py-20">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
        <h2 className="font-display text-[26px] font-semibold leading-snug text-white sm:text-3xl">
          Biến mái nhà thành nguồn năng lượng của bạn
        </h2>
        <p className="mt-4 text-[15px] text-white/65">
          Liên hệ Công Thảnh để được tư vấn giải pháp điện mặt trời phù hợp.
        </p>
        <Link
          href="/tinh-toan"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-gold px-7 py-3.5 text-sm font-semibold text-navy transition-transform hover:scale-[1.02]"
        >
          Nhận tư vấn miễn phí
          <ArrowRight size={16} />
        </Link>
      </div>
    </section>
  );
}
