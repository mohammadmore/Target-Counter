import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, goalQuery, parseResponse, type GoalPayload } from '../lib/api';
import { API_URL, POLL_INTERVAL_MS } from '../config';

export type GoalStatus = 'loading' | 'ready' | 'not_found' | 'not_configured' | 'error';

/** Show the "connection lost" warning only after this many failures in a row. */
const FAILURES_BEFORE_WARNING = 2;

const cacheKey = (slug: string | null) => `goal_cache_${slug ?? '_default'}`;

/** Last payload seen on this device — lets repeat visitors see the page instantly. */
export function readGoalCache(slug: string | null): GoalPayload | null {
  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey(slug)) ?? 'null');
    return cached?.payload?.slug ? cached.payload : null;
  } catch {
    return null;
  }
}

/** Also stores the colours so index.html can paint the page's look before any JS runs. */
export function writeGoalCache(slug: string | null, payload: GoalPayload, bg: string, fg: string) {
  try {
    localStorage.setItem(cacheKey(slug), JSON.stringify({ payload, bg, fg }));
  } catch { /* storage full or disabled */ }
}

declare global {
  interface Window {
    __goalPrefetch?: { url: string; promise: Promise<Response> };
  }
}

/** Uses the request index.html started in parallel with the JS download, once. */
function takePrefetch(slug: string | null, draftToken: string | null) {
  const pre = window.__goalPrefetch;
  if (!pre) return null;
  window.__goalPrefetch = undefined;
  return pre.url === API_URL + goalQuery(slug, draftToken) ? pre.promise : null;
}

/**
 * Loads a goal (null slug = platform default) and keeps it fresh by polling.
 * Polls that started before a mutation finished are discarded so they can't
 * overwrite the value that was just saved.
 */
export function useGoal(slug: string | null, draftToken: string | null = null) {
  const [goal, setGoal] = useState<GoalPayload | null>(() => (draftToken ? null : readGoalCache(slug)));
  const [status, setStatus] = useState<GoalStatus>(() => (goal ? 'ready' : 'loading'));
  const [connectionError, setConnectionError] = useState(false);
  const mutationVersion = useRef(0);
  const mutationsInFlight = useRef(0);

  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    let inFlight = false;
    let failures = 0;
    let first = true;

    const schedule = (delay = POLL_INTERVAL_MS) => {
      clearTimeout(timer);
      if (!disposed && !document.hidden) timer = setTimeout(poll, delay);
    };

    async function fetchOnce(signal: AbortSignal) {
      const prefetched = first ? takePrefetch(slug, draftToken) : null;
      first = false;
      if (prefetched) {
        try {
          return await parseResponse<GoalPayload>(await prefetched);
        } catch (err) {
          // Dev server (no PHP) or a network blip: fall through to the normal path.
          if (!(err instanceof ApiError) || err.code === 'unavailable') return api.getGoal(slug, signal, draftToken);
          throw err;
        }
      }
      return api.getGoal(slug, signal, draftToken);
    }

    async function poll() {
      if (inFlight || disposed) return;
      inFlight = true;
      const versionAtStart = mutationVersion.current;
      controller = new AbortController();
      let next = POLL_INTERVAL_MS;
      try {
        const fresh = await fetchOnce(controller.signal);
        if (disposed) return;
        if (mutationsInFlight.current === 0 && versionAtStart === mutationVersion.current) {
          setGoal((prev) =>
            prev &&
            prev.slug === fresh.slug &&
            prev.updatedAt === fresh.updatedAt &&
            prev.score === fresh.score &&
            prev.target === fresh.target &&
            prev.isDraft === fresh.isDraft
              ? prev
              : fresh,
          );
        }
        failures = 0;
        setStatus('ready');
        setConnectionError(false);
      } catch (err) {
        if (disposed || (err as Error)?.name === 'AbortError') return;
        if (err instanceof ApiError && err.code === 'not_found') {
          setStatus('not_found');
          setGoal(null);
          return; // nothing to poll
        }
        if (err instanceof ApiError && err.code === 'not_configured') {
          setStatus('not_configured');
          next = 30_000; // the installer may fix it; check again slowly
        } else {
          failures++;
          if (failures >= FAILURES_BEFORE_WARNING) setConnectionError(true);
          setStatus((s) => (s === 'ready' ? s : failures >= FAILURES_BEFORE_WARNING ? 'error' : 'loading'));
          next = failures < FAILURES_BEFORE_WARNING ? 1500 : POLL_INTERVAL_MS; // retry a blip quickly
        }
      } finally {
        inFlight = false;
        if (!disposed) schedule(next);
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
  }, [slug, draftToken]);

  /** Runs a server mutation that returns the fresh goal; polls can't overwrite it. */
  const mutate = useCallback(async <T extends GoalPayload>(run: () => Promise<T>): Promise<T> => {
    mutationVersion.current++;
    mutationsInFlight.current++;
    try {
      const saved = await run();
      setGoal((prev) => ({ ...saved, config: prev?.config ?? saved.config, isDraft: prev?.isDraft ?? false }));
      return saved;
    } finally {
      mutationsInFlight.current--;
      mutationVersion.current++;
    }
  }, []);

  /** Re-read immediately (e.g. after a conflict). */
  const refresh = useCallback(async () => {
    const fresh = await api.getGoal(slug, undefined, draftToken);
    setGoal(fresh);
    return fresh;
  }, [slug, draftToken]);

  return { goal, status, connectionError, mutate, refresh };
}
