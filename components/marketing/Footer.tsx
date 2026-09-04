import { COMPANY } from "@/lib/site-data";

export default function Footer() {
  return (
    <footer className="bg-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="font-display text-lg font-semibold text-navy">CÔNG THẢNH</div>
            <p className="mt-2 max-w-sm text-[13.5px] leading-relaxed text-ink/55">{COMPANY.fullName}</p>
          </div>

          <div className="grid grid-cols-1 gap-1 text-[13.5px] text-ink/60 sm:text-right">
            <div>
              Hotline: <span className="font-medium text-ink">{COMPANY.hotline}</span>
            </div>
            <div>
              Website: <span className="font-medium text-ink">{COMPANY.website}</span>
            </div>
            <div className="max-w-xs sm:ml-auto">{COMPANY.address}</div>
          </div>
        </div>

        <div className="mt-10 border-t border-line pt-6 text-xs text-ink/40">
          © {new Date().getFullYear()} {COMPANY.fullName}. Bảo lưu mọi quyền.
        </div>
      </div>
    </footer>
  );
}
