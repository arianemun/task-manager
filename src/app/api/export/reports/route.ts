import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { authErrorResponse } from "@/lib/auth/http";
import { requireUser } from "@/lib/auth/user";
import { toJalali } from "@/lib/dates";
import { parseReportFilters } from "@/lib/reports";
import { fa } from "@/lib/i18n/fa";
import {
  aggregateByStaff,
  aggregateStatusDonut,
  listOccurrenceDetails,
} from "@/server/queries/admin-reports";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const actor = await requireUser({ roles: ["ADMIN", "MANAGER"] });
    const canExport =
      actor.role === "ADMIN" || actor.permissions.includes("reports.export");
    if (!canExport) {
      return NextResponse.json({ error: "مجوز خروجی ندارید" }, { status: 403 });
    }

    const url = new URL(request.url);
    const sp = Object.fromEntries(url.searchParams.entries());
    const filters = parseReportFilters(sp);
    if (actor.role === "MANAGER" && actor.departmentId) {
      filters.departmentId = actor.departmentId;
    }
    filters.page = 1;
    filters.pageSize = 5000;

    const donut = aggregateStatusDonut(actor, filters);
    const staff = aggregateByStaff(actor, filters);
    const details = listOccurrenceDetails(actor, filters);

    const wb = new ExcelJS.Workbook();
    wb.creator = "task-manager";

    const summary = wb.addWorksheet("خلاصه", {
      views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }],
    });
    summary.columns = [
      { header: "شاخص", key: "k", width: 28 },
      { header: "مقدار", key: "v", width: 18 },
    ];
    summary.getRow(1).font = { bold: true };
    const jFrom = toJalali(filters.from).jDate;
    const jTo = toJalali(filters.to).jDate;

    // تاریخ‌ها متن شمسی؛ اعداد به‌صورت number
    summary.addRow({ k: "از", v: jFrom });
    summary.addRow({ k: "تا", v: jTo });
    summary.addRow({
      k: "درصد انجام",
      v: donut.rates.completionRate ?? null,
    });
    summary.addRow({ k: "به‌موقع", v: donut.rates.onTimeRate ?? null });
    summary.addRow({ k: "قابل شمارش", v: donut.rates.countable });
    summary.addRow({ k: "کل", v: donut.rates.total });
    summary.addRow({ k: "انجام", v: donut.rates.done });
    summary.addRow({ k: "تأخیر", v: donut.rates.doneLate });
    summary.addRow({ k: "انجام‌نشده", v: donut.rates.notDone });
    summary.addRow({ k: "فراموش", v: donut.rates.missed });
    summary.getCell(3, 2).numFmt = "0.0";
    summary.getCell(4, 2).numFmt = "0.0";
    for (let r = 5; r <= 10; r++) {
      summary.getCell(r, 2).numFmt = "0";
    }

    const staffSheet = wb.addWorksheet("خلاصه پرسنل", {
      views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }],
    });
    staffSheet.columns = [
      { header: "پرسنل", key: "name", width: 24 },
      { header: "کل", key: "total", width: 10 },
      { header: "انجام", key: "done", width: 10 },
      { header: "تأخیر", key: "late", width: 10 },
      { header: "انجام‌نشده", key: "nd", width: 12 },
      { header: "فراموش", key: "miss", width: 10 },
      { header: "درصد", key: "rate", width: 10 },
      { header: "بهترین streak", key: "streak", width: 14 },
    ];
    staffSheet.getRow(1).font = { bold: true };
    for (const s of staff) {
      const row = staffSheet.addRow({
        name: s.fullName,
        total: s.total,
        done: s.done,
        late: s.doneLate,
        nd: s.notDone,
        miss: s.missed,
        rate: s.completionRate,
        streak: s.bestStreak,
      });
      for (let c = 2; c <= 8; c++) {
        row.getCell(c).numFmt = "0";
      }
    }

    const detailSheet = wb.addWorksheet("جزئیات", {
      views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }],
    });
    detailSheet.columns = [
      { header: "پرسنل", key: "name", width: 22 },
      { header: "کار", key: "title", width: 28 },
      { header: "پایان دوره (شمسی)", key: "end", width: 16 },
      { header: "وضعیت", key: "status", width: 14 },
      { header: "دلیل", key: "reason", width: 16 },
      { header: "توضیح", key: "note", width: 32 },
    ];
    detailSheet.getRow(1).font = { bold: true };

    for (const r of details.rows) {
      detailSheet.addRow({
        name: r.fullName,
        title: r.title,
        end: toJalali(r.periodEnd).jDate,
        status: fa.status[r.status as keyof typeof fa.status] ?? r.status,
        reason: r.reasonCode ?? "",
        note: r.note ?? "",
      });
    }

    const buf = await wb.xlsx.writeBuffer();
    const filename = `report_${jFrom}_${jTo}.xlsx`.replace(/\//g, "-");

    return new NextResponse(Buffer.from(buf), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }
}
