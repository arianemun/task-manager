"use client";

import type { LucideIcon } from "lucide-react";
import {
  Building2,
  CalendarDays,
  CalendarOff,
  ClipboardList,
  Tags,
  FileBarChart2,
  FileText,
  Info,
  LayoutDashboard,
  ListTodo,
  Megaphone,
  MessageSquareWarning,
  Settings,
  Shield,
  UserRound,
  Users,
} from "lucide-react";

/** آیکن‌ها فقط در کلاینت resolve می‌شوند — از پاس دادن کامپوننت از Server جلوگیری می‌کند */
export const NAV_ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  "my-tasks": ListTodo,
  staff: Users,
  departments: Building2,
  tasks: ClipboardList,
  categories: Tags,
  reasons: MessageSquareWarning,
  board: LayoutDashboard,
  announcements: Megaphone,
  holidays: CalendarOff,
  reports: FileBarChart2,
  audit: Shield,
  settings: Settings,
  today: ListTodo,
  calendar: CalendarDays,
  "my-report": FileText,
  "my-info": Info,
  profile: UserRound,
  "back-admin": LayoutDashboard,
};

export function navIcon(id: string): LucideIcon {
  return NAV_ICONS[id] ?? ListTodo;
}
