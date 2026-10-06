import { describe, expect, it } from "vitest";
import { getDateLib, faIR } from "@daypicker/persian";
import { fromJalali, isJalaliLeap, toJalali } from "@/lib/dates";
import { gDateToPickerDate, pickerDateToGDate } from "@/lib/dates/picker";

describe("jalali daypicker bridge", () => {
  it("roundtrip GDate ↔ Date", () => {
    const g = fromJalali(1403, 12, 30);
    expect(isJalaliLeap(1403)).toBe(true);
    const d = gDateToPickerDate(g);
    expect(pickerDateToGDate(d)).toBe(g);
    expect(toJalali(g).jd).toBe(30);
  });

  it("daypicker lib formats leap Esfand", () => {
    const lib = getDateLib({ locale: faIR });
    const g = fromJalali(1403, 12, 30);
    const d = gDateToPickerDate(g);
    const formatted = lib.format(d, "yyyy/MM/dd");
    // ارقام ممکن است فارسی باشند
    expect(formatted.replace(/[۰-۹]/g, (c) => "۰۱۲۳۴۵۶۷۸۹".indexOf(c).toString())).toMatch(
      /1403\/12\/30/,
    );
  });
});
