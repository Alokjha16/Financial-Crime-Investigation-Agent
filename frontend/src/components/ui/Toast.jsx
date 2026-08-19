import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle, AlertTriangle, X } from "lucide-react";

const TYPE_CONFIG = {
  success: { icon: CheckCircle2, color: "#10B981", bg: "#ECFDF5", border: "rgba(16,185,129,0.25)" },
  error:   { icon: XCircle,      color: "#EF4444", bg: "#FFF5F5", border: "rgba(239,68,68,0.25)"  },
  warning: { icon: AlertTriangle, color: "#F59E0B", bg: "#FFFBEB", border: "rgba(245,158,11,0.25)" },
};

// Singleton toast state — exported so any component can fire a toast
let _setToasts = null;

export function toast(message, type = "success") {
  if (_setToasts) {
    const id = Date.now();
    _setToasts((prev) => [...prev, { id, message, type }]);
  }
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);
  _setToasts = setToasts;

  const dismiss = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));

  // Auto-dismiss after 4s
  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setTimeout(() => {
      setToasts((prev) => prev.slice(1));
    }, 4000);
    return () => clearTimeout(timer);
  }, [toasts]);

  return (
    <div className="fixed top-5 right-5 z-[200] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => {
          const cfg = TYPE_CONFIG[t.type] || TYPE_CONFIG.success;
          const Icon = cfg.icon;
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 40, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.95 }}
              transition={{ duration: 0.22 }}
              className="flex items-start gap-3 px-4 py-3 rounded-xl pointer-events-auto"
              style={{
                background: cfg.bg,
                border: `1px solid ${cfg.border}`,
                boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
                minWidth: 280,
                maxWidth: 360,
              }}
            >
              <Icon size={16} style={{ color: cfg.color, flexShrink: 0, marginTop: 1 }} />
              <p className="text-sm font-medium flex-1" style={{ color: "#0F172A" }}>{t.message}</p>
              <button
                onClick={() => dismiss(t.id)}
                className="shrink-0 ml-1"
                style={{ color: "#94A3B8" }}
              >
                <X size={14} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
