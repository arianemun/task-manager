import { compareGDate, type GDate } from "@/lib/dates";

/** مسیری که کاربر را برای یک قالب واجد شرایط کرده است. */
export type OccurrenceSourcePath =
  | { kind: "department"; departmentId: number }
  | { kind: "direct" };

export type OccurrenceSourceMembership = {
  departmentId: number;
  /** تاریخ پیوستن به همان دپارتمان. تهی یعنی نامعلوم. */
  joinedAt: GDate | null;
};

/**
 * دپارتمان منبع یک occurrence.
 *
 * برای هر قالب، کاربر و دوره فقط یک ردیف ساخته می‌شود. اگر چند مسیر
 * هم‌زمان واجد شرایط باشند، منبع با این اولویت انتخاب می‌شود:
 *
 * 1. اساین دپارتمانی که کاربر عضو اصلی آن است (`users.department_id`).
 * 2. وگرنه اساین دپارتمانی با قدیمی‌ترین عضویت. تساوی تاریخ با شناسه
 *    کوچک‌تر دپارتمان شکسته می‌شود. عضویت بدون تاریخ بعد از عضویت‌های
 *    تاریخ‌دار می‌آید.
 * 3. اگر مسیر دپارتمانی نباشد، اساین مستقیم و دپارتمان اصلی همان لحظه.
 *    اگر دپارتمان اصلی تهی باشد منبع تهی است.
 */
export function resolveOccurrenceSource(input: {
  paths: OccurrenceSourcePath[];
  primaryDepartmentId: number | null;
  memberships: OccurrenceSourceMembership[];
}): number | null {
  const departmentIds = [
    ...new Set(
      input.paths.flatMap((path) =>
        path.kind === "department" ? [path.departmentId] : [],
      ),
    ),
  ];

  if (departmentIds.length > 0) {
    if (
      input.primaryDepartmentId != null &&
      departmentIds.includes(input.primaryDepartmentId)
    ) {
      return input.primaryDepartmentId;
    }

    const ranked = departmentIds
      .map((departmentId) => ({
        departmentId,
        joinedAt:
          input.memberships.find((row) => row.departmentId === departmentId)
            ?.joinedAt ?? null,
      }))
      .sort((a, b) => {
        if (a.joinedAt && b.joinedAt) {
          const byDate = compareGDate(a.joinedAt, b.joinedAt);
          if (byDate !== 0) return byDate;
        } else if (a.joinedAt && !b.joinedAt) {
          return -1;
        } else if (!a.joinedAt && b.joinedAt) {
          return 1;
        }
        return a.departmentId - b.departmentId;
      });
    return ranked[0]?.departmentId ?? null;
  }

  if (input.paths.some((path) => path.kind === "direct")) {
    return input.primaryDepartmentId;
  }
  return null;
}
