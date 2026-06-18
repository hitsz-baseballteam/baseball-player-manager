"use client";

import { useCallback, useEffect } from "react";
import { useReportWebVitals } from "next/web-vitals";

import type { PerformanceMetricPayload } from "@/lib/performance-telemetry";
import { PANEL_ROUTES } from "@/lib/routes";

const DATA_CENTER_NAVIGATION_START = "telemetry:data-center-navigation-start";

function reportMetric(payload: PerformanceMetricPayload) {
  if (process.env.NODE_ENV !== "production") return;

  void fetch("/api/telemetry/performance", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {
    // Telemetry is best effort and must never affect navigation.
  });
}

export function reportDataCenterReady() {
  if (typeof window === "undefined") return;

  const rawStart = window.sessionStorage.getItem(DATA_CENTER_NAVIGATION_START);
  window.sessionStorage.removeItem(DATA_CENTER_NAVIGATION_START);
  if (!rawStart) return;

  const startedAt = Number(rawStart);
  const duration = Date.now() - startedAt;
  if (!Number.isFinite(duration) || duration < 0) return;

  reportMetric({
    name: "DATA_CENTER_READY",
    value: duration,
    route: PANEL_ROUTES.stats,
  });
}

export function PanelPerformanceTelemetry() {
  const reportWebVital = useCallback((metric: {
    name: "CLS" | "FCP" | "INP" | "LCP" | "TTFB";
    value: number;
    rating: "good" | "needs-improvement" | "poor";
    navigationType: string;
  }) => {
    reportMetric({
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      navigationType: metric.navigationType,
      route: window.location.pathname,
    });
  }, []);

  useReportWebVitals(reportWebVital);

  useEffect(() => {
    function markDataCenterNavigation(event: MouseEvent) {
      if (!(event.target instanceof Element)) return;
      const link = event.target.closest<HTMLAnchorElement>("a[href]");
      if (!link || new URL(link.href).pathname !== PANEL_ROUTES.stats) return;

      window.sessionStorage.setItem(
        DATA_CENTER_NAVIGATION_START,
        String(Date.now()),
      );
    }

    document.addEventListener("click", markDataCenterNavigation, true);
    return () => document.removeEventListener("click", markDataCenterNavigation, true);
  }, []);

  return null;
}
