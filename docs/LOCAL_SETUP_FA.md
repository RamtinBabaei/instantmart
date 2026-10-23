# اجرای پروژه در VS Code و ویندوز

## پیش‌نیازها

Node.js نسخه 24 LTS، Git و VS Code را نصب کنید. برای اجرای دمو روی سیستم خودتان به حساب Cloudflare یا کلید Stripe احتیاج ندارید.

1. در VS Code از منوی **Terminal → New Terminal** یک ترمینال PowerShell باز کنید.
2. دستورهای زیر را یکی‌یکی اجرا کنید:

```powershell
git clone https://github.com/RamtinBabaei/instantmart.git
cd instantmart
npm install -g pnpm@11.25.0
pnpm install --frozen-lockfile
pnpm build
pnpm db:migrate
pnpm dev
```

3. آدرس **http://localhost:5173** را در مرورگر باز کنید. ترمینال باید باز بماند.
4. برای بررسی اتصال پایگاه داده، آدرس **http://localhost:5173/api/health** را باز کنید. مقدار `status` باید `ok` و مقدار `database` باید `connected` باشد.

## تست کامل دمو

- روی **Sign in** و سپس **Explore customer demo** بزنید.
- یک محصول به سبد اضافه کنید و وارد Checkout شوید.
- برای آدرس آزمایشی، **Use fictional demo address** را انتخاب کنید.
- روش پرداخت **Cash on delivery** را انتخاب کنید. هیچ پرداخت یا ارسال واقعی انجام نمی‌شود.
- کد تخفیف `FRESH10` را وارد و روی **Apply** بزنید، سپس سفارش را ثبت کنید.
- از نوار بالای صفحه روی **Admin** بزنید. وارد **Orders** شوید و سفارش را ابتدا تأیید و سپس Packed کنید.
- روی **Delivery** بزنید. در بخش **Available** سفارش را قبول کنید.
- با **Shop** به نقش مشتری برگردید و در صفحه سفارش، کد شش‌رقمی تحویل را ببینید.
- دوباره به **Delivery** بروید و با واردکردن کد صحیح، تحویل را تکمیل کنید.

برای مشاهده نسخه Build شده:

```powershell
pnpm build
pnpm start -- --port 8787
```

آدرس این حالت **http://localhost:8787** است. با **Ctrl+C** سرور را متوقف کنید.

## رفع اشکال‌های رایج

- **pnpm شناخته نمی‌شود:** پس از نصب pnpm، ترمینال VS Code را ببندید و دوباره باز کنید.
- **no such table / Database is not configured:** ابتدا `pnpm build` و سپس `pnpm db:migrate` را اجرا کنید.
- **پورت اشغال است:** سرور قبلی را با Ctrl+C متوقف کنید. برای توسعه می‌توانید `pnpm dev -- --port 5174` را اجرا کنید و آدرس پورت جدید را باز کنید.
- **خطای اجرای فایل yml:** فایل `.github/workflows/ci.yml` دستور ترمینال نیست؛ GitHub آن را پس از Push اجرا می‌کند.
- **پرداخت کارتی غیرفعال است:** طبیعی است. دمو از پرداخت هنگام تحویل استفاده می‌کند. پرداخت واقعی به تنظیم کلیدهای Stripe و وب‌هوک نیاز دارد.
- **داده‌های لوکال با سایت آنلاین فرق دارند:** این دو پایگاه داده جدا هستند. اطلاعات محلی در پوشه نادیده‌گرفته‌شده `.wrangler/state` ذخیره می‌شود.

فایل `.env.example` فاقد اطلاعات محرمانه است. اگر تنظیمات اختیاری لازم داشتید، با `Copy-Item .env.example .dev.vars` یک نسخه محلی بسازید و کلید واقعی را فقط در آن قرار دهید. فایل `.dev.vars` را در GitHub قرار ندهید.
