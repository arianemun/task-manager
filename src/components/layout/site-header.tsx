"use client";

import { PanelRightIcon } from "lucide-react";
import { AppBreadcrumbs } from "@/components/layout/app-breadcrumbs";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { UserMenu } from "@/components/layout/user-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import type { Role } from "@/db/schema";
import { fa } from "@/lib/i18n/fa";
import type { NotificationItem } from "@/lib/notifications/types";
import { cn } from "@/lib/utils";

type Props = {
  fullName: string;
  role: Role;
  avatarPath?: string | null;
  notificationUnread: number;
  notifications: NotificationItem[];
  /** مخفی کردن تریگر روی موبایل (پرسنل با bottom nav) */
  hideTriggerOnMobile?: boolean;
};

export function SiteHeader({
  fullName,
  role,
  avatarPath,
  notificationUnread,
  notifications,
  hideTriggerOnMobile = false,
}: Props) {
  return (
    <header
      data-app-header
      className="border-border bg-background/80 sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b backdrop-blur-md md:h-16 print:hidden"
    >
      <SidebarTrigger
        className={cn(
          "[&_svg]:size-5",
          hideTriggerOnMobile && "max-md:hidden",
        )}
        aria-label="منو"
      >
        <PanelRightIcon />
      </SidebarTrigger>

      <Separator
        orientation="vertical"
        className={cn(
          "mx-0.5 hidden h-5 sm:block",
          hideTriggerOnMobile && "max-md:hidden",
        )}
      />

      <div className="min-w-0 flex-1">
        <AppBreadcrumbs />
      </div>

      <div className="flex items-center gap-2">
        <NotificationBell initialUnread={notificationUnread} initialItems={notifications} />
        <ThemeToggle />
        <UserMenu
          fullName={fullName}
          roleLabel={fa.roles[role]}
          avatarPath={avatarPath}
        />
      </div>
    </header>
  );
}
