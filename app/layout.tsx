import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "知了森林 · 一个会自己生长的兴趣森林",
  description:
    "把知乎的收藏、点赞与搜索历史，变成一座会自动生长的兴趣森林。知乎黑客松 2026 参赛作品。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
