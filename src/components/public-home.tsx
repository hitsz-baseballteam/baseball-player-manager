"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Baseball,
  Envelope,
  List,
  LockKey,
  Trophy,
  UsersThree,
  X,
} from "@phosphor-icons/react";

import styles from "@/components/public-home.module.css";
import { PUBLIC_SITE_CONTENT as staticContent } from "@/lib/public-site-content";
import { PANEL_ROUTES } from "@/lib/routes";
import type {
  PublicGame,
  PublicMilestone,
} from "@/lib/public-site-data";
import type { PublicHomeConfig } from "@/lib/workspace/types";

type PublicHomeProps = {
  config?: PublicHomeConfig | null;
  milestones?: PublicMilestone[];
  games?: PublicGame[];
};

type GalleryItem = (typeof staticContent.gallery)[number];
type GalleryCategory = "all" | GalleryItem["category"];

const contactIcons: Record<string, typeof Envelope> = {
  email: Envelope,
  social: UsersThree,
  "wechat-group": UsersThree,
};

const galleryFilters: Array<{ label: string; value: GalleryCategory }> = [
  { label: "全部", value: "all" },
  { label: "比赛", value: "match" },
  { label: "训练", value: "training" },
  { label: "合影", value: "group" },
  { label: "细节", value: "detail" },
];

function resolveContent(
  config: PublicHomeConfig | null | undefined,
  milestones: PublicMilestone[] | undefined,
  games: PublicGame[] | undefined,
) {
  const training = config?.training ?? staticContent.training;
  const contacts = config?.contacts ?? staticContent.contacts;
  const faq = config?.faq ?? staticContent.faq;
  const history = config?.history ?? staticContent.history;

  return {
    ...staticContent,
    training,
    contacts,
    faq,
    history,
    milestones: milestones ?? [],
    games: games ?? [],
  };
}

function revealClass(id: string, visibleSections: Set<string>) {
  return `${styles.reveal} ${visibleSections.has(id) ? styles.revealVisible : ""}`;
}

