import type { OccurrenceStatus } from "@/db/schema";
import {
  Ban,
  Check,
  Clock,
  HelpCircle,
  Timer,
  X,
  type LucideIcon,
} from "lucide-react";

/** کلاس پس‌زمینه از توکن‌های --status-* در globals.css */
export const STATUS_COLORS: Record<
  OccurrenceStatus,
  { bg: string; label: string }
> = {
  PENDING: { bg: "bg-status-pending", label: "در انتظار" },
  DONE: { bg: "bg-status-done", label: "انجام شد" },
  DONE_LATE: { bg: "bg-status-late", label: "با تأخیر" },
  NOT_DONE: { bg: "bg-status-not-done", label: "انجام نشد" },
  MISSED: { bg: "bg-status-missed", label: "فراموش‌شده" },
  EXCUSED: { bg: "bg-status-excused", label: "معاف" },
};

export const STATUS_DOT: Record<OccurrenceStatus, string> = {
  PENDING: "dot-status-pending",
  DONE: "dot-status-done",
  DONE_LATE: "dot-status-late",
  NOT_DONE: "dot-status-not-done",
  MISSED: "dot-status-missed",
  EXCUSED: "dot-status-excused",
};

export const STATUS_ICONS: Record<OccurrenceStatus, LucideIcon> = {
  PENDING: Clock,
  DONE: Check,
  DONE_LATE: Timer,
  NOT_DONE: X,
  MISSED: HelpCircle,
  EXCUSED: Ban,
};
