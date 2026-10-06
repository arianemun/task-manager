import { describe, expect, it } from "vitest";
import {
  dashboardHealthAlerts,
  type HealthReport,
} from "./db-check";

const nowMs = Date.parse("2026-10-06T12:00:00.000Z");

function report(overrides: Partial<HealthReport> = {}): HealthReport {
  return {
    ranAt: new Date(nowMs).toISOString(),
    ok: true,
    elapsedMs: 1,
    checks: [
      {
        id: "foreign_close",
        title: "نمونه",
        count: 0,
        sampleIds: [],
        durationMs: 1,
      },
    ],
    ...overrides,
  };
}

describe("منطق Alert داشبورد سلامت داده", () => {
  it("بدون اجرا زرد است", () => {
    expect(dashboardHealthAlerts(null, nowMs)).toEqual({
      yellow: true,
      red: false,
    });
  });

  it("اجرای قدیمی‌تر از ۲ روز زرد است", () => {
    const old = report({
      ranAt: new Date(nowMs - 3 * 24 * 60 * 60 * 1000).toISOString(),
    });
    expect(dashboardHealthAlerts(old, nowMs)).toEqual({
      yellow: true,
      red: false,
    });
  });

  it("اجرای تازه با مشکل قرمز است", () => {
    const bad = report({
      ok: false,
      checks: [
        {
          id: "stale_pending",
          title: "PENDING",
          count: 4,
          sampleIds: [1],
          durationMs: 1,
        },
      ],
    });
    expect(dashboardHealthAlerts(bad, nowMs)).toEqual({
      yellow: false,
      red: true,
    });
  });

  it("اجرای سالم و تازه Alert ندارد", () => {
    expect(dashboardHealthAlerts(report(), nowMs)).toEqual({
      yellow: false,
      red: false,
    });
  });
});
