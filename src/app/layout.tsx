import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const inter = localFont({
  variable: "--font-ui",
  display: "swap",
  src: [
    {
      path: "../fonts/inter-latin-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../fonts/inter-latin-500-normal.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../fonts/inter-latin-700-normal.woff2",
      weight: "700",
      style: "normal",
    },
  ],
});

const notoSansSc = localFont({
  variable: "--font-body-sc",
  display: "swap",
  src: [
    {
      path: "../fonts/noto-sans-sc-chinese-simplified-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../fonts/noto-sans-sc-chinese-simplified-500-normal.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../fonts/noto-sans-sc-chinese-simplified-700-normal.woff2",
      weight: "700",
      style: "normal",
    },
  ],
});

export const metadata: Metadata = {
  title: "Baseball Player Manager",
  description: "PostgreSQL-backed baseball roster and lineup manager",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${inter.variable} ${notoSansSc.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
