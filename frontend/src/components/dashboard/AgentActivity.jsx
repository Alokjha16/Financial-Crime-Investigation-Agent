import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, ChevronDown, ChevronUp } from "lucide-react";
import { relativeTime } from "../../utils/format";

const RISK_ACCENT = {
  HIGH:   "#EF4444",
  MEDIUM: "#F97316",
  LOW:    "#10B981",
};

const STATUS_COLOR = {
  done:     { color: "#10B981", bg: "rgba(16,185,129,0.09)"  },
  complete: { color: "#10B981", bg: "rgba(16,185,129,0.09)"  },
  waiting:  { color: "#F97316", bg: "rgba(249,115,22,0.09)"  },
  escalate: { color: "#EF4444", bg: "rgba(239,68,68,0.09)"   },
  running:  { color: "#7C3AED", bg: "rgba(124,58,237,0.09)"  },
};

// Extract tool-call name from action string
function extractToolCall(action) {
  const match = action?.match(/\b([a-z][a-z_]+(?:_[a-z]+)+)\b/);
  return match ? `${match[1]}()` : null;
}

// Group consecutive rows by case_id
function groupByCaseId(items) {
  const groups = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.case_id === item.case_id) {
      last.rows.push(item);
    } else {
      groups.push({ case_id: item.case_id, rows: [item] });
    }
  }
  return groups;
}

