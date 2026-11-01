import { lazy, Suspense, useMemo, useState } from 'react';
import { useGoal } from './hooks/useGoal';
import { normalizeConfig } from './goal/normalize';
import { themeStyle } from './goal/theme';
import { createDefaultConfig } from './goal/presets';
import { isLang, type Lang } from './lib/format';
import { hrefFor, navigate, useRoute } from './router';
import GoalPage from './page/GoalPage';
import ScoreEditor from './editor/ScoreEditor';
import { CHROME } from './page/chrome';
import PreviewHost from './page/PreviewHost';

// The studio (dashboard + wizard) is only needed by admins — keep it out of the viewer bundle.
const Studio = lazy(() => import('./studio/Studio'));

function Spinner({ message }: { message?: string }) {
  return (
    <div className="min-h-[100dvh] flex flex-col gap-4 items-center justify-center bg-bg text-text-muted font-goal" role="status">
      <div className="w-12 h-12 border-4 border-primary/30 border-t-primary-light rounded-full animate-spin" />
      {message && <p className="text-sm">{message}</p>}
    </div>
  );
}

function GoalRoute({ slug, edit }: { slug: string | null; edit: boolean }) {
  const { goal, status, connectionError, saveScore } = useGoal(slug);
  // Re-normalize only when the stored config actually changes (not on every score poll).
  const configKey = goal ? JSON.stringify(goal.config) : null;
  const config = useMemo(() => (configKey === null ? null : normalizeConfig(JSON.parse(configKey))), [configKey]);
  const [langOverride, setLangOverride] = useState<Lang | null>(() => {
    const q = new URLSearchParams(window.location.search).get('lang');
    return isLang(q) ? q : null;
  });

  if (status === 'not_found') {
    const fallback = createDefaultConfig();
    const chrome = CHROME.fa;
    return (
      <div style={themeStyle(fallback)} dir="rtl" className="min-h-[100dvh] flex flex-col gap-4 items-center justify-center bg-bg text-text font-goal">
        <p className="text-lg">{slug ? chrome.notFound : chrome.noGoals}</p>
        <a href={hrefFor({ kind: 'studio' })} className="px-5 py-2 rounded-full border border-primary/40 text-primary-light hover:bg-primary/10">
          {chrome.openStudio}
        </a>
      </div>
    );
  }

  if (!goal || !config) {
    return <Spinner message={status === 'error' ? CHROME.fa.connectionLost : CHROME.fa.connecting} />;
  }

  const lang = langOverride && config.languages.includes(langOverride) ? langOverride : config.defaultLang;
  const goalRoute = { kind: 'goal' as const, slug: slug ?? goal.slug };

  if (edit) {
    return (
      <div style={themeStyle(config)} dir="rtl" className="relative min-h-[100dvh] bg-bg text-text font-goal">
        <ScoreEditor
          goal={goal}
          goalName={config.name}
          save={saveScore}
          onBack={() => navigate({ ...goalRoute, edit: false })}
        />
      </div>
    );
  }

  return (
    <GoalPage
      config={config}
      score={goal.score}
      target={goal.target}
      lang={lang}
      connectionError={connectionError}
      onLangChange={(next) => {
        setLangOverride(next);
        const url = new URL(window.location.href);
        url.searchParams.set('lang', next);
        window.history.replaceState(null, '', url.toString());
      }}
      onOpenEditor={() => navigate({ ...goalRoute, edit: true })}
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
