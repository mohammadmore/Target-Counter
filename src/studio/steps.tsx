import { Suspense, useEffect, useState } from 'react';
import { AlertTriangle, Check, Copy, Info, RotateCcw, Wand2 } from 'lucide-react';
import type { ColorMode, GoalConfig, GoalTexts, Lang, VizType } from '../goal/types';
import { DEFAULT_TEXTS, FONTS, LANG_NAMES, PALETTES, PALETTE_FIELDS, TEXT_FIELDS } from '../goal/presets';
import { BUILTIN_BACKGROUNDS, assetUrl, loadFontById, resolveMode, themeStyle } from '../goal/theme';
import { LANGS, dirOf, formatNumber } from '../lib/format';
import { contrastIssues, deriveCounterpart, fixContrast, paletteLabel, untranslatedFields } from '../goal/quality';
import NumberInput from '../components/NumberInput';
import { goalUrl } from '../router';
import { MAX_VALUE } from '../config';
import { VISUALIZATIONS } from '../viz';
import { ColorInput, Field, Section, Segmented, Toggle, UploadField, buttonClass, inputClass } from './ui';

export interface Draft {
  config: GoalConfig;
  slug: string;
  originalSlug: string | null;
  target: number | null;
  score: number | null;
  /** The score as loaded from the server; only sent back if the admin changed it. */
  baseScore: number;
  scoreTouched: boolean;
  published: boolean;
  hasDraft: boolean;
  draftToken: string | null;
  editorPassword: string;
  removeEditorPassword: boolean;
  hasEditorPassword: boolean;
}

export interface StepProps {
  draft: Draft;
  setDraft: (fn: (d: Draft) => Draft) => void;
  patch: (fn: (c: GoalConfig) => void) => void;
  token: string;
  /** Which colour mode the wizard is previewing / editing. */
  previewMode: ColorMode;
  setPreviewMode: (m: ColorMode) => void;
}

/** Modes a goal actually uses (both when the visitor can switch). */
export const activeModes = (c: GoalConfig): ColorMode[] => (c.theme.mode === 'both' ? ['dark', 'light'] : [c.theme.mode]);
export const MODE_NAMES: Record<ColorMode, string> = { dark: 'تیره', light: 'روشن' };

export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/;

export function validateBasics(d: Draft) {
  const errors: Partial<Record<'name' | 'slug' | 'target' | 'score', string>> = {};
  const { target, score } = d;
  if (!d.config.name.trim()) errors.name = 'یک نام برای این صفحه بنویسید.';
  if (!SLUG_PATTERN.test(d.slug)) errors.slug = 'فقط حروف کوچک انگلیسی، عدد و خط تیره (حداقل ۱ و حداکثر ۴۸ کاراکتر).';
  if (target === null || target < 1 || target > MAX_VALUE) errors.target = 'هدف باید یک عدد صحیح بزرگ‌تر از صفر باشد.';
  if (score === null || score > MAX_VALUE) errors.score = 'مقدار فعلی باید یک عدد صحیح باشد.';
  else if (target !== null && score > target) errors.score = 'مقدار فعلی نمی‌تواند از هدف بیشتر باشد.';
  return errors;
}

