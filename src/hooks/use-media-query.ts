"use client";

import { useEffect, useState } from "react";

/**
 * بدون flash/hydration mismatch: تا mount مقدار `defaultValue` برمی‌گردد
 * (برای ResponsiveDialog پیش‌فرض دسکتاپ = true تا SSR با Dialog هم‌خوان باشد).
 */
export function useMediaQuery(
  query: string,
  defaultValue = false,
): boolean {
  const [matches, setMatches] = useState(defaultValue);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  if (!mounted) return defaultValue;
  return matches;
}

/** md و بالاتر — هم‌تراز Tailwind `md:` */
export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 768px)", true);
}
