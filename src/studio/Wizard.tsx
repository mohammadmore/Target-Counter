import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Copy, ExternalLink, Eye, History, Loader2, Save, Trash2, X } from 'lucide-react';
import { api, ApiError, messageFor, type StudioGoal } from '../lib/api';
import { formatNumber, type Lang } from '../lib/format';
import { createDefaultConfig, LANG_NAMES, FONTS, TEXT_FIELDS } from '../goal/presets';
import { normalizeConfig } from '../goal/normalize';
import { ensureFont } from '../goal/theme';
import { contrastIssues, untranslatedSummary } from '../goal/quality';
import type { GoalConfig } from '../goal/types';
import { goalUrl, hrefFor, navigate } from '../router';
import { vizById } from '../viz';
import { DEFAULT_TARGET } from '../config';
import PreviewFrame from './PreviewFrame';
import { AppearanceStep, BasicsStep, FeaturesStep, StyleStep, TextsStep, validateBasics, type Draft } from './steps';
import { buttonClass } from './ui';

const STEPS = [
  { id: 'basics', title: 'اطلاعات پایه' },
  { id: 'style', title: 'سبک نمایش' },
  { id: 'appearance', title: 'ظاهر' },
  { id: 'texts', title: 'متن‌ها' },
  { id: 'features', title: 'امکانات و دسترسی' },
  { id: 'review', title: 'انتشار' },
] as const;

const randomSlug = () => `goal-${Math.random().toString(36).slice(2, 7)}`;

// ---------------------------------------------------------------------------
// Local autosave: unpublished work survives crashes, closed tabs and expired sessions.
// ---------------------------------------------------------------------------
const autosaveKey = (slug: string | null) => `wizard_autosave_${slug ?? 'new'}`;
interface Autosave {
  draft: Draft;
  savedAt: number;
}
const readAutosave = (slug: string | null): Autosave | null => {
  try {
    const a = JSON.parse(localStorage.getItem(autosaveKey(slug)) ?? 'null');
    return a?.draft?.config ? a : null;
  } catch {
    return null;
  }
};
const clearAutosave = (slug: string | null) => localStorage.removeItem(autosaveKey(slug));
/** What matters for "is this different from the server?" */
const fingerprint = (d: Draft) => JSON.stringify([d.config, d.slug, d.target, d.scoreTouched ? d.score : null, d.editorPassword, d.removeEditorPassword]);

function newDraft(): Draft {
  return {
    config: createDefaultConfig(),
    slug: randomSlug(),
    originalSlug: null,
    target: DEFAULT_TARGET,
    score: 0,
    baseScore: 0,
    scoreTouched: false,
    published: false,
    hasDraft: false,
    draftToken: null,
    editorPassword: '',
    removeEditorPassword: false,
    hasEditorPassword: false,
  };
}

/** Builds the editing state from the server; unpublished draft changes take precedence. */
function draftFromServer(goal: StudioGoal): Draft {
  return {
    config: normalizeConfig(goal.draft ? goal.draft.config : goal.config),
    slug: goal.slug,
    originalSlug: goal.slug,
    target: goal.draft ? goal.draft.target : goal.target,
    score: goal.score,
    baseScore: goal.score,
    scoreTouched: false,
    published: goal.published,
    hasDraft: !!goal.draft,
    draftToken: goal.draftToken,
    editorPassword: '',
    removeEditorPassword: false,
    hasEditorPassword: goal.hasEditorPassword,
  };
}

const draftPreviewUrl = (slug: string, token: string) => `${goalUrl(slug)}&draft=${encodeURIComponent(token)}`;

