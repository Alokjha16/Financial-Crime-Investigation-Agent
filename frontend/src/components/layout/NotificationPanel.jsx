import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, X, AlertTriangle, Bot, Zap, CheckCircle2, Clock } from "lucide-react";
import { relativeTime } from "../../utils/format";

const TYPE_CONFIG = {
  escalation:     { icon: AlertTriangle, color: "#EF4444", bg: "rgba(239,68,68,0.10)"   },
  agent_complete: { icon: Bot,           color: "#7C3AED", bg: "rgba(124,58,237,0.10)"  },
  high_risk:      { icon: Zap,           color: "#F97316", bg: "rgba(249,115,22,0.10)"  },
  review:         { icon: Clock,         color: "#8B5CF6", bg: "rgba(139,92,246,0.10)"  },
  flagged:        { icon: AlertTriangle, color: "#F97316", bg: "rgba(249,115,22,0.10)"  },
  cleared:        { icon: CheckCircle2,  color: "#10B981", bg: "rgba(16,185,129,0.10)"  },
};

export default function NotificationPanel({ notifications, onClose, onMarkAllRead, onDismiss }) {
  const navigate = useNavigate();
  const panelRef = useRef(null);
  const unread = notifications.filter((n) => !n.read).length;

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const handleClick = (n) => {
    if (n.case_id) navigate(`/case/${n.case_id}`);
    onClose();
  };

  return (
    <motion.div
      ref={panelRef}
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.15 }}
      className="absolute right-0 top-full mt-2 w-96 rounded-2xl overflow-hidden z-50"
      style={{
        background: "#FFFFFF",
        border: "1px solid rgba(15,23,42,0.09)",
        boxShadow: "0 16px 48px rgba(0,0,0,0.12)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: "1px solid rgba(15,23,42,0.07)" }}
      >
        <div className="flex items-center gap-2.5">
          <Bell size={16} style={{ color: "#0F172A" }} />
          <span className="text-sm font-bold" style={{ color: "#0F172A" }}>Notifications</span>
          {unread > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "#EF4444", color: "#fff" }}>
              {unread}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {unread > 0 && (
            <button
              onClick={onMarkAllRead}
              className="text-xs font-semibold transition-colors"
              style={{ color: "#3B82F6" }}
            >
              Mark all read
            </button>
          )}
          <button onClick={onClose} style={{ color: "#94A3B8" }}>
            <X size={15} />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="max-h-[400px] overflow-y-auto">
        {notifications.length === 0 && (
          <div className="px-5 py-10 text-center">
            <Bell size={24} className="mx-auto mb-2" style={{ color: "#CBD5E1" }} />
            <p className="text-sm" style={{ color: "#94A3B8" }}>No notifications</p>
          </div>
        )}

        {notifications.map((n) => {
          const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.flagged;
          const Icon = cfg.icon;
          return (
            <div
              key={n.id}
              className="flex items-start gap-3 px-5 py-3.5 cursor-pointer group transition-colors"
              style={{ background: n.read ? "transparent" : "rgba(59,130,246,0.03)", borderBottom: "1px solid rgba(15,23,42,0.05)" }}
              onMouseEnter={(e) => e.currentTarget.style.background = "#F5F6FA"}
              onMouseLeave={(e) => e.currentTarget.style.background = n.read ? "transparent" : "rgba(59,130,246,0.03)"}
              onClick={() => handleClick(n)}
            >
              {/* Unread dot */}
              <div className="relative shrink-0 mt-0.5">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: cfg.bg }}>
                  <Icon size={14} style={{ color: cfg.color }} />
                </div>
                {!n.read && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full" style={{ background: "#3B82F6" }} />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold leading-tight" style={{ color: "#0F172A" }}>{n.title}</p>
                <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "#64748B" }}>{n.message}</p>
                <div className="flex items-center gap-2 mt-1">
                  {n.case_id && (
                    <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded" style={{ background: "#F5F6FA", color: "#64748B" }}>
                      {n.case_id}
                    </span>
                  )}
                  <span className="text-[10px]" style={{ color: "#CBD5E1" }}>{relativeTime(n.timestamp)}</span>
                </div>
              </div>

              <button
                onClick={(e) => { e.stopPropagation(); onDismiss(n.id); }}
                className="opacity-0 group-hover:opacity-100 transition-opacity mt-0.5 shrink-0"
                style={{ color: "#CBD5E1" }}
                title="Dismiss"
              >
                <X size={13} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 text-center" style={{ borderTop: "1px solid rgba(15,23,42,0.07)", background: "#F8FAFF" }}>
        <button className="text-xs font-semibold" style={{ color: "#3B82F6" }}>
          View all notifications
        </button>
      </div>
    </motion.div>
  );
}
