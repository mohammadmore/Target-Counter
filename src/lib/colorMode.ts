import { useCallback, useEffect, useState } from 'react';
import type { ColorMode } from '../goal/types';

const query = () => window.matchMedia?.('(prefers-color-scheme: light)');
export const systemMode = (): ColorMode => (query()?.matches ? 'light' : 'dark');

function stored(key: string): ColorMode | null {
  try {
    const v = localStorage.getItem(key);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

/**
 * Light/dark preference for one surface (goal pages or the studio).
 * Follows the device setting until the user picks a mode, then remembers it.
 */
export function useColorMode(storageKey: string): [ColorMode, (mode: ColorMode) => void] {
  const [explicit, setExplicit] = useState<ColorMode | null>(() => stored(storageKey));
  const [system, setSystem] = useState<ColorMode>(systemMode);

  useEffect(() => {
    const mq = query();
    if (!mq) return;
    const onChange = () => setSystem(systemMode());
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  const choose = useCallback(
    (mode: ColorMode) => {
      setExplicit(mode);
      try {
        // Picking the same as the device setting means "follow the device" again.
        if (mode === systemMode()) localStorage.removeItem(storageKey);
        else localStorage.setItem(storageKey, mode);
      } catch { /* ignore */ }
    },
    [storageKey],
  );

  return [explicit ?? system, choose];
}

export const GOAL_MODE_KEY = 'goal_color_mode';
export const STUDIO_MODE_KEY = 'studio_color_mode';
