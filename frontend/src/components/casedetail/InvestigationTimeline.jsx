import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot, History, IdCard, AlertTriangle, Network, BarChart3, Shield,
  Flag, MapPin, CheckCircle2, FileText, ChevronDown, ChevronUp,
  HelpCircle, Terminal, Lightbulb, Code2,
} from "lucide-react";

// ── Icon map ────────────────────────────────────────────────
const ICON_MAP = {
  bot:       Bot,
  history:   History,
  "id-card": IdCard,
  alert:     AlertTriangle,
  network:   Network,
  graph:     BarChart3,
  shield:    Shield,
  flag:      Flag,
  map:       MapPin,
  check:     CheckCircle2,
  report:    FileText,
};

// ── Color palette (cycles across steps) ─────────────────────
const STEP_PALETTE = [
  { bg: "rgba(59,130,246,0.12)",  border: "rgba(59,130,246,0.25)",  color: "#2563EB" }, // Blue
  { bg: "rgba(139,92,246,0.12)", border: "rgba(139,92,246,0.25)", color: "#7C3AED"  }, // Purple
  { bg: "rgba(249,115,22,0.12)", border: "rgba(249,115,22,0.25)", color: "#EA580C"  }, // Orange
  { bg: "rgba(236,72,153,0.12)", border: "rgba(236,72,153,0.25)", color: "#DB2777"  }, // Pink
  { bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.25)", color: "#059669"  }, // Green
];

// ── JSON pretty-printer with syntax highlighting ─────────────
function JsonView({ data }) {
  const json = JSON.stringify(data, null, 2);
  // Basic token coloring via pre
  return (
    <pre
      className="text-[10px] leading-relaxed font-mono overflow-x-auto p-3 rounded-lg"
      style={{ background: "#0F172A", color: "#94A3B8" }}
    >
      {json.split("\n").map((line, i) => {
        // Colorize keys and values
        const colored = line
          .replace(/"([^"]+)":/g, (_, k) => `<span style="color:#7DD3FC">"${k}"</span>:`)
          .replace(/: "([^"]+)"/g, (_, v) => `: <span style="color:#86EFAC">"${v}"</span>`)
          .replace(/: (\d+\.?\d*)/g, (_, v) => `: <span style="color:#FCA5A5">${v}</span>`)
          .replace(/: (true|false|null)/g, (_, v) => `: <span style="color:#FCD34D">${v}</span>`);
        return (
          <span key={i} dangerouslySetInnerHTML={{ __html: colored + "\n" }} />
        );
      })}
    </pre>
  );
}

