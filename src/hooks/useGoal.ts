import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, type GoalPayload } from '../lib/api';
import { POLL_INTERVAL_MS } from '../config';

export type GoalStatus = 'loading' | 'ready' | 'not_found' | 'error';

/**
 * Loads a goal (null slug = platform default) and keeps it fresh by polling.
 * Polls that started before a save finished are discarded so they can't
 * overwrite the value that was just saved.
 */
export function useGoal(slug: string | null) {
  const [goal, setGoal] = useState<GoalPayload | null>(null);
  const [status, setStatus] = useState<GoalStatus>('loading');
  const [connectionError, setConnectionError] = useState(false);
  const mutationVersion = useRef(0);
  const savesInFlight = useRef(0);

  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    let inFlight = false;
    setGoal(null);
    setStatus('loading');

    const schedule = () => {
      clearTimeout(timer);
      if (!disposed && !document.hidden) timer = setTimeout(poll, POLL_INTERVAL_MS);
    };

    async function poll() {
      if (inFlight || disposed) return;
      inFlight = true;
      const versionAtStart = mutationVersion.current;
      controller = new AbortController();
      try {
        const fresh = await api.getGoal(slug, controller.signal);
        if (disposed) return;
        if (savesInFlight.current === 0 && versionAtStart === mutationVersion.current) {
          setGoal((prev) =>
            prev && prev.updatedAt === fresh.updatedAt && prev.score === fresh.score && prev.target === fresh.target ? prev : fresh,
          );
        }
        setStatus('ready');
        setConnectionError(false);
      } catch (err) {
        if (disposed || (err as Error)?.name === 'AbortError') return;
        if (err instanceof ApiError && err.code === 'not_found') {
          setStatus('not_found');
          return; // nothing to poll
        }
        setConnectionError(true);
        setStatus((s) => (s === 'ready' ? s : 'error'));
      } finally {
        inFlight = false;
        if (!disposed) schedule();
      }
    }

    const onVisibilityChange = () => {
      clearTimeout(timer);
      if (!document.hidden) poll();
    };

    poll();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      disposed = true;
      clearTimeout(timer);
      controller?.abort();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [slug]);

  /** Resolves only after the server confirmed. Throws ApiError on failure. */
  const saveScore = useCallback(
    async (token: string, update: { score: number; target?: number }) => {
      if (!goal) throw new ApiError('not_found');
      mutationVersion.current++;
      savesInFlight.current++;
      try {
        const saved = await api.updateScore(token, goal.slug, update);
        setGoal(saved);
        return saved;
      } finally {
        savesInFlight.current--;
        mutationVersion.current++;
      }
    },
    [goal],
  );

  return { goal, status, connectionError, saveScore };
}
