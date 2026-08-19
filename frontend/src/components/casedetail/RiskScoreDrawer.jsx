import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, TrendingUp, Bot, Zap, HelpCircle, AlertTriangle } from "lucide-react";

const SEVERITY_CONFIG = {
  HIGH:   { color: "#EF4444", bg: "rgba(239,68,68,0.10)",  border: "rgba(239,68,68,0.25)"  },
  MEDIUM: { color: "#F97316", bg: "rgba(249,115,22,0.10)", border: "rgba(249,115,22,0.25)" },
  LOW:    { color: "#10B981", bg: "rgba(16,185,129,0.10)", border: "rgba(16,185,129,0.18)" },
};

// Mini horizontal bar for a factor
function ImpactBar({ points, maxPoints }) {
  const abs   = Math.abs(points);
  const width = Math.round((abs / maxPoints) * 100);
  const isRisk = points > 0;
  return (
    <div className="flex items-center gap-2 flex-1">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "#F1F5F9" }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${width}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ background: isRisk ? "#EF4444" : "#10B981" }}
        />
      </div>
      <span
        className="text-[10px] font-black w-10 text-right"
        style={{ color: isRisk ? "#EF4444" : "#10B981" }}
      >
        {isRisk ? `+${points}` : points}
      </span>
    </div>
  );
}

// Donut arc score
function ScoreArc({ score }) {
  const r         = 52;
  const circ      = 2 * Math.PI * r;
  const fill      = (score / 100) * circ;
  const color     = score >= 75 ? "#EF4444" : score >= 50 ? "#F97316" : "#10B981";
  const trackColor = "#E2E8F0";

  return (
    <div className="relative w-32 h-32 mx-auto">
      <svg width="128" height="128" viewBox="0 0 128 128" style={{ transform: "rotate(-90deg)" }}>
        {/* Track */}
        <circle cx="64" cy="64" r={r} fill="none" stroke={trackColor} strokeWidth="10" />
        {/* Arc */}
        <motion.circle
          cx="64" cy="64" r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - fill }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />
      </svg>
      {/* Score text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className="text-3xl font-black leading-none"
          style={{ color }}
        >
          {score}
        </motion.span>
        <span className="text-[10px] font-semibold mt-0.5" style={{ color: "#94A3B8" }}>/ 100</span>
      </div>
    </div>
  );
}

export default function RiskScoreDrawer({ riskData, caseData, isOpen, onClose }) {
  // ESC to close
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!riskData) return null;

  const factors      = riskData.factors || [];
  const maxPoints    = Math.max(...factors.map((f) => Math.abs(f.points)), 1);
  const totalRisk    = factors.filter((f) => f.points > 0).reduce((s, f) => s + f.points, 0);
  const totalMitig   = factors.filter((f) => f.points < 0).reduce((s, f) => s + f.points, 0);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40"
            style={{ background: "rgba(15,23,42,0.35)", backdropFilter: "blur(2px)" }}
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            className="fixed right-0 top-0 h-full z-50 overflow-y-auto"
            style={{
              width: 440,
              background: "#FFFFFF",
              boxShadow: "-8px 0 40px rgba(0,0,0,0.12)",
              borderLeft: "1px solid rgba(15,23,42,0.08)",
            }}
          >
            {/* Header */}
            <div
              className="sticky top-0 px-6 py-5 flex items-center justify-between z-10"
              style={{ background: "#FFFFFF", borderBottom: "1px solid rgba(15,23,42,0.07)" }}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(59,130,246,0.10)" }}>
                  <HelpCircle size={17} style={{ color: "#3B82F6" }} />
                </div>
                <div>
                  <p className="text-sm font-bold leading-none" style={{ color: "#0F172A" }}>Why This Score?</p>
                  <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>AI risk scoring explanation</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-xl transition-colors"
                style={{ background: "#F5F6FA" }}
              >
                <X size={16} style={{ color: "#64748B" }} />
              </button>
            </div>

            <div className="px-6 py-6 space-y-6">
              {/* Score Arc */}
              <div className="text-center">
                <ScoreArc score={riskData.risk_score} />
                <p className="font-black text-lg mt-3" style={{ color: "#0F172A" }}>{caseData?.typology?.replace(/_/g, " ")}</p>
                <p className="text-xs mt-1" style={{ color: "#94A3B8" }}>{caseData?.case_id} · {caseData?.transaction_id}</p>
              </div>

              {/* Model confidence row */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: Bot,  label: "ML Fraud Probability", value: `${(riskData.ml_probability * 100).toFixed(0)}%`,   color: "#7C3AED" },
                  { icon: Zap,  label: "Agent Confidence",      value: `${(riskData.agent_confidence * 100).toFixed(0)}%`, color: "#3B82F6" },
                ].map(({ icon: Icon, label, value, color }) => (
                  <div key={label} className="p-4 rounded-xl text-center"
                    style={{ background: "#F8FAFF", border: "1px solid rgba(15,23,42,0.06)" }}>
                    <Icon size={16} className="mx-auto mb-2" style={{ color }} />
                    <p className="text-lg font-black" style={{ color }}>{value}</p>
                    <p className="text-[10px] mt-1" style={{ color: "#94A3B8" }}>{label}</p>
                  </div>
                ))}
              </div>

              {/* Score breakdown summary */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Risk Contribution",  value: `+${totalRisk}`,  color: "#EF4444" },
                  { label: "Mitigating Factors", value: totalMitig,        color: "#10B981" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="p-3 rounded-xl text-center"
                    style={{ background: "#F8FAFF", border: "1px solid rgba(15,23,42,0.06)" }}>
                    <p className="text-base font-black" style={{ color }}>{value}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: "#94A3B8" }}>{label}</p>
                  </div>
                ))}
              </div>

              {/* Factor bars */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "#94A3B8" }}>
                  Contributing Factors — Impact on Score
                </p>
                <div className="space-y-3">
                  {factors.map((factor, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + i * 0.07 }}
                      className="space-y-1.5"
                    >
                      <div className="flex items-start gap-2">
                        <AlertTriangle
                          size={11}
                          className="mt-0.5 shrink-0"
                          style={{ color: factor.points > 0 ? "#EF4444" : "#10B981" }}
                        />
                        <p className="text-xs leading-relaxed flex-1" style={{ color: "#334155" }}>{factor.label}</p>
                      </div>
                      <ImpactBar points={factor.points} maxPoints={maxPoints} />
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Footer caveat */}
              <div className="p-4 rounded-xl" style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.15)" }}>
                <p className="text-[11px] leading-relaxed" style={{ color: "#64748B" }}>
                  <strong style={{ color: "#2563EB" }}>About this score:</strong> The risk score is computed by the ML model (fraud probability) and refined by the AI investigation agent (evidence correlation). Each factor above shows its contribution to the final score. Negative values indicate mitigating evidence that reduced the score.
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
