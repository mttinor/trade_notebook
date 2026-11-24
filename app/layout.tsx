import type { Metadata, Viewport } from "next";
import "vazirmatn/Vazirmatn-font-face.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "ژورنال معاملاتی",
  description: "دفترچه معاملاتی: ثبت روزانه معاملات، آمار، وین‌ریت و نمودارها",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
