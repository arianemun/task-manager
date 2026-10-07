import { AppFrame } from "@/components/layout/app-frame";
import { ChatShell } from "@/components/chat/chat-shell";
import { ConversationList } from "@/components/chat/conversation-list";
import { ADMIN_NAV, ME_NAV } from "@/config/nav";
import { requireUserOrRedirect } from "@/lib/auth/redirect";
import {
  listActivePeers,
  listConversations,
  listDepartmentsForChat,
} from "@/lib/chat/store";
import { getNavBadges } from "@/server/queries/nav-badges";

export default async function ChatLayout({
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

  return (
    <AppFrame
      user={user}
      navItems={isStaffOnly ? ME_NAV : ADMIN_NAV}
      badges={badges}
      variant={isStaffOnly ? "staff" : "admin"}
      bleed
    >
      <ChatShell
        list={
          <ConversationList
            items={listConversations(user.id)}
            people={listActivePeers(user.id)}
            departments={user.role === "ADMIN" ? listDepartmentsForChat() : []}
            canCreateGroup={
              user.role === "ADMIN" ||
              user.permissions.includes("chat.create_group")
            }
            isAdmin={user.role === "ADMIN"}
          />
        }
      >
        {children}
      </ChatShell>
    </AppFrame>
  );
}
