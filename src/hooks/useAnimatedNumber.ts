import { useEffect, useRef, useState } from 'react';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Smoothly animates from the currently displayed value to `value` (ease-out cubic).
 * The first render starts from `from`. Pending frames are cancelled on change/unmount.
 */
export function useAnimatedNumber(value: number, duration = 1900, from = 0) {
  const [display, setDisplay] = useState(from);
  const displayRef = useRef(from);

  useEffect(() => {
    if (prefersReducedMotion()) {
      displayRef.current = value;
      setDisplay(value);
      return;
    }
    const startValue = displayRef.current;
    let frame = 0;
    let start: number | null = null;

    const step = (ts: number) => {
      if (start === null) start = ts;
      const t = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = startValue + (value - startValue) * eased;
      displayRef.current = next;
      setDisplay(next);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return display;
}
