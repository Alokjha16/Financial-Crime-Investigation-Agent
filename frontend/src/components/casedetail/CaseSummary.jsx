import { motion } from "framer-motion";
import { ArrowRight, Building2, HelpCircle } from "lucide-react";
import { fmtINR } from "../../utils/format";

const RISK_COLORS = {
  HIGH:   { color: "#EF4444", bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.18)"   },
  MEDIUM: { color: "#F97316", bg: "rgba(249,115,22,0.08)",  border: "rgba(249,115,22,0.18)"  },
  LOW:    { color: "#10B981", bg: "rgba(16,185,129,0.08)",  border: "rgba(16,185,129,0.18)"  },
};

// currency formatter moved to src/utils/format.js → fmtINR()

export default function CaseSummary({ caseData, onWhyScore }) {
  if (!caseData) return null;
  const { color, bg, border } = RISK_COLORS[caseData.risk_level] || RISK_COLORS.MEDIUM;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      className="glass-card p-6 relative overflow-hidden">
      {/* Left risk accent bar */}
      <div className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-2xl" style={{ background: color }} />

      <div className="relative z-10 pl-2">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <p className="section-label mb-1">Case Investigation</p>
            <h2 className="text-2xl font-black tracking-tight" style={{ color: '#0F172A' }}>{caseData.case_id}</h2>
            <p className="text-xs mt-1 font-mono font-medium" style={{ color: '#94A3B8' }}>{caseData.transaction_id}</p>
          </div>

          {/* Prominent Risk gauge + Why This Score button */}
          <div className="text-right flex flex-col items-end gap-2">
            <div className="text-6xl font-black leading-none tracking-tight" style={{ color }}>
              {caseData.risk_score}
            </div>
            <div className="text-xs font-semibold" style={{ color: '#94A3B8' }}>/ 100 Risk Score</div>
            <div
              className="text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider shadow-sm"
              style={{ background: bg, color: color, border: `1px solid ${border}` }}
            >
              {caseData.risk_level} RISK
            </div>
            {onWhyScore && (
              <button
                onClick={onWhyScore}
                className="flex items-center gap-1 text-xs font-semibold mt-1 transition-colors"
                style={{ color: '#3B82F6' }}
              >
                <HelpCircle size={13} /> Why this score?
              </button>
            )}
          </div>
        </div>

        {/* Distinct Tinted Sender -> Receiver flow panel */}
        <div
          className="flex items-center gap-4 p-5 rounded-xl mb-5 shadow-sm"
          style={{
            background: 'linear-gradient(135deg, #F8F5FF 0%, #F0F6FF 100%)',
            border: '1px solid rgba(139,92,246,0.15)',
          }}
        >
          <div className="flex-1">
            <p className="text-xs mb-1 font-semibold uppercase tracking-wider" style={{ color: '#8B5CF6' }}>Sender</p>
            <p className="text-lg font-bold font-mono tracking-tight" style={{ color: '#0F172A' }}>{caseData.from_account}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <Building2 size={12} style={{ color: '#94A3B8' }} />
              <p className="text-xs font-medium" style={{ color: '#64748B' }}>{caseData.from_bank}</p>
            </div>
          </div>

          <div className="flex flex-col items-center gap-1 px-4">
            <div className="text-xl font-black tracking-tight" style={{ color: '#0F172A' }}>
              {fmtINR(caseData.amount)}
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-14 h-0.5 rounded-full" style={{ background: `linear-gradient(90deg, transparent, ${color})` }} />
              <ArrowRight size={17} style={{ color }} strokeWidth={2.5} />
            </div>
            <p className="text-[10px] font-mono font-bold" style={{ color: '#94A3B8' }}>{caseData.currency}</p>
          </div>

          <div className="flex-1 text-right">
            <p className="text-xs mb-1 font-semibold uppercase tracking-wider" style={{ color: '#3B82F6' }}>Receiver</p>
            <p className="text-lg font-bold font-mono tracking-tight" style={{ color: '#0F172A' }}>{caseData.to_account}</p>
            <div className="flex items-center gap-1.5 mt-1 justify-end">
              <Building2 size={12} style={{ color: '#94A3B8' }} />
              <p className="text-xs font-medium" style={{ color: '#64748B' }}>{caseData.to_bank}</p>
            </div>
          </div>
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap gap-5 text-xs font-medium" style={{ color: '#64748B' }}>
          <span>
            <span style={{ color: '#94A3B8' }}>Typology: </span>
            <span className="font-bold" style={{ color: '#7C3AED' }}>{caseData.typology?.replace(/_/g," ") || "UNKNOWN"}</span>
          </span>
          <span>
            <span style={{ color: '#94A3B8' }}>ML Probability: </span>
            <span className="font-bold" style={{ color: '#0F172A' }}>
              {typeof caseData.fraud_probability === "number" ? `${(caseData.fraud_probability * 100).toFixed(0)}%` : `${caseData.risk_score || 0}%`}
            </span>
          </span>
          <span>
            <span style={{ color: '#94A3B8' }}>Flagged: </span>
            <span className="font-bold" style={{ color: '#0F172A' }}>
              {caseData.created_at || caseData.timestamp ? new Date(caseData.created_at || caseData.timestamp).toLocaleString("en-IN") : "Recent"}
            </span>
          </span>
          {caseData.decision && (
            <span>
              <span style={{ color: '#94A3B8' }}>Decision: </span>
              <span className="font-bold uppercase" style={{ color }}>{caseData.decision}</span>
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
