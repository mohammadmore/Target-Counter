import { Suspense, useEffect, useRef, useState } from 'react';
import { Camera, Eye, Film, Loader2, Settings, WifiOff } from 'lucide-react';
import type { GoalConfig, Lang } from '../goal/types';
import { assetUrl, ensureFont, themeStyle } from '../goal/theme';
import { dirOf, fillTemplate, formatNumber, formatPercent } from '../lib/format';
import { vizById } from '../viz';
import Background from './Background';
import { CHROME, LANG_CODES, timeAgo } from './chrome';

/** Wait for the visualization to reach 100% before celebrating. */
const CELEBRATION_DELAY_MS = 1900;
const CONFETTI_DURATION_MS = 12_000;
/** Elements with this attribute are left out of the downloaded poster. */
const SKIP_CAPTURE = 'data-capture-skip';

const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes('Mac') && 'ontouchend' in document);

export interface GoalPageProps {
  config: GoalConfig;
  score: number;
  target: number;
  lang: Lang;
  onLangChange?: (lang: Lang) => void;
  /** Wizard thumbnail-style rendering inside a frame (no toolbar/title/confetti). */
  preview?: boolean;
  connectionError?: boolean;
  /** Unix seconds of the last score change. */
  scoreUpdatedAt?: number;
  isDraft?: boolean;
  /** Present only when this visitor should see the score button. */
  onOpenEditor?: () => void;
}

