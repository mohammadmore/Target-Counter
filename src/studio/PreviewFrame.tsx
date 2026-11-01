import { useEffect, useRef, useState } from 'react';
import { Monitor, RotateCcw, Smartphone } from 'lucide-react';
import { hrefFor } from '../router';
import type { GoalConfig, Lang } from '../goal/types';
import type { PreviewMessage } from '../page/PreviewHost';
import { LANG_NAMES } from '../goal/presets';
import { formatNumber } from '../lib/format';

const DEVICES = {
  mobile: { width: 390, height: 844, label: 'موبایل', icon: Smartphone },
  desktop: { width: 1280, height: 800, label: 'دسکتاپ', icon: Monitor },
} as const;

/** Live preview of the draft page inside a scaled device-sized iframe. */
export default function PreviewFrame({ config, target, initialScore }: { config: GoalConfig; target: number; initialScore: number }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [device, setDevice] = useState<keyof typeof DEVICES>('mobile');
  const [boxWidth, setBoxWidth] = useState(360);
  const [percent, setPercent] = useState(() => (target > 0 ? Math.round((initialScore / target) * 100) : 0) || 62);
  const [lang, setLang] = useState<Lang>(config.defaultLang);
  const [replay, setReplay] = useState(0);
  const [readyCount, setReadyCount] = useState(0);

  const previewLang = config.languages.includes(lang) ? lang : config.defaultLang;
  const score = Math.round((target * percent) / 100);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setBoxWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin === window.location.origin && e.data?.type === 'goal-preview-ready') setReadyCount((n) => n + 1);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    if (!readyCount) return;
    const message: PreviewMessage = { type: 'goal-preview', config, score, target, lang: previewLang, replay };
    frameRef.current?.contentWindow?.postMessage(message, window.location.origin);
  }, [readyCount, config, score, target, previewLang, replay]);

  const d = DEVICES[device];
  const scale = Math.min(1, boxWidth / d.width);

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <div className="glass-soft inline-flex p-1 rounded-xl">
          {(Object.keys(DEVICES) as (keyof typeof DEVICES)[]).map((key) => {
            const Icon = DEVICES[key].icon;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setDevice(key)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md ${device === key ? 'btn-aurora' : 'text-violet-100/60 hover:text-white'}`}
              >
                <Icon size={14} />
                {DEVICES[key].label}
              </button>
            );
          })}
        </div>
        {config.languages.length > 1 && (
          <select value={previewLang} onChange={(e) => setLang(e.target.value as Lang)} className="studio-field rounded-xl px-2 py-1.5">
            {config.languages.map((l) => (
              <option key={l} value={l}>
                {LANG_NAMES[l]}
              </option>
            ))}
          </select>
        )}
        <button type="button" onClick={() => setReplay((r) => r + 1)} className="glass-soft flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-violet-50/85 hover:bg-white/10">
          <RotateCcw size={14} />
          پخش دوباره
        </button>
      </div>

      <label className="flex items-center gap-3 text-xs text-violet-100/60">
        <span className="shrink-0">پیشرفت آزمایشی</span>
        <input type="range" min={0} max={100} value={percent} onChange={(e) => setPercent(Number(e.target.value))} className="flex-1 accent-fuchsia-500" />
        <span className="w-10 text-white/85 font-mono" dir="ltr">
          {formatNumber(percent, 'fa')}%
        </span>
      </label>
      {percent === 100 && config.features.celebration && <p className="text-[0.7rem] text-pink-300 -mt-1">حالت جشن رسیدن به هدف نمایش داده می‌شود.</p>}

      <div ref={boxRef} className="w-full flex-1 min-h-0">
        <div dir="ltr" className="mx-auto rounded-[26px] border-[5px] border-white/15 bg-black overflow-hidden shadow-[0_30px_80px_-20px_rgba(124,58,237,0.65),0_0_0_1px_rgba(255,255,255,0.08)]" style={{ width: d.width * scale + 8, height: d.height * scale + 8 }}>
          <iframe
            ref={frameRef}
            src={hrefFor({ kind: 'preview' })}
            title="پیش‌نمایش"
            style={{ width: d.width, height: d.height, transform: `scale(${scale})`, transformOrigin: 'top left' }}
            className="border-0 block"
          />
        </div>
      </div>
    </div>
  );
}
