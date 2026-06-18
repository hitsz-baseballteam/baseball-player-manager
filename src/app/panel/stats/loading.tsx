import { AppShell } from "@/components/app-shell";
import { panelNavItems } from "@/lib/routes";

import styles from "./loading.module.css";

const NAV_ITEMS = panelNavItems("数据中心");

export default function StatsLoading() {
  return (
    <AppShell
      eyebrow="Stats Center"
      title="数据中心"
      description="正在加载球员统计与比赛记录…"
      statusLabel="工作区"
      statusValue="读取中"
      navItems={[...NAV_ITEMS]}
    >
      <div className={styles.loadingPanel} aria-label="正在加载数据中心" aria-busy="true">
        <div className={styles.filterBar} />
        <div className={styles.metrics}>
          {Array.from({ length: 4 }, (_, index) => (
            <div className={styles.metricCard} key={index} />
          ))}
        </div>
        <div className={styles.tableCard} />
      </div>
    </AppShell>
  );
}
