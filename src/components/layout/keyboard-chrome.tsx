"use client";

import { useEffect } from "react";

const KEYBOARD_GAP = 120;

/** روی موبایل، باز بودن کیبورد را از visualViewport روی html می‌گذارد. */
export function KeyboardChrome() {
  useEffect(() => {
    const root = document.documentElement;
    const mobile = window.matchMedia("(max-width: 767px)");

    const sync = () => {
      const viewport = window.visualViewport;
      if (!mobile.matches || !viewport) {
        root.dataset.keyboard = "closed";
        root.style.setProperty("--keyboard-inset", "0px");
        return;
      }
      const inset = Math.max(
        0,
        window.innerHeight - viewport.offsetTop - viewport.height,
      );
      const open = inset > KEYBOARD_GAP;
      root.dataset.keyboard = open ? "open" : "closed";
      root.style.setProperty("--keyboard-inset", open ? `${inset}px` : "0px");
    };

    sync();
    mobile.addEventListener("change", sync);
    window.visualViewport?.addEventListener("resize", sync);
    window.visualViewport?.addEventListener("scroll", sync);
    return () => {
      mobile.removeEventListener("change", sync);
      window.visualViewport?.removeEventListener("resize", sync);
      window.visualViewport?.removeEventListener("scroll", sync);
      root.dataset.keyboard = "closed";
      root.style.setProperty("--keyboard-inset", "0px");
    };
  }, []);

  return null;
}
