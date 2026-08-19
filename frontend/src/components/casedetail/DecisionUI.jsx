import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, XCircle, AlertOctagon, RotateCcw,
  Loader2, X, ShieldAlert,
} from "lucide-react";
import { api } from "../../services/api";
import { fmtINR } from "../../utils/format";
import { toast } from "../ui/Toast";

const DECISIONS = [
  { key: "ESCALATE",      label: "Escalate",       icon: AlertOctagon, cls: "btn-danger",   desc: "Refer to Financial Intelligence Unit" },
  { key: "CLEAR",         label: "Clear",           icon: CheckCircle2, cls: "btn-success",  desc: "Mark as legitimate — no further action" },
  { key: "FALSE_POSITIVE",label: "False Positive",  icon: XCircle,      cls: "btn-ghost",    desc: "Flag as incorrectly flagged by ML model" },
  { key: "REVIEW",        label: "Review Later",    icon: RotateCcw,    cls: "btn-warning",  desc: "Keep open for additional investigation" },
];

const RISK_STYLE = {
  HIGH:   { color: "#EF4444", bg: "rgba(239,68,68,0.08)"   },
  MEDIUM: { color: "#F97316", bg: "rgba(249,115,22,0.08)"  },
  LOW:    { color: "#10B981", bg: "rgba(16,185,129,0.08)"  },
};

// ── Confirmation Modal ──────────────────────────────────────
function ConfirmModal({ decision, caseData, note, onConfirm, onCancel, loading }) {
  const [checked, setChecked] = useState(false);
  const d = DECISIONS.find((d) => d.key === decision);
  const rs = RISK_STYLE[caseData.risk_level] || RISK_STYLE.MEDIUM;
  const Icon = d?.icon || AlertOctagon;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center px-4"
      style={{ background: "rgba(15,23,42,0.50)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: "#FFFFFF", boxShadow: "0 24px 64px rgba(0,0,0,0.18)", border: "1px solid rgba(15,23,42,0.09)" }}
      >
        {/* Header */}
        <div className="px-6 py-5 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(15,23,42,0.07)" }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(239,68,68,0.10)" }}>
              <ShieldAlert size={17} style={{ color: "#EF4444" }} />
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: "#0F172A" }}>Confirm Decision</p>
              <p className="text-xs" style={{ color: "#94A3B8" }}>This will be recorded in the immutable audit trail</p>
            </div>
          </div>
          <button onClick={onCancel} style={{ color: "#94A3B8" }}><X size={16} /></button>
        </div>

        <div className="p-6 space-y-4">
          {/* Case summary */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Case ID",    value: caseData.case_id },
              { label: "Risk Score", value: `${caseData.risk_score}/100`, style: { color: rs.color } },
              { label: "Typology",   value: caseData.typology?.replace("_", " ") },
            ].map(({ label, value, style }) => (
              <div key={label} className="p-3 rounded-xl text-center" style={{ background: "#F8FAFF", border: "1px solid rgba(15,23,42,0.06)" }}>
                <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "#94A3B8" }}>{label}</p>
                <p className="text-xs font-bold" style={{ color: "#0F172A", ...style }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Decision badge */}
          <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: "#F8FAFF", border: "1px solid rgba(15,23,42,0.07)" }}>
            <Icon size={18} style={{ color: "#EF4444" }} />
            <div>
              <p className="text-xs" style={{ color: "#94A3B8" }}>Selected decision</p>
              <p className="text-sm font-black" style={{ color: "#0F172A" }}>{d?.label}</p>
            </div>
            {note && (
              <div className="ml-auto max-w-[180px]">
                <p className="text-xs" style={{ color: "#94A3B8" }}>Analyst note</p>
                <p className="text-xs font-medium truncate" style={{ color: "#334155" }}>{note}</p>
              </div>
            )}
          </div>

          {/* AI Recommendation */}
          <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.15)" }}>
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#94A3B8" }}>AI Recommendation:</span>
            <span className="text-xs font-bold" style={{ color: rs.color }}>{caseData.recommendation}</span>
          </div>

          {/* Confirmation checkbox */}
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded accent-blue-600"
            />
            <span className="text-xs leading-relaxed" style={{ color: "#334155" }}>
              I confirm that I have reviewed all evidence and the investigation report before submitting this decision.
            </span>
          </label>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex gap-3" style={{ borderTop: "1px solid rgba(15,23,42,0.07)", background: "#F8FAFF" }}>
          <button
            onClick={onCancel}
            className="flex-1 btn-ghost py-2.5 text-sm font-semibold"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!checked || loading}
            className="flex-1 btn-danger py-2.5 text-sm font-bold flex items-center justify-center gap-2"
            style={{ opacity: !checked ? 0.5 : 1 }}
          >
            {loading
              ? <><Loader2 size={15} className="animate-spin" /> Submitting…</>
              : <><Icon size={15} /> Confirm {d?.label}</>}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Main DecisionUI ─────────────────────────────────────────
