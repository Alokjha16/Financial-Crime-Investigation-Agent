import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { fmtINR, fmtDate } from "../../utils/format";

const RISK_STYLE = {
  HIGH:   { color: "#EF4444", bg: "rgba(239,68,68,0.09)"   },
  MEDIUM: { color: "#F97316", bg: "rgba(249,115,22,0.09)"  },
  LOW:    { color: "#10B981", bg: "rgba(16,185,129,0.09)"  },
};

export default function TransactionHistory({ txHistory, currentTxnId }) {
  const [expanded, setExpanded] = useState(null);

  if (!txHistory || txHistory.length === 0) {
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="glass-card p-6 flex items-center justify-center h-32">
        <p className="text-sm" style={{ color: "#94A3B8" }}>No transaction history found</p>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
      className="glass-card overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4" style={{ borderBottom: "1px solid rgba(15,23,42,0.06)" }}>
        <p className="text-sm font-semibold leading-none" style={{ color: "#0F172A" }}>Transaction History</p>
        <p className="text-xs mt-1" style={{ color: "#94A3B8" }}>
          {txHistory.length} recent transactions — current highlighted
        </p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(15,23,42,0.06)", background: "#F8FAFF" }}>
              {["Date", "TXN ID", "From → To", "Amount", "Channel", "Risk"].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-bold uppercase tracking-wider" style={{ color: "#94A3B8", fontSize: "10px" }}>
                  {h}
                </th>
              ))}
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {txHistory.map((tx, i) => {
              const rs = RISK_STYLE[tx.risk] || RISK_STYLE.LOW;
              const isCurrent = tx.txn_id === currentTxnId;
              const isExpanded = expanded === i;

              return (
                <>
                  <tr
                    key={tx.txn_id}
                    className="cursor-pointer transition-colors"
                    style={{
                      background: isCurrent
                        ? "rgba(59,130,246,0.05)"
                        : isExpanded ? "#F8FAFF" : "transparent",
                      borderBottom: "1px solid rgba(15,23,42,0.05)",
                      borderLeft: isCurrent ? "3px solid #3B82F6" : "3px solid transparent",
                    }}
                    onClick={() => setExpanded(isExpanded ? null : i)}
                    onMouseEnter={(e) => { if (!isCurrent) e.currentTarget.style.background = "#F8FAFF"; }}
                    onMouseLeave={(e) => { if (!isCurrent) e.currentTarget.style.background = isExpanded ? "#F8FAFF" : "transparent"; }}
                  >
                    <td className="px-4 py-3 font-medium" style={{ color: "#64748B" }}>
                      {fmtDate(tx.date)}
                      {isCurrent && (
                        <span className="ml-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                          style={{ background: "rgba(59,130,246,0.12)", color: "#2563EB" }}>
                          CURRENT
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold" style={{ color: isCurrent ? "#2563EB" : "#334155" }}>
                      {tx.txn_id}
                    </td>
                    <td className="px-4 py-3" style={{ color: "#334155" }}>
                      <span className="font-mono">{tx.from}</span>
                      <span className="mx-1.5" style={{ color: "#94A3B8" }}>→</span>
                      <span className="font-mono">{tx.to}</span>
                    </td>
                    <td className="px-4 py-3 font-black" style={{ color: "#0F172A" }}>
                      {fmtINR(tx.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded-lg font-semibold"
                        style={{ background: "#F0F2F8", color: "#64748B", fontSize: "10px" }}>
                        {tx.channel}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded-full font-bold"
                        style={{ background: rs.bg, color: rs.color, fontSize: "10px" }}>
                        {tx.risk}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {isExpanded
                        ? <ChevronUp size={14} style={{ color: "#94A3B8" }} />
                        : <ChevronDown size={14} style={{ color: "#94A3B8" }} />}
                    </td>
                  </tr>

                  {/* Expanded detail row */}
                  <AnimatePresence>
                    {isExpanded && (
                      <tr key={`${tx.txn_id}-detail`}>
                        <td colSpan={7} style={{ padding: 0 }}>
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.18 }}
                            className="overflow-hidden"
                          >
                            <div className="px-6 py-4 flex flex-wrap gap-6"
                              style={{ background: "#F8FAFF", borderBottom: "1px solid rgba(15,23,42,0.06)" }}>
                              {[
                                { label: "Transaction ID", value: tx.txn_id },
                                { label: "From Account",   value: tx.from  },
                                { label: "To Account",     value: tx.to    },
                                { label: "Amount",         value: fmtINR(tx.amount) },
                                { label: "Channel",        value: tx.channel },
                                { label: "Risk Level",     value: tx.risk  },
                                { label: "Date",           value: fmtDate(tx.date) },
                              ].map(({ label, value }) => (
                                <div key={label}>
                                  <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: "#94A3B8" }}>{label}</p>
                                  <p className="text-xs font-semibold" style={{ color: "#334155" }}>{value}</p>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        </td>
                      </tr>
                    )}
                  </AnimatePresence>
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
