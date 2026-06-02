"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { GuideOverlay, type GuideHandle } from "@/components/guide-overlay";
import { HelpDrawer, type HelpDrawerHandle } from "@/components/help-drawer";
import { ThemeToggle } from "@/components/theme-toggle";
import { ToastProvider, type ToastHandle } from "@/components/toast";
import { mountPlayerManager } from "@/lib/player-manager-dom";
import type { Workspace } from "@/lib/workspace";

type PlayerManagerClientProps = {
  initialWorkspace: Workspace;
  initialVersion: number;
  markup: string;
  styles: string;
};

export function PlayerManagerClient(props: PlayerManagerClientProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  const toastRef = useRef<ToastHandle | null>(null);
  const helpRef = useRef<HelpDrawerHandle | null>(null);
  const guideRef = useRef<GuideHandle | null>(null);

  const [helpOpen, setHelpOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(
    !props.initialWorkspace.preferences.helpDismissed,
  );

  const handleHelpClose = useCallback(() => setHelpOpen(false), []);
  const handleGuideDismiss = useCallback(() => setGuideOpen(false), []);
  const handleReplayGuide = useCallback(() => {
    setHelpOpen(false);
    setGuideOpen(true);
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const cleanup = mountPlayerManager(root, {
      workspace: props.initialWorkspace,
      version: props.initialVersion,
      updatedAt: "",
    }, {
      toast: toastRef,
      helpDrawer: helpRef,
      guide: guideRef,
    });

    return cleanup;
  }, [props.initialVersion, props.initialWorkspace]);

  return (
    <ToastProvider toastRef={toastRef}>
      <style dangerouslySetInnerHTML={{ __html: props.styles }} />
      <div ref={rootRef} dangerouslySetInnerHTML={{ __html: props.markup }} />
      <ThemeToggle />
      <HelpDrawer
        isOpen={helpOpen}
        onClose={handleHelpClose}
        onReplayGuide={handleReplayGuide}
        helpRef={helpRef}
      />
      <GuideOverlay
        isOpen={guideOpen}
        onDismiss={handleGuideDismiss}
        guideRef={guideRef}
        rootRef={rootRef}
      />
    </ToastProvider>
  );
}
