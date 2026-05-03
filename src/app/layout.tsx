import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "广学英语",
  description: "一款基于Next.js的英语学习平台，支持AI根据用户不熟悉的单词针对性生成选词填空、翻译句子等练习题",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
