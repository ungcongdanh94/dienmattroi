import { Sun, Zap, Leaf, Activity } from "lucide-react";

const BENEFITS = [
  { icon: Sun, title: "Tiết kiệm chi phí điện", description: "Giảm đáng kể hoá đơn tiền điện hàng tháng." },
  { icon: Zap, title: "Chủ động nguồn năng lượng", description: "Ít phụ thuộc vào biến động giá điện lưới." },
  { icon: Leaf, title: "Năng lượng xanh bền vững", description: "Giảm phát thải, hướng đến vận hành bền vững." },
  { icon: Activity, title: "Giám sát hiệu suất 24/7", description: "Theo dõi sản lượng và tình trạng hệ thống liên tục." },
];

export default function Benefits() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <h2 className="font-display text-center text-[28px] font-semibold text-navy sm:text-3xl">
        Năng lượng thông minh cho tương lai
      </h2>

      <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {BENEFITS.map(({ icon: Icon, title, description }) => (
          <div key={title} className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-solarblue/10 text-solarblue">
              <Icon size={22} strokeWidth={1.75} />
            </div>
            <h3 className="mt-4 text-[15px] font-semibold text-navy">{title}</h3>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink/60">{description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
