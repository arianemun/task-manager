"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItemConfig } from "@/config/nav";
import { navIcon } from "@/config/nav-icons";
import { cn, toFaDigits } from "@/lib/utils";

type Props = {
  items: NavItemConfig[];
  badges: { unread: number; unanswered: number };
};

export function StaffBottomNav({ items, badges }: Props) {
  const pathname = usePathname() || "/";
  const shown = items.slice(0, 5);

  return (
    <nav
      data-bottom-nav
      className="border-border bg-card/95 fixed inset-x-0 bottom-0 z-20 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden print:hidden"
    >
      <ul className="grid grid-cols-5 gap-0.5 px-1 py-1.5">
        {shown.map((item) => {
          const Icon = navIcon(item.id);
          const active =
            item.href === "/me"
              ? pathname === "/me"
              : pathname === item.href || pathname.startsWith(item.href + "/");
          const badge =
            item.badge === "unread" && badges.unread > 0
              ? badges.unread
              : null;
          return (
            <li key={item.id}>
              <Link
                href={item.href}
                className={cn(
                  "relative flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-md px-1 py-1 text-xs transition-colors",
                  active
                    ? "text-primary bg-accent/60"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="relative">
                  <Icon className="size-5" />
                  {badge != null ? (
                    <span className="bg-destructive text-destructive-foreground absolute -top-1.5 -end-2 flex size-4 items-center justify-center rounded-full text-[9px] font-semibold">
                      {toFaDigits(badge > 9 ? "۹+" : badge)}
                    </span>
                  ) : null}
                </span>
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
