import { TodayBoard } from "@/components/me/today-board";
import { requireUserOrRedirect } from "@/lib/auth/redirect";
import { jalaliWeekday, toJalali, todayTehran } from "@/lib/dates";
import { fa } from "@/lib/i18n/fa";
import { getNotDoneReasons } from "@/lib/settings/not-done-reasons";
import { toFaDigits } from "@/lib/utils";
import { listAnnouncementsForStaff } from "@/server/queries/announcements";
import { loadMeReport } from "@/server/queries/me-report";
import { loadMeToday } from "@/server/queries/me-today";
import { lazyGenerateOnce } from "@/server/services/lazy-generate";

export default async function MeTodayPage() {
  const user = await requireUserOrRedirect({
    roles: ["STAFF", "ADMIN", "MANAGER"],
  });
  lazyGenerateOnce(user.id);

  const data = loadMeToday(user.id);
  const report = loadMeReport(user.id);
  const reasons = getNotDoneReasons();
  const today = todayTehran();
  const j = toJalali(today);
  const wd = jalaliWeekday(today);
  const jalaliDateLabel = `${fa.weekdays[wd as keyof typeof fa.weekdays]} ${toFaDigits(j.jDate)}`;

  const pinned = listAnnouncementsForStaff(user)
    .filter((a) => a.isPinned)
    .slice(0, 5)
    .map((a) => ({ id: a.id, title: a.title, body: a.body }));

  return (
    <TodayBoard
      fullName={user.fullName}
      jalaliDateLabel={jalaliDateLabel}
      todayList={data.todayList}
      weekList={data.weekList}
      monthList={data.monthList}
      excusedList={data.excusedList}
      progress={data.progress}
      showLeaveBanner={data.showLeaveBanner}
      reasons={reasons}
      streakCurrent={report.streaks.current}
      streakBest={report.streaks.best}
      pinned={pinned}
    />
  );
}
