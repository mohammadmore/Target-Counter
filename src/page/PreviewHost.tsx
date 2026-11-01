import { useEffect, useState } from 'react';
import GoalPage from './GoalPage';
import { normalizeConfig } from '../goal/normalize';
import type { GoalConfig, Lang } from '../goal/types';

export interface PreviewMessage {
  type: 'goal-preview';
  config: GoalConfig;
  score: number;
  target: number;
  lang: Lang;
  replay: number;
}

/**
 * Rendered inside the wizard's <iframe>. Receives the draft config from the
 * parent window (same origin only) and renders the real page with it.
 */
export default function PreviewHost() {
  const [state, setState] = useState<PreviewMessage | null>(null);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== window.parent) return;
      const data = e.data as PreviewMessage;
      if (data?.type !== 'goal-preview') return;
      setState({ ...data, config: normalizeConfig(data.config) });
    };
    window.addEventListener('message', onMessage);
    window.parent.postMessage({ type: 'goal-preview-ready' }, window.location.origin);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  if (!state) return null;
  return <GoalPage key={state.replay} config={state.config} score={state.score} target={state.target} lang={state.lang} />;
}
