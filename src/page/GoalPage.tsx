import { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { toPng } from 'html-to-image';
import { AnimatePresence, motion } from 'motion/react';
import { Camera, Film, Settings, WifiOff } from 'lucide-react';
import type { GoalConfig, Lang } from '../goal/types';
import { assetUrl, ensureFont, themeStyle } from '../goal/theme';
import { dirOf, fillTemplate, formatNumber, formatPercent } from '../lib/format';
import { vizById } from '../viz';
import Background from './Background';
import { CHROME, LANG_CODES } from './chrome';

const CONFETTI_DELAY_MS = 4000;
const CONFETTI_DURATION_MS = 15_000;

const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes('Mac') && 'ontouchend' in document);

export interface GoalPageProps {
  config: GoalConfig;
  score: number;
  target: number;
  lang: Lang;
  onLangChange?: (lang: Lang) => void;
  /** Wizard preview: rendered inside a frame, no confetti/toolbar/document title. */
  preview?: boolean;
  connectionError?: boolean;
  onOpenEditor?: () => void;
}

/** A complete goal page, rendered entirely from its config. */
export default function GoalPage({ config, score, target, lang, onLangChange, preview = false, connectionError, onOpenEditor }: GoalPageProps) {
  const texts = config.texts[lang];
  const chrome = CHROME[lang];
  const safeTarget = target > 0 ? target : 1;
  const ratio = Math.max(0, Math.min(score / safeTarget, 1));
  const remaining = Math.max(safeTarget - score, 0);
  const goalReached = score >= safeTarget;
  const Viz = vizById(config.visualization.type).component;

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
  const mountedAt = useRef(Date.now());

  useEffect(() => ensureFont(config), [config]);

  useEffect(() => {
    if (!preview) document.title = fillTemplate(texts.pageTitle || texts.title || config.name, vars);
    // vars change with every score update; the title only needs the texts
  }, [preview, texts.pageTitle, texts.title, config.name]);

  // Celebration + confetti
  const celebrate = config.features.celebration && goalReached;
  useEffect(() => {
    if (!celebrate) {
      setShowCelebration(false);
      return;
    }
    let interval: ReturnType<typeof setInterval> | undefined;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const timer = setTimeout(
      () => {
        setShowCelebration(true);
        if (preview || reduceMotion || !config.features.confetti) return;
        const end = Date.now() + CONFETTI_DURATION_MS;
        const p = config.theme.palette;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100, colors: ['#ffffff', p.primaryLight, p.primary, p.primaryDark] };
        const rand = (min: number, max: number) => Math.random() * (max - min) + min;
        interval = setInterval(() => {
          const left = end - Date.now();
          if (left <= 0) return clearInterval(interval);
          const particleCount = 50 * (left / CONFETTI_DURATION_MS);
          confetti({ ...defaults, particleCount, origin: { x: rand(0.1, 0.3), y: Math.random() - 0.2 } });
          confetti({ ...defaults, particleCount, origin: { x: rand(0.7, 0.9), y: Math.random() - 0.2 } });
        }, 250);
      },
      preview ? 600 : CONFETTI_DELAY_MS,
    );
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      if (!preview) confetti.reset();
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
      await new Promise((r) => setTimeout(r, 150)); // let the toolbar hide
      const elapsed = Date.now() - mountedAt.current;
      if (elapsed < 2000) await new Promise((r) => setTimeout(r, 2000 - elapsed));
      const dataUrl = await toPng(pageRef.current, {
        cacheBust: true,
        pixelRatio: isIOS() ? 2 : 3, // iOS Safari crashes on very large canvases
        backgroundColor: config.theme.palette.bg,
      });
      if (isIOS()) setPosterUrl(dataUrl);
      else {
        const link = document.createElement('a');
        link.download = `${(texts.title || 'goal').replace(/[\\/:*?"<>|]+/g, '-')}.png`;
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
    'w-10 h-10 rounded-full bg-surface/70 backdrop-blur-sm border border-primary/25 flex items-center justify-center text-primary-light/60 hover:text-primary-light hover:bg-primary/10 transition-all hover:scale-110';

  const minH = preview ? 'min-h-full' : 'min-h-[100dvh]';

  return (
    <div
      ref={pageRef}
      dir={dirOf(lang)}
      lang={lang}
      style={themeStyle(config)}
      className={`relative ${minH} text-text bg-bg font-goal overflow-hidden selection:bg-primary/30`}
    >
      <Background config={config} contained={preview} />

      <main className={`relative z-40 ${minH} flex flex-col items-center justify-center gap-[clamp(1rem,3vh,1.8rem)] px-[5vw] py-[6vh] pb-24 text-center`}>
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

        {/* Stage: visualization or celebration */}
        <div className="relative w-full flex items-center justify-center min-h-[min(60vw,320px)]">
          <AnimatePresence mode="wait">
            {showCelebration ? (
              <motion.div
                key={`celebrate-${lang}`}
                initial={{ opacity: 0, scale: 1.1 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1 }}
                className="text-[clamp(1.4rem,4vw,2.2rem)] leading-[1.8] font-medium text-text px-4 max-w-[700px]"
              >
                <span className="font-extrabold text-gradient drop-shadow-[0_0_10px_color-mix(in_srgb,var(--color-primary)_40%,transparent)]">
                  {fill(texts.celebrationTitle)}
                </span>
                {fill(texts.celebrationBody)
                  .split('\n')
                  .map((line, i) => (
                    <span key={i} className="block">
                      {line}
                    </span>
                  ))}
              </motion.div>
            ) : (
              <motion.div
                key={`viz-${replayKey}-${lang}`}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.4 }}
                className="w-full"
              >
                <Viz score={score} target={safeTarget} ratio={ratio} lang={lang} config={config} label={fill(texts.vizLabel)} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {config.features.stats && !showCelebration && (
          <div className="grid grid-cols-2 gap-3 w-full max-w-[420px]">
            {[
              { label: chrome.achieved, value: score, accent: false },
              { label: chrome.remaining, value: remaining, accent: true },
            ].map((s) => (
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
            <div className={`transition-opacity duration-1000 ${showCelebration || !config.features.celebration ? 'opacity-100' : 'opacity-0'}`}>
              <div className="text-[clamp(1.2rem,3.5vw,1.6rem)] font-bold text-text">{fill(texts.afterGoal)}</div>
            </div>
          ) : (
            <>
              <div className="text-[clamp(1.7rem,4.5vw,2.3rem)] font-bold leading-tight">
                <span className="font-extrabold text-gradient">{formatNumber(remaining, lang)}</span> {texts.unit}
              </div>
              {texts.remainingText && <div className="text-[clamp(1.05rem,2.8vw,1.35rem)] font-medium text-text/90">{fill(texts.remainingText)}</div>}
              {texts.callToAction && <div className="text-[clamp(0.9rem,2.4vw,1.1rem)] text-text-muted mt-0.5">{fill(texts.callToAction)}</div>}
            </>
          )}
        </div>

        {texts.footer && <footer className="text-[0.72rem] tracking-[0.2em] text-text-muted/70">{fill(texts.footer)}</footer>}
      </main>

      {connectionError && !capturing && (
        <div role="status" className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-black/75 border border-red-400/40 text-red-200 text-xs px-3 py-1.5 rounded-full backdrop-blur-md">
          <WifiOff size={14} />
          <span>{chrome.connectionLost}</span>
        </div>
      )}

      {!preview && !capturing && (
        <div className="fixed bottom-[18px] left-[18px] z-50 flex gap-3" dir="ltr">
          {config.features.editorButton && onOpenEditor && (
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
            <button onClick={handleCapture} className={toolbarButton} title={chrome.poster} aria-label={chrome.poster}>
              <Camera size={18} strokeWidth={1.5} />
            </button>
          )}
        </div>
      )}

      <AnimatePresence>
        {toast?.shutter && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: [1, 0] }} transition={{ duration: 0.5 }} className="fixed inset-0 z-[100] bg-white pointer-events-none" />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {toast && (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-[40px] left-1/2 -translate-x-1/2 z-[101] bg-black/80 border border-primary/30 text-primary-light px-6 py-3 rounded-full font-medium backdrop-blur-md shadow-lg pointer-events-none whitespace-nowrap"
          >
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {posterUrl && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="relative max-w-sm w-full bg-surface border border-primary/30 rounded-2xl p-4 flex flex-col items-center gap-4">
              <h3 className="text-primary-light font-bold text-lg mt-2">{chrome.posterReady}</h3>
              <p className="text-text/70 text-sm">{chrome.posterHint}</p>
              <img src={posterUrl} alt="" className="w-full rounded-lg border border-primary/20" />
              <button onClick={() => setPosterUrl(null)} className="w-full py-2.5 rounded-xl bg-primary-light text-bg font-bold hover:bg-primary transition-colors">
                {chrome.close}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
