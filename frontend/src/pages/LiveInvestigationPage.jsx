import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot, History, IdCard, AlertTriangle, Network, BarChart3, Shield,
  Flag, FileText, CheckCircle2, MapPin, Loader2, ArrowRight,
  Zap, Clock, Eye,
} from "lucide-react";
import { MOCK_TIMELINES, MOCK_CASES } from "../data/mockData";
import { fmtINR } from "../utils/format";

// Icon map (same as InvestigationTimeline)
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

const STEP_PALETTE = [
  { bg: "rgba(59,130,246,0.12)",  border: "rgba(59,130,246,0.25)",  color: "#2563EB" },
  { bg: "rgba(139,92,246,0.12)", border: "rgba(139,92,246,0.25)", color: "#7C3AED"  },
  { bg: "rgba(249,115,22,0.12)", border: "rgba(249,115,22,0.25)", color: "#EA580C"  },
  { bg: "rgba(236,72,153,0.12)", border: "rgba(236,72,153,0.25)", color: "#DB2777"  },
  { bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.25)", color: "#059669"  },
];

const RISK_STYLE = {
  HIGH:   { color: "#EF4444", bg: "rgba(239,68,68,0.10)"   },
  MEDIUM: { color: "#F97316", bg: "rgba(249,115,22,0.10)"  },
  LOW:    { color: "#10B981", bg: "rgba(16,185,129,0.10)"  },
};

// ── Typing animation for text ───────────────────────────────
function TypedText({ text, speed = 18 }) {
  const [displayed, setDisplayed] = useState("");
  useEffect(() => {
    setDisplayed("");
    let i = 0;
    const iv = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(iv);
    }, speed);
    return () => clearInterval(iv);
  }, [text, speed]);
  return <>{displayed}</>;
}

// ── Live terminal log ───────────────────────────────────────
function TerminalLog({ steps }) {
  const endRef = useRef(null);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [steps]);

  return (
    <div
      className="rounded-xl p-4 font-mono text-xs space-y-1.5 overflow-y-auto"
      style={{ background: "#0F172A", maxHeight: 200, minHeight: 120 }}
    >
      {steps.map((s, i) => (
        <div key={i} className="flex items-start gap-2.5">
          <span style={{ color: "#64748B" }}>{s.time}</span>
          <span style={{ color: "#7DD3FC" }}>agent</span>
          <span style={{ color: "#94A3B8" }}>→</span>
          <span style={{ color: i === steps.length - 1 ? "#86EFAC" : "#94A3B8" }}>
            {i === steps.length - 1 ? <TypedText text={s.label} /> : s.label}
          </span>
        </div>
      ))}
      {/* Blinking cursor */}
      <div className="flex items-center gap-1">
        <span style={{ color: "#64748B" }}>{">"}</span>
        <span
          className="w-2 h-3.5 rounded-sm"
          style={{ background: "#3B82F6", animation: "pulse 1s ease-in-out infinite" }}
        />
      </div>
      <div ref={endRef} />
    </div>
  );
}

