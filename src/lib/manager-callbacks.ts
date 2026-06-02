import type { ToastHandle } from "@/components/toast";
import type { HelpDrawerHandle } from "@/components/help-drawer";
import type { GuideHandle } from "@/components/guide-overlay";

/**
 * Callbacks that the legacy DOM manager uses to trigger React-managed UI.
 * Each ref is populated by the corresponding React component on mount.
 */
export type ManagerCallbacks = {
  toast: React.MutableRefObject<ToastHandle | null>;
  helpDrawer: React.MutableRefObject<HelpDrawerHandle | null>;
  guide: React.MutableRefObject<GuideHandle | null>;
};
