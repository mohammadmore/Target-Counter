import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { motion } from 'motion/react';

const DRAG_STEP_PX = 20;

export default function DigitWheel({
  value,
  onChange,
  colorClass,
  label,
  narrow,
}: {
  value: number;
  onChange: (v: number) => void;
  colorClass: string;
  label: string;
  narrow?: boolean;
}) {
  const [rotation, setRotation] = useState(value);
  const dragStart = useRef<number | null>(null);

  // Keep a continuous rotation so 9 -> 0 spins forward instead of rewinding.
  useEffect(() => {
    setRotation((r) => {
      const currentVal = ((Math.round(r) % 10) + 10) % 10;
      let diff = value - currentVal;
      if (diff > 5) diff -= 10;
      else if (diff < -5) diff += 10;
      return r + diff;
    });
  }, [value]);

  const step = (delta: number) => onChange((value + delta + 10) % 10);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    dragStart.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (dragStart.current === null) return;
    const diff = dragStart.current - e.clientY;
    if (Math.abs(diff) >= DRAG_STEP_PX) {
      step(diff > 0 ? 1 : -1); // drag up -> +1
      dragStart.current = e.clientY;
    }
  };
  const endDrag = () => {
    dragStart.current = null;
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowUp') step(1);
    else if (e.key === 'ArrowDown') step(-1);
    else if (/^[0-9]$/.test(e.key)) onChange(Number(e.key));
    else return;
    e.preventDefault();
  };

  return (
    <div
      role="spinbutton"
      tabIndex={0}
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={9}
      className={`relative flex flex-col items-center justify-center bg-bg/80 border rounded-lg mx-[1px] ${narrow ? 'w-[1.45rem] sm:w-8 text-[0.85em]' : 'w-9 sm:w-[2.75rem]'} h-[6.5rem] select-none cursor-ns-resize overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-light ${colorClass}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onKeyDown}
      style={{ perspective: '300px', touchAction: 'none' }}
    >
      {/* 3D Bevel & Inner Shadows */}
      <div className="absolute inset-0 shadow-[inset_0_5px_12px_rgba(0,0,0,0.85),inset_0_-5px_12px_rgba(0,0,0,0.85)] pointer-events-none z-10 rounded-lg" />
      <div className="absolute inset-0 border border-white/5 pointer-events-none z-10 rounded-lg" />

      {/* Gradient Masks */}
      <div className="absolute top-0 w-full h-[35%] bg-gradient-to-b from-black/95 via-black/40 to-transparent z-10 pointer-events-none" />
      <div className="absolute bottom-0 w-full h-[35%] bg-gradient-to-t from-black/95 via-black/40 to-transparent z-10 pointer-events-none" />

      {/* 3D Wheel Numbers */}
      <div className="absolute inset-0 flex items-center justify-center font-mono font-bold" style={{ transformStyle: 'preserve-3d' }}>
        {[-3, -2, -1, 0, 1, 2, 3].map((offset) => {
          const absoluteIndex = rotation + offset;
          const displayNum = ((absoluteIndex % 10) + 10) % 10;
          const isCenter = offset === 0;

          return (
            <motion.div
              key={absoluteIndex}
              className="absolute flex items-center justify-center w-full h-full"
              initial={false}
              animate={{
                y: `${offset * 35}%`,
                rotateX: offset * -35,
                z: -Math.abs(offset) * 15,
                scale: 1 - Math.abs(offset) * 0.1,
                opacity: 1 - Math.abs(offset) * 0.4,
                filter: isCenter ? 'blur(0px)' : 'blur(0.8px)',
              }}
              transition={{ type: 'spring', stiffness: 400, damping: 30, mass: 0.8 }}
            >
              <div className={`text-[1.35rem] sm:text-2xl ${isCenter ? 'drop-shadow-[0_0_8px_currentColor]' : ''}`}>{displayNum}</div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

/** Colour groups of three digits from the right, using the goal's palette. */
export const wheelColor = (i: number, total: number) => {
  const group = Math.floor((total - 1 - i) / 3);
  if (group === 0) return 'border-primary-dark text-primary-dark';
  if (group === 1) return 'border-text-muted text-text';
  return 'border-primary text-primary-light';
};

