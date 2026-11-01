import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type ScoreData } from '../lib/api';
import { DEFAULT_TARGET, POLL_INTERVAL_MS } from '../config';

export function useScore() {
  const [data, setData] = useState<ScoreData>({ score: 0, target: DEFAULT_TARGET });
  const [hasData, setHasData] = useState(false);
  const [connectionError, setConnectionError] = useState(false);

  // Bumped at the start AND end of every save. A poll that started before the
  // latest bump may carry pre-save data, so its result is discarded.
  const mutationVersion = useRef(0);
  const savesInFlight = useRef(0);

  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    let inFlight = false;

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
        const fresh = await api.getScore(controller.signal);
        if (disposed) return;
        if (savesInFlight.current === 0 && versionAtStart === mutationVersion.current) {
          setData((prev) => (prev.score === fresh.score && prev.target === fresh.target ? prev : fresh));
        }
        setHasData(true);
        setConnectionError(false);
      } catch (err) {
        if (disposed || (err as Error)?.name === 'AbortError') return;
        // Keep showing the last known value and keep retrying.
        setConnectionError(true);
      } finally {
        inFlight = false;
        schedule();
      }
    }

    // Pause polling in background tabs; refresh immediately when visible again.
    const onVisibilityChange = () => {
      if (document.hidden) clearTimeout(timer);
      else {
        clearTimeout(timer);
        poll();
      }
    };

    poll();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      disposed = true;
      clearTimeout(timer);
      controller?.abort();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  /** Persists to the server; resolves only after the server confirmed. Throws ApiError on failure. */
  const save = useCallback(async (token: string, update: ScoreData) => {
    mutationVersion.current++;
    savesInFlight.current++;
    try {
      const saved = await api.updateScore(token, update);
      setData(saved);
      setHasData(true);
      return saved;
    } finally {
      savesInFlight.current--;
      mutationVersion.current++;
    }
  }, []);

  return {
    score: data.score,
    target: data.target,
    loading: !hasData,
    connectionError,
    save,
  };
}
