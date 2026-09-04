"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

const NAV_ITEMS = [
  { label: "Trang chủ", href: "/#top" },
  { label: "Giải pháp", href: "/#giai-phap" },
  { label: "Hệ sinh thái", href: "/#he-sinh-thai" },
  { label: "Dự án", href: "/#du-an" },
  { label: "Quy trình", href: "/#quy-trinh" },
];

export default function Header({ forceSolid = false }: { forceSolid?: boolean }) {
  const [scrolledState, setScrolledState] = useState(false);
  const scrolled = forceSolid || scrolledState;
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (forceSolid) return;
    const onScroll = () => setScrolledState(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, [forceSolid]);

  return (
    <header
      className={[
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled ? "border-b border-line bg-white/95 backdrop-blur" : "bg-transparent",
      ].join(" ")}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:h-20 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <span className={["font-display text-lg font-semibold tracking-tight lg:text-xl", scrolled ? "text-navy" : "text-white"].join(" ")}>
            CÔNG THẢNH
          </span>
        </Link>

        <nav className="hidden items-center gap-8 lg:flex">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={["text-sm font-medium transition-colors", scrolled ? "text-ink/70 hover:text-navy" : "text-white/80 hover:text-white"].join(" ")}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden lg:block">
          <Link
            href="/tinh-toan"
            className="rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-navy transition-transform hover:scale-[1.03]"
          >
            Tư vấn miễn phí
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className={["lg:hidden", scrolled ? "text-navy" : "text-white"].join(" ")}
          aria-label="Mở menu"
        >
          {mobileOpen ? <X size={26} /> : <Menu size={26} />}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-line bg-white px-4 py-4 lg:hidden">
          <nav className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-ink/80 hover:bg-surface"
              >
                {item.label}
              </a>
            ))}
            <Link
              href="/tinh-toan"
              className="mt-2 rounded-full bg-gold px-5 py-3 text-center text-sm font-semibold text-navy"
            >
              Tư vấn miễn phí
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
