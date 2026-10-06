import type { OccurrenceStatus } from "@/db/schema";

export function statusFromCompletion(
  completedAtMs: number,
  dueAtMs: number | null | undefined,
): Extract<OccurrenceStatus, "DONE" | "DONE_LATE"> {
  if (dueAtMs == null) return "DONE";
  return completedAtMs <= dueAtMs ? "DONE" : "DONE_LATE";
}
