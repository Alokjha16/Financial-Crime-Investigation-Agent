import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Zap, AlertTriangle, Loader2, ArrowRight,
  Hash, Building, CreditCard,
} from "lucide-react";
import { api } from "../../services/api";
import { fmtINR } from "../../utils/format";

const EXAMPLE_TXN_IDS = [
  { id: "TXN-DEMO-001", label: "High Risk — ₹4.8L transfer",  risk: "HIGH"   },
  { id: "TXN-DEMO-002", label: "Medium Risk — Structuring",    risk: "MEDIUM" },
  { id: "TXN-DEMO-003", label: "Low Risk — B2B payment",       risk: "LOW"    },
];

const RISK_COLORS = {
  HIGH:   { color: "#EF4444", bg: "rgba(239,68,68,0.10)"  },
  MEDIUM: { color: "#F97316", bg: "rgba(249,115,22,0.10)" },
  LOW:    { color: "#10B981", bg: "rgba(16,185,129,0.10)" },
};

export default function NewInvestigationModal({ onClose }) {
  const navigate = useNavigate();

  const [txnId,    setTxnId]    = useState("");
  const [fromAcc,  setFromAcc]  = useState("");
  const [toAcc,    setToAcc]    = useState("");
  const [amount,   setAmount]   = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!txnId.trim()) { setError("Transaction ID is required"); return; }
    setError("");
    setLoading(true);
    try {
      const result = await api.startInvestigation(txnId.trim());
      onClose();
      navigate(`/live/${result.case_id}?txn=${txnId}`);
    } catch {
      setError("Failed to start investigation. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickStart = async (exampleTxnId) => {
    setLoading(true);
    try {
      const result = await api.startInvestigation(exampleTxnId);
      onClose();
      navigate(`/live/${result.case_id}?txn=${exampleTxnId}`);
    } catch {
      setError("Failed to start investigation.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(15,23,42,0.50)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-lg rounded-2xl overflow-hidden"
        style={{
          background: "#FFFFFF",
          boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
          border: "1px solid rgba(15,23,42,0.09)",
        }}
      >
        {/* Header */}
        <div
          className="px-6 py-5 flex items-center justify-between"
          style={{ borderBottom: "1px solid rgba(15,23,42,0.07)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #3B82F6, #7C3AED)" }}
            >
              <Zap size={18} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: "#0F172A" }}>New Investigation</p>
              <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>Start an autonomous AI investigation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl"
            style={{ background: "#F5F6FA" }}
          >
            <X size={16} style={{ color: "#64748B" }} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Quick start scenarios */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "#94A3B8" }}>
              Quick Start — Demo Scenarios
            </p>
            <div className="space-y-2">
              {EXAMPLE_TXN_IDS.map((ex) => {
                const rc = RISK_COLORS[ex.risk];
                return (
                  <button
                    key={ex.id}
                    onClick={() => handleQuickStart(ex.id)}
                    disabled={loading}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors group"
                    style={{ border: "1px solid rgba(15,23,42,0.08)", background: "#FAFBFE" }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "#F0F6FF"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "#FAFBFE"}
                  >
                    <span
                      className="text-[10px] font-black px-2 py-0.5 rounded-full shrink-0"
                      style={{ background: rc.bg, color: rc.color }}
                    >
                      {ex.risk}
                    </span>
                    <div className="flex-1">
                      <p className="text-xs font-bold" style={{ color: "#0F172A" }}>{ex.id}</p>
                      <p className="text-[10px]" style={{ color: "#94A3B8" }}>{ex.label}</p>
                    </div>
                    <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "#3B82F6" }} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: "rgba(15,23,42,0.08)" }} />
            <span className="text-[10px] font-semibold" style={{ color: "#94A3B8" }}>or enter manually</span>
            <div className="flex-1 h-px" style={{ background: "rgba(15,23,42,0.08)" }} />
          </div>

          {/* Manual form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Transaction ID */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider block mb-1.5" style={{ color: "#94A3B8" }}>
                Transaction ID *
              </label>
              <div className="relative">
                <Hash size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#94A3B8" }} />
                <input
                  id="new-investigation-txn-id"
                  type="text"
                  value={txnId}
                  onChange={(e) => setTxnId(e.target.value)}
                  placeholder="e.g. TXN-9823"
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none"
                  style={{
                    background: "#F5F6FA",
                    border: error ? "1px solid rgba(239,68,68,0.50)" : "1px solid rgba(15,23,42,0.08)",
                    color: "#334155",
                  }}
                />
              </div>
              {error && <p className="text-xs mt-1" style={{ color: "#EF4444" }}>{error}</p>}
            </div>

            {/* Optional fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider block mb-1.5" style={{ color: "#94A3B8" }}>
                  From Account
                </label>
                <div className="relative">
                  <CreditCard size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#94A3B8" }} />
                  <input
                    type="text"
                    value={fromAcc}
                    onChange={(e) => setFromAcc(e.target.value)}
                    placeholder="ACC-XXXX"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm outline-none"
                    style={{ background: "#F5F6FA", border: "1px solid rgba(15,23,42,0.08)", color: "#334155" }}
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider block mb-1.5" style={{ color: "#94A3B8" }}>
                  Amount (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold" style={{ color: "#94A3B8" }}>₹</span>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="480000"
                    className="w-full pl-7 pr-3 py-2.5 rounded-xl text-sm outline-none"
                    style={{ background: "#F5F6FA", border: "1px solid rgba(15,23,42,0.08)", color: "#334155" }}
                  />
                </div>
              </div>
            </div>

            {/* Disclaimer */}
            <div className="flex items-start gap-2 p-3 rounded-xl"
              style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.15)" }}>
              <AlertTriangle size={13} className="shrink-0 mt-0.5" style={{ color: "#3B82F6" }} />
              <p className="text-[11px] leading-relaxed" style={{ color: "#64748B" }}>
                The AI agent will autonomously run 6–9 investigation steps, collecting transaction history,
                KYC data, complaints, and network analysis before presenting a recommendation.
              </p>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary flex items-center justify-center gap-2 py-3"
            >
              {loading
                ? <><Loader2 size={15} className="animate-spin" /> Starting investigation…</>
                : <><Zap size={15} /> Launch AI Investigation</>
              }
            </button>
          </form>
        </div>
      </motion.div>
    </motion.div>
  );
}