/** A complete goal page, rendered entirely from its config. */
export default function GoalPage({
  config,
  score,
  target,
  lang,
  onLangChange,
  preview = false,
  connectionError,
  scoreUpdatedAt,
  isDraft,
  onOpenEditor,
}: GoalPageProps) {
  const texts = config.texts[lang];
  const chrome = CHROME[lang];
  const safeTarget = target > 0 ? target : 1;
  const ratio = Math.max(0, Math.min(score / safeTarget, 1));
  const remaining = Math.max(safeTarget - score, 0);
  const goalReached = score >= safeTarget;
  const viz = config.visualization;
  const Viz = vizById(viz.type).component;

  // Never show the same number twice: the counter style already shows one of them big.
  const counterShowsRemaining = viz.type === 'counter' && viz.counterMode === 'remaining';
  const counterShowsScore = viz.type === 'counter' && viz.counterMode === 'score';

  const vars = {
    target: formatNumber(safeTarget, lang),
    score: formatNumber(score, lang),
    remaining: formatNumber(remaining, lang),
    percent: `${formatPercent(ratio * 100, lang)}%`,
    unit: texts.unit,
  };
  const fill = (s: string) => fillTemplate(s, vars);

  const pageRef = useRef<HTMLDivElement>(null);
  const [replayKey, setReplayKey] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [toast, setToast] = useState<{ text: string; shutter: boolean } | null>(null);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [, setClock] = useState(0);
  const mountedAt = useRef(Date.now());

  useEffect(() => ensureFont(config), [config]);

  useEffect(() => {
    if (preview) return;
    document.title = fillTemplate(texts.pageTitle || texts.title || config.name, vars);
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', config.theme.palette.bg);
    // vars change with every score update; the title only needs the texts
  }, [preview, texts.pageTitle, texts.title, config.name, config.theme.palette.bg]);

  // Keep "updated 5 minutes ago" fresh.
  useEffect(() => {
    if (!config.features.lastUpdated || !scoreUpdatedAt) return;
    const id = setInterval(() => setClock((c) => c + 1), 30_000);
    return () => clearInterval(id);
  }, [config.features.lastUpdated, scoreUpdatedAt]);

  // Celebration: the visualization fills to 100%, then the message appears above it.
  const celebrate = config.features.celebration && goalReached;
  useEffect(() => {
    if (!celebrate) {
      setShowCelebration(false);
      return;
    }
    let interval: ReturnType<typeof setInterval> | undefined;
    let confettiReset: (() => void) | undefined;
    let cancelled = false;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const timer = setTimeout(async () => {
      setShowCelebration(true);
      if (preview || reduceMotion || !config.features.confetti) return;
      const { default: confetti } = await import('canvas-confetti');
      if (cancelled) return;
      confettiReset = () => confetti.reset();
      const end = Date.now() + CONFETTI_DURATION_MS;
      const p = config.theme.palette;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100, colors: ['#ffffff', p.primaryLight, p.primary, p.primaryDark] };
      const rand = (min: number, max: number) => Math.random() * (max - min) + min;
      interval = setInterval(() => {
        const left = end - Date.now();
        if (left <= 0) return clearInterval(interval);
        const particleCount = 45 * (left / CONFETTI_DURATION_MS);
        confetti({ ...defaults, particleCount, origin: { x: rand(0.1, 0.3), y: Math.random() - 0.2 } });
        confetti({ ...defaults, particleCount, origin: { x: rand(0.7, 0.9), y: Math.random() - 0.2 } });
      }, 250);
    }, preview ? 400 : CELEBRATION_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearInterval(interval);
      confettiReset?.();
    };
  }, [celebrate, preview, replayKey, config.features.confetti, config.theme.palette]);

  const flash = (text: string, shutter: boolean) => {
    setToast({ text, shutter });
    setTimeout(() => setToast(null), 2500);
  };

  const handleReplay = () => {
    setReplayKey((k) => k + 1);
    mountedAt.current = Date.now();
  };

  const handleCapture = async () => {
    if (!pageRef.current || capturing) return;
    setCapturing(true);
    try {
      const [{ toPng }] = await Promise.all([
        import('html-to-image'),
        // Let entry animations finish so the poster shows final values.
        new Promise((r) => setTimeout(r, Math.max(0, 2000 - (Date.now() - mountedAt.current)))),
      ]);
      const dataUrl = await toPng(pageRef.current, {
        cacheBust: true,
        pixelRatio: isIOS() ? 2 : 3, // iOS Safari crashes on very large canvases
        backgroundColor: config.theme.palette.bg,
        filter: (node) => !(node instanceof HTMLElement && node.hasAttribute(SKIP_CAPTURE)),
      });
      if (isIOS()) setPosterUrl(dataUrl);
      else {
        const link = document.createElement('a');
        link.download = `${(fill(texts.title) || config.name || 'goal').replace(/[\\/:*?"<>|]+/g, '-')}.png`;
        link.href = dataUrl;
        link.click();
        flash(chrome.posterSaved, true);
      }
    } catch (err) {
      console.error('Failed to capture poster:', err);
      flash(chrome.posterFailed, false);
    } finally {
      setCapturing(false);
    }
  };

  const nextLang = config.languages[(config.languages.indexOf(lang) + 1) % config.languages.length];
  const showLangSwitch = config.features.languageSwitch && config.languages.length > 1 && !!onLangChange;
  const toolbarButton =
    'w-11 h-11 rounded-full bg-surface/75 backdrop-blur-sm border border-primary/25 flex items-center justify-center text-primary-light/75 hover:text-primary-light hover:bg-primary/10 transition-all hover:scale-110 disabled:opacity-60 disabled:hover:scale-100';

  const minH = preview ? 'min-h-full' : 'min-h-[100dvh]';

  const stats = [
    !counterShowsScore && { label: chrome.achieved, value: score, accent: true },
    { label: chrome.target, value: safeTarget, accent: false },
  ].filter(Boolean) as { label: string; value: number; accent: boolean }[];

  return (
    <div ref={pageRef} dir={dirOf(lang)} lang={lang} style={themeStyle(config)} className={`relative ${minH} text-text bg-bg font-goal overflow-hidden selection:bg-primary/30`}>
      <Background config={config} contained={preview} />

      {isDraft && (
        <div {...{ [SKIP_CAPTURE]: '' }} className="fixed top-0 inset-x-0 z-[60] flex items-center justify-center gap-2 bg-primary text-bg text-xs font-bold shadow-[0_2px_12px_rgb(0_0_0/var(--shade))] py-1.5 px-3 text-center">
          <Eye size={14} />
          {chrome.draftBanner}
        </div>
      )}

      <main className={`relative z-40 ${minH} flex flex-col items-center justify-center gap-[clamp(1rem,3vh,1.8rem)] px-[5vw] py-[6vh] pb-28 text-center`}>
        {(config.logo || texts.title || texts.subtitle) && (
          <header className="flex flex-col items-center gap-2">
            {config.logo && <img src={assetUrl(config.logo)} alt="" className="h-[clamp(48px,9vh,84px)] w-auto object-contain mb-1" />}
            {texts.title && (
              <h1 className="text-[clamp(1.6rem,5vw,2.6rem)] font-extrabold leading-tight text-gradient drop-shadow-[0_0_12px_color-mix(in_srgb,var(--color-primary)_30%,transparent)]">
                {fill(texts.title)}
              </h1>
            )}
            {texts.subtitle && <p className="text-[clamp(0.9rem,2.4vw,1.1rem)] text-text-muted">{fill(texts.subtitle)}</p>}
          </header>
        )}

        {showCelebration && (
            <div role="status" className="anim-fade-up text-[clamp(1.25rem,3.6vw,2rem)] leading-[1.7] font-medium text-text px-4 max-w-[700px]">
              <span className="block font-extrabold text-gradient text-[1.15em] drop-shadow-[0_0_10px_color-mix(in_srgb,var(--color-primary)_40%,transparent)]">
                {fill(texts.celebrationTitle)}
              </span>
              {fill(texts.celebrationBody)
                .split('\n')
                .map((line, i) => (
                  <span key={i} className="block">
                    {line}
                  </span>
                ))}
            </div>
          )}

        {/* The visualization stays visible — reaching 100% is the moment to see it full. */}
        <div
          key={`viz-${replayKey}`}
          className={`anim-fade-in relative w-full flex items-center justify-center min-h-[min(60vw,320px)] transition-transform duration-500 ${showCelebration ? 'scale-[0.94]' : ''}`}
        >
          <Suspense fallback={<div className="w-12 h-12 border-4 border-primary/25 border-t-primary-light rounded-full animate-spin" />}>
            <Viz score={score} target={safeTarget} ratio={ratio} lang={lang} config={config} label={fill(texts.vizLabel)} />
          </Suspense>
        </div>

        {config.features.stats && (
          <div className={`grid gap-3 w-full max-w-[420px] ${stats.length === 2 ? 'grid-cols-2' : 'grid-cols-1 max-w-[220px]'}`}>
            {stats.map((s) => (
              <div key={s.label} className="goal-card px-3 py-2.5 !rounded-[min(var(--radius-goal),16px)]">
                <div className="text-[0.75rem] text-text-muted mb-0.5">{s.label}</div>
                <div className={`text-[1rem] font-bold ${s.accent ? 'text-primary-light' : 'text-text'}`} style={{ direction: 'ltr' }}>
                  {formatNumber(s.value, lang)}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="w-full max-w-[560px] flex flex-col items-center gap-1">
          {goalReached ? (
            <div className="text-[clamp(1.2rem,3.5vw,1.6rem)] font-bold text-text">{fill(texts.afterGoal)}</div>
          ) : (
            <>
              {!counterShowsRemaining && (
                <div className="text-[clamp(1.7rem,4.5vw,2.3rem)] font-bold leading-tight">
                  <span className="font-extrabold text-gradient">{formatNumber(remaining, lang)}</span> {texts.unit}
                </div>
              )}
              {texts.remainingText && <div className="text-[clamp(1.05rem,2.8vw,1.35rem)] font-medium text-text/90">{fill(texts.remainingText)}</div>}
              {texts.callToAction && <div className="text-[clamp(0.9rem,2.4vw,1.1rem)] text-text-muted mt-0.5">{fill(texts.callToAction)}</div>}
            </>
          )}
        </div>

        {(texts.footer || (config.features.lastUpdated && scoreUpdatedAt)) && (
          <footer className="flex flex-col items-center gap-1">
            {texts.footer && <div className="text-[0.72rem] tracking-[0.2em] text-text-muted/70">{fill(texts.footer)}</div>}
            {config.features.lastUpdated && scoreUpdatedAt ? (
              <div className="text-[0.72rem] text-text-muted/80">
                {chrome.updated}: {timeAgo(scoreUpdatedAt, lang)}
              </div>
            ) : null}
          </footer>
        )}
      </main>

      {connectionError && (
        <div
          {...{ [SKIP_CAPTURE]: '' }}
          role="status"
          className="fixed top-2 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 whitespace-nowrap bg-surface/95 border border-danger/50 text-danger text-[11px] shadow-[0_4px_16px_rgb(0_0_0/var(--shade))] px-3 py-1.5 rounded-full backdrop-blur-md"
        >
          <WifiOff size={13} />
          <span>{chrome.offline}</span>
        </div>
      )}

      {!preview && (
        <div {...{ [SKIP_CAPTURE]: '' }} className="fixed bottom-[18px] left-[18px] z-50 flex gap-3" dir="ltr">
          {onOpenEditor && (
            <button onClick={onOpenEditor} className={toolbarButton} title={chrome.editScore} aria-label={chrome.editScore}>
              <Settings size={18} strokeWidth={1.5} />
            </button>
          )}
          {showLangSwitch && (
            <button onClick={() => onLangChange!(nextLang)} className={`${toolbarButton} font-bold text-[0.8rem]`} title={chrome.nextLang} aria-label={chrome.nextLang}>
              {LANG_CODES[nextLang]}
            </button>
          )}
          {config.features.replay && (
            <button onClick={handleReplay} className={toolbarButton} title={chrome.replay} aria-label={chrome.replay}>
              <Film size={18} strokeWidth={1.5} />
            </button>
          )}
          {config.features.poster && (
            <button onClick={handleCapture} disabled={capturing} className={toolbarButton} title={chrome.poster} aria-label={chrome.poster} aria-busy={capturing}>
              {capturing ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} strokeWidth={1.5} />}
            </button>
          )}
        </div>
      )}

      {toast?.shutter && <div {...{ [SKIP_CAPTURE]: '' }} className="anim-shutter fixed inset-0 z-[100] bg-white pointer-events-none opacity-0" />}
      {(toast || capturing) && (
          <div
            {...{ [SKIP_CAPTURE]: '' }}
            role="status"
            className="anim-fade-up fixed top-[40px] left-1/2 -translate-x-1/2 z-[101] flex items-center gap-2 bg-surface/90 border border-primary/30 text-primary-light px-6 py-3 rounded-full font-medium backdrop-blur-md shadow-lg pointer-events-none whitespace-nowrap"
          >
            {capturing && !toast && <Loader2 size={16} className="animate-spin" />}
            {toast ? toast.text : chrome.posterWorking}
          </div>
        )}

      {posterUrl && (
          <div
            {...{ [SKIP_CAPTURE]: '' }}
            className="anim-fade-in fixed inset-0 z-[100] bg-bg/90 flex items-center justify-center p-4 backdrop-blur-sm"
          >
            <div className="relative max-w-sm w-full bg-surface border border-primary/30 rounded-2xl p-4 flex flex-col items-center gap-4">
              <h3 className="text-primary-light font-bold text-lg mt-2">{chrome.posterReady}</h3>
              <p className="text-text/70 text-sm">{chrome.posterHint}</p>
              <img src={posterUrl} alt="" className="w-full rounded-lg border border-primary/20" />
              <button onClick={() => setPosterUrl(null)} className="w-full py-2.5 rounded-xl bg-primary-light text-bg font-bold hover:bg-primary transition-colors">
                {chrome.close}
              </button>
            </div>
          </div>
        )}
    </div>
  );
}
