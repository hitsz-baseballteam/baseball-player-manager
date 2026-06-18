"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  Baseball,
  Eye,
  List,
  LockKey,
  PersonSimpleRun,
  UsersThree,
  X,
} from "@phosphor-icons/react";

import styles from "@/components/public-home.module.css";
import { PUBLIC_SITE_CONTENT as content } from "@/lib/public-site-content";
import { PANEL_ROUTES } from "@/lib/routes";

const stepIcons = [Eye, PersonSimpleRun, UsersThree];

export function PublicHome() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <main className={styles.site}>
      <header className={styles.header}>
        <a className={styles.brand} href="#top" aria-label="哈工大深圳棒球队首页">
          <Image
            src="/team/team-logo-v1.webp"
            alt=""
            width={74}
            height={74}
            className={styles.logo}
            priority
          />
          <span>
            <strong>哈工大深圳棒球队</strong>
            <small>HITSZ BASEBALL</small>
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
            <a key={item.href} href={item.href} onClick={() => setMenuOpen(false)}>
              {item.label}
            </a>
          ))}
          <Link className={styles.panelLink} href={PANEL_ROUTES.home} prefetch={false}>
            <LockKey size={18} weight="bold" />
            队员入口
          </Link>
        </nav>
      </header>

      <section id="top" className={styles.hero}>
        <div className={styles.heroMain}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>HITSZ BASEBALL</p>
            <h1>
              <span>新生</span>
              <strong>开球</strong>
            </h1>
            <p className={styles.heroSubtitle}>{content.hero.subtitle}</p>
            <div className={styles.recruitmentMark}>
              <strong>2026 秋季招新</strong>
              <span>零基础也欢迎</span>
            </div>
          </div>

          <div className={styles.heroMedia}>
            <Image
              src="/team/team-huddle.jpg"
              alt="哈工大深圳棒球队队员赛前围圈"
              fill
              sizes="(max-width: 900px) 100vw, 64vw"
              className={styles.heroImage}
              priority
            />
            <span className={styles.photoTag}>PLAY AS ONE</span>
          </div>
        </div>

        <div className={styles.heroBand}>
          <div className={styles.heroContact}>
            <span>2026 秋季招新</span>
            <strong>扫码加入棒球队微信群</strong>
          </div>
          <div className={styles.heroActions}>
            <a className={styles.primaryAction} href="#join">
              加入球队
              <ArrowRight size={22} weight="bold" />
            </a>
            <Link className={styles.secondaryAction} href={PANEL_ROUTES.home} prefetch={false}>
              <LockKey size={18} weight="bold" />
              队员入口
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.stepsSection} aria-label="加入球队步骤">
        <div className={styles.steps}>
          {content.steps.map((step, index) => {
            const Icon = stepIcons[index];
            return (
              <article key={step.number}>
                <span className={styles.stepNumber}>{step.number}</span>
                <Icon size={34} weight="duotone" aria-hidden="true" />
                <div>
                  <h2>{step.title}</h2>
                  <p>{step.detail}</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section id="about" className={styles.about}>
        <div className={styles.sectionHeading}>
          <p>WE PLAY TOGETHER</p>
          <h2>一支在深圳成长的大学棒球队</h2>
        </div>
        <div className={styles.aboutGrid}>
          <div className={styles.aboutPhoto}>
            <Image
              src="/team/team-huddle-wide.jpg"
              alt="哈工大深圳棒球队全队赛前围圈"
              fill
              sizes="(max-width: 800px) 100vw, 58vw"
            />
          </div>
          <div className={styles.valueList}>
            {content.values.map((value, index) => (
              <article key={value.title}>
                <span>0{index + 1}</span>
                <h3>{value.title}</h3>
                <p>{value.detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="training" className={styles.training}>
        <div className={styles.trainingPhoto}>
          <Image
            src="/team/team-lineup-field.jpg"
            alt="球队在棒球场边列队"
            fill
            sizes="100vw"
          />
        </div>
        <div className={styles.trainingPanel}>
          <p className={styles.eyebrow}>FIRST PRACTICE</p>
          <h2>第一次来，不需要准备得像个老手</h2>
          <p>
            穿上方便运动的衣服，带上水，先来场边认识我们。装备和基础动作都会有人带你熟悉。
          </p>
          <dl>
            {content.training.map((item) => (
              <div key={item.label}>
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className={styles.gallery} aria-label="球队照片">
        <div className={styles.galleryTall}>
          <Image src="/team/team-dugout.jpg" alt="队员准备进入球场" fill sizes="50vw" />
        </div>
        <div>
          <Image src="/team/team-tournament.jpg" alt="球队赛事合影" fill sizes="50vw" />
        </div>
        <div>
          <Image src="/team/team-campus.jpg" alt="球队校园合影" fill sizes="50vw" />
        </div>
      </section>

      <section id="join" className={styles.join}>
        <Baseball className={styles.joinBall} size={72} weight="duotone" aria-hidden="true" />
        <p className={styles.eyebrow}>2026 AUTUMN RECRUITMENT</p>
        <h2>下一球，真的等你上场</h2>
        <p className={styles.joinLead}>
          无论你以前有没有接触过棒球，都可以先来看看、跟练一次，再决定是否正式入队。
        </p>
        <div className={styles.joinGrid}>
          <div className={styles.contact}>
            <span>入群方式</span>
            <strong>扫码加入棒球队微信群</strong>
            <p className={styles.contactNote}>
              新生、零基础同学都可以先扫码进群，训练时间和招新安排都会在群里同步。
            </p>
          </div>
          <figure className={styles.qrCard}>
            <div className={styles.qrFrame}>
              <Image
                src="/team/wechat-group-qr.jpg"
                alt="哈工大深圳棒球队微信群二维码"
                width={420}
                height={420}
                className={styles.qrImage}
              />
            </div>
            <figcaption>
              扫码进入棒球队微信群，先围观训练通知和招新安排。
            </figcaption>
          </figure>
        </div>
      </section>

      <footer className={styles.footer}>
        <div>
          <Image src="/team/team-logo-v1.webp" alt="" width={56} height={56} />
          <span>哈尔滨工业大学（深圳）棒球队</span>
        </div>
        <Link href={PANEL_ROUTES.home} prefetch={false}>队员控制台</Link>
      </footer>
    </main>
  );
}
