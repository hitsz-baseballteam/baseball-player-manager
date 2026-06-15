import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "队员控制台",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function PanelLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
