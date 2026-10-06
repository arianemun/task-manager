import { ReportView } from "@/components/me/report-view";
import { PageHeader } from "@/components/layout/page-header";
import { Stack } from "@/components/layout/stack";
import { requireUserOrRedirect } from "@/lib/auth/redirect";
import { fa } from "@/lib/i18n/fa";
import { loadMeReport } from "@/server/queries/me-report";
import { lazyGenerateOnce } from "@/server/services/lazy-generate";

export default async function MeReportPage() {
  const user = await requireUserOrRedirect({
    roles: ["STAFF", "ADMIN", "MANAGER"],
  });
  lazyGenerateOnce(user.id);
  const data = loadMeReport(user.id);

  return (
    <Stack className="overflow-x-hidden">
      <PageHeader
        title={fa.nav.myReport}
        description="فقط عملکرد خودتان — بدون مقایسه با همکاران"
      />
      <ReportView data={data} />
    </Stack>
  );
}
