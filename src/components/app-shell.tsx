import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  Baseball,
  ChartBar,
  CheckCircle,
  ClipboardText,
  GearSix,
  House,
  Trophy,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";

import styles from "@/components/app-shell.module.css";
import { PANEL_ROUTES } from "@/lib/routes";

type NavItem = {
  label: string;
  href?: string;
  active?: boolean;
  disabled?: boolean;
  status?: string;
  prefetch?: boolean;
};

type SummaryTone = "neutral" | "accent" | "warm" | "cool";

type SummaryItem = {
  label: string;
  value: string;
  detail: string;
  tone?: SummaryTone;
};

type AppShellProps = {
  variant?: "default" | "command";
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
  variant = "default",
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
  if (variant === "command") {
    return (
      <div className={styles.commandShell}>
        <aside className={styles.commandSidebar}>
          <Link href={PANEL_ROUTES.home} className={styles.commandCrest} aria-label="Baseball Player Manager 首页">
            <Baseball size={34} weight="duotone" aria-hidden="true" />
          </Link>

          <nav className={styles.commandNav} aria-label="主导航">
            {navItems.map((item) => {
              const Icon = getNavIcon(item.label);
              const className = item.active
                ? `${styles.commandNavItem} ${styles.commandNavItemActive}`
                : styles.commandNavItem;

              if (item.disabled || !item.href) {
                return (
                  <span key={item.label} className={styles.commandNavItemDisabled}>
                    <Icon size={25} weight="duotone" aria-hidden="true" />
                    <span>{item.label}</span>
                  </span>
                );
              }

              return (
                <Link key={item.label} href={item.href} prefetch={item.prefetch} className={className}>
                  <Icon size={25} weight={item.active ? "fill" : "duotone"} aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className={styles.commandWorkspace}>
          <header className={styles.commandHeader}>
            <div className={styles.commandHeading}>
              <div className={styles.commandEyebrow}>{eyebrow}</div>
              <h1 className={styles.commandTitle}>{title}</h1>
              <p className={styles.commandDescription}>{description}</p>
            </div>

            <div className={styles.commandHeaderStatus}>
              {statusValue ? (
                <div className={styles.commandStatus}>
                  <CheckCircle className={styles.commandStatusMark} size={31} weight="duotone" aria-hidden="true" />
                  <span>
                    <strong>{statusLabel}: {statusValue}</strong>
                    {statusMeta ? <small>{statusMeta}</small> : null}
                  </span>
                </div>
              ) : null}
              {actions ? <div className={styles.commandActions}>{actions}</div> : null}
            </div>
          </header>

          <main className={styles.commandMain}>
            {content ? <div className={styles.commandContent}>{content}</div> : null}
            {children}
          </main>
        </div>
      </div>
    );
  }

  const frameBodyClassName = frameVariant === "legacy"
    ? `${styles.frameBody} ${styles.frameBodyLegacy}`
    : styles.frameBody;

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brandBlock}>
          <div className={styles.brandBadge}>指挥台</div>
          <div className={styles.brandText}>
            <div className={styles.brandTitle}>Baseball Player Manager</div>
            <div className={styles.brandSubtitle}>共享名册与排阵工作区</div>
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
                <Link key={item.label} href={item.href} prefetch={item.prefetch} className={className}>
                  <span>{item.label}</span>
                  {item.status ? (
                    <span className={styles.navStatus}>{item.status}</span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
        ) : null}

        <div className={styles.actions}>
          <Link href={PANEL_ROUTES.home} className={styles.backButton}>
            <ArrowLeft size={16} weight="bold" aria-hidden="true" />
            <span>返回首页</span>
          </Link>
          {actions}
        </div>
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

function getNavIcon(label: string) {
  if (label === "总览") return House;
  if (label === "名册") return UsersThree;
  if (label.includes("场景") || label.includes("排阵")) return ClipboardText;
  if (label.includes("数据")) return ChartBar;
  if (label === "名人堂") return Trophy;
  return GearSix;
}
