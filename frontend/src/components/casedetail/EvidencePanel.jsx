import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldAlert, ChevronDown, ChevronUp, Database, Eye, Target, TrendingUp } from "lucide-react";

const SEVERITY_CONFIG = {
  HIGH:   { color: "#EF4444", bg: "rgba(239,68,68,0.09)",   border: "rgba(239,68,68,0.22)"   },
  MEDIUM: { color: "#F97316", bg: "rgba(249,115,22,0.09)",  border: "rgba(249,115,22,0.22)"  },
  LOW:    { color: "#10B981", bg: "rgba(16,185,129,0.09)",  border: "rgba(16,185,129,0.20)"  },
};

// Fallback: plain string evidence items → convert to structured
function toStructured(evidence) {
  if (!evidence || evidence.length === 0) return [];
  if (typeof evidence[0] === "string") {
    return evidence.map((item, i) => ({
      source:   "Investigation Agent",
      observed: item,
      expected: "No anomaly expected",
      impact:   null,
      label:    item,
      severity: i === 0 ? "HIGH" : i < 3 ? "MEDIUM" : "LOW",
    }));
  }
  return evidence;
}

function EvidenceCard({ item, index }) {
  const [expanded, setExpanded] = useState(false);
  const sev = SEVERITY_CONFIG[item.severity] || SEVERITY_CONFIG.MEDIUM;

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.05 + index * 0.06 }}
      className="rounded-xl overflow-hidden"
      style={{ border: `1px solid ${sev.border}`, background: sev.bg }}
    >
      {/* Summary row */}
      <button
        className="w-full flex items-start gap-3 p-3.5 text-left"
        onClick={() => setExpanded((e) => !e)}
      >
        {/* Severity chip */}
        <div
          className="shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider"
          style={{ background: sev.color, color: "#fff" }}
        >
          {item.severity}
        </div>

        <p className="flex-1 text-sm leading-relaxed font-medium" style={{ color: "#334155" }}>
          {item.label || item.observed}
        </p>

        <div className="flex items-center gap-2 shrink-0">
          {item.impact !== null && item.impact !== undefined && (
            <span
              className="text-xs font-black"
              style={{ color: item.impact > 0 ? "#EF4444" : "#10B981" }}
            >
              {item.impact > 0 ? `+${item.impact}` : item.impact} pts
            </span>
          )}
          {expanded
            ? <ChevronUp size={14} style={{ color: "#94A3B8" }} />
            : <ChevronDown size={14} style={{ color: "#94A3B8" }} />
          }
        </div>
      </button>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div
              className="grid grid-cols-3 gap-3 px-3.5 py-3.5"
              style={{ borderTop: `1px solid ${sev.border}`, background: "rgba(255,255,255,0.8)" }}
            >
              {[
                { icon: Database,   label: "Data Source", value: item.source   },
                { icon: Eye,        label: "Observed",    value: item.observed  },
                { icon: Target,     label: "Expected",    value: item.expected  },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label}>
                  <p className="text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 mb-1"
                    style={{ color: "#94A3B8" }}>
                    <Icon size={8} /> {label}
                  </p>
                  <p className="text-xs font-semibold" style={{ color: "#334155" }}>{value || "—"}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function EvidencePanel({ evidence, structuredEvidence }) {
  // Prefer structured evidence (Phase 4 data); fallback to plain strings
  const items = structuredEvidence?.length ? structuredEvidence : toStructured(evidence);

  if (!items || items.length === 0) return null;

  const highCount   = items.filter((i) => i.severity === "HIGH").length;
  const medCount    = items.filter((i) => i.severity === "MEDIUM").length;
  const totalImpact = items.reduce((s, i) => s + (i.impact || 0), 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="glass-card overflow-hidden"
    >
      {/* Header */}
      <div className="px-6 py-4" style={{ borderBottom: "1px solid rgba(15,23,42,0.06)" }}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <ShieldAlert size={16} style={{ color: "#64748B" }} />
            <p className="text-sm font-semibold" style={{ color: "#0F172A" }}>Evidence Panel</p>
          </div>
          {totalImpact !== 0 && (
            <div className="flex items-center gap-1.5">
              <TrendingUp size={12} style={{ color: totalImpact > 0 ? "#EF4444" : "#10B981" }} />
              <span className="text-xs font-black" style={{ color: totalImpact > 0 ? "#EF4444" : "#10B981" }}>
                {totalImpact > 0 ? `+${totalImpact}` : totalImpact} net score impact
              </span>
            </div>
          )}
        </div>
        <p className="text-xs" style={{ color: "#94A3B8" }}>
          {items.length} evidence items · {highCount} HIGH · {medCount} MEDIUM
        </p>
      </div>

      {/* Items */}
      <div className="p-4 space-y-2.5">
        {/* Severity legend */}
        <div className="flex items-center gap-4 mb-3.5">
          {["HIGH", "MEDIUM", "LOW"].map((s) => {
            const cfg = SEVERITY_CONFIG[s];
            return (
              <div key={s} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-sm" style={{ background: cfg.color }} />
                <span className="text-[10px] font-semibold" style={{ color: "#64748B" }}>{s}</span>
              </div>
            );
          })}
          <span className="ml-auto text-[10px]" style={{ color: "#CBD5E1" }}>Click to expand details</span>
        </div>

        {items.map((item, i) => (
          <EvidenceCard key={i} item={item} index={i} />
        ))}
      </div>
    </motion.div>
  );
}