export default function AgentActivity({ activities }) {
  const navigate    = useNavigate();
  const [showAll, setShowAll] = useState(false);

  if (!activities || activities.length === 0) {
    return (
      <div className="glass-card p-8 flex flex-col items-center justify-center" style={{ minHeight: 160 }}>
        <p className="text-sm font-semibold mb-1" style={{ color: "#0F172A" }}>Agent Activity</p>
        <p className="text-xs" style={{ color: "#94A3B8" }}>No recent agent activity</p>
      </div>
    );
  }

  // Cap to 5 by default; show all when toggled
  const DEFAULT_VISIBLE = 5;
  const displayed = showAll ? activities : activities.slice(0, DEFAULT_VISIBLE);
  const hiddenCount = activities.length - DEFAULT_VISIBLE;
  const groups = groupByCaseId(displayed);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="glass-card overflow-hidden relative"
    >
      {/* Dot-grid texture — ties to investigation/network theme */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(59,130,246,0.055) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      />

      {/* Header */}
      <div
        className="relative px-6 py-5 flex items-center gap-3"
        style={{ borderBottom: "1px solid rgba(15,23,42,0.06)" }}
      >
        <div
          className="w-8 h-8 flex items-center justify-center shrink-0"
          style={{ background: "rgba(124,58,237,0.10)", borderRadius: 10 }}
        >
          <Bot size={15} style={{ color: "#7C3AED" }} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold leading-none" style={{ color: "#0F172A" }}>Agent Activity</p>
          <p className="text-[10px] mt-0.5" style={{ color: "#94A3B8" }}>
            Live investigation events · click any row to inspect
          </p>
        </div>

        {/* Animated ping "LIVE" */}
        <div className="flex items-center gap-2">
          <span className="relative flex w-2.5 h-2.5">
            <span
              className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping"
              style={{ background: "#10B981" }}
            />
            <span
              className="relative inline-flex rounded-full w-2.5 h-2.5"
              style={{ background: "#10B981" }}
            />
          </span>
          <span className="text-[10px] font-bold tracking-wide" style={{ color: "#10B981" }}>LIVE</span>
        </div>
      </div>

      {/* Scrollable feed — fixed height */}
      <div
        className="relative overflow-y-auto"
        style={{ maxHeight: showAll ? 520 : "auto" }}
      >
        {groups.map((group, gi) => {
          const accentColor = RISK_ACCENT[group.rows[0]?.risk_level] || "#94A3B8";

          return (
            <div key={group.case_id}>
              {/* Case-group separator — subtle label between cases */}
              {gi > 0 && (
                <div
                  className="flex items-center gap-3 px-6 py-2"
                  style={{ borderTop: "1px solid rgba(15,23,42,0.06)", background: "#FAFBFE" }}
                >
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: accentColor }} />
                  <span className="text-[10px] font-black font-mono tracking-wide" style={{ color: "#94A3B8" }}>
                    {group.case_id}
                  </span>
                  <div className="flex-1 h-px" style={{ background: "rgba(15,23,42,0.05)" }} />
                </div>
              )}

              {/* First group: show case ID header too if more than 1 group */}
              {gi === 0 && groups.length > 1 && (
                <div
                  className="flex items-center gap-3 px-6 py-2"
                  style={{ background: "#FAFBFE", borderBottom: "1px solid rgba(15,23,42,0.04)" }}
                >
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: accentColor }} />
                  <span className="text-[10px] font-black font-mono tracking-wide" style={{ color: "#94A3B8" }}>
                    {group.case_id}
                  </span>
                  <div className="flex-1 h-px" style={{ background: "rgba(15,23,42,0.05)" }} />
                </div>
              )}

              {/* Rows */}
              {group.rows.map((item, i) => {
                const statusCfg = STATUS_COLOR[item.status] || STATUS_COLOR.running;
                const toolCall  = extractToolCall(item.action);

                return (
                  <motion.button
                    key={item.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => navigate(`/case/${item.case_id}`)}
                    className="w-full relative flex items-center gap-0 text-left transition-colors"
                    style={{ borderBottom: "1px solid rgba(15,23,42,0.04)" }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "rgba(59,130,246,0.03)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                  >
                    {/* Risk-color left accent bar */}
                    <div
                      className="w-1 self-stretch shrink-0"
                      style={{ background: accentColor, minHeight: 52 }}
                    />

                    <div className="flex items-center gap-4 flex-1 min-w-0 px-5 py-4">
                      {/* Case badge */}
                      <span
                        className="text-[10px] font-black font-mono px-2 py-1 rounded-md shrink-0 leading-none"
                        style={{
                          background: "#F0F2F8",
                          color: "#334155",
                          border: "1px solid rgba(15,23,42,0.07)",
                          minWidth: 76,
                          textAlign: "center",
                        }}
                      >
                        {item.case_id}
                      </span>

                      {/* Tool call chip + action text */}
                      <div className="flex-1 min-w-0">
                        {toolCall ? (
                          <>
                            <span
                              className="text-[11px] font-mono font-semibold block truncate"
                              style={{ color: statusCfg.color }}
                            >
                              {toolCall}
                            </span>
                            <span
                              className="text-[10px] block truncate mt-0.5"
                              style={{ color: "#94A3B8" }}
                            >
                              {item.action}
                            </span>
                          </>
                        ) : (
                          <span className="text-xs font-medium block truncate" style={{ color: "#334155" }}>
                            {item.action}
                          </span>
                        )}
                      </div>

                      {/* Relative time */}
                      <span className="text-[10px] shrink-0 tabular-nums" style={{ color: "#CBD5E1" }}>
                        {relativeTime(item.timestamp)}
                      </span>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* View all / Collapse toggle */}
      {activities.length > DEFAULT_VISIBLE && (
        <button
          onClick={() => setShowAll((s) => !s)}
          className="relative w-full flex items-center justify-center gap-2 py-3.5 text-xs font-bold transition-colors"
          style={{
            borderTop: "1px solid rgba(15,23,42,0.07)",
            background: "#FAFBFE",
            color: showAll ? "#64748B" : "#2563EB",
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = "#F0F6FF"}
          onMouseLeave={(e) => e.currentTarget.style.background = "#FAFBFE"}
        >
          {showAll ? (
            <><ChevronUp size={13} /> Collapse activity</>
          ) : (
            <><ChevronDown size={13} /> View all {activities.length} events (+{hiddenCount} hidden)</>
          )}
        </button>
      )}
    </motion.div>
  );
}
