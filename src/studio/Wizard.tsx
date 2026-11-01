import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Copy, ExternalLink, Eye, Loader2, X } from 'lucide-react';
import { api, ApiError, messageFor } from '../lib/api';
import { formatNumber, parseWholeNumber, type Lang } from '../lib/format';
import { createDefaultConfig, LANG_NAMES, FONTS } from '../goal/presets';
import { normalizeConfig } from '../goal/normalize';
import { ensureFont } from '../goal/theme';
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

function newDraft(): Draft {
  return {
    config: createDefaultConfig(),
    slug: randomSlug(),
    originalSlug: null,
    targetText: String(DEFAULT_TARGET),
    scoreText: '0',
    editorPassword: '',
    removeEditorPassword: false,
    hasEditorPassword: false,
  };
}

export default function Wizard({ token, slug, onUnauthorized }: { token: string; slug: string | null; onUnauthorized: () => void }) {
  const [draft, setDraftState] = useState<Draft | null>(() => (slug ? null : newDraft()));
  const [loadError, setLoadError] = useState('');
  const [step, setStep] = useState(0);
  const [textLang, setTextLang] = useState<Lang>('fa');
  const [dirty, setDirty] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');
  const [published, setPublished] = useState<string | null>(null);
  const [showMobilePreview, setShowMobilePreview] = useState(false);

  // Load an existing goal for editing.
  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    api
      .getForEdit(token, slug)
      .then((goal) => {
        if (cancelled) return;
        const config = normalizeConfig(goal.config);
        setDraftState({
          config,
          slug: goal.slug,
          originalSlug: goal.slug,
          targetText: String(goal.target),
          scoreText: String(goal.score),
          editorPassword: '',
          removeEditorPassword: false,
          hasEditorPassword: !!goal.hasEditorPassword,
        });
        setTextLang(config.defaultLang);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.code === 'unauthorized') onUnauthorized();
        else setLoadError(messageFor(err));
      });
    return () => {
      cancelled = true;
    };
  }, [slug, token, onUnauthorized]);

  const setDraft = useCallback((fn: (d: Draft) => Draft) => {
    setDraftState((d) => (d ? fn(d) : d));
    setDirty(true);
    setPublished(null);
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

  // Warn before leaving with unpublished changes.
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

  if (loadError) {
    return (
      <div className="max-w-md mx-auto p-8 text-center space-y-4">
        <p className="text-red-400">{loadError}</p>
        <button className={buttonClass.ghost} onClick={() => navigate({ kind: 'studio' })}>
          بازگشت به داشبورد
        </button>
      </div>
    );
  }
  if (!draft) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="animate-spin text-zinc-500" />
      </div>
    );
  }

  const target = parseWholeNumber(draft.targetText) ?? 0;
  const score = parseWholeNumber(draft.scoreText) ?? 0;

  const publish = async () => {
    if (!basicsValid) {
      setStep(0);
      return;
    }
    setPublishing(true);
    setPublishError('');
    try {
      const saved = await api.save(token, {
        originalSlug: draft.originalSlug,
        slug: draft.slug,
        config: draft.config,
        target,
        score,
        editorPassword: draft.removeEditorPassword ? null : draft.editorPassword || undefined,
      });
      setDraftState({
        ...draft,
        originalSlug: saved.slug,
        editorPassword: '',
        hasEditorPassword: !!draft.editorPassword || (draft.hasEditorPassword && !draft.removeEditorPassword),
        removeEditorPassword: false,
      });
      setDirty(false);
      setPublished(saved.slug);
      setStep(STEPS.length - 1); // show the shareable link
      if (draft.originalSlug !== saved.slug) {
        window.history.replaceState(null, '', hrefFor({ kind: 'wizard', slug: saved.slug }));
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === 'unauthorized') onUnauthorized();
      else {
        setPublishError(messageFor(err));
        if (err instanceof ApiError && ['invalid_slug', 'slug_taken', 'invalid_target', 'invalid_score', 'score_exceeds_target'].includes(err.code)) setStep(0);
      }
    } finally {
      setPublishing(false);
    }
  };

  const stepProps = { draft, setDraft, patch, token };
  const current = STEPS[step].id;

  const leave = () => {
    if (!dirty || window.confirm('تغییرات منتشرنشده از بین می‌روند. خارج می‌شوید؟')) {
      setDirty(false);
      navigate({ kind: 'studio' });
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <button className={`${buttonClass.ghost} !px-2.5`} onClick={leave} aria-label="بازگشت به داشبورد">
            <ArrowRight size={16} />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg font-bold truncate">{draft.originalSlug ? `طراحی «${draft.config.name}»` : 'ساخت صفحه‌ی هدف جدید'}</h1>
            <p className="text-xs text-zinc-500">{dirty ? 'تغییرات منتشر نشده' : draft.originalSlug ? 'همه‌ی تغییرات منتشر شده است' : 'پیش‌نویس'}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button className={`${buttonClass.ghost} lg:hidden`} onClick={() => setShowMobilePreview(true)}>
            <Eye size={16} />
            پیش‌نمایش
          </button>
          <button className={buttonClass.primary} onClick={publish} disabled={publishing || !basicsValid}>
            {publishing ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            {draft.originalSlug ? 'ذخیره و انتشار' : 'انتشار صفحه'}
          </button>
        </div>
      </header>

      {publishError && <p className="mb-4 text-sm text-red-400" role="alert">{publishError}</p>}

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(340px,440px)] gap-6 items-start">
        <div className="min-w-0">
          {/* Stepper */}
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
                      i === step ? 'bg-amber-400 text-zinc-950 font-bold' : 'text-zinc-400 hover:bg-zinc-900'
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[0.65rem] ${i === step ? 'bg-zinc-950/15' : 'bg-zinc-800'}`}>
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
          {current === 'review' && <Review draft={draft} target={target} score={score} published={published} dirty={dirty} />}

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
              <button className={buttonClass.primary} onClick={publish} disabled={publishing || !basicsValid}>
                {publishing ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                {draft.originalSlug ? 'ذخیره و انتشار' : 'انتشار صفحه'}
              </button>
            )}
          </div>
        </div>

        <aside className="hidden lg:block sticky top-4 h-[calc(100dvh-2rem)]">
          <PreviewFrame config={draft.config} target={target || 1} initialScore={score} />
        </aside>
      </div>

      {showMobilePreview && (
        <div className="fixed inset-0 z-50 bg-zinc-950/95 p-4 flex flex-col lg:hidden">
          <button className={`${buttonClass.ghost} self-end mb-3`} onClick={() => setShowMobilePreview(false)}>
            <X size={16} />
            بستن پیش‌نمایش
          </button>
          <div className="flex-1 min-h-0">
            <PreviewFrame config={draft.config} target={target || 1} initialScore={score} />
          </div>
        </div>
      )}
    </div>
  );
}

function Review({ draft, target, score, published, dirty }: { draft: Draft; target: number; score: number; published: string | null; dirty: boolean }) {
  const { config } = draft;
  const [copied, setCopied] = useState(false);
  const url = goalUrl(draft.slug);
  const live = draft.originalSlug && !dirty;

  const rows: [string, string][] = [
    ['نام', config.name],
    ['هدف', formatNumber(target, 'fa')],
    ['مقدار فعلی', formatNumber(score, 'fa')],
    ['سبک نمایش', vizById(config.visualization.type).name],
    ['زبان‌ها', config.languages.map((l) => LANG_NAMES[l]).join('، ')],
    ['فونت', FONTS.find((f) => f.id === config.theme.font.id)?.name ?? ''],
    ['رمز ویرایشگر', draft.removeEditorPassword ? 'حذف می‌شود' : draft.editorPassword ? 'تنظیم می‌شود' : draft.hasEditorPassword ? 'دارد' : 'ندارد'],
  ];

  return (
    <div className="space-y-4">
      {published && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 space-y-3">
          <p className="font-bold text-emerald-300">صفحه منتشر شد 🎉</p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="text-xs bg-zinc-900 rounded px-2 py-1.5 text-zinc-200 break-all" dir="ltr">
              {url}
            </code>
            <button
              className={`${buttonClass.ghost} !py-1.5`}
              onClick={async () => {
                await navigator.clipboard?.writeText(url).catch(() => undefined);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              <Copy size={14} />
              {copied ? 'کپی شد' : 'کپی لینک'}
            </button>
            <a className={`${buttonClass.ghost} !py-1.5`} href={hrefFor({ kind: 'goal', slug: draft.slug, edit: false })} target="_blank" rel="noreferrer">
              <ExternalLink size={14} />
              مشاهده
            </a>
            <button className={`${buttonClass.ghost} !py-1.5`} onClick={() => navigate({ kind: 'studio' })}>
              داشبورد
            </button>
          </div>
        </div>
      )}
      <div className="rounded-xl border border-zinc-800 divide-y divide-zinc-800">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 px-4 py-2.5 text-sm">
            <span className="text-zinc-400">{k}</span>
            <span className="text-zinc-100 text-end">{v}</span>
          </div>
        ))}
      </div>
      {!published && (
        <p className="text-xs text-zinc-500 leading-relaxed">
          {live
            ? 'این صفحه منتشر شده است. هر تغییری که بدهید پس از «ذخیره و انتشار» برای همه‌ی بازدیدکنندگان اعمال می‌شود.'
            : 'پیش‌نمایش سمت چپ دقیقاً همان صفحه‌ای است که منتشر می‌شود. با دکمه‌ی انتشار، لینک اشتراک‌گذاری ساخته می‌شود.'}
        </p>
      )}
    </div>
  );
}
