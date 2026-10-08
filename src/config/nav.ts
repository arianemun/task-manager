import type { Permission, Role } from "@/db/schema";
import type { AuthUser } from "@/lib/auth/user";
import { fa } from "@/lib/i18n/fa";

export type NavGroupId = "main" | "manage" | "reports" | "settings" | "me";

export type NavBadgeKind = "unread" | "unanswered" | "chat";

export type NavBadges = {
  unread: number;
  unanswered: number;
  chat: number;
};

export const STAFF_BOTTOM_NAV_IDS = [
  "today",
  "calendar",
  "chat",
  "my-report",
  "profile",
] as const;

/** بدون کامپوننت — سریال‌پذیر برای Server → Client */
export type NavItemConfig = {
  id: string;
  href: string;
  label: string;
  group: NavGroupId;
  /** اگر خالی باشد همه نقش‌های مجاز layout */
  roles?: Role[];
  /** هر یک از این مجوزها کافی است؛ ADMIN همیشه می‌بیند */
  permissions?: Permission[];
  adminOnly?: boolean;
  badge?: NavBadgeKind;
};

export const NAV_GROUP_LABELS: Record<NavGroupId, string> = {
  main: "اصلی",
  manage: "مدیریت",
  reports: "گزارش‌ها",
  settings: "تنظیمات",
  me: "کارهای من",
};

/** منوی مدیر / سرپرست */
export const ADMIN_NAV: NavItemConfig[] = [
  {
    id: "dashboard",
    href: "/admin",
    label: fa.nav.dashboard,
    group: "main",
    badge: "unanswered",
  },
  {
    id: "chat",
    href: "/chat",
    label: fa.nav.chat,
    group: "main",
    badge: "chat",
  },
  {
    id: "my-tasks",
    href: "/me",
    label: "کارهای من",
    group: "main",
  },
  {
    id: "staff",
    href: "/admin/staff",
    label: fa.nav.staff,
    group: "manage",
    permissions: ["staff.manage"],
  },
  {
    id: "departments",
    href: "/admin/departments",
    label: fa.nav.departments,
    group: "manage",
    permissions: ["staff.manage"],
  },
  {
    id: "tasks",
    href: "/admin/tasks",
    label: fa.nav.tasks,
    group: "manage",
    permissions: ["tasks.create", "tasks.assign"],
  },
  {
    id: "categories",
    href: "/admin/categories",
    label: fa.nav.categories,
    group: "manage",
    permissions: ["tasks.create"],
  },
  {
    id: "reasons",
    href: "/admin/reasons",
    label: fa.nav.reasons,
    group: "manage",
    permissions: ["tasks.create"],
  },
  {
    id: "board",
    href: "/admin/board",
    label: fa.nav.board,
    group: "manage",
    permissions: ["tasks.assign"],
  },
  {
    id: "announcements",
    href: "/admin/announcements",
    label: fa.nav.announcements,
    group: "manage",
    permissions: ["announcements.manage"],
    badge: "unread",
  },
  {
    id: "holidays",
    href: "/admin/holidays",
    label: fa.nav.holidays,
    group: "settings",
    adminOnly: true,
  },
  {
    id: "reports",
    href: "/admin/reports",
    label: fa.nav.reports,
    group: "reports",
    permissions: [
      "reports.view_all",
      "reports.view_department",
      "reports.export",
    ],
  },
  {
    id: "audit",
    href: "/admin/audit",
    label: fa.nav.audit,
    group: "settings",
    adminOnly: true,
  },
  {
    id: "settings",
    href: "/admin/settings",
    label: fa.nav.settings,
    group: "settings",
    adminOnly: true,
  },
  {
    id: "push-lab",
    href: "/admin/push-lab",
    label: fa.nav.pushLab,
    group: "settings",
    adminOnly: true,
  },
];

/** منوی پرسنل (/me) */
export const ME_NAV: NavItemConfig[] = [
  {
    id: "today",
    href: "/me",
    label: fa.nav.today,
    group: "me",
  },
  {
    id: "calendar",
    href: "/me/calendar",
    label: fa.nav.calendar,
    group: "me",
  },
  {
    id: "chat",
    href: "/chat",
    label: fa.nav.chat,
    group: "me",
    badge: "chat",
  },
  {
    id: "my-report",
    href: "/me/report",
    label: fa.nav.myReport,
    group: "me",
  },
  {
    id: "my-info",
    href: "/me/info",
    label: fa.nav.myInfo,
    group: "me",
    badge: "unread",
  },
  {
    id: "profile",
    href: "/me/profile",
    label: fa.nav.profile,
    group: "me",
    badge: "unread",
  },
];

export function canSeeNavItem(user: AuthUser, item: NavItemConfig): boolean {
  if (item.adminOnly && user.role !== "ADMIN") return false;
  if (item.roles && !item.roles.includes(user.role)) return false;
  if (user.role === "ADMIN") return true;
  if (!item.permissions || item.permissions.length === 0) return true;
  return item.permissions.some((p) => user.permissions.includes(p));
}

export function filterNav(
  user: AuthUser,
  items: NavItemConfig[],
): NavItemConfig[] {
  return items.filter((i) => canSeeNavItem(user, i));
}

export function groupNav(
  items: NavItemConfig[],
): Array<{ group: NavGroupId; label: string; items: NavItemConfig[] }> {
  const order: NavGroupId[] = ["main", "me", "manage", "reports", "settings"];
  return order
    .map((group) => ({
      group,
      label: NAV_GROUP_LABELS[group],
      items: items.filter((i) => i.group === group),
    }))
    .filter((g) => g.items.length > 0);
}

/** برچسب فارسی سگمنت مسیر برای Breadcrumb */
export const PATH_LABELS: Record<string, string> = {
  admin: "مدیریت",
  me: "کارهای من",
  staff: fa.nav.staff,
  departments: fa.nav.departments,
  tasks: fa.nav.tasks,
  categories: fa.nav.categories,
  reasons: fa.nav.reasons,
  board: fa.nav.board,
  announcements: fa.nav.announcements,
  holidays: fa.nav.holidays,
  reports: fa.nav.reports,
  audit: fa.nav.audit,
  settings: fa.nav.settings,
  "push-lab": fa.nav.pushLab,
  calendar: fa.nav.calendar,
  report: fa.nav.myReport,
  info: fa.nav.myInfo,
  profile: fa.nav.profile,
  chat: fa.nav.chat,
  new: "جدید",
  bulk: fa.common.bulkAddTasks,
  login: fa.auth.login,
  "change-password": fa.auth.changePassword,
};
