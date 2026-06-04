type LegacyBridgeOptions = {
  root: HTMLElement | null;
  onUnavailable?: (message: string) => void;
  onFeedback?: (message: string) => void;
  highlightClassName?: string;
  highlightDurationMs?: number;
};

type ActionOptions = {
  focusSelector?: string;
  unavailableMessage?: string;
  feedbackMessage?: string;
};

export type LegacyBridge = {
  trigger: (selector: string, options?: ActionOptions) => boolean;
  changeSelect: (selector: string, value: string, options?: ActionOptions) => boolean;
  focus: (selector: string, options?: Omit<ActionOptions, "focusSelector">) => boolean;
  triggerAndFocus: (selector: string, focusSelector: string, options?: Omit<ActionOptions, "focusSelector">) => boolean;
};

export function createLegacyBridge({
  root,
  onUnavailable,
  onFeedback,
  highlightClassName = "bridge-focus",
  highlightDurationMs = 1600,
}: LegacyBridgeOptions): LegacyBridge {
  let removeHighlightTimer: ReturnType<typeof setTimeout> | null = null;
  let highlightedElement: HTMLElement | null = null;

  const query = <T extends HTMLElement>(selector: string) => root?.querySelector<T>(selector) ?? null;

  const emitUnavailable = (message: string) => {
    onUnavailable?.(message);
  };

  const emitFeedback = (message?: string) => {
    if (message) {
      onFeedback?.(message);
    }
  };

  const clearHighlight = () => {
    if (removeHighlightTimer) {
      clearTimeout(removeHighlightTimer);
      removeHighlightTimer = null;
    }
    if (highlightedElement) {
      highlightedElement.classList.remove(highlightClassName);
      highlightedElement = null;
    }
  };

  const applyHighlight = (element: HTMLElement) => {
    clearHighlight();
    void element.offsetWidth;
    element.classList.add(highlightClassName);
    highlightedElement = element;
    removeHighlightTimer = setTimeout(() => {
      element.classList.remove(highlightClassName);
      if (highlightedElement === element) {
        highlightedElement = null;
      }
      removeHighlightTimer = null;
    }, highlightDurationMs);
  };

  const focus = (selector: string, options: Omit<ActionOptions, "focusSelector"> = {}) => {
    const target = query(selector);
    if (!root || !target) {
      emitUnavailable(options.unavailableMessage ?? "定位目标暂时不可用，请在完整工作台中继续操作");
      return false;
    }

    target.scrollIntoView?.({ behavior: "smooth", block: "start", inline: "nearest" });
    applyHighlight(target);
    emitFeedback(options.feedbackMessage);
    return true;
  };

  const trigger = (selector: string, options: ActionOptions = {}) => {
    const target = query(selector);
    if (!root || !target) {
      emitUnavailable(options.unavailableMessage ?? "入口暂时不可用，请在完整工作台中继续操作");
      return false;
    }

    target.click();
    if (options.focusSelector) {
      focus(options.focusSelector, options);
    } else {
      emitFeedback(options.feedbackMessage);
    }
    return true;
  };

  const changeSelect = (selector: string, value: string, options: ActionOptions = {}) => {
    const target = query<HTMLSelectElement>(selector);
    if (!root || !target) {
      emitUnavailable(options.unavailableMessage ?? "入口暂时不可用，请在完整工作台中继续操作");
      return false;
    }

    target.value = value;
    target.dispatchEvent(new Event("change", { bubbles: true }));
    if (options.focusSelector) {
      focus(options.focusSelector, options);
    } else {
      emitFeedback(options.feedbackMessage);
    }
    return true;
  };

  const triggerAndFocus = (selector: string, focusSelector: string, options: Omit<ActionOptions, "focusSelector"> = {}) => {
    return trigger(selector, { ...options, focusSelector });
  };

  return {
    trigger,
    changeSelect,
    focus,
    triggerAndFocus,
  };
}
