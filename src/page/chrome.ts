import type { Lang } from '../lib/format';

/** Fixed interface strings of the public goal page (not part of the goal's own texts). */
export const CHROME: Record<Lang, Record<string, string>> = {
  fa: {
    editScore: 'ثبت امتیاز',
    nextLang: 'تغییر زبان',
    replay: 'پخش مجدد انیمیشن',
    poster: 'دانلود پوستر با کیفیت',
    posterSaved: 'تصویر با موفقیت ذخیره شد',
    posterFailed: 'ساخت پوستر ناموفق بود، دوباره تلاش کنید',
    posterReady: 'پوستر شما آماده است',
    posterHint: 'روی تصویر زیر نگه دارید (Long Press) و گزینه Save Image را بزنید تا در گالری ذخیره شود.',
    close: 'بستن',
    connecting: 'در حال اتصال به سرور…',
    connectionLost: 'اتصال به سرور برقرار نیست؛ در حال تلاش مجدد…',
    achieved: 'ثبت‌شده',
    remaining: 'مانده تا هدف',
    notFound: 'این صفحه پیدا نشد',
    noGoals: 'هنوز هیچ صفحه‌ای ساخته نشده است',
    openStudio: 'ورود به استودیو',
    target: 'هدف',
    posterWorking: 'در حال ساخت پوستر…',
    updated: 'به‌روزرسانی',
    justNow: 'همین حالا',
    draftBanner: 'پیش‌نمایش پیش‌نویس — این نسخه هنوز منتشر نشده است',
    notConfigured: 'سایت هنوز راه‌اندازی نشده است',
    notConfiguredHint: 'فایل kiyan-config.php روی سرور پیدا نشد یا کامل نیست. مراحل نصب در README توضیح داده شده است.',
    serverError: 'سرور با خطا مواجه شد؛ در حال تلاش مجدد…',
  },
  ar: {
    editScore: 'تسجيل النقاط',
    nextLang: 'تغيير اللغة',
    replay: 'إعادة تشغيل الحركة',
    poster: 'تحميل ملصق عالي الجودة',
    posterSaved: 'تم حفظ الصورة بنجاح',
    posterFailed: 'تعذّر إنشاء الملصق، حاول مرة أخرى',
    posterReady: 'الملصق الخاص بك جاهز',
    posterHint: 'اضغط باستمرار على الصورة أدناه وحدد حفظ الصورة لحفظها.',
    close: 'إغلاق',
    connecting: 'جارٍ الاتصال بالخادم…',
    connectionLost: 'لا يوجد اتصال بالخادم؛ جارٍ إعادة المحاولة…',
    achieved: 'المسجّل',
    remaining: 'المتبقي للهدف',
    notFound: 'هذه الصفحة غير موجودة',
    noGoals: 'لم يتم إنشاء أي صفحة بعد',
    openStudio: 'الدخول إلى الاستوديو',
    target: 'الهدف',
    posterWorking: 'جارٍ إنشاء الملصق…',
    updated: 'آخر تحديث',
    justNow: 'الآن',
    draftBanner: 'معاينة المسودة — هذه النسخة لم تُنشر بعد',
    notConfigured: 'الموقع غير مُعدّ بعد',
    notConfiguredHint: 'لم يتم العثور على ملف kiyan-config.php على الخادم أو أنه غير مكتمل.',
    serverError: 'حدث خطأ في الخادم؛ جارٍ إعادة المحاولة…',
  },
  en: {
    editScore: 'Update score',
    nextLang: 'Change language',
    replay: 'Replay animation',
    poster: 'Download poster',
    posterSaved: 'Image saved',
    posterFailed: 'Could not create the poster, please try again',
    posterReady: 'Your poster is ready',
    posterHint: 'Long-press the image below and choose “Save Image”.',
    close: 'Close',
    connecting: 'Connecting…',
    connectionLost: 'Connection lost; retrying…',
    achieved: 'Achieved',
    remaining: 'Remaining',
    notFound: 'Page not found',
    noGoals: 'No goal pages yet',
    openStudio: 'Open studio',
    target: 'Target',
    posterWorking: 'Creating poster…',
    updated: 'Updated',
    justNow: 'just now',
    draftBanner: 'Draft preview — this version is not published yet',
    notConfigured: 'This site is not set up yet',
    notConfiguredHint: 'kiyan-config.php is missing or incomplete on the server. See the README for setup steps.',
    serverError: 'Server error; retrying…',
  },
};

export const LANG_CODES: Record<Lang, string> = { fa: 'FA', ar: 'AR', en: 'EN' };

/** "2 hours ago" in the page language. */
export function timeAgo(unixSeconds: number, lang: Lang, nowMs = Date.now()) {
  const diff = Math.round(unixSeconds - nowMs / 1000);
  const abs = Math.abs(diff);
  if (abs < 45) return CHROME[lang].justNow;
  const rtf = new Intl.RelativeTimeFormat(lang === 'fa' ? 'fa-IR' : lang === 'ar' ? 'ar-EG' : 'en-US', { numeric: 'auto' });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['week', 604_800],
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ];
  for (const [unit, seconds] of units) {
    if (abs >= seconds) return rtf.format(Math.round(diff / seconds), unit);
  }
  return rtf.format(diff, 'second');
}
