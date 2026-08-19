import { motion } from "framer-motion";
import { Check } from "lucide-react";

// Status → stepper step mapping
const STEP_ORDER = ["DETECTED", "INVESTIGATING", "UNDER_REVIEW", "DECISION", "CLOSED"];

const STATUS_TO_STEP = {
  FLAGGED:        "UNDER_REVIEW",
  INVESTIGATING:  "INVESTIGATING",
  UNDER_REVIEW:   "UNDER_REVIEW",
  ESCALATED:      "DECISION",
  CLEARED:        "DECISION",
  FALSE_POSITIVE: "DECISION",
  CLOSED:         "CLOSED",
};

const STEP_LABELS = {
  DETECTED:     "Detected",
  INVESTIGATING:"Investigating",
  UNDER_REVIEW: "Analyst Review",
  DECISION:     "Decision",
  CLOSED:       "Closed",
};

const TERMINAL_COLORS = {
  ESCALATED:      "#EF4444",
  CLEARED:        "#10B981",
  FALSE_POSITIVE: "#F97316",
};

export default function CaseLifecycleStepper({ caseData }) {
  if (!caseData) return null;

  const activeStep = STATUS_TO_STEP[caseData.status] || "INVESTIGATING";
  const activeIdx  = STEP_ORDER.indexOf(activeStep);
  const terminalColor = TERMINAL_COLORS[caseData.status];

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="glass-card px-6 py-4"
    >
      {/* Step row */}
      <div className="flex items-center gap-0">
        {STEP_ORDER.map((step, i) => {
          const isCompleted = i < activeIdx;
          const isActive    = i === activeIdx;
          const isFuture    = i > activeIdx;

          const isDecisionStep = step === "DECISION";
          const color = isDecisionStep && isActive && terminalColor
            ? terminalColor
            : isCompleted || isActive
              ? "#3B82F6"
              : "#CBD5E1";

          return (
            <div key={step} className="flex items-center flex-1">
              {/* Node + label */}
              <div className="flex flex-col items-center flex-1">
                <div className="relative">
                  {/* Active pulse ring */}
                  {isActive && (
                    <span
                      className="absolute inset-0 rounded-full animate-ping opacity-30"
                      style={{ background: color, transform: "scale(1.6)" }}
                    />
                  )}
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center relative z-10 transition-all duration-300"
                    style={{
                      background: isCompleted || isActive ? color : "#F1F5F9",
                      border: isFuture ? "2px solid #CBD5E1" : `2px solid ${color}`,
                      boxShadow: isActive ? `0 0 0 4px ${color}22` : "none",
                    }}
                  >
                    {isCompleted ? (
                      <Check size={13} className="text-white" strokeWidth={3} />
                    ) : (
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ background: isActive ? "#fff" : "#CBD5E1" }}
                      />
                    )}
                  </div>
                </div>
                <p
                  className="text-[10px] font-bold mt-2 text-center whitespace-nowrap"
                  style={{ color: isFuture ? "#94A3B8" : isActive && isDecisionStep && terminalColor ? terminalColor : isActive ? "#2563EB" : "#334155" }}
                >
                  {isDecisionStep && isActive && caseData.status !== "FLAGGED"
                    ? caseData.decision || caseData.status
                    : STEP_LABELS[step]}
                </p>
              </div>

              {/* Connector line (skip after last) */}
              {i < STEP_ORDER.length - 1 && (
                <div
                  className="h-0.5 flex-1 -mt-4 mx-1 rounded-full transition-all duration-500"
                  style={{ background: i < activeIdx ? "#3B82F6" : "#E2E8F0" }}
                />
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
