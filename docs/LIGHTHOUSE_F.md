# Lighthouse — فاز F (موبایل)

تاریخ: ۱۴۰۴/۰۷/۱۴ · فرم‌فاکتور: mobile (۳۹۰×۸۴۴) · `next start` + کوکی سشن

هدف Accessibility ≥ ۹۰ — **محقق شد (هر سه مسیر ۱۰۰).**

| مسیر | Performance | Accessibility | Best Practices | Console |
|---|---:|---:|---:|---|
| `/me` | ۹۰ | **۱۰۰** | ۱۰۰ | بدون خطا |
| `/admin` | ۹۲ | **۱۰۰** | ۱۰۰ | بدون خطا |
| `/admin/reports` | ۸۲ | **۱۰۰** | ۱۰۰ | بدون خطا |

خروجی خام: `docs/lighthouse/*-mobile.json`

## تکرار

```bash
npm run build && npm start
node scripts/make-session.mjs
node scripts/lighthouse-mobile.mjs
```

## رفع‌های مرتبط با کنسول/hydration

- آیکن‌های nav دیگر از Server به Client پاس داده نمی‌شوند (`nav-icons.tsx`).
- `REPORT_TABS` از ماژول بدون `"use client"` خوانده می‌شود.
- `BreadcrumbSeparator` هم‌سطح `BreadcrumbItem` است (نه داخل `<li>` تو در تو).
- CSP از `next.config.ts` روی همه مسیرها فعال است.
