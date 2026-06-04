import type { ToastHandle } from "@/components/toast";
import type { HelpDrawerHandle } from "@/components/help-drawer";
import type { GuideHandle } from "@/components/guide-overlay";
import type { Workspace } from "@/lib/workspace";

export type ManagerUiSnapshot = {
  workspace: Workspace;
  version: number;
  saveStatus: string;
};

/**
 * Callbacks that the legacy DOM manager uses to trigger React-managed UI.
 * Each ref is populated by the corresponding React component on mount.
 */
export type ManagerCallbacks = {
  toast: React.MutableRefObject<ToastHandle | null>;
  helpDrawer: React.MutableRefObject<HelpDrawerHandle | null>;
  guide: React.MutableRefObject<GuideHandle | null>;
  onStateChange?: (snapshot: ManagerUiSnapshot) => void;
};
