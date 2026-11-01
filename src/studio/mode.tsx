import { createContext, useContext } from 'react';
import { Moon, Sun } from 'lucide-react';
import type { ColorMode } from '../goal/types';

export const StudioModeContext = createContext<{ mode: ColorMode; setMode: (m: ColorMode) => void }>({
  mode: 'dark',
  setMode: () => undefined,
});

export const useStudioMode = () => useContext(StudioModeContext);

/** Sun/moon switch for the studio's light and dark looks. */
export function ModeToggle({ className = '' }: { className?: string }) {
  const { mode, setMode } = useStudioMode();
  const label = mode === 'dark' ? 'حالت روشن' : 'حالت تاریک';
  return (
    <button
      type="button"
      onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}
      className={`inline-flex items-center justify-center w-9 h-9 rounded-xl border border-st-line/15 bg-st-fill/[0.06] text-st-fg hover:bg-st-fill/[0.12] transition-colors backdrop-blur-md ${className}`}
      title={label}
      aria-label={label}
    >
      {mode === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}
