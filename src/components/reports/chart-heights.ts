/** ارتفاع ثابت نمودارها بر اساس breakpoint (کلاس Tailwind) */
export const CHART_H = {
  sm: "aspect-auto h-44 w-full sm:h-56 md:h-64",
  md: "aspect-auto h-48 w-full sm:h-64 md:h-72",
  lg: "aspect-auto h-52 w-full sm:h-72 md:h-80",
} as const;

/** ارتفاع میله‌ای افقی بر اساس تعداد ردیف */
export function staffBarHeightPx(rowCount: number, isMobile: boolean): number {
  const row = isMobile ? 28 : 32;
  const pad = isMobile ? 48 : 56;
  return Math.max(isMobile ? 180 : 220, rowCount * row + pad);
}
