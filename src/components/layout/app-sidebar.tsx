"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { AppCredit } from "@/components/layout/app-credit";
import { filterNav, groupNav, type NavItemConfig } from "@/config/nav";
import { navIcon } from "@/config/nav-icons";
import type { AuthUser } from "@/lib/auth/user";
import { fa } from "@/lib/i18n/fa";
import { toFaDigits } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

type Props = {
  user: AuthUser;
  items: NavItemConfig[];
  badges: { unread: number; unanswered: number; chat: number };
  /** پرسنل: روی موبایل sidebar رندر نشود (bottom nav جایگزین) */
  hideOnMobile?: boolean;
};

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin" || href === "/me") return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

function badgeValue(
  item: NavItemConfig,
  badges: Props["badges"],
): number | null {
  if (item.badge === "unread" && badges.unread > 0) return badges.unread;
  if (item.badge === "unanswered" && badges.unanswered > 0)
    return badges.unanswered;
  if (item.badge === "chat" && badges.chat > 0) return badges.chat;
  return null;
}

export function AppSidebar({
  user,
  items,
  badges,
  hideOnMobile = false,
}: Props) {
  const pathname = usePathname() || "/";
  const isMobile = useIsMobile();
  const { setOpenMobile, isMobile: sidebarMobile, state } = useSidebar();
  const visible = filterNav(user, items);
  const groups = groupNav(visible);

  if (hideOnMobile && isMobile) return null;

  function closeMobileNav() {
    if (sidebarMobile || isMobile) setOpenMobile(false);
  }

  return (
    <Sidebar side="right" collapsible="icon" variant="sidebar">
      <SidebarHeader className="border-b border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip={fa.appName}>
              <Link
                href={user.role === "STAFF" ? "/me" : "/admin"}
                onClick={closeMobileNav}
              >
                <ClipboardList className="size-5" />
                <div className="grid flex-1 text-start text-sm leading-snug">
                  <span className="truncate font-semibold">{fa.appName}</span>
                  <span className="text-muted-foreground truncate text-xs">
                    {fa.roles[user.role]}
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {groups.map((g) => (
          <SidebarGroup key={g.group}>
            <SidebarGroupLabel>{g.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {g.items.map((item) => {
                  const Icon = navIcon(item.id);
                  const active = isActive(pathname, item.href);
                  const badge = badgeValue(item, badges);
                  return (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={item.label}
                      >
                        <Link href={item.href} onClick={closeMobileNav}>
                          <Icon />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                      {badge != null ? (
                        <SidebarMenuBadge>
                          {toFaDigits(badge > 99 ? "99+" : badge)}
                        </SidebarMenuBadge>
                      ) : null}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip={user.fullName}
              className="pointer-events-none"
            >
              <span className="truncate text-xs">{user.fullName}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        {sidebarMobile || state === "expanded" ? <AppCredit /> : null}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