export default function Wizard({ token, slug, onUnauthorized }: { token: string; slug: string | null; onUnauthorized: () => void }) {
  const [draft, setDraftState] = useState<Draft | null>(() => (slug ? null : newDraft()));
  const [serverPrint, setServerPrint] = useState<string | null>(() => (slug ? null : fingerprint(newDraft())));
  const [restoreCandidate, setRestoreCandidate] = useState<Autosave | null>(null);
  const [loadError, setLoadError] = useState('');
  const [step, setStep] = useState(0);
  const [textLang, setTextLang] = useState<Lang>('fa');
  const [busy, setBusy] = useState<'draft' | 'publish' | 'discard' | null>(null);
  const [error, setError] = useState('');
  const [lastSaved, setLastSaved] = useState<'draft' | 'publish' | null>(null);
  const [showMobilePreview, setShowMobilePreview] = useState(false);
  /** A save that failed because the session expired; retried after re-login. */
  const pendingSave = useRef<boolean | null>(null);

  const dirty = !!draft && serverPrint !== null && fingerprint(draft) !== serverPrint;

  // Load an existing goal for editing (and offer to restore unsaved local work).
  useEffect(() => {
    if (!slug) {
      const saved = readAutosave(null);
      if (saved) setRestoreCandidate(saved);
      return;
    }
    let cancelled = false;
    api
      .getForEdit(token, slug)
      .then((goal) => {
        if (cancelled) return;
        const loaded = draftFromServer(goal);
        setDraftState(loaded);
        setServerPrint(fingerprint(loaded));
        setTextLang(loaded.config.defaultLang);
        const saved = readAutosave(slug);
        if (saved && fingerprint(saved.draft) !== fingerprint(loaded)) setRestoreCandidate(saved);
        else if (saved) clearAutosave(slug);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.code === 'unauthorized') onUnauthorized();
        else setLoadError(messageFor(err));
      });
    return () => {
      cancelled = true;
    };
    // token changes after a re-login must not reload and discard the user's edits
  }, [slug]);

  // Autosave every change locally (debounced).
  useEffect(() => {
    if (!draft || !dirty) return;
    const id = setTimeout(() => {
      try {
        localStorage.setItem(autosaveKey(slug), JSON.stringify({ draft, savedAt: Date.now() }));
      } catch { /* storage full */ }
    }, 400);
    return () => clearTimeout(id);
  }, [draft, dirty, slug]);

  const setDraft = useCallback((fn: (d: Draft) => Draft) => {
    setDraftState((d) => (d ? fn(d) : d));
    setLastSaved(null);
  }, []);

  const patch = useCallback(
    (fn: (c: GoalConfig) => void) =>
      setDraft((d) => {
        const config = structuredClone(d.config);
        fn(config);
        return { ...d, config };
      }),
    [setDraft],
  );

  // Warn before leaving with unsaved changes (they are also autosaved locally).
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  useEffect(() => {
    if (draft) ensureFont(draft.config);
  }, [draft?.config.theme.font.id, draft?.config.theme.font.customUrl]);

  const basicsErrors = useMemo(() => (draft ? validateBasics(draft) : {}), [draft]);
  const basicsValid = Object.keys(basicsErrors).length === 0;

  async function save(publish: boolean) {
    if (!draft || busy) return;
    if (!basicsValid) {
      setStep(0);
      return;
    }
    if (publish) {
      const missing = untranslatedSummary(draft.config);
      if (
        missing.length > 0 &&
        !window.confirm(
          `${missing.map((m) => `${LANG_NAMES[m.lang]}: ${m.fields.length.toLocaleString('fa-IR')} متن`).join('، ')} هنوز متن پیش‌فرض دارد و ترجمه نشده است.\nبا همین وضعیت منتشر شود؟`,
        )
      ) {
        setStep(3);
        setTextLang(missing[0].lang);
        return;
      }
    }
    setBusy(publish ? 'publish' : 'draft');
    setError('');
    try {
      const saved = await api.save(token, {
        originalSlug: draft.originalSlug,
        slug: draft.slug,
        config: draft.config,
        target: draft.target!,
        publish,
        // Never send the score back unless the admin deliberately changed it —
        // otherwise a design change would wipe scores recorded in the meantime.
        ...(draft.scoreTouched ? { score: draft.score!, expectedScore: draft.baseScore } : {}),
        editorPassword: draft.removeEditorPassword ? null : draft.editorPassword || undefined,
      });
      const next = { ...draftFromServer(saved), config: draft.config, target: draft.target };
      setDraftState(next);
      setServerPrint(fingerprint(next));
      clearAutosave(slug);
      clearAutosave(saved.slug);
      setLastSaved(publish ? 'publish' : 'draft');
      if (publish) setStep(STEPS.length - 1);
      if (draft.originalSlug !== saved.slug) window.history.replaceState(null, '', hrefFor({ kind: 'wizard', slug: saved.slug }));
    } catch (err) {
      if (err instanceof ApiError && err.code === 'unauthorized') {
        pendingSave.current = publish;
        setError('نشست شما منقضی شده است. دوباره وارد شوید؛ تغییرات شما حفظ شده و خودکار ذخیره می‌شود.');
        onUnauthorized();
      } else if (err instanceof ApiError && err.code === 'score_changed') {
        const current = err.details.current ?? draft.baseScore;
        setDraftState({ ...draft, score: current, baseScore: current, scoreTouched: false });
        setError(`در این فاصله امتیاز در پنل ثبت امتیاز به ${formatNumber(current, 'fa')} تغییر کرد. مقدار به‌روز شد؛ اگر لازم است دوباره اصلاح و ذخیره کنید.`);
        setStep(0);
      } else {
        setError(messageFor(err));
        if (err instanceof ApiError && ['invalid_slug', 'slug_taken', 'invalid_target', 'invalid_score', 'score_exceeds_target'].includes(err.code)) setStep(0);
      }
    } finally {
      setBusy(null);
    }
  }

  // After re-login the token changes: finish the save that was interrupted.
  useEffect(() => {
    if (pendingSave.current === null) return;
    const publish = pendingSave.current;
    pendingSave.current = null;
    setError('');
    save(publish);
  }, [token]);

  const discardDraft = async () => {
    if (!draft?.originalSlug || busy) return;
    if (!window.confirm('همه‌ی تغییرات منتشرنشده دور ریخته شود و طراحی به نسخه‌ی منتشرشده برگردد؟')) return;
    setBusy('discard');
    try {
      const live = await api.discardDraft(token, draft.originalSlug);
      const loaded = draftFromServer(live);
      setDraftState(loaded);
      setServerPrint(fingerprint(loaded));
      clearAutosave(slug);
      setLastSaved(null);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'unauthorized') onUnauthorized();
      else setError(messageFor(err));
    } finally {
      setBusy(null);
    }
  };

  if (loadError) {
    return (
      <div className="max-w-md mx-auto p-8 text-center space-y-4">
        <p className="text-rose-300">{loadError}</p>
        <button className={buttonClass.ghost} onClick={() => navigate({ kind: 'studio' })}>
          بازگشت به داشبورد
        </button>
      </div>
    );
  }
  if (!draft) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="animate-spin text-violet-200/60" />
      </div>
    );
  }

  const stepProps = { draft, setDraft, patch, token };
  const current = STEPS[step].id;
  const isNew = !draft.originalSlug;

  const leave = () => {
    if (!dirty || window.confirm('تغییرات ذخیره‌نشده دارید (یک نسخه در همین مرورگر نگه داشته شده). خارج می‌شوید؟')) {
      setServerPrint(draft ? fingerprint(draft) : null); // silence beforeunload
      navigate({ kind: 'studio' });
    }
  };

  const status = dirty
    ? 'تغییرات ذخیره‌نشده (در همین مرورگر نگه داشته می‌شود)'
    : draft.hasDraft
      ? 'پیش‌نویس ذخیره شده — نسخه‌ی عمومی هنوز تغییر نکرده'
      : draft.published
        ? 'همه‌ی تغییرات منتشر شده است'
        : 'هنوز منتشر نشده';

  const saveButtons = (
    <>
      <button className={buttonClass.ghost} onClick={() => save(false)} disabled={!!busy || !basicsValid || (!dirty && !isNew)} title="بدون تغییر صفحه‌ی عمومی ذخیره می‌شود">
        {busy === 'draft' ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
        ذخیره‌ی پیش‌نویس
      </button>
      <button className={buttonClass.primary} onClick={() => save(true)} disabled={!!busy || !basicsValid || (!dirty && !draft.hasDraft && draft.published)}>
        {busy === 'publish' ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
        {draft.published ? 'انتشار تغییرات' : 'انتشار صفحه'}
      </button>
    </>
  );

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <button className={`${buttonClass.ghost} !px-2.5`} onClick={leave} aria-label="بازگشت به داشبورد">
            <ArrowRight size={16} />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-extrabold truncate text-aurora">{isNew ? 'ساخت صفحه‌ی هدف جدید' : `طراحی «${draft.config.name}»`}</h1>
            <p className={`text-xs ${dirty ? 'text-pink-300' : 'text-violet-100/50'}`}>{status}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className={`${buttonClass.ghost} lg:hidden`} onClick={() => setShowMobilePreview(true)}>
            <Eye size={16} />
            پیش‌نمایش
          </button>
          {saveButtons}
        </div>
      </header>

      {restoreCandidate && (
        <div className="mb-4 flex flex-wrap items-center gap-3 glass rounded-2xl !border-sky-300/35 p-3 text-sm text-sky-50">
          <History size={16} className="shrink-0" />
          <span className="flex-1 min-w-[200px]">
            تغییرات ذخیره‌نشده‌ای از {new Date(restoreCandidate.savedAt).toLocaleString('fa-IR', { dateStyle: 'short', timeStyle: 'short' })} در این مرورگر پیدا شد.
          </span>
          <button
            className={`${buttonClass.primary} !py-1.5`}
            onClick={() => {
              setDraftState({ ...restoreCandidate.draft, baseScore: draft.baseScore, published: draft.published, hasDraft: draft.hasDraft, draftToken: draft.draftToken, hasEditorPassword: draft.hasEditorPassword, originalSlug: draft.originalSlug });
              setRestoreCandidate(null);
            }}
          >
            بازیابی
          </button>
          <button
            className={`${buttonClass.ghost} !py-1.5`}
            onClick={() => {
              clearAutosave(slug);
              setRestoreCandidate(null);
            }}
          >
            نادیده گرفتن
          </button>
        </div>
      )}

      {draft.hasDraft && draft.published && !dirty && (
        <div className="mb-4 flex flex-wrap items-center gap-3 glass rounded-2xl p-3 text-xs text-violet-50/80">
          <span className="flex-1 min-w-[200px]">در حال ویرایش پیش‌نویس هستید؛ بازدیدکنندگان هنوز نسخه‌ی قبلی را می‌بینند.</span>
          {draft.draftToken && <CopyLink url={draftPreviewUrl(draft.slug, draft.draftToken)} label="لینک پیش‌نمایش" />}
          <button className={`${buttonClass.danger} !py-1.5`} onClick={discardDraft} disabled={!!busy}>
            {busy === 'discard' ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            دور انداختن پیش‌نویس
          </button>
        </div>
      )}

      {lastSaved === 'draft' && draft.draftToken && (
        <div className="mb-4 flex flex-wrap items-center gap-3 glass rounded-2xl !border-emerald-300/35 p-3 text-sm text-emerald-50">
          <Check size={16} />
          <span className="flex-1">پیش‌نویس ذخیره شد. این لینک را برای تأیید بفرستید؛ صفحه‌ی عمومی تغییری نکرده است.</span>
          <CopyLink url={draftPreviewUrl(draft.slug, draft.draftToken)} label="کپی لینک پیش‌نمایش" />
        </div>
      )}

      {error && (
        <p className="mb-4 text-sm text-rose-100 bg-rose-500/15 border border-rose-300/30 rounded-2xl p-3 backdrop-blur-md" role="alert">
          {error}
        </p>
      )}

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(340px,440px)] gap-6 items-start">
        <div className="min-w-0">
          <ol className="flex gap-1 overflow-x-auto pb-2 mb-5">
            {STEPS.map((s, i) => {
              const blocked = i > 0 && !basicsValid;
              return (
                <li key={s.id} className="shrink-0">
                  <button
                    type="button"
                    disabled={blocked}
                    onClick={() => setStep(i)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs whitespace-nowrap transition-colors disabled:opacity-40 ${
                      i === step ? 'btn-aurora font-bold' : 'text-violet-100/60 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[0.65rem] ${i === step ? 'bg-white/25' : 'bg-white/10'}`}>
                      {formatNumber(i + 1, 'fa')}
                    </span>
                    {s.title}
                  </button>
                </li>
              );
            })}
          </ol>

          {current === 'basics' && <BasicsStep {...stepProps} />}
          {current === 'style' && <StyleStep {...stepProps} />}
          {current === 'appearance' && <AppearanceStep {...stepProps} />}
          {current === 'texts' && <TextsStep {...stepProps} lang={textLang} setLang={setTextLang} />}
          {current === 'features' && <FeaturesStep {...stepProps} />}
          {current === 'review' && <Review draft={draft} justPublished={lastSaved === 'publish'} goTo={setStep} setTextLang={setTextLang} />}

          <div className="flex justify-between gap-2 mt-6">
            <button className={buttonClass.ghost} disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
              <ArrowRight size={16} />
              قبلی
            </button>
            {step < STEPS.length - 1 ? (
              <button className={buttonClass.primary} disabled={!basicsValid} onClick={() => setStep((s) => s + 1)}>
                بعدی: {STEPS[step + 1].title}
                <ArrowLeft size={16} />
              </button>
            ) : (
              <div className="flex gap-2">{saveButtons}</div>
            )}
          </div>
        </div>

        <aside className="hidden lg:block sticky top-4 h-[calc(100dvh-2rem)]">
          <PreviewFrame config={draft.config} target={draft.target || 1} initialScore={draft.score ?? 0} />
        </aside>
      </div>

      {showMobilePreview && (
        <div className="fixed inset-0 z-50 bg-[#0a0718]/80 backdrop-blur-xl p-4 flex flex-col lg:hidden">
          <button className={`${buttonClass.ghost} self-end mb-3`} onClick={() => setShowMobilePreview(false)}>
            <X size={16} />
            بستن پیش‌نمایش
          </button>
          <div className="flex-1 min-h-0">
            <PreviewFrame config={draft.config} target={draft.target || 1} initialScore={draft.score ?? 0} />
          </div>
        </div>
      )}
    </div>
  );
}

function CopyLink({ url, label }: { url: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="inline-flex gap-1.5">
      <button
        className={`${buttonClass.ghost} !py-1.5`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
          } catch {
            window.prompt('لینک:', url);
          }
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        <Copy size={14} />
        {copied ? 'کپی شد' : label}
      </button>
      <a className={`${buttonClass.ghost} !py-1.5 !px-2.5`} href={url} target="_blank" rel="noreferrer" aria-label="باز کردن">
        <ExternalLink size={14} />
      </a>
    </span>
  );
}

function Review({ draft, justPublished, goTo, setTextLang }: { draft: Draft; justPublished: boolean; goTo: (step: number) => void; setTextLang: (l: Lang) => void }) {
  const { config } = draft;
  const missing = untranslatedSummary(config);
  const contrast = contrastIssues(config.theme.palette);

  const rows: [string, string][] = [
    ['نام', config.name],
    ['هدف', formatNumber(draft.target ?? 0, 'fa')],
    ['مقدار فعلی', `${formatNumber(draft.score ?? 0, 'fa')}${draft.scoreTouched ? ' (تغییر دستی)' : ''}`],
    ['سبک نمایش', vizById(config.visualization.type).name],
    ['زبان‌ها', config.languages.map((l) => LANG_NAMES[l]).join('، ')],
    ['فونت', FONTS.find((f) => f.id === config.theme.font.id)?.name ?? ''],
    ['رمز ویرایشگر', draft.removeEditorPassword ? 'حذف می‌شود' : draft.editorPassword ? 'تنظیم می‌شود' : draft.hasEditorPassword ? 'دارد' : 'ندارد'],
  ];

  return (
    <div className="space-y-4">
      {justPublished && (
        <div className="glass rounded-2xl !border-emerald-300/35 p-4 space-y-3">
          <p className="font-bold text-emerald-300">صفحه منتشر شد 🎉</p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="text-xs bg-white/[0.07] border border-white/10 rounded-lg px-2 py-1.5 text-white/85 break-all" dir="ltr">
              {goalUrl(draft.slug)}
            </code>
            <CopyLink url={goalUrl(draft.slug)} label="کپی لینک" />
            <button className={`${buttonClass.ghost} !py-1.5`} onClick={() => navigate({ kind: 'studio' })}>
              داشبورد
            </button>
          </div>
        </div>
      )}

      {(missing.length > 0 || contrast.length > 0) && (
        <div className="glass rounded-2xl !border-amber-300/35 p-4 space-y-2 text-sm text-amber-50">
          <div className="flex items-center gap-2 font-bold text-amber-200">
            <AlertTriangle size={16} />
            قبل از انتشار بررسی کنید
          </div>
          {missing.map((m) => (
            <button
              key={m.lang}
              type="button"
              className="block text-start underline decoration-dotted hover:text-white"
              onClick={() => {
                setTextLang(m.lang);
                goTo(3);
              }}
            >
              {LANG_NAMES[m.lang]}: {m.fields.map((f) => TEXT_FIELDS.find((x) => x.key === f)?.label).join('، ')} هنوز ترجمه نشده است.
            </button>
          ))}
          {contrast.length > 0 && (
            <button type="button" className="block text-start underline decoration-dotted hover:text-white" onClick={() => goTo(2)}>
              خوانایی بعضی رنگ‌ها کافی نیست ({contrast.length.toLocaleString('fa-IR')} مورد).
            </button>
          )}
        </div>
      )}

      <div className="glass rounded-2xl divide-y divide-white/10">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 px-4 py-2.5 text-sm">
            <span className="text-violet-100/60">{k}</span>
            <span className="text-white text-end">{v}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-violet-100/50 leading-relaxed">
        «ذخیره‌ی پیش‌نویس» صفحه‌ی عمومی را تغییر نمی‌دهد و یک لینک پیش‌نمایش برای تأیید می‌سازد. «انتشار» تغییرات را برای همه‌ی بازدیدکنندگان اعمال می‌کند.
      </p>
    </div>
  );
}
