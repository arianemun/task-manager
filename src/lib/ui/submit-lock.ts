"use client";

import { useCallback, useEffect, useRef } from "react";

type GuardEvent = {
  preventDefault: () => void;
  stopPropagation?: () => void;
};

/** جلوی ارسال دوباره با دابل‌کلیک یا Enter تکراری را می‌گیرد، تا pending از سرور برسد. */
export function useSubmitLock(pending: boolean) {
  const held = useRef(false);
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  const formRef = useRef<HTMLFormElement | null>(null);
  const unbindRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!pending) held.current = false;
  }, [pending]);

  const guard = useCallback((event: GuardEvent): boolean => {
    const withNative = event as GuardEvent & {
      nativeEvent?: GuardEvent & { __submitClaimed?: boolean };
      __submitClaimed?: boolean;
    };
    const marked = withNative.nativeEvent ?? withNative;
    if (marked.__submitClaimed) return false;
    if (held.current || pendingRef.current) {
      event.preventDefault();
      event.stopPropagation?.();
      return true;
    }
    marked.__submitClaimed = true;
    held.current = true;
    queueMicrotask(() => {
      if (!pendingRef.current) held.current = false;
    });
    return false;
  }, []);

  const release = useCallback(() => {
    held.current = false;
  }, []);

  const bind = useCallback((node: HTMLFormElement | null) => {
    unbindRef.current?.();
    unbindRef.current = null;
    formRef.current = node;
    if (!node) return;
    const onSubmit = (event: Event) => {
      guard(event as GuardEvent);
    };
    node.addEventListener("submit", onSubmit, true);
    unbindRef.current = () => node.removeEventListener("submit", onSubmit, true);
  }, [guard]);

  useEffect(() => () => unbindRef.current?.(), []);

  return { guard, release, bind };
}
