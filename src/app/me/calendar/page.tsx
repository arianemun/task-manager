import { CalendarView } from "@/components/me/calendar-view";
import { PageHeader } from "@/components/layout/page-header";
import { Stack } from "@/components/layout/stack";
import { requireUserOrRedirect } from "@/lib/auth/redirect";
import {
  addJalaliMonths,
  compareGDate,
  fromJalali,
  toJalali,
  todayTehran,
  type GDate,
} from "@/lib/dates";
import { fa } from "@/lib/i18n/fa";
import { dayDetail, loadMeCalendarMonth } from "@/server/queries/me-calendar";
import { lazyGenerateOnce } from "@/server/services/lazy-generate";

type Props = {
  searchParams: Promise<{ month?: string; date?: string }>;
};

export default async function MeCalendarPage({ searchParams }: Props) {
  const user = await requireUserOrRedirect({
    roles: ["STAFF", "ADMIN", "MANAGER"],
  });
  lazyGenerateOnce(user.id);

  const sp = await searchParams;
  const today = todayTehran();
  let anchor: GDate = today;
  if (sp.month && /^\d{4}-\d{2}$/.test(sp.month)) {
    const [jy, jm] = sp.month.split("-").map(Number);
    anchor = fromJalali(jy!, jm!, 1);
  }

  const cal = loadMeCalendarMonth(user.id, anchor);
  const cells = cal.cells.map((c) => ({
    ...c,
    isFuture: compareGDate(c.gDate, today) > 0,
    rate: compareGDate(c.gDate, today) > 0 ? null : c.rate,
  }));

  const selected =
    sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : undefined;
  const detail = selected ? dayDetail(user.id, selected) : undefined;

  const prev = toJalali(addJalaliMonths(cal.monthStart, -1));
  const next = toJalali(addJalaliMonths(cal.monthStart, 1));

  return (
    <Stack className="overflow-x-hidden">
      <PageHeader
        title={fa.nav.calendar}
        description="نمای ماهانه شمسی"
      />
      <CalendarView
        jy={cal.jy}
        jm={cal.jm}
        cells={cells}
        selected={selected}
        prevHref={`/me/calendar?month=${prev.jy}-${String(prev.jm).padStart(2, "0")}`}
        nextHref={`/me/calendar?month=${next.jy}-${String(next.jm).padStart(2, "0")}`}
        detail={detail}
      />
    </Stack>
  );
}
