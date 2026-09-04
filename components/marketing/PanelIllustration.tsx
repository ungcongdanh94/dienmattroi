const VARIANTS = {
  household: { rows: 3, cols: 4, glowX: 85, glowY: 15 },
  business: { rows: 4, cols: 6, glowX: 15, glowY: 20 },
  factory: { rows: 5, cols: 8, glowX: 50, glowY: 10 },
} as const;

export default function PanelIllustration({ variant }: { variant: keyof typeof VARIANTS }) {
  const { rows, cols, glowX, glowY } = VARIANTS[variant];
  const gap = 3;
  const cellW = 100 / cols;
  const cellH = 100 / rows;

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" className="h-full w-full">
      <defs>
        <linearGradient id={`bg-${variant}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0E2A44" />
          <stop offset="100%" stopColor="#0B2239" />
        </linearGradient>
        <radialGradient id={`glow-${variant}`} cx={`${glowX}%`} cy={`${glowY}%`} r="55%">
          <stop offset="0%" stopColor="#F4B63F" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#F4B63F" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`sheen-${variant}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.16" />
          <stop offset="45%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="55%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.05" />
        </linearGradient>
      </defs>

      <rect width="100" height="100" fill={`url(#bg-${variant})`} />
      <rect width="100" height="100" fill={`url(#glow-${variant})`} />

      {Array.from({ length: rows }).map((_, r) =>
        Array.from({ length: cols }).map((_, c) => {
          const x = c * cellW + gap / 2;
          const y = r * cellH + gap / 2;
          const w = cellW - gap;
          const h = cellH - gap;
          const dist = Math.hypot(c - (glowX / 100) * cols, r - (glowY / 100) * rows);
          const opacity = Math.max(0.22, 0.65 - dist * 0.06);
          return (
            <rect
              key={`${r}-${c}`}
              x={x}
              y={y}
              width={w}
              height={h}
              rx="0.6"
              fill="#1769AA"
              fillOpacity={opacity}
              stroke="#ffffff"
              strokeOpacity="0.08"
              strokeWidth="0.3"
            />
          );
        }),
      )}

      <rect width="100" height="100" fill={`url(#sheen-${variant})`} />
    </svg>
  );
}
