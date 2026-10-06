import { ReportShell } from "@/components/reports/report-shell";
import type { ReportFilters } from "@/lib/reports";
import type {
  aggregateByDepartment,
  aggregateByStaff,
  aggregateByDay,
  aggregateCompletionHours,
  aggregateReasons,
  aggregateStatusDonut,
  aggregateWeekdayRates,
  aggregateWorstTasks,
  listOccurrenceDetails,
  staffDayHeatmap,
} from "@/server/queries/admin-reports";

type Opt = { id: number; name: string; fullName?: string };

type Props = {
  filters: ReportFilters;
  basePath: string;
  departments: Opt[];
  staffOptions: Opt[];
  categories: Opt[];
  canExport: boolean;
  day: ReturnType<typeof aggregateByDay>;
  donut: ReturnType<typeof aggregateStatusDonut>;
  staff: ReturnType<typeof aggregateByStaff>;
  departmentsData: ReturnType<typeof aggregateByDepartment>;
  tasks: ReturnType<typeof aggregateWorstTasks>;
  weekdays: ReturnType<typeof aggregateWeekdayRates>;
  hours: ReturnType<typeof aggregateCompletionHours>;
  reasons: ReturnType<typeof aggregateReasons>;
  heatmap: ReturnType<typeof staffDayHeatmap>;
  details: ReturnType<typeof listOccurrenceDetails>;
  lockUserId: number;
  sharedGroup?: { periods: number; donePeriods: number; rate: number | null };
};

/** جدا از page تا import نمودار فقط با تب گزارش وارد گراف شود */
export function StaffReportPanel(props: Props) {
  return (
    <ReportShell
      {...props}
      showDepartment={false}
      lockUserId={props.lockUserId}
    />
  );
}
