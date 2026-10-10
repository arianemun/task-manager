import { fa } from "@/lib/i18n/fa";

export function occurrenceStatusLabel(status: string, notStarted = false): string {
  if (notStarted) return fa.tasks.notStarted;
  return fa.status[status as keyof typeof fa.status] ?? status;
}
