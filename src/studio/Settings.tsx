import { useEffect, useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUp, Check, Loader2, Plus, Trash2 } from 'lucide-react';
import { api, ApiError, CONTACT_TYPES, messageFor, type Contact, type PlatformProfile } from '../lib/api';
import { CONTACT_LABELS, contactHref, setPlatformProfile, usePlatformProfile } from '../lib/platform';
import { navigate } from '../router';
import { CREDIT_LINE_1, CREDIT_LINE_2 } from '../components/Credit';
import { assetUrl } from '../goal/theme';
import { Field, Section, UploadField, buttonClass, inputClass } from './ui';
import { ModeToggle } from './mode';

const MAX_CONTACTS = 12;

/** Preview of the credit pill on a light or dark background with the chosen logo. */
function CreditSample({ logo, dark }: { logo: string; dark: boolean }) {
  return (
    <div className={`rounded-2xl p-5 flex items-center justify-center ${dark ? 'bg-[#0b0b10]' : 'bg-[#f6f5fb]'}`}>
      <div
        className={`flex items-center gap-2 ps-1 pe-3 py-1 rounded-full border ${
          dark ? 'bg-white/10 border-white/15 text-white' : 'bg-white border-black/10 text-slate-900 shadow-sm'
        }`}
        dir="rtl"
      >
        <span className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white text-xs font-bold">
          {logo ? <img src={assetUrl(logo)} alt="" className="w-full h-full object-cover" /> : 'A'}
        </span>
        <span className="flex flex-col items-start leading-tight">
          <span className="text-[11px] font-bold" dir="ltr">
            {CREDIT_LINE_1}
          </span>
          <span className={`text-[9.5px] ${dark ? 'text-white/60' : 'text-slate-500'}`}>{CREDIT_LINE_2}</span>
        </span>
      </div>
    </div>
  );
}

