import { useEffect, useState } from 'react';
import GoalPage from './GoalPage';
import { normalizeConfig } from '../goal/normalize';
import type { ColorMode, GoalConfig, Lang } from '../goal/types';
import { resolveMode } from '../goal/theme';
import { setPlatformProfile } from '../lib/platform';
import type { PlatformProfile } from '../lib/api';

export interface PreviewMessage {
  type: 'goal-preview';
  config: GoalConfig;
  score: number;
  target: number;
  lang: Lang;
  mode: ColorMode;
  replay: number;
  platform: PlatformProfile;
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
      setPlatformProfile(data.platform);
      setState({ ...data, config: normalizeConfig(data.config) });
    };
    window.addEventListener('message', onMessage);
    window.parent.postMessage({ type: 'goal-preview-ready' }, window.location.origin);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  if (!state) return null;
  const mode = resolveMode(state.config, state.mode);
  return <GoalPage key={state.replay} config={state.config} score={state.score} target={state.target} lang={state.lang} mode={mode} />;
}
