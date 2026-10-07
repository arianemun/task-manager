import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { PageContainer } from "@/components/layout/page-container";
import { SiteHeader } from "@/components/layout/site-header";
import { StaffBottomNav } from "@/components/layout/staff-bottom-nav";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import type { NavItemConfig } from "@/config/nav";
import type { AuthUser } from "@/lib/auth/user";

type Props = {
  user: AuthUser;
  navItems: NavItemConfig[];
  badges: { unread: number; unanswered: number };
  /** STAFF: bottom nav روی موبایل، بدون sidebar موبایل */
  variant: "admin" | "staff";
  /** عرض محتوا باریک‌تر (صفحات /me) */
  narrow?: boolean;
  children: ReactNode;
};

export async function AppFrame({
  user,
  navItems,
  badges,
  variant,
  narrow = false,
  children,
}: Props) {
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
        <SiteHeader
          fullName={user.fullName}
          role={user.role}
          avatarPath={user.avatarPath}
          hideTriggerOnMobile={staffMobile}
        />

        <PageContainer
          narrow={narrow}
          className={
            staffMobile
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
