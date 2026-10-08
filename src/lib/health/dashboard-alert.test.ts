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
      stale: true,
      diskWarn: false,
    });
  });

  it("اجرای قدیمی‌تر از ۲ روز زرد است", () => {
    const old = report({
      ranAt: new Date(nowMs - 3 * 24 * 60 * 60 * 1000).toISOString(),
    });
    expect(dashboardHealthAlerts(old, nowMs)).toEqual({
      yellow: true,
      red: false,
      stale: true,
      diskWarn: false,
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
      stale: false,
      diskWarn: false,
    });
  });

  it("اجرای سالم و تازه Alert ندارد", () => {
    expect(dashboardHealthAlerts(report(), nowMs)).toEqual({
      yellow: false,
      red: false,
      stale: false,
      diskWarn: false,
    });
  });

  it("دیسک زیر ۱۵ درصد زرد و زیر ۸ درصد قرمز است", () => {
    const volume = {
      id: "data" as const,
      title: "پوشه داده",
      freeBytes: 1,
      totalBytes: 10,
      freeRatio: 0.1,
      level: "warn" as const,
    };
    const warn = report({
      disk: { volumes: [volume], sections: [] },
    });
    expect(dashboardHealthAlerts(warn, nowMs).diskWarn).toBe(true);
    expect(dashboardHealthAlerts(warn, nowMs).red).toBe(false);
    const critical = report({
      disk: {
        volumes: [{ ...volume, freeRatio: 0.05, level: "critical" }],
        sections: [],
      },
    });
    expect(dashboardHealthAlerts(critical, nowMs).red).toBe(true);
    expect(dashboardHealthAlerts(critical, nowMs).diskWarn).toBe(false);
  });
});
