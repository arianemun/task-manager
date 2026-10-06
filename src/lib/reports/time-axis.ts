/**
 * جهت محور زمان در کل اپ (یک تصمیم ثابت):
 * **ltr-chronological** — چپ = قدیمی‌تر، راست = جدیدتر.
 *
 * حتی در UI راست‌به‌چپ، سری‌های زمانی نمودارها از قدیم به جدید مرتب می‌شوند
 * تا مقایسه روند با عرف نمودارهای مدیریتی یکسان بماند.
 */
export const CHART_TIME_AXIS = "ltr-chronological" as const;

export type ChartTimeAxis = typeof CHART_TIME_AXIS;
