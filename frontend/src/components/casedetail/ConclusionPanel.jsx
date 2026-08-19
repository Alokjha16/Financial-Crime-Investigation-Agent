import { motion } from "framer-motion";

const RISK_CONFIG = {
  HIGH:   { label: "HIGH RISK",   color: "#EF4444", bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.18)"   },
  MEDIUM: { label: "MEDIUM RISK", color: "#F59E0B", bg: "rgba(245,158,11,0.08)",  border: "rgba(245,158,11,0.18)"  },
  LOW:    { label: "LOW RISK",    color: "#10B981", bg: "rgba(16,185,129,0.08)",  border: "rgba(16,185,129,0.18)"  },
};

const TYPO_LABELS = {
  MONEY_MULE:       "Money Mule",
  ACCOUNT_TAKEOVER: "Account Takeover",
  FALSE_POSITIVE:   "False Positive",
  STRUCTURING:      "Structuring",
};

export default function ConclusionPanel({ caseData }) {
  if (!caseData) return null;
  const cfg = RISK_CONFIG[caseData.risk_level] || RISK_CONFIG.MEDIUM;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
      className="glass-card p-6">

      <div>
        <p className="text-sm font-semibold mb-4" style={{ color: '#0F172A' }}>Investigation Conclusion</p>

        <div className="grid grid-cols-3 gap-4">
          {/* Risk Level */}
          <div className="text-center p-4 rounded-xl"
            style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
            <p className="text-[10px] uppercase tracking-widest mb-2 font-semibold" style={{ color: '#94A3B8' }}>Risk Level</p>
            <motion.p
              animate={{ scale: [1, 1.04, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="text-xl font-black" style={{ color: cfg.color }}>
              {cfg.label}
            </motion.p>
          </div>

          {/* Typology */}
          <div className="text-center p-4 rounded-xl"
            style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.18)" }}>
            <p className="text-[10px] uppercase tracking-widest mb-2 font-semibold" style={{ color: '#94A3B8' }}>Typology</p>
            <p className="text-xl font-black" style={{ color: '#7C3AED' }}>
              {TYPO_LABELS[caseData.typology] || caseData.typology}
            </p>
          </div>

          {/* Score */}
          <div className="text-center p-4 rounded-xl"
            style={{ background: "rgba(14,165,233,0.07)", border: "1px solid rgba(14,165,233,0.18)" }}>
            <p className="text-[10px] uppercase tracking-widest mb-2 font-semibold" style={{ color: '#94A3B8' }}>Risk Score</p>
            <p className="text-4xl font-black" style={{ color: '#0EA5E9' }}>
              {caseData.risk_score}<span className="text-lg" style={{ color: '#94A3B8' }}>/100</span>
            </p>
          </div>
        </div>

        {/* Recommendation */}
        <div className="mt-4 p-3 rounded-xl flex items-center gap-3"
          style={{ background: '#F8FAFF', border: '1px solid rgba(15,23,42,0.07)' }}>
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#94A3B8' }}>AI Recommendation:</span>
          <span className="text-sm font-bold" style={{ color: cfg.color }}>
            {caseData.recommendation}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
