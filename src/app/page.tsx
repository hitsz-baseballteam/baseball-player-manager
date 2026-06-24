import type { Metadata } from "next";

import { PublicHome } from "@/components/public-home";
import { PUBLIC_SITE_CONTENT } from "@/lib/public-site-content";
import { getPublicHomeData } from "@/lib/public-site-data";
import type { PublicHomeConfig } from "@/lib/workspace/types";
import type {
  PublicGame,
  PublicMilestone,
} from "@/lib/public-site-data";

export const metadata: Metadata = {
  title: "哈工深小熊猫棒球队 | HITSZ Red Pandas Baseball Team",
  description: "哈工深小熊猫棒球队官方主页。记录球队从 2026 年春天出发、首次正式比赛与持续训练的校园棒球故事。",
  alternates: { canonical: "/" },
  openGraph: {
    title: "哈工深小熊猫棒球队",
    description: "从零起步，向省赛进发。哈工深小熊猫棒球队官方主页。",
    url: "https://hitsz-baseball.online",
    siteName: "HITSZ Red Pandas Baseball Team",
    locale: "zh_CN",
    type: "website",
    images: [{ url: "/team/team-fence.jpg", width: 1920, height: 1280 }],
  },
};

export const dynamic = "force-dynamic";

function buildJsonLd(
  config: PublicHomeConfig | null,
  games: PublicGame[],
): string {
  const faq = config?.faq ?? PUBLIC_SITE_CONTENT.faq;
  const history = config?.history ?? PUBLIC_SITE_CONTENT.history;

  const organization = {
    "@context": "https://schema.org",
    "@type": "SportsOrganization",
    name: "哈工深小熊猫棒球队",
    alternateName: "HITSZ Red Pandas Baseball Team",
    url: "https://hitsz-baseball.online",
    logo: "https://hitsz-baseball.online/team/team-logo-v2.webp",
    description: "成立于 2026 年春天的哈尔滨工业大学（深圳）校园棒球队。",
    foundingDate: history.foundedYear === 2026
      ? "2026-04"
      : history.foundedYear ? String(history.foundedYear) : undefined,
    sport: "Baseball",
    location: {
      "@type": "Place",
      name: "哈尔滨工业大学（深圳）",
      address: {
        "@type": "PostalAddress",
        addressLocality: "深圳",
        addressRegion: "广东",
        addressCountry: "CN",
      },
    },
  };

  const faqPage = faq.length > 0
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faq.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer,
          },
        })),
      }
    : null;

  const sportsEvents = games.length > 0
    ? games.map((game) => ({
        "@type": "SportsEvent",
        name: `对阵 ${game.opponent}`,
        startDate: game.date,
        location: {
          "@type": "Place",
          name: "大学城体育中心棒球场",
        },
        sport: "Baseball",
        ...(game.ourScore !== null
          ? {
              result: {
                "@type": "SportsTeam",
                name: "HITSZ Red Pandas Baseball Team",
                score: String(game.ourScore),
              },
            }
          : {}),
      }))
    : [];

  const graphs = [organization, ...(faqPage ? [faqPage] : []), ...sportsEvents];
  return JSON.stringify(graphs.length === 1 ? graphs[0] : graphs);
}

export default async function HomePage() {
  let config: PublicHomeConfig | null = null;
  let milestones: PublicMilestone[] = [];
  let games: PublicGame[] = [];

  try {
    const data = await getPublicHomeData();
    config = data.config;
    milestones = data.milestones;
    games = data.games;
  } catch {
    // Fall back to client-side defaults when the workspace read fails.
  }

  const jsonLd = buildJsonLd(config, games);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd }}
      />
      <PublicHome
        config={config}
        milestones={milestones}
        games={games}
      />
    </>
  );
}
