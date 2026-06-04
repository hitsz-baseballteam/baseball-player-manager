"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

export type ToastHandle = {
  showToast: (message: string) => void;
};

const subscribe = () => () => {};

export function ToastProvider({ children, toastRef }: {
  children: ReactNode;
  toastRef: React.MutableRefObject<ToastHandle | null>;
}) {
  const [message, setMessage] = useState("");
  const [visible, setVisible] = useState(false);
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setMessage(msg);
    setVisible(true);
    timerRef.current = setTimeout(() => setVisible(false), 1800);
  }, []);

  useEffect(() => {
    toastRef.current = { showToast };
    return () => {
      toastRef.current = null;
    };
  }, [showToast, toastRef]);

  return (
    <>
      {children}
      {mounted
        ? createPortal(
            <div id="toast" className={visible ? "toast show" : "toast"} role="status" aria-live="polite">
              {message}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
