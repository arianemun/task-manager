/**
 * تبدیل خالص میلادی ↔ جلالی بدون وابستگی به timezone سیستم.
 * الگوریتم استاندارد (مشابه jalaali-js).
 */

export type GregorianParts = { gy: number; gm: number; gd: number };
export type JalaliParts = { jy: number; jm: number; jd: number };

function div(a: number, b: number): number {
  return Math.trunc(a / b);
}

export function gregorianToJalali(gy: number, gm: number, gd: number): JalaliParts {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy = gy <= 1600 ? 0 : 979;
  gy -= gy <= 1600 ? 621 : 1600;
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days =
    365 * gy +
    div(gy2 + 3, 4) -
    div(gy2 + 99, 100) +
    div(gy2 + 399, 400) -
    80 +
    gd +
    g_d_m[gm - 1]!;
  jy += 33 * div(days, 12053);
  days %= 12053;
  jy += 4 * div(days, 1461);
  days %= 1461;
  if (days > 365) {
    jy += div(days - 1, 365);
    days = (days - 1) % 365;
  }
  const jm = days < 186 ? 1 + div(days, 31) : 7 + div(days - 186, 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return { jy, jm, jd };
}

export function jalaliToGregorian(jy: number, jm: number, jd: number): GregorianParts {
  let gy = jy <= 979 ? 621 : 1600;
  jy -= jy <= 979 ? 0 : 979;
  const days =
    365 * jy +
    div(jy, 33) * 8 +
    div((jy % 33) + 3, 4) +
    78 +
    jd +
    (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
  gy += 400 * div(days, 146097);
  let d = days % 146097;
  if (d > 36524) {
    gy += 100 * div(--d, 36524);
    d %= 36524;
    if (d >= 365) d++;
  }
  gy += 4 * div(d, 1461);
  d %= 1461;
  if (d > 365) {
    gy += div(d - 1, 365);
    d = (d - 1) % 365;
  }
  let gd = d + 1;
  const sal_a = [
    0,
    31,
    (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0 ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  let gm = 0;
  for (gm = 1; gm <= 12 && gd > sal_a[gm]!; gm++) {
    gd -= sal_a[gm]!;
  }
  return { gy, gm, gd };
}

/** کبیسه جلالی: سال‌هایی که باقیمانده به ۳۳ یکی از {1,5,9,13,17,22,26,30} است */
export function isJalaliLeapYear(jy: number): boolean {
  const breaks = [1, 5, 9, 13, 17, 22, 26, 30];
  const cy = jy > 0 ? jy - 474 : jy - 473;
  const jp = (cy % 2820) + 474;
  return breaks.includes(jp % 33);
}

export function jalaliMonthLength(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isJalaliLeapYear(jy) ? 30 : 29;
}
