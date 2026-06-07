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
 * Shared callback/ref shape for React-managed adjunct UI such as toast,
 * help drawer, and guide overlay. Kept as a small bridge type while the
 * remaining legacy-era cleanup is finished.
 */
export type ManagerCallbacks = {
  toast: React.MutableRefObject<ToastHandle | null>;
  helpDrawer: React.MutableRefObject<HelpDrawerHandle | null>;
  guide: React.MutableRefObject<GuideHandle | null>;
  onStateChange?: (snapshot: ManagerUiSnapshot) => void;
};
