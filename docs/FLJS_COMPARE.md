# First Load JS — مقایسه قبل/بعد بازطراحی UI

تاریخ اندازه‌گیری فاز F: ۱۴۰۴/۰۷/۱۴ · بهینه‌سازی dynamic charts: ۱۴۰۴/۰۷/۱۴ · Next 15.5.27

## مبنای «قبل از بازطراحی»

آرتیفکت build قبل از فاز A در مخزن نبود. جدول فاز F = وضعیت پایان بازطراحی (قبل از `next/dynamic` برای recharts).

## بهینه‌سازی نمودار (پس از تأیید فاز F)

`ReportShell` نمودارها را از `dynamic-charts.tsx` با `next/dynamic` + `ssr: false` + `ChartSkeleton` لود می‌کند. در `/admin/staff/[id]` پنل گزارش با `await import(...)` فقط وقتی تب گزارش باز است وارد گراف می‌شود.

| Route | قبل (پایان فاز F) | بعد (dynamic charts) | Δ | Δ٪ |
|---|---:|---:|---:|---:|
| `/admin/reports` | **410 kB** | **284 kB** | −126 kB | **−۳۰٫۷٪** |
| `/admin/staff/[id]` | **472 kB** | **346 kB** | −126 kB | **−۲۶٫۷٪** |
| First Load JS shared | 102 kB | 103 kB | +1 kB | — |

هر دو route بیش از ۲۰٪ کوچک‌تر شدند؛ بستهٔ `recharts` به chunk ناهمزمان منتقل شد و با اسکلتون همان شکل نمایش داده می‌شود تا دانلود تمام شود.

## جدول کامل پس از dynamic charts

| Route | Size | First Load JS | یادداشت |
|---|---:|---:|---|
| `/` | 160 B | 103 kB | نزدیک shared |
| `/login` | 8.23 kB | 158 kB | Form + RHF |
| `/change-password` | 7.08 kB | 157 kB | Form |
| `/me` | 12 kB | 168 kB | کارت‌ها + ResponsiveDialog |
| `/me/calendar` | 7.08 kB | 168 kB | تقویم + Drawer |
| `/me/info` | 8.06 kB | 206 kB | لیست اطلاعیه |
| `/me/profile` | 6.21 kB | 215 kB | Avatar + تغییر رمز |
| `/me/report` | 10.5 kB | 268 kB | Chart (هنوز static import در صفحه me) |
| `/admin` | 25.8 kB | 285 kB | داشبورد + Chart KPI |
| `/admin/announcements` | 11 kB | 188 kB | DataTable |
| `/admin/audit` | 3.37 kB | 188 kB | DataTable |
| `/admin/board` | 8.21 kB | 275 kB | بورد |
| `/admin/departments` | 7.57 kB | 208 kB | DataTable |
| `/admin/holidays` | 8.19 kB | 226 kB | DataTable + datepicker |
| `/admin/reports` | 1.12 kB | **284 kB** | recharts async (−۳۰٫۷٪) |
| `/admin/settings` | 8.65 kB | 163 kB | Tabs + Form |
| `/admin/staff` | 2.2 kB | 225 kB | DataTable |
| `/admin/staff/[id]` | 4.22 kB | **346 kB** | تب گزارش lazy (−۲۶٫۷٪) |
| `/admin/staff/new` | 5.34 kB | 222 kB | StaffForm |
| `/admin/tasks` | 2.32 kB | 235 kB | DataTable |
| `/admin/tasks/[id]` | 165 B | 241 kB | TaskForm |
| `/admin/tasks/new` | 165 B | 241 kB | TaskForm |
| First Load JS shared | — | 103 kB | پایه مشترک |

## مسیرهای همچنان نسبتاً سنگین

1. **`/admin/staff/[id]` → 346 kB** — فیلتر گزارش، تب‌ها، DataTable جزئیات هنوز در chunk مسیر هستند؛ فقط recharts جدا شده. با باز شدن تب گزارش، chunk نمودار دانلود می‌شود.
2. **`/admin/reports` → 284 kB** — پوسته گزارش بدون وزن اصلی recharts؛ نمودارها پس از hydrate با skeleton لود می‌شوند.
3. **`/admin` / `/me/report`** — هنوز import مستقیم `charts` دارند (خارج از این بهینه‌سازی).
