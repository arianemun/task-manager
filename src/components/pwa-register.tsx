"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;
    let stop = () => {};
    void navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        const update = () => {
          void registration.update();
        };
        update();
        document.addEventListener("visibilitychange", update);
        stop = () => document.removeEventListener("visibilitychange", update);
      })
      .catch(() => {
        /* نادیده */
      });
    return () => stop();
  }, []);
  return null;
}