export default function DecisionUI({ caseData, onDecisionMade }) {
  const [loading, setLoading]   = useState(false);
  const [pending, setPending]   = useState(null);  // decision key waiting for confirm
  const [note, setNote]         = useState("");
  const [done, setDone]         = useState(!!caseData?.decision);
  const [decided, setDecided]   = useState(caseData?.decision);

  const handleSelect = (key) => {
    if (loading || done) return;
    setPending(key);
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await api.submitDecision(caseData.case_id, pending, note);
      setDecided(pending);
      setDone(true);
      onDecisionMade?.(pending);
      toast(
        `Decision recorded: ${DECISIONS.find((d) => d.key === pending)?.label} — audit trail updated`,
        "success"
      );
    } catch {
      toast("Failed to submit decision. Please try again.", "error");
    } finally {
      setLoading(false);
      setPending(null);
    }
  };

  const existing = decided || caseData?.decision;

  return (
    <>
      {/* Confirmation modal */}
      <AnimatePresence>
        {pending && (
          <ConfirmModal
            decision={pending}
            caseData={caseData}
            note={note}
            onConfirm={handleConfirm}
            onCancel={() => setPending(null)}
            loading={loading}
          />
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass-card p-6"
      >
        <p className="text-sm font-semibold mb-1" style={{ color: "#0F172A" }}>Analyst Decision</p>
        <p className="text-xs mb-5" style={{ color: "#94A3B8" }}>
          Select your action — this will be recorded in the audit trail
        </p>

        {(done || existing) ? (
          <div className="text-center py-6">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3"
              style={{ background: "rgba(16,185,129,0.10)", border: "1px solid rgba(16,185,129,0.25)" }}>
              <CheckCircle2 size={28} style={{ color: "#10B981" }} />
            </div>
            <p className="font-bold text-lg" style={{ color: "#059669" }}>{existing}</p>
            <p className="text-xs mt-1" style={{ color: "#94A3B8" }}>Decision recorded in audit trail</p>
            {caseData?.decided_by && (
              <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>by {caseData.decided_by}</p>
            )}
          </div>
        ) : (
          <>
            <textarea
              rows={2}
              placeholder="Optional analyst note…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-xl p-3 text-sm outline-none resize-none mb-4"
              style={{ background: "#F0F2F8", border: "1px solid rgba(15,23,42,0.08)", color: "#334155" }}
            />
            <div className="grid grid-cols-2 gap-3">
              {DECISIONS.map(({ key, label, icon: Icon, cls, desc }) => (
                <motion.button
                  key={key}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSelect(key)}
                  className={`${cls} flex flex-col items-start gap-1 p-4 rounded-xl text-left`}
                >
                  <div className="flex items-center gap-2">
                    <Icon size={16} />
                    <span className="font-bold text-sm">{label}</span>
                  </div>
                  <p className="text-[10px] opacity-70 leading-relaxed">{desc}</p>
                </motion.button>
              ))}
            </div>
          </>
        )}
      </motion.div>
    </>
  );
}
