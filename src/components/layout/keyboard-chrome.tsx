"use client";

import { useEffect } from "react";
import { keyboardOverlap } from "@/lib/ui/keyboard-inset";

const KEYBOARD_GAP = 120;

function revealDrawerField() {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return;
  if (!active.closest("[data-slot='drawer-content']")) return;
  if (!active.matches("input, textarea, select, [contenteditable='true']")) return;
  active.scrollIntoView({ block: "nearest" });
}

/** روی موبایل، باز بودن کیبورد را از visualViewport روی html می‌گذارد. */
export function KeyboardChrome() {
  useEffect(() => {
    const root = document.documentElement;
    const mobile = window.matchMedia("(max-width: 767px)");

    const sync = (reveal: boolean) => {
      const viewport = window.visualViewport;
      if (!mobile.matches || !viewport) {
        root.dataset.keyboard = "closed";
        root.style.setProperty("--keyboard-inset", "0px");
        root.style.setProperty("--visual-viewport-height", "100dvh");
        return;
      }
      const inset = keyboardOverlap({
        innerHeight: window.innerHeight,
        offsetTop: viewport.offsetTop,
        height: viewport.height,
      });
      const open = inset > KEYBOARD_GAP;
      root.dataset.keyboard = open ? "open" : "closed";
      root.style.setProperty("--keyboard-inset", open ? `${inset}px` : "0px");
      root.style.setProperty("--visual-viewport-height", `${viewport.height}px`);
      if (reveal && open) revealDrawerField();
    };

    const onResize = () => sync(true);
    const onScroll = () => sync(false);
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (!target.closest("[data-slot='drawer-content']")) return;
      requestAnimationFrame(() => revealDrawerField());
    };

    sync(false);
    mobile.addEventListener("change", onResize);
    window.visualViewport?.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("scroll", onScroll);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      mobile.removeEventListener("change", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("scroll", onScroll);
      document.removeEventListener("focusin", onFocusIn);
      root.dataset.keyboard = "closed";
      root.style.setProperty("--keyboard-inset", "0px");
      root.style.setProperty("--visual-viewport-height", "100dvh");
    };
  }, []);

  return null;
}
