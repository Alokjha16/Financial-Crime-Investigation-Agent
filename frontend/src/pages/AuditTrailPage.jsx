import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Bot, Cpu, User, CheckCircle2 } from "lucide-react";
import { api } from "../services/api";

const ACTOR_CONFIG = {
  system: { icon: Cpu,  color: "#0EA5E9", bg: "rgba(14,165,233,0.09)",  border: "rgba(14,165,233,0.20)",  label: "System"   },
  agent:  { icon: Bot,  color: "#7C3AED", bg: "rgba(124,58,237,0.09)", border: "rgba(124,58,237,0.20)", label: "AI Agent" },
  human:  { icon: User, color: "#10B981", bg: "rgba(16,185,129,0.09)",  border: "rgba(16,185,129,0.20)",  label: "Analyst"  },
};

export default function AuditTrailPage() {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const [audit, setAudit]     = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getAudit(caseId).then(setAudit).finally(() => setLoading(false));
  }, [caseId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-12 h-12 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: 'rgba(14,165,233,0.3)', borderTopColor: '#0EA5E9' }} />
      </div>
    );
  }

  return (
    <div className="space-y-5 page-enter max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(`/case/${caseId}`)}
          className="flex items-center gap-2 text-sm font-medium transition-colors"
          style={{ color: '#64748B' }}
          onMouseEnter={e => e.currentTarget.style.color = '#0F172A'}
          onMouseLeave={e => e.currentTarget.style.color = '#64748B'}>
          <ArrowLeft size={16} /> Back to Case
        </button>
      </div>

      <div className="glass-card p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="section-label mb-1">Audit Trail</p>
            <h2 className="text-xl font-bold" style={{ color: '#0F172A' }}>{caseId}</h2>
            <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>{audit.length} recorded events</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold"
            style={{ background: "rgba(16,185,129,0.10)", border: "1px solid rgba(16,185,129,0.20)", color: "#059669" }}>
            <CheckCircle2 size={13} /> Sealed
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-5 mb-5 pb-5" style={{ borderBottom: '1px solid rgba(15,23,42,0.07)' }}>
          {Object.entries(ACTOR_CONFIG).map(([key, { icon: Icon, color, bg, border, label }]) => (
            <div key={key} className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center"
                style={{ background: bg, border: `1px solid ${border}` }}>
                <Icon size={11} style={{ color }} />
              </div>
              <span className="text-xs" style={{ color: '#64748B' }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Timeline events */}
        <div className="relative">
          {/* Vertical connector line */}
          <div className="absolute left-[18px] top-4 bottom-0 w-px"
            style={{ background: "linear-gradient(to bottom, rgba(14,165,233,0.4), rgba(124,58,237,0.2), transparent)" }} />

          <div className="space-y-1">
            {audit.map((entry, i) => {
              const cfg = ACTOR_CONFIG[entry.type] || ACTOR_CONFIG.system;
              const Icon = cfg.icon;
              const isLast = i === audit.length - 1;
              return (
                <motion.div key={i}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-start gap-4 pl-1">
                  {/* Icon node */}
                  <div className="relative z-10 w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                    style={{
                      background: cfg.bg,
                      border: `1px solid ${cfg.border}`,
                      boxShadow: isLast ? `0 0 14px ${cfg.bg}` : "none",
                    }}>
                    <Icon size={14} style={{ color: cfg.color }} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 pb-5">
                    <div className="flex flex-wrap items-baseline gap-2 mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider"
                        style={{ color: cfg.color }}>{entry.actor}</span>
                      <span className="text-[10px] font-mono" style={{ color: '#94A3B8' }}>
                        {new Date(entry.timestamp).toLocaleString("en-IN", {
                          day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit"
                        })}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: '#334155' }}>{entry.action}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
