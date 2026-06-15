import type { Metadata } from "next";

import { PublicHome } from "@/components/public-home";

export const metadata: Metadata = {
  title: "哈工大深圳棒球队 | HITSZ Baseball",
  description: "哈尔滨工业大学（深圳）棒球队官网。2026 秋季招新，零基础也欢迎。",
  alternates: { canonical: "/" },
  openGraph: {
    title: "哈工大深圳棒球队",
    description: "下一球，等你上场。2026 秋季招新，零基础也欢迎。",
    url: "https://hitsz-baseball.online",
    siteName: "HITSZ Baseball",
    locale: "zh_CN",
    type: "website",
    images: [{ url: "/team/team-fence.jpg", width: 1920, height: 1280 }],
  },
};

export default function HomePage() {
  return <PublicHome />;
}
