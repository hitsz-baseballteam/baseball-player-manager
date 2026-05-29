"use client";

import { useEffect, useRef } from "react";

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

  useEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }

    const cleanup = mountPlayerManager(root, {
      workspace: props.initialWorkspace,
      version: props.initialVersion,
      updatedAt: "",
    });

    return cleanup;
  }, [props.initialVersion, props.initialWorkspace]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: props.styles }} />
      <div ref={rootRef} dangerouslySetInnerHTML={{ __html: props.markup }} />
    </>
  );
}
