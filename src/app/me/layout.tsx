import { AppFrame } from "@/components/layout/app-frame";
import { ADMIN_NAV, ME_NAV } from "@/config/nav";
import { requireUserOrRedirect } from "@/lib/auth/redirect";
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
  // مدیر و سرپرست در پروفایل و بقیهٔ /me هم همان منوی داشبورد را ببینند
  const navItems = isStaffOnly ? ME_NAV : ADMIN_NAV;

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
