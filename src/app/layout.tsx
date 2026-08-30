import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: process.env.NEXT_PUBLIC_APP_NAME ?? "AI Interview",
    template: "%s · AI Interview",
  },
  description:
    process.env.NEXT_PUBLIC_APP_TAGLINE ??
    "基于简历和目标 JD 的 AI 技术岗位语音模拟面试与证据化复盘。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
