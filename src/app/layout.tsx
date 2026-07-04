import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Footer } from "@/components/Footer";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#3b82f6" },
    { media: "(prefers-color-scheme: dark)", color: "#1e40af" },
  ],
};

export const metadata: Metadata = {
  title: "广学英语",
  description: "一款基于Next.js的英语学习平台，支持AI根据用户不熟悉的单词针对性生成选词填空、翻译句子等练习题",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "广学英语",
    startupImage: [
      {
        url: "/favicon.ico",
      },
    ],
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/favicon.ico", type: "image/x-icon" },
    ],
    apple: [
      { url: "/favicon.ico", type: "image/x-icon" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="广学英语" />
        <meta name="application-name" content="广学英语" />
        <meta name="msapplication-TileColor" content="#3b82f6" />
        <meta name="msapplication-tap-highlight" content="no" />
        <link rel="apple-touch-icon" href="/favicon.ico" />
        <link rel="mask-icon" href="/favicon.ico" color="#3b82f6" />
      </head>
      <body className="antialiased flex flex-col min-h-screen">
        <main className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
