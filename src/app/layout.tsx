import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "競馬予想アプリ | 前走トラブル分析",
  description: "前走の不利（トラブル）を加味して馬の真の実力を分析する競馬予想アプリ",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
