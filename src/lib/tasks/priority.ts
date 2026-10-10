import { PRIORITIES, type Priority } from "@/db/schema";

export const PRIORITY_RANK: Record<Priority, number> = {
  DO: 0,
  SCHEDULE: 1,
  DELEGATE: 2,
  ELIMINATE: 3,
};

/** مقدارهای قدیمی کم/متوسط/زیاد هم به خانهٔ ماتریس تبدیل می‌شوند. */
export function normalizeTaskPriority(value: unknown): Priority {
  if (value === "HIGH" || value === "DO") return "DO";
  if (value === "DELEGATE") return "DELEGATE";
  if (value === "LOW" || value === "ELIMINATE") return "ELIMINATE";
  if (value === "SCHEDULE" || value === "MEDIUM" || value == null || value === "") return "SCHEDULE";
  return PRIORITIES.includes(value as Priority) ? (value as Priority) : "SCHEDULE";
}

/**
 * مختصات از گوشهٔ چپ بالای ماتریس.
 * نیمهٔ راست فوری است و نیمهٔ بالا مهم.
 */
export function quadrantAt(x: number, y: number, width: number, height: number): Priority {
  if (width <= 0 || height <= 0) return "SCHEDULE";
  const urgent = x >= width / 2;
  const important = y <= height / 2;
  if (important && urgent) return "DO";
  if (important) return "SCHEDULE";
  if (urgent) return "DELEGATE";
  return "ELIMINATE";
}

export function nudgePriority(current: Priority, key: string): Priority {
  let urgent = current === "DO" || current === "DELEGATE";
  let important = current === "DO" || current === "SCHEDULE";
  if (key === "ArrowRight") urgent = true;
  else if (key === "ArrowLeft") urgent = false;
  else if (key === "ArrowUp") important = true;
  else if (key === "ArrowDown") important = false;
  else return current;
  if (important && urgent) return "DO";
  if (important) return "SCHEDULE";
  if (urgent) return "DELEGATE";
  return "ELIMINATE";
}
