import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { AppPresence } from "@/components/chat/app-presence";
import { ChatNotifier } from "@/components/chat/chat-notifier";
import { PermissionPrep } from "@/components/permissions/permission-prep";
import { PushSync } from "@/components/push/push-sync";
import { db } from "@/db";
import { users } from "@/db/schema";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { PageContainer } from "@/components/layout/page-container";
import { SiteHeader } from "@/components/layout/site-header";
import { StaffBottomNav } from "@/components/layout/staff-bottom-nav";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import type { NavItemConfig } from "@/config/nav";
import type { AuthUser } from "@/lib/auth/user";
import {
  countUnreadNotifications,
  listNotifications,
} from "@/lib/notifications/store";

type Props = {
  user: AuthUser;
  navItems: NavItemConfig[];
  badges: { unread: number; unanswered: number; chat: number };
  /** STAFF: bottom nav روی موبایل، بدون sidebar موبایل */
  variant: "admin" | "staff";
  /** عرض محتوا باریک‌تر (صفحات /me) */
  narrow?: boolean;
  /** گفتگو: کانتینر بدون padding تا لبه امن یک‌بار در خود صفحه اعمال شود */
  bleed?: boolean;
  children: ReactNode;
};

export async function AppFrame({
  user,
  navItems,
  badges,
  variant,
  narrow = false,
  bleed = false,
  children,
}: Props) {
  const snooze = db
    .select({
      until: users.permissionsSnoozeUntil,
      setupCompleted: users.permissionsSetupCompleted,
    })
    .from(users)
    .where(eq(users.id, user.id))
    .get();
  const jar = await cookies();
  const cookie = jar.get("sidebar_state")?.value;
  const defaultOpen = cookie !== "false";
  const staffMobile = variant === "staff";

  return (
    <SidebarProvider defaultOpen={defaultOpen} className="min-h-dvh">
      <a
        href="#main-content"
        className="bg-primary text-primary-foreground focus:ring-ring sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:rounded-md focus:px-3 focus:py-2 focus:ring-2"
      >
        پرش به محتوا
      </a>

      <AppSidebar
        user={user}
        items={navItems}
        badges={badges}
        hideOnMobile={staffMobile}
      />

      <SidebarInset
        className="min-w-0"
        data-has-bottom-nav={staffMobile ? "" : undefined}
      >
        <ChatNotifier userId={user.id} />
        <AppPresence />
        <PushSync />
        <PermissionPrep
          snoozeUntil={snooze?.until?.getTime() ?? null}
          setupCompleted={snooze?.setupCompleted ?? false}
        />

        <SiteHeader
          fullName={user.fullName}
          role={user.role}
          avatarPath={user.avatarPath}
          notificationUnread={countUnreadNotifications(user.id)}
          notifications={listNotifications(user.id, 1, 15)}
          hideTriggerOnMobile={staffMobile}
        />

        <PageContainer
          narrow={narrow}
          className={
            bleed
              ? "chat-bleed"
              : staffMobile
                ? "pb-[calc(var(--bottom-chrome)+1rem)] md:pb-6 lg:pb-8"
                : undefined
          }
        >
          <div id="main-content">{children}</div>
        </PageContainer>

        {staffMobile ? (
          <StaffBottomNav items={navItems} badges={badges} />
        ) : null}
      </SidebarInset>
    </SidebarProvider>
  );
}
