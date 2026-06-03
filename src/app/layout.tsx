import type { Metadata } from "next";
import {
  Bebas_Neue,
  Geist,
  Geist_Mono,
  Noto_Sans_SC,
} from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const bebasNeue = Bebas_Neue({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
});

const notoSansSc = Noto_Sans_SC({
  variable: "--font-body-sc",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
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
      className={`${geistSans.variable} ${geistMono.variable} ${bebasNeue.variable} ${notoSansSc.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
