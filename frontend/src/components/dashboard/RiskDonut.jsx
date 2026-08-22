import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";
import { motion } from "framer-motion";

const VIBRANT_RISK_COLORS = {
  HIGH: "#F43F5E",
  MEDIUM: "#F97316",
  LOW: "#10B981",
};

const RADIAN = Math.PI / 180;
const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  if (percent < 0.04) return null;
  const r = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="#FFFFFF" textAnchor="middle" dominantBaseline="central"
      style={{ fontSize: 11, fontWeight: 800, filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.4))" }}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: '#FFFFFF',
        border: '1px solid rgba(15,23,42,0.08)',
        borderRadius: 12,
        padding: '10px 14px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
        fontSize: 12,
      }}>
        <p style={{ fontWeight: 700, color: '#0F172A' }}>{payload[0].name}</p>
        <p style={{ color: '#64748B', marginTop: 2 }}>{payload[0].value} cases</p>
      </div>
    );
  }
  return null;
};

export default function RiskDonut({ stats }) {
  if (!stats) return null;

  const riskDist = stats.risk_distribution || [
    { name: "HIGH", value: stats.high_risk_cases || 0, color: "#F43F5E" },
    { name: "MEDIUM", value: 0, color: "#F97316" },
    { name: "LOW", value: stats.cleared_cases || 0, color: "#10B981" },
  ];
  const recentAct = stats.recent_activity || [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Donut Chart - Risk Distribution */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="glass-card p-6">
        <p className="text-sm font-bold mb-1" style={{ color: '#0F172A' }}>Risk Distribution</p>
        <p className="text-xs mb-4" style={{ color: '#94A3B8' }}>Flagged cases by severity</p>
        <div className="flex items-center justify-between gap-3">
          <div className="h-48 w-44 sm:w-48 shrink-0 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={riskDist}
                  cx="50%"
                  cy="50%"
                  innerRadius={38}
                  outerRadius={65}
                  paddingAngle={3}
                  labelLine={false}
                  label={renderCustomLabel}
                  dataKey="value"
                  stroke="#FFFFFF"
                  strokeWidth={2}
                >
                  {riskDist.map((entry, i) => {
                    const color = VIBRANT_RISK_COLORS[entry.name] || entry.color;
                    return <Cell key={i} fill={color} />;
                  })}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="space-y-3.5 flex-1 min-w-0 pr-1">
            {riskDist.map((item) => {
              const color = VIBRANT_RISK_COLORS[item.name] || item.color;
              return (
                <div key={item.name} className="flex items-center gap-2.5">
                  <span className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm" style={{ background: color }} />
                  <span className="text-xs font-semibold truncate" style={{ color: '#475569' }}>{item.name}</span>
                  <span className="text-xs font-black ml-auto pl-2" style={{ color: '#0F172A' }}>{item.value}</span>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* Area chart - Weekly Activity */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="glass-card p-6">
        <p className="text-sm font-bold mb-1" style={{ color: '#0F172A' }}>Weekly Activity</p>
        <p className="text-xs mb-4" style={{ color: '#94A3B8' }}>Flagged vs cleared over 7 days</p>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={recentAct} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gFlagged" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"  stopColor="#3B82F6" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.00} />
                </linearGradient>
                <linearGradient id="gCleared" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"  stopColor="#10B981" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#10B981" stopOpacity={0.00} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.05)" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "#94A3B8", fontSize: 11, fontWeight: 500 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#94A3B8", fontSize: 11, fontWeight: 500 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: "#64748B", paddingTop: 8 }} />
              <Area
                type="monotone"
                dataKey="flagged"
                name="Flagged"
                stroke="#3B82F6"
                strokeWidth={3}
                fill="url(#gFlagged)"
                dot={{ r: 3.5, fill: "#3B82F6", stroke: "#FFFFFF", strokeWidth: 2 }}
                activeDot={{ r: 6, fill: "#3B82F6", stroke: "#FFFFFF", strokeWidth: 2.5 }}
              />
              <Area
                type="monotone"
                dataKey="cleared"
                name="Cleared"
                stroke="#10B981"
                strokeWidth={3}
                fill="url(#gCleared)"
                dot={{ r: 3.5, fill: "#10B981", stroke: "#FFFFFF", strokeWidth: 2 }}
                activeDot={{ r: 6, fill: "#10B981", stroke: "#FFFFFF", strokeWidth: 2.5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
    </div>
  );
}
