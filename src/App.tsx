import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useGoal, writeGoalCache } from './hooks/useGoal';
import { normalizeConfig } from './goal/normalize';
import { isLang, type Lang } from './lib/format';
import { canEditOnThisDevice } from './lib/api';
import { hrefFor, navigate, useRoute } from './router';
import GoalPage from './page/GoalPage';
import { CHROME } from './page/chrome';
import PreviewHost from './page/PreviewHost';

// Only admins and team editors need these — keep them out of the viewer bundle.
const Studio = lazy(() => import('./studio/Studio'));
const ScoreEditor = lazy(() => import('./editor/ScoreEditor'));

/** Neutral loader: the goal's colours aren't known yet, so don't flash a wrong theme. */
function Spinner({ message }: { message?: string }) {
  return (
    <div className="min-h-[100dvh] flex flex-col gap-4 items-center justify-center text-white/70 font-vazirmatn" role="status" aria-label={message ?? 'Loading'}>
      <div className="w-10 h-10 border-[3px] border-white/15 border-t-white/70 rounded-full animate-spin" />
      {message && <p className="text-sm px-6 text-center">{message}</p>}
    </div>
  );
}

function Notice({ title, hint, action }: { title: string; hint?: string; action?: { href: string; label: string } }) {
  return (
    <div dir="rtl" className="min-h-[100dvh] flex flex-col gap-3 items-center justify-center px-6 text-center text-zinc-100 font-vazirmatn bg-zinc-950">
      <p className="text-lg font-bold">{title}</p>
      {hint && <p className="text-sm text-zinc-400 max-w-md leading-relaxed">{hint}</p>}
      {action && (
        <a href={action.href} className="mt-2 px-5 py-2 rounded-full border border-amber-400/50 text-amber-200 hover:bg-amber-400/10">
          {action.label}
        </a>
      )}
    </div>
  );
}

function GoalRoute({ slug, edit }: { slug: string | null; edit: boolean }) {
  const draftToken = useMemo(() => new URLSearchParams(window.location.search).get('draft'), []);
  const { goal, status, connectionError, mutate, refresh } = useGoal(slug, draftToken);
  // Re-normalize only when the stored config actually changes (not on every score poll).
  const configKey = goal ? JSON.stringify(goal.config) : null;
  const config = useMemo(() => (configKey === null ? null : normalizeConfig(JSON.parse(configKey))), [configKey]);
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

  // Remember this page (and its colours) for an instant, flash-free next visit.
  useEffect(() => {
    if (goal && config && !goal.isDraft) writeGoalCache(slug, goal, config.theme.palette.bg);
  }, [goal, config, slug]);

  const fa = CHROME.fa;
  if (status === 'not_found') {
    return <Notice title={slug ? fa.notFound : fa.noGoals} action={{ href: hrefFor({ kind: 'studio' }), label: fa.openStudio }} />;
  }
  if (status === 'not_configured') {
    return <Notice title={fa.notConfigured} hint={fa.notConfiguredHint} />;
  }
  if (!goal || !config) {
    return <Spinner message={status === 'error' ? fa.connectionLost : undefined} />;
  }

  const lang = langOverride && config.languages.includes(langOverride) ? langOverride : config.defaultLang;
  const goalRoute = { kind: 'goal' as const, slug: goal.slug };

  if (edit) {
    return (
      <Suspense fallback={<Spinner />}>
        <ScoreEditor
          goal={goal}
          config={config}
          lang={lang}
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
    <Suspense fallback={<Spinner />}>
      <Studio route={route} />
    </Suspense>
  );
}
