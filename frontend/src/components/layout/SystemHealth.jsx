import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { fmtTimestamp } from "../../utils/format";

const STATUS_CONFIG = {
  operational: { icon: CheckCircle2, color: "#10B981", label: "Operational" },
  degraded:    { icon: AlertTriangle, color: "#F59E0B", label: "Degraded"    },
  down:        { icon: XCircle,       color: "#EF4444", label: "Down"        },
};

export default function SystemHealth({ health }) {
  const [expanded, setExpanded] = useState(false);

  if (!health) return null;

  const services = health.services || [];
  const overallStatus =
    services.some((s) => s.status === "down")      ? "down"
    : services.some((s) => s.status === "degraded") ? "degraded"
    : "operational";

  const { color: overallColor, label: overallLabel } = STATUS_CONFIG[overallStatus];

  return (
    <div className="px-4 pb-4">
      <button
        className="w-full px-3.5 py-2.5 rounded-xl flex items-center gap-2.5 transition-colors"
        style={{ background: "rgba(59,130,246,0.07)", border: "1px solid rgba(59,130,246,0.15)" }}
        onClick={() => setExpanded((e) => !e)}
        title="System Health"
      >
        {/* Status dot */}
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{
            background: overallColor,
            boxShadow: `0 0 6px ${overallColor}`,
            animation: overallStatus === "operational" ? "pulse 2s infinite" : "none",
          }}
        />
        <span className="text-xs font-semibold flex-1 text-left" style={{ color: "#2563EB" }}>
          {overallStatus === "operational" ? "All Systems Operational" : overallLabel}
        </span>
        <ChevronDown
          size={12}
          className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          style={{ color: "#2563EB" }}
        />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div
              className="mt-2 rounded-xl overflow-hidden"
              style={{ border: "1px solid rgba(15,23,42,0.07)", background: "#FAFBFE" }}
            >
              {services.map((service, i) => {
                const cfg = STATUS_CONFIG[service.status] || STATUS_CONFIG.operational;
                const Icon = cfg.icon;
                return (
                  <div
                    key={service.id}
                    className="flex items-center gap-2.5 px-3.5 py-2.5"
                    style={{
                      borderTop: i > 0 ? "1px solid rgba(15,23,42,0.05)" : "none",
                    }}
                  >
                    <Icon size={12} style={{ color: cfg.color, flexShrink: 0 }} />
                    <span className="text-xs font-medium flex-1" style={{ color: "#334155" }}>
                      {service.label}
                    </span>
                    <span className="text-[10px] font-semibold" style={{ color: cfg.color }}>
                      {cfg.label}
                    </span>
                  </div>
                );
              })}

              <div
                className="px-3.5 py-2 text-[10px]"
                style={{ borderTop: "1px solid rgba(15,23,42,0.05)", color: "#94A3B8" }}
              >
                Last checked: {fmtTimestamp(health.last_checked).split(",")[1]?.trim() ?? "—"}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
