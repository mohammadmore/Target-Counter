import React, { useMemo } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { motion } from 'motion/react';
import { Target, Award, TrendingUp, Sparkles } from 'lucide-react';

interface GoldGaugeChartProps {
  score: number;
  target: number;
  lang: 'fa' | 'ar';
}

export default function GoldGaugeChart({ score, target, lang }: GoldGaugeChartProps) {
  const safeTarget = target > 0 ? target : 60000000;
  const clampedScore = Math.max(0, score);
  const ratio = Math.min(clampedScore / safeTarget, 1);
  const percentage = (ratio * 100);
  const remaining = Math.max(safeTarget - clampedScore, 0);

  // Data for the Recharts gauge
  const activeValue = Math.min(clampedScore, safeTarget);
  const remainingValue = Math.max(safeTarget - clampedScore, 0);

  const gaugeData = useMemo(() => [
    {
      name: lang === 'fa' ? 'امتیاز محقق‌شده' : 'النقاط المحققة',
      value: activeValue,
      fill: 'url(#goldGaugeGrad)',
    },
    {
      name: lang === 'fa' ? 'باقیمانده تا ۶۰ میلیون' : 'المتبقي حتى 60 مليون',
      value: remainingValue,
      fill: 'rgba(212, 175, 55, 0.08)',
    },
  ], [activeValue, remainingValue, lang]);

  // Background track data (full 180-degree arch)
  const trackData = useMemo(() => [{ value: safeTarget }], [safeTarget]);

  // Milestone points along the 180-degree arch (0%, 25%, 50%, 75%, 100%)
  const milestones = [
    { label: '۰', sub: '0M', pct: 0 },
    { label: '۱۵M', sub: '15M', pct: 0.25 },
    { label: '۳۰M', sub: '30M', pct: 0.5 },
    { label: '۴۵M', sub: '45M', pct: 0.75 },
    { label: '۶۰M', sub: '60M', pct: 1.0 },
  ];

  // Needle calculation: 180° is at the left (0%), 90° is top (50%), 0° is right (100%)
  // SVG coordinates: Center at cx=150, cy=145, length=95
  const cx = 150;
  const cy = 135;
  const needleLength = 88;
  const needleAngleDeg = 180 - ratio * 180;
  const needleAngleRad = (needleAngleDeg * Math.PI) / 180;
  const needleX = cx + needleLength * Math.cos(needleAngleRad);
  const needleY = cy - needleLength * Math.sin(needleAngleRad);

  // Perpendicular points for tapered needle base
  const baseWidth = 5;
  const perpRad = needleAngleRad + Math.PI / 2;
  const xLeft = cx + baseWidth * Math.cos(perpRad);
  const yLeft = cy - baseWidth * Math.sin(perpRad);
  const xRight = cx - baseWidth * Math.cos(perpRad);
  const yRight = cy + baseWidth * Math.sin(perpRad);

  return (
    <div className="w-full max-w-[460px] mx-auto bg-[#0a0907]/85 border border-gold-1/30 rounded-3xl p-5 shadow-[0_0_40px_rgba(212,175,55,0.08)] backdrop-blur-xl relative overflow-hidden">
      {/* Subtle luxury ambient lighting */}
      <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-72 h-40 bg-gold-1/10 rounded-full blur-3xl pointer-events-none" />
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gold-1/20 pb-3 mb-2 relative z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gold-1/15 border border-gold-1/30 flex items-center justify-center text-gold-2">
            <Target size={16} />
          </div>
          <div className="text-right">
            <h3 className="text-[0.95rem] font-bold text-transparent bg-clip-text bg-gradient-to-r from-gold-2 via-gold-1 to-gold-3">
              {lang === 'fa' ? 'گیج سنجش تارگت ماهانه' : 'مقياس الهدف الشهري'}
            </h3>
            <p className="text-[0.72rem] text-pearl-dim/80">
              {lang === 'fa' ? 'هدف نهایی: ۶۰,۰۰۰,۰۰۰ امتیاز کیان‌تیم' : 'الهدف النهائي: 60,000,000 نقطة لفريق كيان'}
            </p>
          </div>
        </div>

        <div className="px-2.5 py-1 rounded-full bg-gold-1/10 border border-gold-1/25 flex items-center gap-1.5 text-gold-2 text-[0.75rem] font-bold">
          <Sparkles size={12} className="animate-pulse" />
          <span>{percentage.toFixed(2)}%</span>
        </div>
      </div>

      {/* Main Recharts Gauge Container */}
      <div className="relative w-full h-[220px] flex items-center justify-center my-1">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart margin={{ top: 10, right: 10, bottom: 0, left: 10 }}>
            <defs>
              <linearGradient id="goldGaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#9b7325" />
                <stop offset="25%" stopColor="#d4af37" />
                <stop offset="50%" stopColor="#fff4cc" />
                <stop offset="75%" stopColor="#d4af37" />
                <stop offset="100%" stopColor="#f3cc5c" />
              </linearGradient>

              <linearGradient id="trackGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#1a1610" />
                <stop offset="50%" stopColor="#292013" />
                <stop offset="100%" stopColor="#1a1610" />
              </linearGradient>

              <filter id="gaugeGoldGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3.5" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Base Track (Background Arch) */}
            <Pie
              data={trackData}
              dataKey="value"
              cx="50%"
              cy="78%"
              startAngle={180}
              endAngle={0}
              innerRadius="68%"
              outerRadius="92%"
              fill="url(#trackGrad)"
              stroke="#3a2e17"
              strokeWidth={1}
              isAnimationActive={false}
            />

            {/* Thin Decorative Inner Gold Rail */}
            <Pie
              data={trackData}
              dataKey="value"
              cx="50%"
              cy="78%"
              startAngle={180}
              endAngle={0}
              innerRadius="64%"
              outerRadius="66%"
              fill="#d4af37"
              opacity={0.35}
              stroke="none"
              isAnimationActive={false}
            />

            {/* Active Progress Pie */}
            <Pie
              data={gaugeData}
              dataKey="value"
              cx="50%"
              cy="78%"
              startAngle={180}
              endAngle={0}
              innerRadius="70%"
              outerRadius="90%"
              paddingAngle={0}
              stroke="#120e06"
              strokeWidth={1.5}
              animationDuration={1800}
              animationEasing="ease-out"
              filter="url(#gaugeGoldGlow)"
            >
              {gaugeData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>

            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0];
                  return (
                    <div className="bg-[#120f0a]/95 border border-gold-1/40 px-3 py-2 rounded-xl text-center shadow-xl backdrop-blur-md">
                      <p className="text-[0.75rem] text-gold-2 font-bold mb-0.5">{data.name}</p>
                      <p className="text-[0.88rem] font-bold text-pearl dir-ltr">
                        {Number(data.value).toLocaleString(lang === 'ar' ? 'ar-EG' : 'fa-IR')}
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Needle & Center Pivot Overlay */}
        <svg
          viewBox="0 0 300 180"
          className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
        >
          {/* Milestone markers along arc */}
          {milestones.map((m, idx) => {
            const angleDeg = 180 - m.pct * 180;
            const angleRad = (angleDeg * Math.PI) / 180;
            const innerR = 100;
            const outerR = 109;
            const textR = 120;
            
            const x1 = cx + innerR * Math.cos(angleRad);
            const y1 = cy - innerR * Math.sin(angleRad);
            const x2 = cx + outerR * Math.cos(angleRad);
            const y2 = cy - outerR * Math.sin(angleRad);
            const tx = cx + textR * Math.cos(angleRad);
            const ty = cy - textR * Math.sin(angleRad) + 3;

            return (
              <g key={idx} className="transition-opacity duration-300">
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="#d4af37"
                  strokeWidth={idx === 0 || idx === 4 ? 2 : 1.5}
                  opacity={0.65}
                />
                <text
                  x={tx}
                  y={ty}
                  fill="#d4af37"
                  fontSize="9.5"
                  fontWeight="bold"
                  textAnchor="middle"
                  opacity={0.8}
                  className="select-none font-mono"
                >
                  {m.label}
                </text>
              </g>
            );
          })}

          {/* Animated Gold Needle */}
          <motion.g
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            {/* Needle Glow Shadow */}
            <line
              x1={cx}
              y1={cy}
              x2={needleX}
              y2={needleY}
              stroke="rgba(212, 175, 55, 0.35)"
              strokeWidth="6"
              strokeLinecap="round"
            />
            {/* Needle Polygon */}
            <polygon
              points={`${xLeft},${yLeft} ${needleX},${needleY} ${xRight},${yRight}`}
              fill="url(#goldGaugeGrad)"
              stroke="#ffe899"
              strokeWidth="0.5"
              filter="drop-shadow(0 0 4px rgba(212,175,55,0.7))"
            />
            {/* Center Pivot Caps */}
            <circle cx={cx} cy={cy} r="11" fill="#140f07" stroke="#d4af37" strokeWidth="2" />
            <circle cx={cx} cy={cy} r="6" fill="#d4af37" />
            <circle cx={cx} cy={cy} r="2.5" fill="#fff9e6" />
          </motion.g>
        </svg>

        {/* Center Live Percentage Readout */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none">
          <div
            className="text-[1.65rem] sm:text-[1.85rem] font-extrabold leading-none text-transparent bg-clip-text bg-gradient-to-b from-gold-2 via-gold-1 to-gold-3 drop-shadow-[0_0_12px_rgba(212,175,55,0.4)] dir-ltr"
            style={{ WebkitBackgroundClip: 'text' }}
          >
            {percentage.toLocaleString(lang === 'ar' ? 'ar-EG' : 'fa-IR', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
            <span className="text-[0.65em] font-bold text-gold-2 ml-1">%</span>
          </div>
          <span className="text-[0.72rem] font-medium text-pearl-dim/90 mt-1">
            {lang === 'fa' ? 'پیشرفت به سوی ۶۰,۰۰۰,۰۰۰' : 'التقدم نحو 60,000,000'}
          </span>
        </div>
      </div>

      {/* Target Breakdown Grid */}
      <div className="grid grid-cols-2 gap-2.5 mt-3 pt-3 border-t border-gold-1/15 relative z-10">
        {/* Achieved Score Card */}
        <div className="bg-black/40 border border-gold-1/20 rounded-xl p-2.5 text-center flex flex-col items-center">
          <div className="flex items-center gap-1 text-[0.72rem] text-gold-2/80 mb-0.5">
            <TrendingUp size={12} />
            <span>{lang === 'fa' ? 'امتیاز ثبت‌شده' : 'النقاط المسجلة'}</span>
          </div>
          <div className="text-[0.95rem] font-bold text-pearl dir-ltr">
            {clampedScore.toLocaleString(lang === 'ar' ? 'ar-EG' : 'fa-IR')}
          </div>
        </div>

        {/* Remaining Score Card */}
        <div className="bg-black/40 border border-gold-1/20 rounded-xl p-2.5 text-center flex flex-col items-center">
          <div className="flex items-center gap-1 text-[0.72rem] text-pearl-dim mb-0.5">
            <Award size={12} />
            <span>{lang === 'fa' ? 'مانده تا تارگت' : 'المتبقي للهدف'}</span>
          </div>
          <div className="text-[0.95rem] font-bold text-gold-2 dir-ltr">
            {remaining.toLocaleString(lang === 'ar' ? 'ar-EG' : 'fa-IR')}
          </div>
        </div>
      </div>

      {/* Target summary footer tag */}
      <div className="mt-2.5 text-center">
        <span className="text-[0.68rem] text-pearl-dim/60 tracking-wider font-light">
          {lang === 'fa'
            ? 'KIYAN TEAM • 60,000,000 TARGET GOAL GAUGE'
            : 'فريق كيان • مقياس هدف 60,000,000 نقطة'}
        </span>
      </div>
    </div>
  );
}
