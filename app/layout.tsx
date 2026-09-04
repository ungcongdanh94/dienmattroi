import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Máy tính công suất điện mặt trời — Công Thảnh",
  description: "Ước tính công suất hệ thống điện mặt trời on-grid / off-grid / hybrid",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