// ── Single expandable step card ───────────────────────────────
function StepCard({ step, index, theme, isLast, totalSteps }) {
  const [expanded, setExpanded] = useState(false);
  const [showJson,  setShowJson]  = useState(false);

  const Icon = ICON_MAP[step.icon] || Bot;
  const hasMeta = step.why || step.result || step.tool_input || step.tool_output;

  return (
    <motion.div
      initial={{ opacity: 0, x: -14 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.04 + index * 0.055 }}
      className="flex items-start gap-4 relative pl-1"
    >
      {/* Icon node */}
      <div
        className="relative z-10 w-9 h-9 rounded-full shrink-0 flex items-center justify-center shadow-sm"
        style={{
          background: theme.bg,
          border: `1.5px solid ${theme.border}`,
          boxShadow: isLast ? `0 0 14px ${theme.bg}` : "none",
        }}
      >
        <Icon size={16} style={{ color: theme.color }} strokeWidth={2.2} />
      </div>

      {/* Card */}
      <div className="flex-1 pb-3">
        {/* Header row */}
        <div
          className={`rounded-xl overflow-hidden transition-shadow ${hasMeta ? "cursor-pointer" : ""}`}
          style={{
            border: expanded ? `1px solid ${theme.border}` : "1px solid rgba(15,23,42,0.07)",
            background: expanded ? theme.bg : "rgba(248,250,255,0.8)",
          }}
          onClick={() => hasMeta && setExpanded((e) => !e)}
        >
          <div className="flex items-center gap-3 px-4 py-3">
            {/* Step number */}
            <span
              className="text-[10px] font-black font-mono w-5 h-5 rounded-md flex items-center justify-center shrink-0"
              style={{ background: theme.bg, color: theme.color, border: `1px solid ${theme.border}` }}
            >
              {step.step}
            </span>

            {/* Time badge */}
            <span
              className="font-mono text-[10px] font-semibold px-2 py-0.5 rounded-md shrink-0"
              style={{ color: "#64748B", background: "#F1F5F9", border: "1px solid rgba(15,23,42,0.06)" }}
            >
              {step.time}
            </span>

            {/* Label */}
            <p className="text-sm font-medium flex-1 leading-snug" style={{ color: "#1E293B" }}>
              {step.label}
            </p>

            {/* Expand toggle */}
            {hasMeta && (
              <div className="shrink-0 flex items-center gap-1.5">
                <span className="text-[9px] font-semibold hidden sm:block" style={{ color: theme.color }}>
                  {expanded ? "Less" : "Details"}
                </span>
                {expanded
                  ? <ChevronUp size={13} style={{ color: theme.color }} />
                  : <ChevronDown size={13} style={{ color: "#94A3B8" }} />
                }
              </div>
            )}
          </div>

          {/* Expanded content */}
          <AnimatePresence>
            {expanded && hasMeta && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4 space-y-3" style={{ borderTop: `1px solid ${theme.border}` }}>

                  {/* Why did the agent do this? */}
                  {step.why && (
                    <div className="pt-3">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <HelpCircle size={11} style={{ color: theme.color }} />
                        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: theme.color }}>
                          Why the agent took this step
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed" style={{ color: "#475569" }}>
                        {step.why}
                      </p>
                    </div>
                  )}

                  {/* Result / Outcome */}
                  {step.result && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Lightbulb size={11} style={{ color: "#F59E0B" }} />
                        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#F59E0B" }}>
                          Result
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed font-medium" style={{ color: "#0F172A" }}>
                        {step.result}
                      </p>
                    </div>
                  )}

                  {/* Tech details toggle */}
                  {(step.tool_input || step.tool_output) && (
                    <div>
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowJson((s) => !s); }}
                        className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors"
                        style={{ color: showJson ? "#7C3AED" : "#94A3B8" }}
                      >
                        <Code2 size={11} />
                        <Terminal size={11} />
                        {showJson ? "Hide" : "Show"} Technical Details (Tool I/O)
                      </button>

                      <AnimatePresence>
                        {showJson && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.18 }}
                            className="overflow-hidden mt-2 space-y-2"
                          >
                            {step.tool_input && (
                              <div>
                                <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: "#64748B" }}>
                                  → Tool Input
                                </p>
                                <JsonView data={step.tool_input} />
                              </div>
                            )}
                            {step.tool_output && (
                              <div>
                                <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: "#64748B" }}>
                                  ← Tool Output
                                </p>
                                <JsonView data={step.tool_output} />
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

// ── Main exported component ───────────────────────────────────
export default function InvestigationTimeline({ steps }) {
  const [expandAll, setExpandAll] = useState(false);

  if (!steps || steps.length === 0) return null;

  const hasRich = steps.some((s) => s.why || s.result || s.tool_input);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="glass-card p-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-sm font-bold" style={{ color: "#0F172A" }}>AI Investigation Timeline</p>
          <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>
            {steps.length} steps · click any step to see agent reasoning
          </p>
        </div>
        {hasRich && (
          <button
            className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            style={{ background: "#F0F2F8", color: "#64748B", border: "1px solid rgba(15,23,42,0.08)" }}
          >
            {steps.length} steps total
          </button>
        )}
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical gradient line */}
        <div
          className="absolute left-[18px] top-4 bottom-4 w-px"
          style={{
            background: "linear-gradient(to bottom, rgba(59,130,246,0.5), rgba(139,92,246,0.4), rgba(236,72,153,0.3), transparent)",
          }}
        />

        <div className="space-y-1">
          {steps.map((step, i) => (
            <StepCard
              key={step.step ?? i}
              step={step}
              index={i}
              theme={STEP_PALETTE[i % STEP_PALETTE.length]}
              isLast={i === steps.length - 1}
              totalSteps={steps.length}
            />
          ))}
        </div>
      </div>

      {/* Footer hint */}
      <div className="mt-4 pt-4 flex items-center gap-2" style={{ borderTop: "1px solid rgba(15,23,42,0.06)" }}>
        <span className="w-2 h-2 rounded-full bg-emerald-500" />
        <p className="text-[10px]" style={{ color: "#94A3B8" }}>
          All steps are read from the agent's execution trace. Tool inputs/outputs represent real API calls.
        </p>
      </div>
    </motion.div>
  );
}
