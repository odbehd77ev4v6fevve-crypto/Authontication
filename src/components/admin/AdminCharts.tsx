import { useId, useState } from 'react';
import { formatBdt } from '../../lib/api.ts';
import type { AdminDashboardPayload } from '../../types/domain.ts';

export function MiniSparkline({
  values,
  color = '#16A34A',
  height = 36,
}: {
  values: number[];
  color?: string;
  height?: number;
}) {
  const gradId = useId();
  const safeValues = values.length >= 2 ? values : [0, ...(values.length ? values : [0])];
  const min = Math.min(...safeValues);
  const max = Math.max(...safeValues);
  const span = max - min || 1;
  const width = 96;
  const padY = 4;

  const coords = safeValues.map((v, i) => {
    const x = (i / (safeValues.length - 1)) * width;
    const y = padY + (1 - (v - min) / span) * (height - padY * 2);
    return { x, y };
  });

  const lineD = coords.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaD = `${lineD} L ${width} ${height} L 0 ${height} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-14 xl:w-16 h-8 overflow-visible shrink-0"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#${gradId})`} />
      <path d={lineD} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SalesOverviewChart({
  points,
}: {
  points: AdminDashboardPayload['salesOverview']['points'];
}) {
  const gradId = useId();
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!points.length) {
    return (
      <div className="h-56 flex items-center justify-center text-xs text-slate-400">
        No sales time-series available for this range.
      </div>
    );
  }

  const W = 680;
  const H = 220;
  const padLeft = 56;
  const padRight = 18;
  const padTop = 20;
  const padBottom = 32;
  const plotW = W - padLeft - padRight;
  const plotH = H - padTop - padBottom;

  const maxRev = Math.max(100, ...points.map((p) => p.revenue));
  const niceMax = Math.ceil(maxRev / 100) * 100;

  const coords = points.map((p, i) => {
    const x =
      points.length === 1
        ? padLeft + plotW / 2
        : padLeft + (i / (points.length - 1)) * plotW;
    const y = padTop + (1 - p.revenue / niceMax) * plotH;
    return { x, y, point: p };
  });

  const lineD = coords
    .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(' ');
  const areaD = `${lineD} L ${coords[coords.length - 1].x.toFixed(1)} ${padTop + plotH} L ${coords[0].x.toFixed(1)} ${padTop + plotH} Z`;

  const gridLevels = [0, 0.25, 0.5, 0.75, 1];
  const labelStep = Math.max(1, Math.ceil(points.length / 6));
  const activeCoord = hoveredIdx !== null ? coords[hoveredIdx] : null;

  const formatCompact = (n: number) => {
    if (n >= 1000000) return `৳${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `৳${Math.round(n / 1000)}K`;
    return `৳${Math.round(n)}`;
  };

  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-56 select-none overflow-visible">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#16A34A" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#16A34A" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {/* Gridlines & Y Labels */}
        {gridLevels.map((lvl) => {
          const y = padTop + (1 - lvl) * plotH;
          const val = niceMax * lvl;
          return (
            <g key={lvl}>
              <line
                x1={padLeft}
                y1={y}
                x2={W - padRight}
                y2={y}
                stroke="#E2E8F0"
                strokeDasharray="3 3"
                strokeWidth="1"
              />
              <text
                x={padLeft - 8}
                y={y + 4}
                textAnchor="end"
                className="fill-slate-400 text-[10px] font-mono"
              >
                {formatCompact(val)}
              </text>
            </g>
          );
        })}

        {/* Area & Line */}
        <path d={areaD} fill={`url(#${gradId})`} />
        <path
          d={lineD}
          fill="none"
          stroke="#16A34A"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Active vertical guide */}
        {activeCoord && (
          <line
            x1={activeCoord.x}
            y1={padTop}
            x2={activeCoord.x}
            y2={padTop + plotH}
            stroke="#16A34A"
            strokeDasharray="3 3"
            strokeOpacity="0.5"
          />
        )}

        {/* X Axis labels */}
        {coords.map((c, i) => {
          const showLabel = i % labelStep === 0 || i === coords.length - 1;
          return (
            <g key={c.point.key}>
              {showLabel && (
                <text
                  x={c.x}
                  y={H - 8}
                  textAnchor="middle"
                  className="fill-slate-400 text-[10px]"
                >
                  {c.point.label}
                </text>
              )}
              <circle
                cx={c.x}
                cy={c.y}
                r={hoveredIdx === i ? 5.5 : 3.2}
                className="transition-all cursor-pointer"
                fill={hoveredIdx === i ? '#15803D' : '#16A34A'}
                stroke="#FFFFFF"
                strokeWidth="2"
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
              />
            </g>
          );
        })}
      </svg>

      {activeCoord && (
        <div
          className="pointer-events-none absolute top-2 bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2 text-xs z-10"
          style={{
            left: `${Math.min(78, Math.max(8, (activeCoord.x / W) * 100))}%`,
          }}
        >
          <p className="text-[10px] font-semibold text-slate-400">{activeCoord.point.fullDate}</p>
          <p className="text-sm font-extrabold font-mono text-slate-900">
            {formatBdt(activeCoord.point.revenue)}
          </p>
          <p className="text-[10px] text-emerald-700 font-semibold">
            {activeCoord.point.orders} order{activeCoord.point.orders === 1 ? '' : 's'}
          </p>
        </div>
      )}
    </div>
  );
}

export function OrdersStatusDonutChart({
  totalOrders,
  breakdown,
}: AdminDashboardPayload['orderStatusBreakdown']) {
  const radius = 50;
  const strokeWidth = 18;
  const circumference = 2 * Math.PI * radius;

  let accumulatedOffset = 0;
  const nonZero = breakdown.filter((b) => b.count > 0);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-32 h-32 shrink-0 flex items-center justify-center">
        <svg viewBox="0 0 140 140" className="w-full h-full -rotate-90">
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="transparent"
            stroke="#F1F5F9"
            strokeWidth={strokeWidth}
          />
          {nonZero.map((slice) => {
            const fraction = totalOrders > 0 ? slice.count / totalOrders : 0;
            const dashLen = fraction * circumference;
            const dashOffset = -accumulatedOffset;
            accumulatedOffset += dashLen;
            return (
              <circle
                key={slice.key}
                cx="70"
                cy="70"
                r={radius}
                fill="transparent"
                stroke={slice.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${dashLen} ${circumference}`}
                strokeDashoffset={dashOffset}
                strokeLinecap="butt"
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-xl font-extrabold font-mono text-slate-900 leading-none">
            {totalOrders.toLocaleString('en-US')}
          </span>
          <span className="text-[10px] font-semibold text-slate-500 mt-1">Total Orders</span>
        </div>
      </div>

      <div className="w-full space-y-2">
        {breakdown.map((slice) => (
          <div key={slice.key} className="flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: slice.color }}
              />
              <span className="font-medium text-slate-700 truncate">{slice.label}</span>
            </div>
            <div className="flex items-center gap-2 font-mono shrink-0">
              <span className="text-slate-400 text-[11px]">({slice.count})</span>
              <span className="font-bold text-slate-900 w-11 text-right">{slice.percentage}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
