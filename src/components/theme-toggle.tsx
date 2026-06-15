"use client";

import { useCallback, useEffect, useState } from "react";
import { Baseball, MoonStars, Sun } from "@phosphor-icons/react";

const THEMES = ["classic", "night", "field"] as const;
type Theme = (typeof THEMES)[number];

const THEME_LABELS: Record<Theme, string> = {
  classic: "经典",
  night: "暗夜",
  field: "球场",
};

const STORAGE_KEY = "baseball-manager-theme";

function readTheme(): Theme {
  if (typeof window === "undefined") {
    return "classic";
  }
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && THEMES.includes(stored as Theme)) {
    return stored as Theme;
  }
  return "classic";
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(STORAGE_KEY, theme);
}

export function ThemeToggle({
  id,
  className,
}: {
  id?: string;
  className?: string;
} = {}) {
  const [theme, setTheme] = useState<Theme>(readTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const cycleTheme = useCallback(() => {
    setTheme((current) => {
      const idx = THEMES.indexOf(current);
      return THEMES[(idx + 1) % THEMES.length];
    });
  }, []);
  const Icon = theme === "classic" ? Sun : theme === "night" ? MoonStars : Baseball;

  return (
    <button
      id={id}
      className={className}
      type="button"
      onClick={cycleTheme}
      aria-label={`切换主题，当前：${THEME_LABELS[theme]}`}
    >
      <Icon className="theme-icon" size={19} weight="duotone" aria-hidden="true" />
      <span className="btn-label">{THEME_LABELS[theme]}</span>
    </button>
  );
}
