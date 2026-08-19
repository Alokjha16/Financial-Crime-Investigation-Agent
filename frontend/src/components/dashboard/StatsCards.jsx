import { motion } from "framer-motion";
import {
  TrendingUp, TrendingDown,
  BookOpen,      // Total transactions — ledger
  FlagTriangleRight, // Flagged — flag with urgency
  ShieldAlert,   // High-risk — shield alert
  Hourglass,     // In review — hourglass/pending
  ArrowUpCircle, // Escalated — escalation
} from "lucide-react";
import { fmtINR } from "../../utils/format";

// ── Tiny SVG sparkline ────────────────────────────────────────
function Sparkline({ points = [], color }) {
  if (!points.length) return null;
  const w = 64, h = 24;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const coords = points.map((v, i) => [
    (i / (points.length - 1)) * w,
    h - ((v - min) / range) * (h - 4) - 2,
  ]);
  const d = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" style={{ overflow: "visible" }}>
      {/* Area fill */}
      <defs>
        <linearGradient id={`sg-${color.replace("#","")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={`${d} L${w},${h} L0,${h} Z`}
        fill={`url(#sg-${color.replace("#","")})`}
      />
      {/* Line */}
      <path d={d} stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      {/* End dot */}
      <circle
        cx={coords[coords.length - 1][0]}
        cy={coords[coords.length - 1][1]}
        r="2.5"
        fill={color}
      />
    </svg>
  );
}

// ── Sparkline data (last 7 days, realistic deltas) ────────────
const SPARKLINES = {
  total_transactions: [4810, 4920, 5010, 4970, 5050, 5060, 5070],
  flagged_cases:      [158, 162, 170, 165, 173, 175, 177],
  high_risk_cases:    [38, 41, 43, 40, 44, 43, 42],
  in_review:          [11, 12, 13, 11, 13, 14, 14],
  escalated_cases:    [4, 5, 6, 5, 6, 7, 7],
};

// ── Card definitions with domain icons ───────────────────────
const CARDS = [
  {
    key:       "total_transactions",
    label:     "Total Transactions",
    icon:      BookOpen,
    color:     "#3B82F6",
    iconBg:    "rgba(59,130,246,0.10)",
    iconColor: "#2563EB",
    trend:     "+12.4%",
    up:        true,
    filterKey: "ALL",
    format:    (v) =>
      v >= 1_000_000 ? `${(v / 1_000_000).toFixed(2)}M`
      : v >= 1_000   ? `${(v / 1_000).toFixed(0)}K`
      : String(v),
  },
  {
    key:       "flagged_cases",
    label:     "Flagged Cases",
    icon:      FlagTriangleRight,
    color:     "#F97316",
    iconBg:    "rgba(249,115,22,0.10)",
    iconColor: "#EA580C",
    trend:     "+3 today",
    up:        true,
    filterKey: "FLAGGED",
    format:    (v) => v?.toLocaleString("en-IN"),
  },
  {
    key:       "high_risk_cases",
    label:     "High-Risk Cases",
    icon:      ShieldAlert,
    color:     "#F43F5E",
    iconBg:    "rgba(244,63,94,0.10)",
    iconColor: "#E11D48",
    trend:     "-2 vs yesterday",
    up:        false,
    filterKey: "HIGH",
    format:    (v) => v?.toLocaleString("en-IN"),
  },
  {
    key:       "in_review",
    label:     "In Review",
    icon:      Hourglass,
    color:     "#8B5CF6",
    iconBg:    "rgba(139,92,246,0.10)",
    iconColor: "#7C3AED",
    trend:     "+1 today",
    up:        true,
    filterKey: "UNDER_REVIEW",
    format:    (v) => v?.toLocaleString("en-IN"),
  },
  {
    key:       "escalated_cases",
    label:     "Escalated",
    icon:      ArrowUpCircle,
    color:     "#EC4899",
    iconBg:    "rgba(236,72,153,0.10)",
    iconColor: "#DB2777",
    trend:     "+1 today",
    up:        true,
    filterKey: "ESCALATED",
    format:    (v) => v?.toLocaleString("en-IN"),
  },
];

export default function StatsCards({ stats, onCardClick }) {
  if (!stats) return null;

  return (
    <div className="grid grid-cols-2 xl:grid-cols-5 gap-5">
      {CARDS.map((card, i) => {
        const Icon  = card.icon;
        const value = stats[card.key];
        const sparkData = SPARKLINES[card.key] || [];

        return (
          <motion.div
            key={card.key}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.4 }}
            className="glass-card p-6 relative overflow-hidden group cursor-pointer select-none"
            style={{ borderRadius: 16 }}
            onClick={() => onCardClick?.(card.filterKey)}
            title={`Filter by: ${card.label}`}
          >
            {/* Left accent bar */}
            <div
              className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full"
              style={{ background: card.color }}
            />

            <div className="relative pl-1">
              {/* Icon + trend */}
              <div className="flex items-start justify-between mb-3">
                {/* Icon chip — 12px radius, not full pill */}
                <div
                  className="w-10 h-10 flex items-center justify-center shrink-0"
                  style={{ background: card.iconBg, borderRadius: 12, border: `1px solid ${card.color}22` }}
                >
                  <Icon size={19} style={{ color: card.iconColor }} strokeWidth={2.2} />
                </div>

                {/* Trend */}
                <div
                  className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    card.up
                      ? "text-emerald-700 bg-emerald-50 border border-emerald-200/60"
                      : "text-red-600 bg-red-50 border border-red-200/60"
                  }`}
                >
                  {card.up ? <TrendingUp size={9} strokeWidth={2.5} /> : <TrendingDown size={9} strokeWidth={2.5} />}
                  {card.trend}
                </div>
              </div>

              {/* Primary number — large, heavy */}
              <p className="text-3xl font-black tracking-tight leading-none" style={{ color: "#0F172A" }}>
                {card.format(value)}
              </p>
              <p className="text-[11px] mt-2 font-semibold tracking-wide uppercase" style={{ color: "#94A3B8" }}>
                {card.label}
              </p>

              {/* Sparkline — bottom right, more breathing room */}
              <div className="mt-5 flex justify-end">
                <Sparkline points={sparkData} color={card.color} />
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
