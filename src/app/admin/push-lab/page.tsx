import { and, asc, eq, isNull } from "drizzle-orm";
import { PushLab } from "@/components/admin/push-lab";
import { TaskNotifyLab } from "@/components/admin/task-notify-lab";
import { PageHeader } from "@/components/layout/page-header";
import { Stack } from "@/components/layout/stack";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireUserOrRedirect } from "@/lib/auth/redirect";
import { fa } from "@/lib/i18n/fa";

export default async function PushLabPage() {
  await requireUserOrRedirect({ roles: ["ADMIN"], forbiddenPath: "/admin" });
  const people = db
    .select({ id: users.id, fullName: users.fullName, role: users.role })
    .from(users)
    .where(and(eq(users.isActive, true), isNull(users.deletedAt)))
    .orderBy(asc(users.fullName))
    .all();
  return (
    <Stack>
      <PageHeader title={fa.pushLab.title} description={fa.pushLab.description} />
      <PushLab publicKey={process.env.VAPID_PUBLIC_KEY ?? ""} />
      <TaskNotifyLab users={people} />
    </Stack>
  );
}
