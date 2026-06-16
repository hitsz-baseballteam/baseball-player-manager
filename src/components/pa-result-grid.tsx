"use client";

import type { PAResult } from "@/lib/scoreboard-actions";
import styles from "./pa-result-grid.module.css";

type PAResultGridProps = {
  onResult: (result: PAResult) => void;
  disabled?: boolean;
};

const RESULT_GROUPS: { label: string; buttons: { result: PAResult; label: string; title: string }[] }[] = [
  {
    label: "击球结果",
    buttons: [
      { result: "1B", label: "一安", title: "一垒安打 (Single)" },
      { result: "2B", label: "二安", title: "二垒安打 (Double)" },
      { result: "3B", label: "三安", title: "三垒安打 (Triple)" },
      { result: "HR", label: "本垒打", title: "本垒打 (Home Run)" },
    ],
  },
  {
    label: "保送 / 死球",
    buttons: [
      { result: "BB", label: "四坏", title: "四坏球保送 (Base on Balls)" },
      { result: "HBP", label: "触身", title: "触身球 (Hit By Pitch)" },
    ],
  },
  {
    label: "出局",
    buttons: [
      { result: "SO", label: "三振", title: "三振 (Strikeout)" },
      { result: "GO", label: "滚地", title: "滚地球出局 (Ground Out)" },
      { result: "FO", label: "飞球", title: "飞球出局 (Fly Out)" },
      { result: "LO", label: "平飞", title: "平飞球出局 (Line Out)" },
    ],
  },
  {
    label: "其他",
    buttons: [
      { result: "DP", label: "双杀", title: "双杀 (Double Play)" },
      { result: "SF", label: "牺飞", title: "高飞牺牲打 (Sacrifice Fly)" },
      { result: "SAC", label: "牺触", title: "牺牲触击 (Sacrifice Bunt)" },
      { result: "ROE", label: "失误", title: "失误上垒 (Reached on Error)" },
      { result: "FC", label: "野选", title: "野手选择 (Fielder's Choice)" },
    ],
  },
];

export function PAResultGrid({ onResult, disabled = false }: PAResultGridProps) {
  return (
    <div className={styles.panel}>
      {RESULT_GROUPS.map((group) => (
        <div key={group.label} className={styles.group}>
          <div className={styles.groupLabel}>{group.label}</div>
          <div className={styles.grid}>
            {group.buttons.map((btn) => (
              <button
                key={btn.result}
                type="button"
                className={`${styles.btn} ${getButtonStyle(btn.result)}`}
                title={btn.title}
                disabled={disabled}
                onClick={() => onResult(btn.result)}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function getButtonStyle(result: PAResult): string {
  switch (result) {
    case "1B":
    case "2B":
    case "3B":
      return styles.btnHit;
    case "HR":
      return styles.btnHR;
    case "BB":
    case "HBP":
      return styles.btnWalk;
    case "SO":
    case "GO":
    case "FO":
    case "LO":
      return styles.btnOut;
    case "DP":
      return styles.btnDP;
    case "SF":
    case "SAC":
      return styles.btnSac;
    case "ROE":
    case "FC":
    case "SB":
    case "CS":
      return styles.btnOther;
  }
}
