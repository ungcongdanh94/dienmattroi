import { PROCESS_STEPS } from "@/lib/site-data";

export default function Process() {
  return (
    <section id="quy-trinh" className="bg-white py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="font-display text-center text-[28px] font-semibold text-navy sm:text-3xl">Quy trình triển khai</h2>

        <div className="relative mt-14 grid grid-cols-1 gap-8 sm:grid-cols-4">
          <div className="absolute left-0 right-0 top-6 hidden h-px bg-line sm:block" />
          {PROCESS_STEPS.map((s) => (
            <div key={s.step} className="relative">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-line bg-white font-mono text-sm font-semibold text-solarblue">
                {s.step}
              </div>
              <h3 className="font-display mt-4 text-[15px] font-semibold text-navy">{s.title}</h3>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink/60">{s.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
