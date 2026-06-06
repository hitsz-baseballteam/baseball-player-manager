import Link from "next/link";
import type { ReactNode } from "react";

import styles from "@/components/app-shell.module.css";

type NavItem = {
  label: string;
  href?: string;
  active?: boolean;
  disabled?: boolean;
  status?: string;
};

type SummaryTone = "neutral" | "accent" | "warm" | "cool";

type SummaryItem = {
  label: string;
  value: string;
  detail: string;
  tone?: SummaryTone;
};

type AppShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  statusLabel?: string;
  statusValue?: string;
  statusMeta?: string;
  navItems?: NavItem[];
  actions?: ReactNode;
  summaryItems?: SummaryItem[];
  content?: ReactNode;
  frameEyebrow?: string;
  frameTitle?: string;
  frameDescription?: string;
  frameVariant?: "default" | "legacy";
  children?: ReactNode;
};

export function AppShell({
  eyebrow,
  title,
  description,
  statusLabel,
  statusValue,
  statusMeta,
  navItems = [],
  actions,
  summaryItems = [],
  content,
  frameEyebrow,
  frameTitle,
  frameDescription,
  frameVariant = "default",
  children,
}: AppShellProps) {
  const frameBodyClassName = frameVariant === "legacy"
    ? `${styles.frameBody} ${styles.frameBodyLegacy}`
    : styles.frameBody;

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brandBlock}>
          <div className={styles.brandBadge}>球队作战指挥台</div>
          <div className={styles.brandText}>
            <div className={styles.brandTitle}>Baseball Player Manager</div>
            <div className={styles.brandSubtitle}>共享名册、排阵与比赛日工作区</div>
          </div>
        </div>

        {navItems.length > 0 ? (
          <nav className={styles.nav} aria-label="主导航">
            {navItems.map((item) => {
              const className = item.active
                ? `${styles.navItem} ${styles.navItemActive}`
                : styles.navItem;

              if (item.disabled || !item.href) {
                return (
                  <span
                    key={item.label}
                    className={styles.navItemDisabled}
                    aria-disabled="true"
                  >
                    <span>{item.label}</span>
                    {item.status ? (
                      <span className={styles.navStatus}>{item.status}</span>
                    ) : null}
                  </span>
                );
              }

              return (
                <Link key={item.label} href={item.href} className={className}>
                  <span>{item.label}</span>
                  {item.status ? (
                    <span className={styles.navStatus}>{item.status}</span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
        ) : null}

        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </header>

      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <div className={styles.eyebrow}>{eyebrow}</div>
            <h1 className={styles.title}>{title}</h1>
            <p className={styles.description}>{description}</p>
          </div>

          {statusValue ? (
            <aside className={styles.statusCard}>
              <div className={styles.statusLabel}>{statusLabel}</div>
              <div className={styles.statusValue}>{statusValue}</div>
              {statusMeta ? <div className={styles.statusMeta}>{statusMeta}</div> : null}
            </aside>
          ) : null}
        </section>

        {summaryItems.length > 0 ? (
          <section className={styles.summaryGrid} aria-label="工作区摘要">
            {summaryItems.map((item) => {
              const toneClassName = item.tone === "accent"
                ? styles.summaryCardAccent
                : item.tone === "warm"
                ? styles.summaryCardWarm
                : item.tone === "cool"
                ? styles.summaryCardCool
                : "";

              return (
                <article
                  key={item.label}
                  className={`${styles.summaryCard} ${toneClassName}`.trim()}
                >
                  <div className={styles.summaryLabel}>{item.label}</div>
                  <div className={styles.summaryValue}>{item.value}</div>
                  <div className={styles.summaryDetail}>{item.detail}</div>
                </article>
              );
            })}
          </section>
        ) : null}

        {content ? <div className={styles.content}>{content}</div> : null}

        {children ? (
          <section className={styles.frame}>
            {(frameEyebrow || frameTitle || frameDescription) ? (
              <div className={styles.frameHeader}>
                <div className={styles.frameHeading}>
                  {frameEyebrow ? <div className={styles.frameEyebrow}>{frameEyebrow}</div> : null}
                  {frameTitle ? <h2 className={styles.frameTitle}>{frameTitle}</h2> : null}
                  {frameDescription ? (
                    <p className={styles.frameDescription}>{frameDescription}</p>
                  ) : null}
                </div>
              </div>
            ) : null}
            <div className={frameBodyClassName}>{children}</div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
