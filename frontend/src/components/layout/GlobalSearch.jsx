import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ArrowRight, X, AlertTriangle, User, Zap } from "lucide-react";
import { useSearch } from "../../hooks/useSearch";
import { fmtINR } from "../../utils/format";

const RISK_COLORS = {
  HIGH:   { color: "#EF4444", bg: "rgba(239,68,68,0.10)"   },
  MEDIUM: { color: "#F97316", bg: "rgba(249,115,22,0.10)"  },
  LOW:    { color: "#10B981", bg: "rgba(16,185,129,0.10)"  },
};

export default function GlobalSearch({ onClose }) {
  const { query, setQuery, results } = useSearch();
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [active, setActive] = useState(0);

  // Focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleCaseClick = (caseId) => {
    navigate(`/case/${caseId}`);
    onClose();
  };

  const totalResults = results
    ? results.cases.length + results.accounts.length + results.transactions.length
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4"
      style={{ background: "rgba(15,23,42,0.45)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.18 }}
        className="w-full max-w-2xl rounded-2xl overflow-hidden"
        style={{ background: "#FFFFFF", boxShadow: "0 24px 64px rgba(0,0,0,0.18)", border: "1px solid rgba(15,23,42,0.09)" }}
      >
        {/* Input row */}
        <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: "1px solid rgba(15,23,42,0.07)" }}>
          <Search size={18} style={{ color: "#94A3B8", flexShrink: 0 }} />
          <input
            ref={inputRef}
            id="global-search-modal-input"
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(0); }}
            placeholder="Search cases, accounts, transactions…"
            className="flex-1 text-sm outline-none bg-transparent"
            style={{ color: "#0F172A" }}
          />
          {query && (
            <button onClick={() => setQuery("")} style={{ color: "#94A3B8" }}>
              <X size={16} />
            </button>
          )}
          <kbd className="text-[10px] px-2 py-0.5 rounded font-mono font-semibold" style={{ background: "#F5F6FA", color: "#94A3B8", border: "1px solid rgba(15,23,42,0.10)" }}>
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[420px] overflow-y-auto">
          {!query && (
            <div className="px-5 py-8 text-center">
              <Search size={28} className="mx-auto mb-3" style={{ color: "#CBD5E1" }} />
              <p className="text-sm font-medium" style={{ color: "#94A3B8" }}>Search cases, accounts, transactions…</p>
              <p className="text-xs mt-1" style={{ color: "#CBD5E1" }}>Try "CASE-001", "ACC4521", or "TXN-9823"</p>
            </div>
          )}

          {query && results && totalResults === 0 && (
            <div className="px-5 py-8 text-center">
              <p className="text-sm font-medium" style={{ color: "#94A3B8" }}>No results for "{query}"</p>
              <p className="text-xs mt-1" style={{ color: "#CBD5E1" }}>Try a case ID, account number, or transaction ID</p>
            </div>
          )}

          {results && results.cases.length > 0 && (
            <div className="px-5 pt-4 pb-2">
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#94A3B8" }}>
                Cases ({results.cases.length})
              </p>
              <div className="space-y-1">
                {results.cases.map((c) => {
                  const rc = RISK_COLORS[c.risk_level] || RISK_COLORS.LOW;
                  return (
                    <button
                      key={c.case_id}
                      onClick={() => handleCaseClick(c.case_id)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors"
                      onMouseEnter={(e) => e.currentTarget.style.background = "#F5F6FA"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: rc.bg }}>
                        <AlertTriangle size={14} style={{ color: rc.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold" style={{ color: "#0F172A" }}>{c.case_id}</p>
                        <p className="text-xs" style={{ color: "#94A3B8" }}>{c.typology?.replace("_", " ")} · {c.from_account} → {c.to_account}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: rc.bg, color: rc.color }}>{c.risk_level}</span>
                        <span className="text-xs font-bold" style={{ color: "#64748B" }}>{c.risk_score}/100</span>
                        <ArrowRight size={14} style={{ color: "#CBD5E1" }} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {results && results.accounts.length > 0 && (
            <div className="px-5 pt-3 pb-2">
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#94A3B8" }}>
                Accounts ({results.accounts.length})
              </p>
              <div className="space-y-1">
                {results.accounts.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => a.case_id && handleCaseClick(a.case_id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors"
                    onMouseEnter={(e) => e.currentTarget.style.background = "#F5F6FA"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(59,130,246,0.10)" }}>
                      <User size={14} style={{ color: "#3B82F6" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold" style={{ color: "#0F172A" }}>{a.id}</p>
                      <p className="text-xs" style={{ color: "#94A3B8" }}>{a.role} · {a.bank}</p>
                    </div>
                    {a.case_id && (
                      <span className="text-xs font-mono px-2 py-0.5 rounded-lg" style={{ background: "#F5F6FA", color: "#64748B" }}>
                        {a.case_id} <ArrowRight size={10} className="inline" />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {results && results.transactions.length > 0 && (
            <div className="px-5 pt-3 pb-4">
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#94A3B8" }}>
                Transactions ({results.transactions.length})
              </p>
              <div className="space-y-1">
                {results.transactions.map((t) => {
                  const rc = RISK_COLORS[t.risk_level] || RISK_COLORS.LOW;
                  return (
                    <button
                      key={t.txn_id}
                      onClick={() => t.case_id && handleCaseClick(t.case_id)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors"
                      onMouseEnter={(e) => e.currentTarget.style.background = "#F5F6FA"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: rc.bg }}>
                        <Zap size={14} style={{ color: rc.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold" style={{ color: "#0F172A" }}>{t.txn_id}</p>
                        <p className="text-xs" style={{ color: "#94A3B8" }}>{fmtINR(t.amount)} · {t.typology?.replace("_", " ")}</p>
                      </div>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0" style={{ background: rc.bg, color: rc.color }}>
                        {t.risk_level}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-5 py-3 flex items-center gap-4" style={{ borderTop: "1px solid rgba(15,23,42,0.06)", background: "#F8FAFF" }}>
          <span className="text-[11px]" style={{ color: "#CBD5E1" }}>↑↓ navigate · Enter to open · Esc to close</span>
          {totalResults > 0 && (
            <span className="ml-auto text-[11px] font-semibold" style={{ color: "#94A3B8" }}>{totalResults} result{totalResults !== 1 ? "s" : ""}</span>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
