"use client";

import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export type HelpDrawerHandle = {
  open: () => void;
  close: () => void;
};

type HelpDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  onReplayGuide: () => void;
  helpRef: React.MutableRefObject<HelpDrawerHandle | null>;
};

export function HelpDrawer({ isOpen, onClose, onReplayGuide, helpRef }: HelpDrawerProps) {
  const drawerRef = useRef<HTMLElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const open = useCallback(() => {
    restoreFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement : null;
    requestAnimationFrame(() => closeBtnRef.current?.focus());
  }, []);

  const close = useCallback(() => {
    if (restoreFocusRef.current?.isConnected) {
      restoreFocusRef.current.focus();
      restoreFocusRef.current = null;
    }
  }, []);

  useEffect(() => {
    helpRef.current = { open, close };
    return () => { helpRef.current = null; };
  }, [open, close, helpRef]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Tab" && drawerRef.current) {
        const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const scrim = (
    <div
      className={`drawer-scrim${isOpen ? " open" : ""}`}
      onClick={onClose}
      aria-hidden="true"
    />
  );

  const drawer = (
    <aside
      ref={drawerRef}
      className={`help-drawer${isOpen ? " open" : ""}`}
      aria-hidden={!isOpen}
      role="dialog"
      aria-modal="true"
      aria-labelledby="helpDrawerTitle"
      tabIndex={-1}
    >
      <div className="panel-title">
        <h2 id="helpDrawerTitle">使用指引 / 帮助</h2>
        <button
          ref={closeBtnRef}
          className="btn icon secondary"
          type="button"
          aria-label="关闭帮助"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <p>这个工具现在支持多套阵容方案、工作区备份、单方案分享、自动排阵初稿、撤销重做和分级提醒。</p>
      <div className="help-block">
        <h3>基本流程</h3>
        <p>先从球员池里搜索或勾选球员，再把他们分配到守备位置和棒次。拖拽和&ldquo;勾选后点击&rdquo;两条路径都保留。</p>
      </div>
      <div className="help-block">
        <h3>方案管理</h3>
        <p>同一批球员可以保存多套命名方案。适合把常规先发、守备优先、对左投和临时调整分别留档。</p>
      </div>
      <div className="help-block">
        <h3>导入导出</h3>
        <p>&ldquo;导出工作区&rdquo;会备份全部球员和全部方案；&ldquo;导出当前方案&rdquo;只分享当前阵容和它实际引用到的球员。</p>
      </div>
      <div className="help-block">
        <h3>自动排阵与提醒</h3>
        <p>自动排阵会优先使用可上场球员和主守位生成初稿。强提醒表示阵容不完整或存在明显风险，建议提醒表示阵容仍可用但值得复查。</p>
      </div>
      <div className="help-actions">
        <button className="btn secondary" type="button" onClick={onReplayGuide}>
          重新查看新手引导
        </button>
      </div>
    </aside>
  );

  if (typeof document === "undefined") return null;

  return (
    <>
      {createPortal(scrim, document.body)}
      {createPortal(drawer, document.body)}
    </>
  );
}
