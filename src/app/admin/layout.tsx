import { AppFrame } from "@/components/layout/app-frame";
import { ADMIN_NAV } from "@/config/nav";
import { requireUserOrRedirect } from "@/lib/auth/redirect";
import { getNavBadges } from "@/server/queries/nav-badges";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUserOrRedirect({
    roles: ["ADMIN", "MANAGER"],
    forbiddenPath: "/me",
  });
  const badges = getNavBadges(user);

  return (
    <AppFrame
      user={user}
      navItems={ADMIN_NAV}
      badges={badges}
      variant="admin"
    >
      {children}
    </AppFrame>
  );
}