export function PublicHome(props: PublicHomeProps) {
  const { config, milestones, games } = props;
  const [menuOpen, setMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("#top");
  const [visibleSections, setVisibleSections] = useState<Set<string>>(() => new Set(["hero"]));
  const [activeStep, setActiveStep] = useState(staticContent.trainingSteps[0]?.number ?? "01");
  const [galleryFilter, setGalleryFilter] = useState<GalleryCategory>("all");
  const [lightboxItem, setLightboxItem] = useState<GalleryItem | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);

  const content = useMemo(
    () => resolveContent(config, milestones, games),
    [config, milestones, games],
  );

  const filteredGallery = useMemo(() => {
    if (galleryFilter === "all") return content.gallery;
    return content.gallery.filter((item) => item.category === galleryFilter);
  }, [content.gallery, galleryFilter]);

  const selectedTrainingStep =
    content.trainingSteps.find((step) => step.number === activeStep) ?? content.trainingSteps[0];

  useEffect(() => {
    const progress = progressRef.current;
    let frame = 0;
    const requestFrame = window.requestAnimationFrame ?? ((callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 0));
    const cancelFrame = window.cancelAnimationFrame ?? window.clearTimeout;

    function updateScrollState() {
      frame = 0;
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      const pct = max > 0 ? (doc.scrollTop / max) * 100 : 0;
      if (progress) progress.style.width = `${pct}%`;
      setIsScrolled(window.scrollY > 72);

      const y = window.scrollY + 140;
      const sectionIds = ["#top", ...content.navigation.map((item) => item.href)];
      let nextActive = "#top";
      for (const id of sectionIds) {
        const section = document.querySelector<HTMLElement>(id);
        if (section && section.offsetTop <= y) nextActive = id;
      }
      setActiveSection(nextActive);
    }

    function onScroll() {
      if (frame) return;
      frame = requestFrame(updateScrollState);
    }

    updateScrollState();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) cancelFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [content.navigation]);

  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal-id]"));
    if (typeof window.IntersectionObserver === "undefined") {
      const requestFrame = window.requestAnimationFrame ?? ((callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 0));
      const cancelFrame = window.cancelAnimationFrame ?? window.clearTimeout;
      const frame = requestFrame(() => {
        setVisibleSections(new Set(nodes.map((node) => node.dataset.revealId ?? "")));
      });
      return () => cancelFrame(frame);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        setVisibleSections((current) => {
          const next = new Set(current);
          for (const entry of entries) {
            const id = (entry.target as HTMLElement).dataset.revealId;
            if (!id) continue;
            if (entry.isIntersecting) {
              if (id) next.add(id);
            } else {
              next.delete(id);
            }
          }
          return next;
        });
      },
      { threshold: 0.22, rootMargin: "-6% 0px -10% 0px" },
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!lightboxItem) return;
    const currentLightboxItem = lightboxItem;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setLightboxItem(null);
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        const gallery = filteredGallery.length > 0 ? filteredGallery : content.gallery;
        const index = gallery.findIndex((item) => item.id === currentLightboxItem.id);
        const delta = event.key === "ArrowRight" ? 1 : -1;
        const next = gallery[(index + delta + gallery.length) % gallery.length];
        if (next) setLightboxItem(next);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [content.gallery, filteredGallery, lightboxItem]);

  function moveLightbox(delta: number) {
    if (!lightboxItem) return;
    const gallery = filteredGallery.length > 0 ? filteredGallery : content.gallery;
    const index = gallery.findIndex((item) => item.id === lightboxItem.id);
    const next = gallery[(index + delta + gallery.length) % gallery.length];
    if (next) setLightboxItem(next);
  }

  return (
    <main className={styles.site}>
      <div ref={progressRef} className={styles.scrollProgress} aria-hidden="true" />

      <header className={`${styles.header} ${isScrolled ? styles.headerScrolled : ""}`}>
        <a className={styles.brand} href="#top" aria-label="哈工深小熊猫棒球队首页">
          <Image
            src="/team/team-logo-v2.webp"
            alt=""
            width={74}
            height={74}
            className={styles.logo}
            priority
          />
          <span>
            <strong>小熊猫棒球队</strong>
            <small>HITSZ RED PANDAS</small>
          </span>
        </a>

        <button
          className={styles.menuButton}
          type="button"
          aria-label={menuOpen ? "关闭导航" : "打开导航"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X size={24} /> : <List size={24} />}
        </button>

        <nav className={menuOpen ? styles.navOpen : styles.nav} aria-label="公开站导航">
          {content.navigation.map((item) => (
            <a
              key={item.href}
              className={activeSection === item.href ? styles.navActive : undefined}
              href={item.href}
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </a>
          ))}
          <Link className={styles.panelLink} href={PANEL_ROUTES.home} prefetch={false}>
            <LockKey size={18} weight="bold" />
            队员入口
          </Link>
        </nav>
      </header>

      <section id="top" className={styles.hero} data-reveal-id="hero">
        <div className={styles.heroMedia}>
          <Image
            src="/team/team-fence.jpg"
            alt="哈工深小熊猫棒球队队员望向球场"
            fill
            sizes="100vw"
            className={styles.heroImage}
            priority
          />
          <svg className={styles.heroArc} viewBox="0 0 420 220" aria-hidden="true">
            <path d="M18 190 C 120 40 260 28 398 84" />
          </svg>
        </div>

        <div className={`${styles.heroCard} ${revealClass("hero", visibleSections)}`}>
          <p className={styles.eyebrow}>{content.hero.eyebrow}</p>
          <h1>{content.hero.title}</h1>
          <p className={styles.heroEnglish}>{content.hero.englishTitle}</p>
          <p className={styles.heroSlogan}>{content.hero.slogan}</p>
          <p className={styles.heroSummary}>{content.hero.summary}</p>
          <div className={styles.heroActions}>
            <a className={styles.primaryAction} href="#history">
              了解队史
              <ArrowRight size={20} weight="bold" />
            </a>
            <a className={styles.secondaryAction} href="#match">查看首次出征</a>
            <a className={styles.textAction} href="#join">加入我们</a>
          </div>
        </div>

        <div className={styles.heroMeta} aria-label="球队关键事实">
          <span>2026.04 成立</span>
          <span>20+ 现役成员</span>
          <span>2026.05.30 首战</span>
        </div>

        <div className={styles.heroKinetics} aria-hidden="true">
          <span className={styles.kineticCard}>TRAINING LOG</span>
          <span className={styles.kineticCard}>FIRST MATCH</span>
          <span className={styles.kineticCard}>NUMBER WALL</span>
        </div>
      </section>

      <section id="about" className={styles.section} data-reveal-id="about">
        <div className={styles.introGrid}>
          <div className={`${styles.introPhoto} ${revealClass("about", visibleSections)}`}>
            <Image
              src="/team/team-huddle-wide.jpg"
              alt="哈工深小熊猫棒球队全队赛前围圈"
              fill
              sizes="(max-width: 900px) 100vw, 52vw"
            />
            <span>PLAY AS ONE</span>
          </div>
          <div className={`${styles.introCopy} ${revealClass("about", visibleSections)}`}>
            <p className={styles.eyebrow}>ABOUT THE TEAM</p>
            <h2>{content.intro.title}</h2>
            {content.intro.body.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            <div className={styles.tagRow}>
              {content.intro.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className={styles.statsSection} aria-label="球队核心数字" data-reveal-id="stats">
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}>BY THE NUMBERS · 2026</p>
          <h2>四件事，先记住。</h2>
        </div>
        <div className={`${styles.statsGrid} ${revealClass("stats", visibleSections)}`}>
          {content.stats.map((stat) => (
            <article key={stat.label} className={`${styles.statCard} ${styles[stat.tone]}`}>
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
              <p>{stat.detail}</p>
            </article>
          ))}
        </div>
      </section>

      {content.milestones.length > 0 && (
        <section id="news" className={styles.dynamicSection} data-reveal-id="news">
          <div className={styles.sectionHeading}>
            <p className={styles.eyebrow}>LATEST</p>
            <h2>球队最新动态</h2>
          </div>
          <div className={`${styles.newsList} ${revealClass("news", visibleSections)}`}>
            {content.milestones.map((item) => (
              <article key={item.id} className={styles.newsItem}>
                <span>{item.date}</span>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      <section id="history" className={styles.section} data-reveal-id="history">
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}>FROM DAY ONE</p>
          <h2>一段正在被书写的历史。</h2>
          <p>{content.history.story}</p>
        </div>
        <div className={`${styles.timeline} ${revealClass("history", visibleSections)}`}>
          {content.timeline.map((item, index) => (
            <article
              key={`${item.date}-${item.title}`}
              className={`${styles.timelineNode} ${item.isFuture ? styles.futureNode : ""}`}
              style={{ "--node-index": index } as React.CSSProperties}
            >
              <span className={styles.timelineDot} />
              <time>{item.date}</time>
              <h3>{item.title}</h3>
              <p>{item.summary}</p>
            </article>
          ))}
        </div>
        <ul className={`${styles.awardsStrip} ${revealClass("history", visibleSections)}`} aria-label="队史记录">
          {content.history.awards.map((award) => (
            <li key={award}>{award}</li>
          ))}
        </ul>
      </section>

      <section id="match" className={styles.matchSection} data-reveal-id="match">
        <div className={`${styles.matchCopy} ${revealClass("match", visibleSections)}`}>
          <p className={styles.eyebrow}>{content.firstMatch.eyebrow}</p>
          <h2>{content.firstMatch.title}</h2>
          {content.firstMatch.body.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          <div className={styles.matchCards}>
          {content.firstMatch.games.map((game) => (
              <article key={game.label}>
                <span>{game.label}</span>
                <strong>{game.opponent}</strong>
                <p>{game.result} · {game.note}</p>
              </article>
            ))}
          </div>
        </div>
        <div className={`${styles.matchPhotos} ${revealClass("match", visibleSections)}`}>
          <div className={styles.matchPhotoBack}>
            <Image src="/team/team-huddle.jpg" alt="首次出征赛前围圈" fill sizes="50vw" />
          </div>
          <div className={styles.matchPhotoFront}>
            <Image src="/team/team-tournament.jpg" alt="首次出征赛事合影" fill sizes="50vw" />
          </div>
          <div className={styles.matchGlassNote} aria-hidden="true">
            <span>2026.05.30</span>
            <strong>首次正式出征</strong>
          </div>
          <span className={styles.scoreboardMark}>RP · GAME 01</span>
        </div>
      </section>

      <section id="training" className={styles.section} data-reveal-id="training">
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}>TRAINING ROUTINE</p>
          <h2>一周三练，从基础动作开始。</h2>
          <p>
            固定训练由老队员带训，新手友好，提供一对一指导，让零基础队员也能循序渐进地融入训练。
          </p>
        </div>
        <div className={`${styles.trainingGrid} ${revealClass("training", visibleSections)}`}>
          <div className={styles.trainingPhoto}>
            <Image
              src="/team/team-lineup-field.jpg"
              alt="球队在棒球场边列队"
              fill
              sizes="(max-width: 900px) 100vw, 48vw"
            />
          </div>
          <div className={styles.trainingPanel}>
            <div className={styles.trainingStepper} role="tablist" aria-label="训练流程">
              {content.trainingSteps.map((step) => (
                <button
                  key={step.number}
                  type="button"
                  role="tab"
                  aria-selected={step.number === selectedTrainingStep.number}
                  className={step.number === selectedTrainingStep.number ? styles.stepActive : undefined}
                  onClick={() => setActiveStep(step.number)}
                >
                  <span>{step.number}</span>
                  {step.name}
                </button>
              ))}
            </div>
            <div className={styles.trainingDetail}>
              <span>{selectedTrainingStep.number}</span>
              <h3>{selectedTrainingStep.name}</h3>
              <p>{selectedTrainingStep.detail}</p>
            </div>
            <div className={styles.trainingFacts}>
              <dl>
                <div>
                  <dt>训练时间</dt>
                  <dd>{content.training.schedule}</dd>
                </div>
                <div>
                  <dt>训练地点</dt>
                  <dd>{content.training.location}</dd>
                </div>
                <div>
                  <dt>需要自带</dt>
                  <dd>{content.training.whatToBring.join("、")}</dd>
                </div>
                <div>
                  <dt>球队提供</dt>
                  <dd>{content.training.whatWeProvide.join("、")}</dd>
                </div>
              </dl>
              <p>{content.training.note}</p>
            </div>
          </div>
        </div>
        <div className={`${styles.cultureRow} ${revealClass("training", visibleSections)}`}>
          {content.culture.map((item) => (
            <article key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="members" className={styles.membersSection} data-reveal-id="members">
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}>NUMBER WALL</p>
          <h2>人是球队最重要的内容。</h2>
        </div>
        <div className={`${styles.membersWall} ${revealClass("members", visibleSections)}`}>
          {content.members.map((member) => (
            <article key={`${member.number}-${member.name}`} className={`${styles.jersey} ${styles[member.tone]}`}>
              <span className={styles.jerseyRole}>{member.role}</span>
              <strong>{member.number}</strong>
              <h3>{member.name}</h3>
              <p>{member.note}</p>
            </article>
          ))}
        </div>
      </section>

      {content.games.length > 0 && (
        <section id="games" className={styles.dynamicSection} data-reveal-id="games">
          <div className={styles.sectionHeading}>
            <p className={styles.eyebrow}>RECENT GAMES</p>
            <h2>近期比赛</h2>
          </div>
          <div className={`${styles.gamesList} ${revealClass("games", visibleSections)}`}>
            {content.games.map((game) => (
              <article key={game.id} className={styles.gameItem}>
                <Trophy size={22} weight="duotone" aria-hidden="true" />
                <span>{game.date}</span>
                <strong>对手：{game.opponent}</strong>
                <small>{game.gameType === "official" ? "正式赛" : "训练赛"} · 共 {game.totalInnings} 局</small>
              </article>
            ))}
          </div>
        </section>
      )}

      <section id="gallery" className={styles.gallerySection} data-reveal-id="gallery">
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}>PHOTO ARCHIVE</p>
          <h2>照片负责情绪。</h2>
          <p>围圈、背影、赛场和队服细节会比长文字更快说明这支队伍从哪里开始。</p>
        </div>
        <div className={styles.galleryFilters} aria-label="相册分类">
          {galleryFilters.map((filter) => (
            <button
              key={filter.value}
              type="button"
              className={galleryFilter === filter.value ? styles.filterActive : undefined}
              aria-pressed={galleryFilter === filter.value}
              onClick={() => setGalleryFilter(filter.value)}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <div className={`${styles.galleryGrid} ${revealClass("gallery", visibleSections)}`}>
          {filteredGallery.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`${styles.galleryTile} ${item.wide ? styles.galleryWide : ""} ${item.tall ? styles.galleryTall : ""}`}
              onClick={() => setLightboxItem(item)}
            >
              <Image src={item.src} alt={item.alt} fill sizes="(max-width: 900px) 100vw, 33vw" />
              <span>{item.categoryLabel}</span>
              <strong>{item.title}</strong>
              <small>{item.date}</small>
            </button>
          ))}
        </div>
      </section>

      <section id="faq" className={styles.faqSection} data-reveal-id="faq">
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}>QUESTIONS</p>
          <h2>常见问题</h2>
        </div>
        <div className={`${styles.faqList} ${revealClass("faq", visibleSections)}`}>
          {content.faq.map((item) => (
            <details key={item.question} className={styles.faqItem}>
              <summary>
                <span>{item.question}</span>
              </summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section id="join" className={styles.join} data-reveal-id="join">
        <Baseball size={68} weight="duotone" aria-hidden="true" />
        <p className={styles.eyebrow}>JOIN THE TEAM</p>
        <h2>想和我们一起上场？</h2>
        <p>
          球队长期欢迎对棒球感兴趣的同学加入。无论你是否有基础，都可以先来体验一次训练。
        </p>
        <div className={`${styles.contactCards} ${revealClass("join", visibleSections)}`}>
          {content.contacts.map((contact) => {
            const Icon = contactIcons[contact.type] ?? UsersThree;
            return (
              <article key={contact.label} className={styles.contactCard}>
                <div>
                  <Icon size={24} weight="duotone" aria-hidden="true" />
                  <span>{contact.label}</span>
                </div>
                {contact.href ? (
                  <a
                    href={contact.href}
                    target={contact.type === "social" ? "_blank" : undefined}
                    rel={contact.type === "social" ? "noopener noreferrer" : undefined}
                  >
                    {contact.value}
                  </a>
                ) : (
                  <strong>{contact.value}</strong>
                )}
                {contact.qrImage && (
                  <div className={styles.qrFrame}>
                    <Image
                      src={contact.qrImage}
                      alt="哈工深小熊猫棒球队微信群二维码"
                      width={420}
                      height={420}
                      className={styles.qrImage}
                    />
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <footer className={styles.footer}>
        <div>
          <Image src="/team/team-logo-v2.webp" alt="" width={56} height={56} />
          <span>哈工深小熊猫棒球队</span>
        </div>
        <nav aria-label="页脚导航">
          <a href="#history">队史</a>
          <a href="#gallery">相册</a>
          <a href="#join">加入我们</a>
          <Link href={PANEL_ROUTES.home} prefetch={false}>队员控制台</Link>
        </nav>
      </footer>

      {lightboxItem && (
        <div
          className={styles.lightbox}
          role="dialog"
          aria-modal="true"
          aria-label="照片大图浏览"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setLightboxItem(null);
          }}
        >
          <button type="button" className={styles.lightboxClose} aria-label="关闭" onClick={() => setLightboxItem(null)}>
            <X size={24} />
          </button>
          <button type="button" className={styles.lightboxPrev} aria-label="上一张" onClick={() => moveLightbox(-1)}>
            ‹
          </button>
          <div className={styles.lightboxFrame}>
            <Image src={lightboxItem.src} alt={lightboxItem.alt} fill sizes="92vw" />
            <div>
              <span>{lightboxItem.categoryLabel}</span>
              <strong>{lightboxItem.title}</strong>
              <small>{lightboxItem.date}</small>
            </div>
          </div>
          <button type="button" className={styles.lightboxNext} aria-label="下一张" onClick={() => moveLightbox(1)}>
            ›
          </button>
        </div>
      )}
    </main>
  );
}
