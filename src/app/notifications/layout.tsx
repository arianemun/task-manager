import { AppFrame } from "@/components/layout/app-frame";
import { ADMIN_NAV, ME_NAV } from "@/config/nav";
import { requireUserOrRedirect } from "@/lib/auth/redirect";
import { getNavBadges } from "@/server/queries/nav-badges";

export default async function NotificationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUserOrRedirect({
    roles: ["STAFF", "ADMIN", "MANAGER"],
    forbiddenPath: "/login",
  });
  const isStaffOnly = user.role === "STAFF";
  return (
    <AppFrame
      user={user}
      navItems={isStaffOnly ? ME_NAV : ADMIN_NAV}
      badges={getNavBadges(user)}
      variant={isStaffOnly ? "staff" : "admin"}
      narrow
    >
      {children}
    </AppFrame>
  );
}
