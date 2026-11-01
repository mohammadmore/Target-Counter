# Kiyan Pearl Ambassador — شمارنده‌ی تارگت کیان‌تیم

شمارنده‌ی زنده‌ی امتیاز تیم تا رسیدن به هدف «سفیر مروارید» (فارسی / عربی)، با پنل مدیریت.

- **فرانت‌اند:** React 19 + Vite + Tailwind 4 (بدون وابستگی سنگین؛ گیج با SVG خالص)
- **بک‌اند:** `public/api.php` (PHP 7.4+ / MySQL) روی هاست cPanel

## توسعه

```bash
bun install        # یا npm install
bun run dev        # http://localhost:3000
bun run test       # تست‌های واحد
bun run build      # typecheck + خروجی در dist/
```

در حالت `dev` (و پیش‌نمایش AI Studio) که PHP اجرا نمی‌شود، برنامه خودکار از localStorage
استفاده می‌کند و ورود ادمین با هر رمزی پذیرفته می‌شود. **این رفتار فقط در حالت توسعه است**
و در build نهایی وجود ندارد.

## نصب روی cPanel

1. `bun run build` و محتوای پوشه‌ی `dist/` (شامل `api.php` و `.htaccess`) را در پوشه‌ی سایت آپلود کنید.
2. فایل `server/kiyan-config.example.php` را به نام `kiyan-config.php` کپی و مقادیرش را پر کنید:
   - اطلاعات دیتابیس MySQL
   - `admin_password_hash` (ترجیحاً) یا `admin_password`
   - `token_secret`: یک رشته‌ی تصادفی طولانی
3. `kiyan-config.php` را **یک پوشه بالاتر از** پوشه‌ی سایت قرار دهید
   (مثلاً `/home/<user>/kiyan-config.php` وقتی سایت در `public_html` است).
   در صورت نیاز می‌توان آن را کنار `api.php` هم گذاشت؛ `.htaccess` دسترسی مستقیم به آن را می‌بندد.
4. جدول `kiyan_score` در اولین درخواست خودکار ساخته می‌شود؛ جدول قبلی هم بدون تغییر کار می‌کند.

> ⚠️ `kiyan-config.php` هرگز نباید commit شود (در `.gitignore` هست).

## API

| درخواست | بدنه | پاسخ |
|---|---|---|
| `GET api.php` | — | `{"score","target"}` |
| `POST api.php` | `{"action":"login","password"}` | `{"token","expiresAt"}` |
| `POST api.php` + `Authorization: Bearer <token>` | `{"action":"update","score","target"?}` | `{"score","target"}` |

- توکن ۱۲ ساعت اعتبار دارد و با تغییر رمز یا `token_secret` باطل می‌شود.
- بعد از ۸ تلاش ناموفق ورود، آن IP به مدت ۱۵ دقیقه مسدود می‌شود.
- امتیاز باید بین ۰ و هدف باشد؛ هدف حداکثر ۹۹,۹۹۹,۹۹۹ (۸ رقم).
