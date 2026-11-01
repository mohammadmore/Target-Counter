import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { readGoalCache, useGoal, writeGoalCache } from './hooks/useGoal';
import { normalizeConfig } from './goal/normalize';
import { createDefaultConfig } from './goal/presets';
import { paletteFor, resolveMode, themeStyle } from './goal/theme';
import type { ColorMode, GoalConfig } from './goal/types';
import { GOAL_MODE_KEY, useColorMode } from './lib/colorMode';
import { setPlatformProfile } from './lib/platform';
import Credit from './components/Credit';
import { isLang, type Lang } from './lib/format';
import { canEditOnThisDevice } from './lib/api';
import { hrefFor, navigate, useRoute } from './router';
import GoalPage from './page/GoalPage';
import { CHROME } from './page/chrome';
import PreviewHost from './page/PreviewHost';

// Only admins and team editors need these — keep them out of the viewer bundle.
const Studio = lazy(() => import('./studio/Studio'));
const ScoreEditor = lazy(() => import('./editor/ScoreEditor'));

/** The goal's own look while it loads: remembered from the last visit, else the default palette. */
function fallbackConfig(slug: string | null): GoalConfig {
  const cached = readGoalCache(slug);
  return cached ? normalizeConfig(cached.config) : createDefaultConfig();
}

function Spinner({ config, mode, message }: { config: GoalConfig; mode: ColorMode; message?: string }) {
  return (
    <div
      style={themeStyle(config, mode)}
      className="min-h-[100dvh] flex flex-col gap-4 items-center justify-center bg-bg text-text-muted font-goal"
      role="status"
      aria-label={message ?? 'Loading'}
    >
      <div className="w-10 h-10 border-[3px] border-primary/20 border-t-primary-light rounded-full animate-spin" />
      {message && <p className="text-sm px-6 text-center">{message}</p>}
    </div>
  );
}

function Notice({ config, mode, title, hint, action }: { config: GoalConfig; mode: ColorMode; title: string; hint?: string; action?: { href: string; label: string } }) {
  return (
    <div style={themeStyle(config, mode)} dir="rtl" className="relative min-h-[100dvh] bg-bg text-text font-goal overflow-hidden">
      <div className="absolute inset-0 bg-glow pointer-events-none" />
      <div className="relative min-h-[100dvh] flex flex-col gap-3 items-center justify-center px-6 text-center">
        <p className="text-lg font-bold text-primary-light">{title}</p>
        {hint && <p className="text-sm text-text-muted max-w-md leading-relaxed">{hint}</p>}
        {action && (
          <a href={action.href} className="mt-2 px-5 py-2 rounded-full border border-primary/50 text-primary-light hover:bg-primary/10">
            {action.label}
          </a>
        )}
      </div>
      <Credit mode={mode} tone="goal" />
    </div>
  );
}

function GoalRoute({ slug, edit }: { slug: string | null; edit: boolean }) {
  const draftToken = useMemo(() => new URLSearchParams(window.location.search).get('draft'), []);
  const { goal, status, connectionError, mutate, refresh } = useGoal(slug, draftToken);
  // Re-normalize only when the stored config actually changes (not on every score poll).
  const configKey = goal ? JSON.stringify(goal.config) : null;
  const config = useMemo(() => (configKey === null ? null : normalizeConfig(JSON.parse(configKey))), [configKey]);
  const [preferredMode, setPreferredMode] = useColorMode(GOAL_MODE_KEY);
  const [langOverride, setLangOverride] = useState<Lang | null>(() => {
    const q = new URLSearchParams(window.location.search).get('lang');
    return isLang(q) ? q : null;
  });

  // Renamed goals: show the current address in the URL bar.
  useEffect(() => {
    if (!goal || !slug || goal.slug === slug) return;
    const url = new URL(window.location.href);
    url.searchParams.set('g', goal.slug);
    window.history.replaceState(null, '', url.toString());
  }, [goal, slug]);

  const fallback = config ?? fallbackConfig(slug);
  const mode = resolveMode(fallback, preferredMode);

  // Remember this page (and its colours) for an instant, flash-free next visit.
  useEffect(() => {
    if (!goal || !config || goal.isDraft) return;
    const p = paletteFor(config, mode);
    writeGoalCache(slug, goal, p.bg, p.primaryLight);
  }, [goal, config, slug, mode]);

  // Every goal response carries the studio profile used by the credit.
  useEffect(() => setPlatformProfile(goal?.platform), [goal?.platform]);

  const fa = CHROME.fa;
  if (status === 'not_found') {
    return <Notice config={fallback} mode={mode} title={slug ? fa.notFound : fa.noGoals} action={{ href: hrefFor({ kind: 'studio' }), label: fa.openStudio }} />;
  }
  if (status === 'not_configured') {
    return <Notice config={fallback} mode={mode} title={fa.notConfigured} hint={fa.notConfiguredHint} />;
  }
  if (!goal || !config) {
    return <Spinner config={fallback} mode={mode} message={status === 'error' ? fa.connectionLost : undefined} />;
  }

  const lang = langOverride && config.languages.includes(langOverride) ? langOverride : config.defaultLang;
  const goalRoute = { kind: 'goal' as const, slug: goal.slug };

  if (edit) {
    return (
      <Suspense fallback={<Spinner config={config} mode={mode} />}>
        <ScoreEditor
          goal={goal}
          config={config}
          lang={lang}
          colorMode={mode}
          mutate={mutate}
          refresh={refresh}
          onBack={() => navigate({ ...goalRoute, edit: false })}
        />
      </Suspense>
    );
  }

  const showEditor = !goal.isDraft && (config.features.editorButton || canEditOnThisDevice(goal.slug));

  return (
    <GoalPage
      config={config}
      score={goal.score}
      target={goal.target}
      lang={lang}
      mode={mode}
      onModeChange={config.theme.mode === 'both' ? setPreferredMode : undefined}
      connectionError={connectionError}
      scoreUpdatedAt={goal.scoreUpdatedAt}
      isDraft={goal.isDraft}
      onLangChange={(next) => {
        setLangOverride(next);
        const url = new URL(window.location.href);
        url.searchParams.set('lang', next);
        window.history.replaceState(null, '', url.toString());
      }}
      onOpenEditor={showEditor ? () => navigate({ ...goalRoute, edit: true }) : undefined}
    />
  );
}

export default function App() {
  const route = useRoute();

  if (route.kind === 'preview') return <PreviewHost />;
  if (route.kind === 'goal') {
    return <GoalRoute key={`${route.slug}`} slug={route.slug} edit={route.edit} />;
  }
  return (
    <Suspense fallback={<div className="min-h-[100dvh]" />}>
      <Studio route={route} />
    </Suspense>
  );
}