export default function LiveInvestigationPage() {
  const { caseId }         = useParams();
  const [searchParams]     = useSearchParams();
  const navigate           = useNavigate();
  const txnId              = searchParams.get("txn") || "TXN-DEMO-001";

  const caseData           = MOCK_CASES.find((c) => c.case_id === caseId) || MOCK_CASES[0];
  const allSteps           = MOCK_TIMELINES[caseId] || MOCK_TIMELINES["CASE-001"];

  const [visibleSteps,  setVisibleSteps]  = useState([]);
  const [phase,         setPhase]         = useState("starting"); // starting | running | done
  const [progress,      setProgress]      = useState(0);
  const intervalRef                       = useRef(null);

  // ── Simulate steps appearing one by one ─────────────────
  useEffect(() => {
    // Start with brief "starting" phase
    const startTimer = setTimeout(() => setPhase("running"), 1200);

    return () => clearTimeout(startTimer);
  }, [caseId]);

  useEffect(() => {
    if (phase !== "running") return;

    let idx = 0;
    intervalRef.current = setInterval(() => {
      idx++;
      setVisibleSteps(allSteps.slice(0, idx));
      setProgress(Math.round((idx / allSteps.length) * 100));

      if (idx >= allSteps.length) {
        clearInterval(intervalRef.current);
        setTimeout(() => setPhase("done"), 800);
      }
    }, 900); // one step per 900ms

    return () => clearInterval(intervalRef.current);
  }, [phase, allSteps]);

  const rs = RISK_STYLE[caseData.risk_level] || RISK_STYLE.MEDIUM;

  return (
    <div className="max-w-3xl mx-auto space-y-5 page-enter">
      {/* Header */}
      <div className="glass-card px-6 py-5">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #3B82F6, #7C3AED)" }}
              >
                <Bot size={15} className="text-white" />
              </div>
              <p className="text-sm font-bold" style={{ color: "#0F172A" }}>AI Investigation Agent</p>
              {phase !== "done" && (
                <span
                  className="flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(59,130,246,0.10)", color: "#2563EB" }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                  LIVE
                </span>
              )}
              {phase === "done" && (
                <span
                  className="flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(16,185,129,0.10)", color: "#059669" }}
                >
                  <CheckCircle2 size={10} /> COMPLETE
                </span>
              )}
            </div>
            <p className="text-xs" style={{ color: "#94A3B8" }}>
              Investigating <span className="font-mono font-bold" style={{ color: "#334155" }}>{txnId}</span>
              {" · "} Case <span className="font-mono font-bold" style={{ color: "#334155" }}>{caseId}</span>
            </p>
          </div>

          {/* Risk + score */}
          <div className="text-right">
            <p className="text-3xl font-black" style={{ color: rs.color }}>
              {phase === "done" ? caseData.risk_score : "—"}
            </p>
            <p className="text-[10px]" style={{ color: "#94A3B8" }}>/ 100 Risk Score</p>
            {phase === "done" && (
              <span
                className="text-[10px] font-black px-2 py-0.5 rounded-full mt-1 inline-block"
                style={{ background: rs.bg, color: rs.color }}
              >
                {caseData.risk_level} RISK
              </span>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-semibold" style={{ color: "#94A3B8" }}>
              {phase === "starting"
                ? "Initializing agent…"
                : phase === "running"
                ? `Step ${visibleSteps.length} of ${allSteps.length}`
                : "Investigation complete"
              }
            </span>
            <span className="text-[10px] font-bold" style={{ color: "#3B82F6" }}>{progress}%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "#F1F5F9" }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: "linear-gradient(90deg, #3B82F6, #7C3AED)" }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
        </div>
      </div>

      {/* Terminal log */}
      {visibleSteps.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-4"
        >
          <p className="text-[10px] font-bold uppercase tracking-widest mb-3 flex items-center gap-2"
            style={{ color: "#94A3B8" }}>
            <Eye size={10} /> Live Agent Log
          </p>
          <TerminalLog steps={visibleSteps} />
        </motion.div>
      )}

      {/* Steps */}
      <div className="space-y-2">
        <AnimatePresence>
          {visibleSteps.map((step, i) => {
            const Icon  = ICON_MAP[step.icon] || Bot;
            const theme = STEP_PALETTE[i % STEP_PALETTE.length];
            const isRunning = i === visibleSteps.length - 1 && phase === "running";

            return (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, y: 16, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="glass-card px-5 py-4 flex items-start gap-4"
                style={isRunning ? { border: `1px solid ${theme.border}`, boxShadow: `0 0 16px ${theme.bg}` } : {}}
              >
                {/* Icon */}
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: theme.bg, border: `1.5px solid ${theme.border}` }}
                >
                  {isRunning
                    ? <Loader2 size={16} className="animate-spin" style={{ color: theme.color }} />
                    : <Icon size={16} style={{ color: theme.color }} strokeWidth={2.2} />
                  }
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2.5 mb-1 flex-wrap">
                    <span
                      className="text-[9px] font-black font-mono px-1.5 py-0.5 rounded-md"
                      style={{ background: theme.bg, color: theme.color, border: `1px solid ${theme.border}` }}
                    >
                      STEP {step.step}
                    </span>
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded-md"
                      style={{ background: "#F1F5F9", color: "#64748B" }}>
                      {step.time}
                    </span>
                    {isRunning && (
                      <span className="text-[10px] font-bold animate-pulse" style={{ color: theme.color }}>
                        Running…
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium leading-snug" style={{ color: "#1E293B" }}>
                    {isRunning ? <TypedText text={step.label} speed={20} /> : step.label}
                  </p>
                  {!isRunning && step.result && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.3 }}
                      className="text-xs mt-1.5 leading-relaxed"
                      style={{ color: "#64748B" }}
                    >
                      {step.result}
                    </motion.p>
                  )}
                </div>

                {/* Completion check */}
                {!isRunning && (
                  <CheckCircle2 size={16} className="shrink-0 mt-0.5" style={{ color: "#10B981" }} />
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Completion actions */}
      <AnimatePresence>
        {phase === "done" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="glass-card p-6 text-center"
          >
            {/* Recommendation banner */}
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: rs.bg, border: `2px solid ${rs.color}33` }}
            >
              <Flag size={28} style={{ color: rs.color }} />
            </div>

            <p className="text-lg font-black mb-1" style={{ color: "#0F172A" }}>
              Investigation Complete
            </p>
            <p className="text-sm mb-1" style={{ color: "#64748B" }}>
              AI Recommendation:&nbsp;
              <span className="font-black" style={{ color: rs.color }}>
                {caseData.recommendation}
              </span>
            </p>
            <p className="text-xs mb-6" style={{ color: "#94A3B8" }}>
              Risk Score: {caseData.risk_score}/100 · Typology: {caseData.typology?.replace(/_/g, " ")} · Agent Confidence: {Math.round(caseData.agent_confidence * 100)}%
            </p>

            <div className="flex items-center justify-center gap-3 flex-wrap">
              <button
                onClick={() => navigate(`/case/${caseId}`)}
                className="btn-primary flex items-center gap-2"
              >
                <Eye size={15} /> View Full Investigation
              </button>
              <button
                onClick={() => navigate(`/`)}
                className="btn-ghost flex items-center gap-2"
              >
                Back to Dashboard
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Starting state spinner */}
      {phase === "starting" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass-card px-6 py-8 flex flex-col items-center gap-3"
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #3B82F6, #7C3AED)" }}
          >
            <Loader2 size={22} className="text-white animate-spin" />
          </div>
          <p className="text-sm font-semibold" style={{ color: "#0F172A" }}>Initializing AI Investigation Agent…</p>
          <p className="text-xs text-center" style={{ color: "#94A3B8" }}>
            Connecting to ML engine · Loading transaction context · Preparing investigation tools
          </p>
        </motion.div>
      )}
    </div>
  );
}
