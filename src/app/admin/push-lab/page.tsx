import { PushLab } from "@/components/admin/push-lab";
import { PageHeader } from "@/components/layout/page-header";
import { Stack } from "@/components/layout/stack";
import { requireUserOrRedirect } from "@/lib/auth/redirect";
import { fa } from "@/lib/i18n/fa";

export default async function PushLabPage() {
  await requireUserOrRedirect({ roles: ["ADMIN"], forbiddenPath: "/admin" });
  return (
    <Stack>
      <PageHeader title={fa.pushLab.title} description={fa.pushLab.description} />
      <PushLab publicKey={process.env.VAPID_PUBLIC_KEY ?? ""} />
    </Stack>
  );
}