/** Studio-wide settings: the Asva logos used in every credit, and its contact links. */
export default function Settings({ token, onUnauthorized }: { token: string; onUnauthorized: () => void }) {
  const live = usePlatformProfile();
  const [draft, setDraft] = useState<PlatformProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    document.title = 'تنظیمات پایه | استودیو';
    api
      .getPlatform()
      .then((p) => {
        setPlatformProfile(p);
        setDraft(p);
      })
      .catch(() => setDraft(live));
    // load once
  }, []);

  if (!draft) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="animate-spin text-st-muted" />
      </div>
    );
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(live);
  const update = (fn: (p: PlatformProfile) => PlatformProfile) => {
    setDraft((d) => (d ? fn(d) : d));
    setMessage(null);
  };
  const setContact = (i: number, patch: Partial<Contact>) =>
    update((p) => ({ ...p, contacts: p.contacts.map((c, j) => (j === i ? { ...c, ...patch } : c)) }));
  const move = (i: number, dir: -1 | 1) =>
    update((p) => {
      const contacts = [...p.contacts];
      const [item] = contacts.splice(i, 1);
      contacts.splice(i + dir, 0, item);
      return { ...p, contacts };
    });

  const invalid = draft.contacts.filter((c) => c.value.trim() && !contactHref(c)).length;

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const saved = await api.savePlatform(token, { ...draft, contacts: draft.contacts.filter((c) => c.value.trim()) });
      setPlatformProfile(saved);
      setDraft(saved);
      setMessage({ ok: true, text: 'تنظیمات ذخیره شد و در همه‌ی صفحه‌ها اعمال می‌شود.' });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'unauthorized') onUnauthorized();
      else setMessage({ ok: false, text: messageFor(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button className={`${buttonClass.ghost} !px-2.5`} onClick={() => navigate({ kind: 'studio' })} aria-label="بازگشت به داشبورد">
            <ArrowRight size={16} />
          </button>
          <div>
            <h1 className="text-2xl font-extrabold text-aurora">تنظیمات پایه</h1>
            <p className="text-sm text-st-muted mt-1">برند استودیو در کردیت پایین همه‌ی صفحه‌ها</p>
          </div>
        </div>
        <div className="flex gap-2">
          <ModeToggle />
          <button className={buttonClass.primary} onClick={save} disabled={busy || !dirty || invalid > 0}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            ذخیره
          </button>
        </div>
      </header>

      {message && (
        <p className={`glass-soft rounded-2xl p-3 text-sm ${message.ok ? 'text-st-ok' : 'text-st-danger'}`} role="status">
          {message.text}
        </p>
      )}

      <Section title="لوگوی استودیو" description="در دایره‌ی کوچک کردیت همه‌ی صفحه‌ها نمایش داده می‌شود. برای هر حالت نسخه‌ای انتخاب کنید که روی آن پس‌زمینه خوانا باشد؛ تصویر مربعی بهترین نتیجه را دارد.">
        <div className="grid sm:grid-cols-2 gap-4">
          {(
            [
              ['logoLight', 'لوگو برای حالت روشن', false],
              ['logoDark', 'لوگو برای حالت تاریک', true],
            ] as const
          ).map(([key, label, dark]) => (
            <div key={key} className="space-y-3">
              <span className="text-xs font-medium text-st-fg/85">{label}</span>
              <CreditSample logo={draft[key] || (dark ? draft.logoLight : draft.logoDark)} dark={dark} />
              <UploadField
                token={token}
                kind="image"
                accept="image/png,image/webp,image/jpeg,image/gif"
                label="آپلود لوگو"
                value={draft[key]}
                onChange={(url) => update((p) => ({ ...p, [key]: url }))}
              />
            </div>
          ))}
        </div>
        <p className="text-xs text-st-muted">اگر فقط یکی را آپلود کنید، در هر دو حالت از همان استفاده می‌شود. بدون لوگو، نشان پیش‌فرض اسوا نمایش داده می‌شود.</p>
      </Section>

      <Section title="لینک‌های تماس" description="با کلیک روی کردیت، این لینک‌ها به ترتیب نمایش داده می‌شوند. اگر خالی باشد، کردیت قابل کلیک نیست.">
        {draft.contacts.length === 0 && <p className="text-sm text-st-muted">هنوز لینکی اضافه نشده است.</p>}
        <ul className="space-y-3">
          {draft.contacts.map((c, i) => {
            const bad = c.value.trim() !== '' && !contactHref(c);
            return (
              <li key={i} className="glass-soft rounded-2xl p-3 space-y-2">
                <div className="flex flex-wrap items-end gap-2">
                  <Field label="نوع">
                    <select value={c.type} onChange={(e) => setContact(i, { type: e.target.value as Contact['type'] })} className={`${inputClass} !w-36`}>
                      {CONTACT_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {CONTACT_LABELS[t].fa}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <div className="flex-1 min-w-[180px]">
                    <Field label="آدرس / شماره" error={bad ? 'قالب این مقدار معتبر نیست.' : undefined}>
                      <input className={inputClass} dir="ltr" value={c.value} placeholder={CONTACT_LABELS[c.type].placeholder} onChange={(e) => setContact(i, { value: e.target.value })} />
                    </Field>
                  </div>
                  <div className="flex-1 min-w-[140px]">
                    <Field label="عنوان (اختیاری)">
                      <input className={inputClass} value={c.label} placeholder={CONTACT_LABELS[c.type].fa} onChange={(e) => setContact(i, { label: e.target.value })} />
                    </Field>
                  </div>
                  <div className="flex gap-1">
                    <button type="button" className={`${buttonClass.ghost} !px-2`} disabled={i === 0} onClick={() => move(i, -1)} aria-label="بالا">
                      <ArrowUp size={15} />
                    </button>
                    <button type="button" className={`${buttonClass.ghost} !px-2`} disabled={i === draft.contacts.length - 1} onClick={() => move(i, 1)} aria-label="پایین">
                      <ArrowDown size={15} />
                    </button>
                    <button type="button" className={`${buttonClass.danger} !px-2`} onClick={() => update((p) => ({ ...p, contacts: p.contacts.filter((_, j) => j !== i) }))} aria-label="حذف">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                {contactHref(c) && (
                  <p className="text-[0.7rem] text-st-muted truncate" dir="ltr" style={{ textAlign: 'right' }}>
                    {contactHref(c)}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          className={buttonClass.ghost}
          disabled={draft.contacts.length >= MAX_CONTACTS}
          onClick={() => update((p) => ({ ...p, contacts: [...p.contacts, { type: p.contacts.length ? 'link' : 'website', value: '', label: '' }] }))}
        >
          <Plus size={16} />
          افزودن لینک
        </button>
      </Section>
    </div>
  );
}
