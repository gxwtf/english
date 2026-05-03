import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "广学英语",
  description: "广学英语 - 智能英语学习平台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
