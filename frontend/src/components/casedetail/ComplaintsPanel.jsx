import { motion } from "framer-motion";
import { MessageSquareWarning, CheckCircle2, Clock, AlertOctagon } from "lucide-react";
import { fmtDate } from "../../utils/format";

const TYPE_CONFIG = {
  UNAUTHORIZED_TRANSFER: { label: "Unauthorized Transfer", color: "#EF4444", bg: "rgba(239,68,68,0.09)"  },
  SUSPICIOUS_RECIPIENT:  { label: "Suspicious Recipient",  color: "#F97316", bg: "rgba(249,115,22,0.09)" },
  FRAUD_SUSPICION:       { label: "Fraud Suspicion",       color: "#8B5CF6", bg: "rgba(139,92,246,0.09)" },
  FRAUD:                 { label: "Fraud",                 color: "#EF4444", bg: "rgba(239,68,68,0.09)"  },
  AML:                   { label: "AML",                   color: "#F97316", bg: "rgba(249,115,22,0.09)" },
  OTHER:                 { label: "Other",                 color: "#64748B", bg: "rgba(100,116,139,0.09)" },
};

const STATUS_CONFIG = {
  OPEN:     { icon: AlertOctagon, color: "#EF4444", label: "Open"     },
  RESOLVED: { icon: CheckCircle2, color: "#10B981", label: "Resolved" },
  PENDING:  { icon: Clock,        color: "#F59E0B", label: "Pending"  },
};

export default function ComplaintsPanel({ complaints }) {
  const isEmpty = !complaints || complaints.length === 0;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}
      className="glass-card overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 flex items-center gap-3" style={{ borderBottom: "1px solid rgba(15,23,42,0.06)" }}>
        <MessageSquareWarning size={16} style={{ color: "#64748B" }} />
        <div>
          <p className="text-sm font-semibold leading-none" style={{ color: "#0F172A" }}>Complaint History</p>
          <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>
            {isEmpty ? "No complaints found" : `${complaints.length} complaint${complaints.length !== 1 ? "s" : ""} found`}
          </p>
        </div>
        {!isEmpty && (
          <div className="ml-auto px-2.5 py-1 rounded-full text-xs font-bold"
            style={{ background: "rgba(239,68,68,0.10)", color: "#EF4444" }}>
            {complaints.filter((c) => c.status === "OPEN").length} open
          </div>
        )}
      </div>

      <div className="p-4">
        {isEmpty ? (
          <div className="flex items-center gap-3 p-4 rounded-xl"
            style={{ background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.18)" }}>
            <CheckCircle2 size={16} style={{ color: "#10B981" }} />
            <p className="text-sm font-semibold" style={{ color: "#059669" }}>No complaints on record</p>
          </div>
        ) : (
          <div className="space-y-3">
            {complaints.map((complaint, i) => {
              const typeCfg   = TYPE_CONFIG[complaint.type] || TYPE_CONFIG.OTHER;
              const statusCfg = STATUS_CONFIG[complaint.status] || STATUS_CONFIG.OPEN;
              const StatusIcon = statusCfg.icon;

              return (
                <motion.div
                  key={complaint.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.07 }}
                  className="p-4 rounded-xl"
                  style={{ border: "1px solid rgba(15,23,42,0.07)", background: "#FAFBFE" }}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    {/* Type badge */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                        style={{ background: typeCfg.bg, color: typeCfg.color }}>
                        {typeCfg.label}
                      </span>
                      <span className="text-[10px] font-mono font-semibold" style={{ color: "#94A3B8" }}>
                        #{complaint.id}
                      </span>
                    </div>
                    {/* Status */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <StatusIcon size={11} style={{ color: statusCfg.color }} />
                      <span className="text-[10px] font-bold uppercase" style={{ color: statusCfg.color }}>
                        {statusCfg.label}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs leading-relaxed mb-1.5" style={{ color: "#334155" }}>
                    {complaint.description}
                  </p>
                  <p className="text-[10px]" style={{ color: "#94A3B8" }}>
                    Filed: {fmtDate(complaint.date)}
                  </p>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}
