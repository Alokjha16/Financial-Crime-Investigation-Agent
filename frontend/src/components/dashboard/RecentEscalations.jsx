import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { AlertOctagon, ArrowUpRight, TrendingUp } from "lucide-react";

const RISK_STYLE = {
  HIGH:   { color: "#EF4444", bg: "rgba(239,68,68,0.09)"   },
  MEDIUM: { color: "#F97316", bg: "rgba(249,115,22,0.09)"  },
  LOW:    { color: "#10B981", bg: "rgba(16,185,129,0.09)"  },
};

const TYPOLOGY_LABELS = {
  MONEY_MULE:       "Money Mule",
  ACCOUNT_TAKEOVER: "Acct. Takeover",
  STRUCTURING:      "Structuring",
  FALSE_POSITIVE:   "False Positive",
  LAYERING:         "Layering",
  SMURFING:         "Smurfing",
};

export default function RecentEscalations({ cases }) {
  const navigate = useNavigate();

  const escalated = (cases || [])
    .filter((c) => c.status === "ESCALATED" || c.risk_level === "HIGH")
    .sort((a, b) => b.risk_score - a.risk_score)
    .slice(0, 5);

  if (escalated.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.18 }}
      className="glass-card overflow-hidden"
    >
      {/* Header */}
      <div
        className="px-5 py-4 flex items-center gap-3"
        style={{ borderBottom: "1px solid rgba(15,23,42,0.06)" }}
      >
        <div
          className="w-8 h-8 flex items-center justify-center"
          style={{ background: "rgba(239,68,68,0.09)", borderRadius: 10 }}
        >
          <AlertOctagon size={15} style={{ color: "#EF4444" }} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold leading-none" style={{ color: "#0F172A" }}>Recent Escalations</p>
          <p className="text-[10px] mt-0.5" style={{ color: "#94A3B8" }}>
            {escalated.length} case{escalated.length !== 1 ? "s" : ""} requiring urgent attention
          </p>
        </div>
        <span
          className="text-[10px] font-black px-2 py-0.5 rounded-full"
          style={{ background: "rgba(239,68,68,0.10)", color: "#EF4444" }}
        >
          {escalated.length} URGENT
        </span>
      </div>

      {/* Table header */}
      <div
        className="grid grid-cols-12 px-5 py-2.5 text-[9px] font-black uppercase tracking-widest"
        style={{ background: "#F8FAFF", color: "#94A3B8", borderBottom: "1px solid rgba(15,23,42,0.05)" }}
      >
        <div className="col-span-3">Case ID</div>
        <div className="col-span-4">Typology</div>
        <div className="col-span-2 text-center">Risk</div>
        <div className="col-span-2 text-center">Score</div>
        <div className="col-span-1" />
      </div>

      {/* Rows */}
      <div>
        {escalated.map((c, i) => {
          const rs  = RISK_STYLE[c.risk_level] || RISK_STYLE.HIGH;
          const typ = TYPOLOGY_LABELS[c.typology] || c.typology?.replace(/_/g, " ");

          return (
            <motion.button
              key={c.case_id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 + i * 0.05 }}
              onClick={() => navigate(`/case/${c.case_id}`)}
              className="w-full grid grid-cols-12 items-center px-5 py-4 text-left transition-colors group"
              style={{ borderBottom: "1px solid rgba(15,23,42,0.04)" }}
              onMouseEnter={(e) => e.currentTarget.style.background = "#F8FAFF"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              {/* Case ID */}
              <div className="col-span-3">
                <span
                  className="text-[11px] font-black font-mono"
                  style={{ color: "#2563EB" }}
                >
                  {c.case_id}
                </span>
              </div>

              {/* Typology */}
              <div className="col-span-4">
                <span className="text-[11px] font-semibold" style={{ color: "#334155" }}>
                  {typ}
                </span>
              </div>

              {/* Risk badge */}
              <div className="col-span-2 flex justify-center">
                <span
                  className="text-[9px] font-black px-1.5 py-0.5 rounded"
                  style={{ background: rs.bg, color: rs.color }}
                >
                  {c.risk_level}
                </span>
              </div>

              {/* Risk score with mini bar */}
              <div className="col-span-2 flex flex-col items-center gap-0.5">
                <span className="text-xs font-black" style={{ color: rs.color }}>
                  {c.risk_score}
                </span>
                <div className="w-10 h-1 rounded-full overflow-hidden" style={{ background: "#E2E8F0" }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${c.risk_score}%`, background: rs.color }}
                  />
                </div>
              </div>

              {/* Arrow */}
              <div className="col-span-1 flex justify-end">
                <ArrowUpRight
                  size={13}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: "#3B82F6" }}
                />
              </div>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}