// ---------------------------------------------------------------------------
// 1. Basics
// ---------------------------------------------------------------------------
export function BasicsStep({ draft, setDraft, patch }: StepProps) {
  const errors = validateBasics(draft);
  const { config } = draft;
  const renaming = !!draft.originalSlug && draft.published && draft.slug !== draft.originalSlug;

  const toggleLang = (lang: Lang) =>
    patch((c) => {
      const has = c.languages.includes(lang);
      if (has && c.languages.length === 1) return;
      c.languages = has ? c.languages.filter((l) => l !== lang) : LANGS.filter((l) => l === lang || c.languages.includes(l));
      if (!c.languages.includes(c.defaultLang)) c.defaultLang = c.languages[0];
    });

  return (
    <div className="space-y-4">
      <Section title="هدف" description="نام داخلی برای پیدا کردن صفحه در داشبورد؛ تیتر نمایشی را در مرحله‌ی «متن‌ها» تنظیم کنید.">
        <Field label="نام صفحه" error={errors.name}>
          <input className={inputClass} value={config.name} onChange={(e) => patch((c) => void (c.name = e.target.value))} placeholder="مثلاً فروش فصل پاییز" />
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="عدد هدف" error={errors.target}>
            <NumberInput className={inputClass} lang="fa" value={draft.target} onChange={(v) => setDraft((d) => ({ ...d, target: v }))} />
          </Field>
          <Field
            label={draft.originalSlug ? 'مقدار فعلی' : 'مقدار شروع'}
            error={errors.score}
            hint={draft.originalSlug ? 'ثبت روزانه را از «ثبت امتیاز» انجام دهید؛ این فیلد فقط برای اصلاح دستی است.' : undefined}
          >
            <NumberInput className={inputClass} lang="fa" value={draft.score} onChange={(v) => setDraft((d) => ({ ...d, score: v, scoreTouched: true }))} />
          </Field>
        </div>
      </Section>

      <Section title="آدرس صفحه" description="لینک اشتراک‌گذاری صفحه با این شناسه ساخته می‌شود.">
        <Field label="شناسه (slug)" error={errors.slug}>
          <div className="flex items-center gap-2" dir="ltr">
            <span className="text-xs text-st-muted/80 font-mono shrink-0">?g=</span>
            <input
              className={`${inputClass} font-mono`}
              value={draft.slug}
              onChange={(e) => setDraft((d) => ({ ...d, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') }))}
            />
          </div>
        </Field>
        {renaming && (
          <p className="flex gap-2 text-xs text-st-info bg-sky-400/10 border border-sky-300/30 rounded-xl p-2.5 leading-relaxed">
            <Info size={14} className="shrink-0 mt-0.5" />
            لینک قبلی (<span dir="ltr" className="font-mono">?g={draft.originalSlug}</span>) بعد از ذخیره هم کار می‌کند و خودکار به آدرس جدید می‌رود.
          </p>
        )}
      </Section>

      <Section title="زبان‌ها" description="برای هر زبانِ فعال، متن‌های جداگانه می‌نویسید. بازدیدکننده می‌تواند بین زبان‌ها جابه‌جا شود.">
        <div className="flex flex-wrap gap-2">
          {LANGS.map((lang) => {
            const on = config.languages.includes(lang);
            return (
              <button
                key={lang}
                type="button"
                onClick={() => toggleLang(lang)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm ${on ? 'selected-aurora bg-st-fill/10 text-st-fg' : 'border-st-line/15 text-st-muted hover:bg-st-fill/10'}`}
              >
                {on && <Check size={14} />}
                {LANG_NAMES[lang]}
              </button>
            );
          })}
        </div>
        {config.languages.length > 1 && (
          <Field label="زبان پیش‌فرض">
            <Segmented value={config.defaultLang} options={config.languages.map((l) => ({ value: l, label: LANG_NAMES[l] }))} onChange={(l) => patch((c) => void (c.defaultLang = l))} />
          </Field>
        )}
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. Visualization style
// ---------------------------------------------------------------------------
export function StyleStep({ draft, patch, previewMode }: StepProps) {
  const { config } = draft;
  const selected = VISUALIZATIONS.find((v) => v.id === config.visualization.type)!;
  const lang = config.defaultLang;
  const sampleTarget = draft.target || 1_000_000;

  return (
    <div className="space-y-4">
      <p className="text-sm text-st-muted leading-relaxed">
        فقط یک سبک انتخاب کنید تا صفحه روی یک پیام تمرکز داشته باشد. پیش‌نمایش‌ها با رنگ و فونت فعلی شما و پیشرفت ۶۲٪ نمایش داده می‌شوند.
      </p>
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-3" role="radiogroup" aria-label="سبک نمایش پیشرفت">
        {VISUALIZATIONS.map((v) => {
          const Viz = v.component;
          const active = v.id === config.visualization.type;
          return (
            <button
              key={v.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => patch((c) => void (c.visualization.type = v.id as VizType))}
              className={`text-start rounded-2xl border overflow-hidden transition-all ${active ? 'selected-aurora' : 'border-st-line/10 hover:border-st-line/30 hover:-translate-y-0.5'}`}
            >
              <div style={themeStyle(config, resolveMode(config, previewMode))} dir={dirOf(lang)} className="relative h-[150px] bg-bg text-text font-goal overflow-hidden pointer-events-none">
                <div className="absolute inset-0 bg-glow opacity-80" />
                <div className="absolute left-1/2 top-1/2 w-[380px]" style={{ transform: 'translate(-50%, -50%) scale(0.46)' }}>
                  <Suspense fallback={null}>
                    <Viz compact score={sampleTarget * 0.62} target={sampleTarget} ratio={0.62} lang={lang} config={config} label={config.texts[lang].vizLabel} />
                  </Suspense>
                </div>
              </div>
              <div className="p-3 glass-soft !border-0 !rounded-none">
                <div className="flex items-center gap-1.5 text-sm font-bold">
                  {active && <Check size={14} className="text-st-accent" />}
                  {v.name}
                </div>
                <p className="text-[0.7rem] text-st-muted mt-1 leading-relaxed">{v.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      {selected.options.length > 0 && (
        <Section title={`تنظیمات «${selected.name}»`}>
          {selected.options.includes('milestones') && (
            <Field label={`تعداد بخش‌های مرحله‌ای: ${formatNumber(config.visualization.milestones, 'fa')}`}>
              <input
                type="range"
                min={2}
                max={10}
                value={config.visualization.milestones}
                onChange={(e) => patch((c) => void (c.visualization.milestones = Number(e.target.value)))}
                className="w-full accent-fuchsia-500"
              />
            </Field>
          )}
          {selected.options.includes('ringText') && (
            <Field label="متن چرخان دور حلقه" hint="خالی بگذارید تا متنی نمایش داده نشود.">
              <input className={inputClass} dir="ltr" value={config.visualization.ringText} onChange={(e) => patch((c) => void (c.visualization.ringText = e.target.value))} />
            </Field>
          )}
          {selected.options.includes('counterMode') && (
            <Field label="عدد بزرگ چه چیزی را نشان دهد؟">
              <Segmented
                value={config.visualization.counterMode}
                options={[
                  { value: 'remaining', label: 'مانده تا هدف' },
                  { value: 'score', label: 'مقدار به‌دست‌آمده' },
                ]}
                onChange={(m) => patch((c) => void (c.visualization.counterMode = m))}
              />
            </Field>
          )}
        </Section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. Appearance
// ---------------------------------------------------------------------------
export function AppearanceStep({ draft, patch, token, previewMode, setPreviewMode }: StepProps) {
  const { config } = draft;
  const modes = activeModes(config);
  const editMode = resolveMode(config, previewMode);
  const palette = config.theme.palettes[editMode];
  const other: ColorMode = editMode === 'dark' ? 'light' : 'dark';

  // Load every font once so the picker can show real samples.
  useEffect(() => FONTS.forEach((f) => loadFontById(f.id)), []);

  return (
    <div className="space-y-4">
      <Section title="حالت روشن / تاریک" description="«هر دو» یعنی بازدیدکننده با دکمه‌ی خورشید/ماه بین دو حالت جابه‌جا می‌شود و در ابتدا حالت تنظیم‌شده‌ی دستگاهش را می‌بیند.">
        <Segmented
          value={config.theme.mode}
          options={[
            { value: 'both', label: 'هر دو (انتخاب بیننده)' },
            { value: 'dark', label: 'فقط تاریک' },
            { value: 'light', label: 'فقط روشن' },
          ]}
          onChange={(m) => {
            patch((c) => void (c.theme.mode = m));
            if (m !== 'both') setPreviewMode(m);
          }}
        />
      </Section>

      <Section title="پالت رنگی" description="هر پالت آماده یک نسخه‌ی تاریک و یک نسخه‌ی روشنِ هماهنگ دارد. بعد از انتخاب می‌توانید هر رنگ را جداگانه تغییر دهید.">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {PALETTES.map((p) => {
            const active = config.theme.paletteId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() =>
                  patch((c) => {
                    c.theme.paletteId = p.id;
                    c.theme.palettes = { dark: { ...p.dark }, light: { ...p.light } };
                  })
                }
                className={`glass-soft rounded-xl p-2 text-start transition-all ${active ? 'selected-aurora' : 'hover:border-st-line/30'}`}
              >
                <div className="grid grid-cols-2 h-7 rounded-lg overflow-hidden">
                  {(['dark', 'light'] as ColorMode[])
                    .filter((m) => modes.includes(m))
                    .map((m) => (
                      <span key={m} className={`flex items-center justify-center gap-0.5 ${modes.length === 1 ? 'col-span-2' : ''}`} style={{ background: p[m].bg }}>
                        {[p[m].primaryDark, p[m].primary, p[m].primaryLight].map((c) => (
                          <span key={c} className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />
                        ))}
                      </span>
                    ))}
                </div>
                <div className="text-xs mt-1.5 text-st-fg/80">{p.name}</div>
              </button>
            );
          })}
        </div>

        <div className="pt-2 space-y-3">
          {modes.length > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-st-muted">ویرایش رنگ‌های حالت:</span>
              <Segmented value={editMode} options={modes.map((m) => ({ value: m, label: MODE_NAMES[m] }))} onChange={setPreviewMode} />
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {PALETTE_FIELDS.map((f) => (
              <ColorInput
                key={`${editMode}-${f.key}`}
                label={f.label}
                value={palette[f.key]}
                onChange={(v) =>
                  patch((c) => {
                    c.theme.palettes[editMode][f.key] = v;
                    c.theme.paletteId = 'custom';
                  })
                }
              />
            ))}
          </div>
          {modes.length > 1 && (
            <button
              type="button"
              className={buttonClass.ghost}
              onClick={() =>
                patch((c) => {
                  c.theme.palettes[other] = deriveCounterpart(c.theme.palettes[editMode], other);
                  c.theme.paletteId = 'custom';
                })
              }
              title={`رنگ‌های حالت ${MODE_NAMES[other]} با همین طیف و با خوانایی کافی ساخته می‌شوند`}
            >
              <Wand2 size={15} />
              ساخت خودکار حالت {MODE_NAMES[other]} از روی این رنگ‌ها
            </button>
          )}
        </div>
      </Section>

      <ContrastWarnings config={config} patch={patch} />

      <Section title="فونت" description="همه‌ی فونت‌ها روی سرور خودتان میزبانی می‌شوند و فقط فونت انتخاب‌شده برای بازدیدکننده دانلود می‌شود.">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {FONTS.map((f) => {
            const active = config.theme.font.id === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => patch((c) => void (c.theme.font.id = f.id))}
                className={`glass-soft rounded-xl px-3 py-2 text-start transition-all ${active ? 'selected-aurora !bg-st-fill/10' : 'hover:border-st-line/30'}`}
              >
                <div className="text-lg leading-snug" style={{ fontFamily: f.id === 'custom' ? undefined : `${f.family}, Tahoma` }}>
                  {f.id === 'custom' ? '…' : 'هدف ۱۲۳'}
                </div>
                <div className="text-[0.7rem] text-st-muted">{f.name}</div>
              </button>
            );
          })}
        </div>
        {config.theme.font.id === 'custom' && (
          <UploadField
            token={token}
            kind="font"
            accept=".woff2,.woff,.ttf,.otf"
            label="آپلود فایل فونت (woff2/woff/ttf/otf)"
            value={config.theme.font.customUrl}
            onChange={(url) => patch((c) => void (c.theme.font.customUrl = url))}
          />
        )}
        <Field label="گردی گوشه‌ها">
          <Segmented
            value={config.theme.radius}
            options={[
              { value: 'sharp', label: 'تیز' },
              { value: 'soft', label: 'نرم' },
              { value: 'round', label: 'گرد' },
            ]}
            onChange={(r) => patch((c) => void (c.theme.radius = r))}
          />
        </Field>
      </Section>

      <Section title="پس‌زمینه">
        <Segmented
          value={config.background.type}
          options={[
            { value: 'glow', label: 'درخشش رنگی' },
            { value: 'gradient', label: 'گرادیان' },
            { value: 'solid', label: 'ساده' },
            { value: 'image', label: 'تصویر' },
          ]}
          onChange={(t) =>
            patch((c) => {
              c.background.type = t;
              if (t === 'image' && !c.background.image) c.background.image = BUILTIN_BACKGROUNDS[0].id;
            })
          }
        />
        {config.background.type === 'image' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {BUILTIN_BACKGROUNDS.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => patch((c) => void (c.background.image = b.id))}
                  className={`rounded-lg overflow-hidden border-2 ${config.background.image === b.id ? 'selected-aurora' : 'border-transparent'}`}
                  title={b.name}
                >
                  <img src={b.url} alt={b.name} className="h-14 w-24 object-cover" />
                </button>
              ))}
            </div>
            <UploadField
              token={token}
              kind="image"
              accept="image/jpeg,image/png,image/webp,image/gif"
              label="آپلود تصویر پس‌زمینه"
              value={config.background.image.startsWith('builtin:') ? '' : config.background.image}
              onChange={(url) => patch((c) => void (c.background.image = url || BUILTIN_BACKGROUNDS[0].id))}
            />
            <Field label={`تیرگی روی تصویر: ${formatNumber(Math.round(config.background.overlay * 100), 'fa')}٪`} hint="برای خوانایی بهتر متن‌ها روی تصویر">
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(config.background.overlay * 100)}
                onChange={(e) => patch((c) => void (c.background.overlay = Number(e.target.value) / 100))}
                className="w-full accent-fuchsia-500"
              />
            </Field>
          </div>
        )}
        <Toggle checked={config.background.particles} onChange={(v) => patch((c) => void (c.background.particles = v))} label="ذرات معلق درخشان" />
      </Section>

      <Section title="لوگوی سازمان" description="برای نمایش در بخش‌هایی که در زیر انتخاب می‌کنید. PNG یا WebP با پس‌زمینه‌ی شفاف بهترین نتیجه را دارد. کردیت پایین صفحه همیشه لوگوی اسواست.">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="لوگوی اصلی (برای پس‌زمینه‌ی روشن یا هر دو حالت)">
            <UploadField token={token} kind="image" accept="image/png,image/webp,image/jpeg,image/gif" label="آپلود لوگو" value={config.logo} onChange={(url) => patch((c) => void (c.logo = url))} />
          </Field>
          <Field label="نسخه‌ی حالت تاریک (اختیاری)" hint="اگر لوگوی اصلی روی پس‌زمینه‌ی تیره دیده نمی‌شود (مثلاً لوگوی مشکی)">
            <UploadField token={token} kind="image" accept="image/png,image/webp,image/jpeg,image/gif" label="آپلود نسخه‌ی تاریک" value={config.logoDark} onChange={(url) => patch((c) => void (c.logoDark = url))} />
          </Field>
        </div>
        {(config.logo || config.logoDark) && (
          <div className="grid grid-cols-2 gap-3">
            {(['light', 'dark'] as ColorMode[]).map((m) => {
              const src = m === 'dark' && config.logoDark ? config.logoDark : config.logo || config.logoDark;
              return (
                <div key={m} className="rounded-xl p-4 flex items-center justify-center h-20" style={{ background: config.theme.palettes[m].bg }}>
                  {src && <img src={assetUrl(src)} alt="" className="max-h-12 max-w-full object-contain" />}
                </div>
              );
            })}
          </div>
        )}
        <div className="space-y-3 pt-1">
          <span className="text-xs font-medium text-st-fg/85">محل نمایش</span>
          <Toggle checked={config.logoPlacements.header} onChange={(v) => patch((c) => void (c.logoPlacements.header = v))} label="بالای تیتر صفحه" />
          <Toggle checked={config.logoPlacements.editor} onChange={(v) => patch((c) => void (c.logoPlacements.editor = v))} label="پنل ثبت امتیاز" />
          <Toggle
            checked={config.logoPlacements.poster}
            onChange={(v) => patch((c) => void (c.logoPlacements.poster = v))}
            label="پوستر دانلودی"
            description="اگر لوگو بالای تیتر نباشد، در گوشه‌ی پوستر قرار می‌گیرد"
          />
          <Toggle checked={config.logoPlacements.favicon} onChange={(v) => patch((c) => void (c.logoPlacements.favicon = v))} label="آیکن تب مرورگر" />
        </div>
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 4. Texts
// ---------------------------------------------------------------------------
export function TextsStep({ draft, patch, lang, setLang }: StepProps & { lang: Lang; setLang: (l: Lang) => void }) {
  const { config } = draft;
  const activeLang = config.languages.includes(lang) ? lang : config.defaultLang;
  const texts = config.texts[activeLang];
  const set = (key: keyof GoalTexts, value: string) => patch((c) => void (c.texts[activeLang][key] = value));
  const missing = untranslatedFields(config, activeLang);

  return (
    <div className="space-y-4">
      {config.languages.length > 1 && (
        <Segmented
          value={activeLang}
          options={config.languages.map((l) => {
            const n = untranslatedFields(config, l).length;
            return { value: l, label: n ? `${LANG_NAMES[l]} ⚠ ${n.toLocaleString('fa-IR')}` : LANG_NAMES[l] };
          })}
          onChange={setLang}
        />
      )}
      {missing.length > 0 && (
        <p className="flex gap-2 text-xs text-st-warn bg-amber-400/10 border border-amber-300/30 rounded-xl p-2.5 leading-relaxed">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          {missing.length.toLocaleString('fa-IR')} متنِ این زبان هنوز متن پیش‌فرض است، در حالی که در زبان دیگر نوشته شده. اگر منتشر شود، بازدیدکنندگان این زبان متن عمومی می‌بینند.
        </p>
      )}
      <div className="glass-soft rounded-xl p-3 text-xs text-st-muted leading-relaxed">
        در متن‌ها می‌توانید از این جای‌گذارها استفاده کنید تا با اعداد زنده جایگزین شوند:
        <div className="flex flex-wrap gap-1.5 mt-2" dir="ltr">
          {['{target}', '{score}', '{remaining}', '{percent}', '{unit}'].map((p) => (
            <code key={p} className="px-1.5 py-0.5 rounded-md bg-st-fill/10 text-st-accent">
              {p}
            </code>
          ))}
        </div>
      </div>
      <Section title={`متن‌های ${LANG_NAMES[activeLang]}`}>
        <div className="space-y-3" dir={dirOf(activeLang)}>
          {TEXT_FIELDS.map((f) => (
            <Field key={f.key} label={missing.includes(f.key) ? `${f.label} — ⚠ ترجمه نشده` : f.label} hint={f.hint}>
              {f.multiline ? (
                <textarea rows={3} className={inputClass} value={texts[f.key]} onChange={(e) => set(f.key, e.target.value)} />
              ) : (
                <input className={inputClass} value={texts[f.key]} onChange={(e) => set(f.key, e.target.value)} />
              )}
            </Field>
          ))}
        </div>
        <button
          type="button"
          onClick={() => patch((c) => void (c.texts[activeLang] = { ...DEFAULT_TEXTS[activeLang] }))}
          className="inline-flex items-center gap-1.5 text-xs text-st-muted hover:text-st-fg"
        >
          <RotateCcw size={13} />
          بازگردانی متن‌های پیش‌فرض این زبان
        </button>
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 5. Features & access
// ---------------------------------------------------------------------------
export function FeaturesStep({ draft, setDraft, patch }: StepProps) {
  const f = draft.config.features;
  const set = (key: keyof GoalConfig['features'], value: boolean) => patch((c) => void (c.features[key] = value));

  return (
    <div className="space-y-4">
      <Section title="امکانات صفحه">
        <Toggle checked={f.stats} onChange={(v) => set('stats', v)} label="کارت‌های «ثبت‌شده» و «مانده»" description="دو عدد خلاصه زیر نمودار" />
        <Toggle checked={f.celebration} onChange={(v) => set('celebration', v)} label="صفحه‌ی جشن رسیدن به هدف" description="وقتی مقدار به هدف برسد، متن جشن جایگزین نمودار می‌شود" />
        {f.celebration && <Toggle checked={f.confetti} onChange={(v) => set('confetti', v)} label="بارش کاغذ رنگی در جشن" />}
        <Toggle checked={f.poster} onChange={(v) => set('poster', v)} label="دکمه‌ی دانلود پوستر" description="ذخیره‌ی تصویر باکیفیت صفحه برای اشتراک در شبکه‌های اجتماعی" />
        <Toggle checked={f.replay} onChange={(v) => set('replay', v)} label="دکمه‌ی پخش دوباره‌ی انیمیشن" />
        <Toggle checked={f.languageSwitch} onChange={(v) => set('languageSwitch', v)} label="دکمه‌ی تغییر زبان" description="فقط وقتی بیش از یک زبان فعال باشد" />
        <Toggle checked={f.lastUpdated} onChange={(v) => set('lastUpdated', v)} label="زمان آخرین به‌روزرسانی" description="مثلاً «به‌روزرسانی: ۲ ساعت پیش» تا بیننده بداند عدد تازه است" />
        <Toggle
          checked={f.editorButton}
          onChange={(v) => set('editorButton', v)}
          label="دکمه‌ی ثبت امتیاز برای همه‌ی بازدیدکنندگان"
          description="خاموش (پیشنهادی): دکمه فقط در دستگاه‌هایی دیده می‌شود که قبلاً با رمز وارد شده‌اند؛ مسئول تیم از لینک زیر وارد می‌شود"
        />
      </Section>

      <Section
        title="رمز ویرایشگر امتیاز"
        description="با این رمز، مسئول تیم فقط می‌تواند امتیاز همین صفحه را به‌روز کند و به استودیو دسترسی ندارد. بدون رمز ویرایشگر، فقط مدیر پلتفرم امتیاز ثبت می‌کند."
      >
        {draft.hasEditorPassword && !draft.removeEditorPassword && <p className="text-xs text-st-ok">برای این صفحه رمز ویرایشگر تعریف شده است.</p>}
        {draft.originalSlug && <EditorLink slug={draft.originalSlug} />}
        <Field label={draft.hasEditorPassword ? 'رمز جدید (خالی = بدون تغییر)' : 'رمز ویرایشگر (اختیاری)'} hint="حداقل ۶ کاراکتر">
          <input
            type="password"
            autoComplete="new-password"
            className={inputClass}
            value={draft.editorPassword}
            onChange={(e) => setDraft((d) => ({ ...d, editorPassword: e.target.value, removeEditorPassword: false }))}
          />
        </Field>
        {draft.hasEditorPassword && (
          <Toggle
            checked={draft.removeEditorPassword}
            onChange={(v) => setDraft((d) => ({ ...d, removeEditorPassword: v, editorPassword: v ? '' : d.editorPassword }))}
            label="حذف رمز ویرایشگر"
          />
        )}
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------
function ContrastWarnings({ config, patch }: { config: GoalConfig; patch: StepProps['patch'] }) {
  const modes = activeModes(config);
  const issues = modes.flatMap((m) => contrastIssues(config.theme.palettes[m]).map((i) => ({ ...i, mode: m })));
  if (issues.length === 0) return null;
  const fixAll = () =>
    patch((c) => {
      for (const m of activeModes(c)) {
        const p = c.theme.palettes[m];
        for (const issue of contrastIssues(p)) p[issue.key] = fixContrast(p[issue.key], p[issue.against], issue.min);
      }
      c.theme.paletteId = 'custom';
    });
  return (
    <div className="glass rounded-2xl !border-amber-300/40 p-4 space-y-2" role="alert">
      <div className="flex items-center gap-2 text-sm font-bold text-st-warn">
        <AlertTriangle size={16} />
        خوانایی رنگ‌ها کافی نیست
      </div>
      <ul className="text-xs text-st-warn space-y-1 list-disc ps-5">
        {issues.map((i) => (
          <li key={`${i.mode}-${i.key}-${i.against}`}>
            {modes.length > 1 && `حالت ${MODE_NAMES[i.mode]}: `}
            {i.message} ({paletteLabel(i.key)} روی {paletteLabel(i.against)}: {i.ratio.toFixed(1)} از حداقل {i.min})
          </li>
        ))}
      </ul>
      <button type="button" className={`${buttonClass.ghost} !border-amber-400/50 !text-st-warn`} onClick={fixAll}>
        <Wand2 size={15} />
        اصلاح خودکار رنگ‌ها
      </button>
    </div>
  );
}

function EditorLink({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${goalUrl(slug)}&edit`;
  return (
    <div className="space-y-1.5">
      <span className="text-xs font-medium text-st-fg/85">لینک ثبت امتیاز برای مسئول تیم</span>
      <div className="flex items-center gap-2">
        <code className="flex-1 min-w-0 truncate text-xs bg-st-fill/[0.06] border border-st-line/10 rounded-xl px-2 py-2 text-st-fg/80" dir="ltr">
          {url}
        </code>
        <button
          type="button"
          className={`${buttonClass.ghost} !py-1.5 shrink-0`}
          onClick={async () => {
            await navigator.clipboard?.writeText(url).catch(() => undefined);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          <Copy size={14} />
          {copied ? 'کپی شد' : 'کپی'}
        </button>
      </div>
    </div>
  );
}
