import { useEffect, useState } from 'react';

/**
 * Query-string routing (works on any static host without rewrite rules):
 *   ./                      default goal
 *   ./?g=<slug>             goal page            (&lang=fa|ar|en)
 *   ./?g=<slug>&edit        score editor for that goal
 *   ./?studio               studio dashboard
 *   ./?studio&new           wizard for a new goal
 *   ./?studio&design=<slug> wizard for an existing goal
 *   ./?studio&settings      studio settings (Asva logos, contact links)
 *   ./?preview              wizard live-preview frame (config via postMessage)
 */
export type Route =
  | { kind: 'goal'; slug: string | null; edit: boolean }
  | { kind: 'preview' }
  | { kind: 'studio' }
  | { kind: 'settings' }
  | { kind: 'wizard'; slug: string | null };

export function parseRoute(search: string): Route {
  const q = new URLSearchParams(search);
  if (q.has('preview')) return { kind: 'preview' };
  if (q.has('studio')) {
    if (q.has('new')) return { kind: 'wizard', slug: null };
    if (q.has('settings')) return { kind: 'settings' };
    const design = q.get('design');
    if (design) return { kind: 'wizard', slug: design };
    return { kind: 'studio' };
  }
  return { kind: 'goal', slug: q.get('g') || null, edit: q.has('edit') };
}

export function hrefFor(route: Route, extra: Record<string, string> = {}): string {
  const q = new URLSearchParams();
  if (route.kind === 'goal') {
    if (route.slug) q.set('g', route.slug);
    if (route.edit) q.set('edit', '');
  } else if (route.kind === 'preview') {
    q.set('preview', '');
  } else {
    q.set('studio', '');
    if (route.kind === 'settings') q.set('settings', '');
    if (route.kind === 'wizard') {
      if (route.slug) q.set('design', route.slug);
      else q.set('new', '');
    }
  }
  for (const [k, v] of Object.entries(extra)) q.set(k, v);
  const s = q.toString().replace(/=(?=&|$)/g, '');
  return `${window.location.pathname}${s ? `?${s}` : ''}`;
}

/** Absolute shareable URL for a goal page. */
export function goalUrl(slug: string) {
  return new URL(hrefFor({ kind: 'goal', slug, edit: false }), window.location.href).toString();
}

const listeners = new Set<() => void>();

export function navigate(route: Route, extra?: Record<string, string>) {
  window.history.pushState(null, '', hrefFor(route, extra));
  listeners.forEach((l) => l());
  window.scrollTo(0, 0);
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(window.location.search));
  useEffect(() => {
    const update = () => setRoute(parseRoute(window.location.search));
    listeners.add(update);
    window.addEventListener('popstate', update);
    return () => {
      listeners.delete(update);
      window.removeEventListener('popstate', update);
    };
  }, []);
  return route;
}
