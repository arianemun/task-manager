# عیب‌یابی UI — فاصله / اندازه / Sidebar (۱۴۰۴/۰۷/۱۴)

## علت‌های ریشه‌ای

1. **`SmartSidebarProvider` + CSS خارج از `@layer` با `!important`**  
   فایل‌ها: `src/components/layout/smart-sidebar-provider.tsx` (حذف شد)، `src/app/globals.css` خطوط قبلی ۳۱۵–۳۵۰.  
   کلاس `sidebar-mq-prefer-icon` عرض gap/container و لیبل/badge را با `!important` override می‌کرد و با `data-state` / `data-collapsible` خود shadcn تداخل داشت → منو نیمه‌کاره، badge مخفی، اسکرول محتوا قطع.

2. **`<main>` تو در تو**  
   `SidebarInset` خودش `<main>` است و `app-frame` هم `<main id="main-content">` داشت → HTML نامعتبر و رفتار layout ناپایدار.

3. **تریگر هدر خارج از `SidebarTrigger`**  
   دکمهٔ دستی `toggleSidebar` بدون `data-sidebar="trigger"`؛ روی موبایل قبل از mount شدن `useIsMobile` ممکن بود state دسکتاپ عوض شود نه Sheet.

4. **بستن Sheet موبایل هنگام ناوبری**  
   لینک‌های sidebar `setOpenMobile(false)` صدا نمی‌زدند → Sheet باز می‌ماند.

5. **فاصلهٔ صفحه ناکافی / overrideهای تنگ**  
   - `app-frame`: فقط `px-4 py-4 md:px-6` بدون پلهٔ ۳۲px دسکتاپ.  
   - KPIها: `CardContent className="p-3"` پیش‌فرض Card را می‌کشت.  
   - `CardTitle` با `leading-none` متن فارسی را فشرده می‌کرد.  
   - `body` بدون `line-height: 1.7`.

6. **اندازه‌های کنترل ناهمگون**  
   Button/Input/Select پیش‌فرض `h-9` (۳۶px)، هدر `h-12`، ردیف جدول بدون min-height، SidebarMenuButton `h-8` / `gap-2` / آیکن `size-4`.

7. **قواعد تم تاریک خارج از `@layer`**  
   selectorهای `.dark [data-slot=...]` در globals می‌توانستند با utilityها رقابت کنند → به `@layer components` منتقل شد.

## چیزهایی که علت نبودند

- جایگزینی فیزیکی→منطقی کلاس فاصله را خراب نکرده؛ `px-*` / `gap-*` سالم‌اند.  
- Tailwind فایل‌های `src` را اسکن می‌کند؛ utilityهایی مثل `.px-4` در CSS build موجودند.  
- `--spacing` در `@theme` صفر/خراب نشده بود.

## اصلاح تکمیلی پس از تست production

- `SidebarMenuBadge` در حالت آیکنی با `group-data-[collapsible=icon]:hidden` کاملاً مخفی می‌شد → به نقطهٔ کوچک primary تغییر کرد تا badge دیده شود.  
- `me/report-view` هنوز `CardContent className="p-3"` داشت → حذف شد تا padding پیش‌فرض Card اعمال شود.  
- آیکن bottom nav پرسنل از `size-4` به `size-5` (۲۰px ناوبری) هم‌تراز شد.
