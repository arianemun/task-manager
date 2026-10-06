import { AuditDataTable } from "@/components/audit/audit-data-table";
import { PageHeader } from "@/components/layout/page-header";
import { Stack } from "@/components/layout/stack";
import { requireUserOrRedirect } from "@/lib/auth/redirect";
import { fa } from "@/lib/i18n/fa";
import { toFaDigits } from "@/lib/utils";
import { listAuditLogs } from "@/server/queries/audit";
import { listStaffForActor } from "@/server/queries/staff";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function get(sp: Record<string, string | string[] | undefined>, k: string) {
  const v = sp[k];
  return Array.isArray(v) ? v[0] : v;
}

export default async function AuditPage({ searchParams }: Props) {
  const actor = await requireUserOrRedirect({
    roles: ["ADMIN"],
    forbiddenPath: "/admin",
  });
  const sp = await searchParams;
  const action = get(sp, "action") || null;
  const actorId = get(sp, "actorId") ? Number(get(sp, "actorId")) : null;
  const from = get(sp, "from") || null;
  const to = get(sp, "to") || null;
  const page = Number(get(sp, "page") || 1);
  const pageSize = Number(get(sp, "pageSize") || 30);

  const data = listAuditLogs({
    action,
    actorId: Number.isInteger(actorId) ? actorId : null,
    from: from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : null,
    to: to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : null,
    page,
    pageSize: Number.isFinite(pageSize) ? pageSize : 30,
  });

  const { rows: staff } = listStaffForActor(actor, {
    status: "all",
    pageSize: 200,
  });

  return (
    <Stack>
      <PageHeader
        title={fa.nav.audit}
        description={`فقط مدیر کل — مجموع ${toFaDigits(data.total)} رویداد`}
      />

      <AuditDataTable
        rows={data.rows}
        total={data.total}
        page={data.page}
        pageSize={data.pageSize}
        actions={data.actions}
        staff={staff.map((s) => ({ id: s.id, fullName: s.fullName }))}
      />
    </Stack>
  );
}
