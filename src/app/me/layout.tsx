import { AppFrame } from "@/components/layout/app-frame";
import { ME_NAV, type NavItemConfig } from "@/config/nav";
import { requireUserOrRedirect } from "@/lib/auth/redirect";
import { fa } from "@/lib/i18n/fa";
import { getNavBadges } from "@/server/queries/nav-badges";

export default async function MeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUserOrRedirect({
    roles: ["STAFF", "ADMIN", "MANAGER"],
    forbiddenPath: "/login",
  });
  const badges = getNavBadges(user);
  const isStaffOnly = user.role === "STAFF";

  const navItems: NavItemConfig[] = isStaffOnly
    ? ME_NAV
    : [
        {
          id: "back-admin",
          href: "/admin",
          label: fa.nav.dashboard,
          group: "main",
        },
        ...ME_NAV,
      ];

  return (
    <AppFrame
      user={user}
      navItems={navItems}
      badges={badges}
      variant={isStaffOnly ? "staff" : "admin"}
      narrow
    >
      {children}
    </AppFrame>
  );
}
