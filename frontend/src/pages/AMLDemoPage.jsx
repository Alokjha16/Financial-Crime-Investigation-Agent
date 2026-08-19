import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Database, Cpu, Shield, AlertTriangle, Search, Network,
  BarChart3, FileText, CheckCircle2, Loader2, ChevronRight,
  Zap, Activity, Eye, Flag, TrendingUp, Users, Clock, RefreshCw,
  ArrowRight, Bot, Lock, Star, XCircle, Check, X, Download,
  Filter, MessageSquare, UserCheck, ShieldCheck, History,
  FileCheck, ExternalLink, Sparkles, ArrowLeft, Sliders, Layers,
  ChevronLeft, ArrowUpDown
} from "lucide-react";
import { loadDemoDataset } from "../data/demoDataset";
import { runBaselineScan, runEnhancedScan } from "../services/demoMLEngine";
import { runInvestigation, AGENT_STEPS } from "../services/demoAgentEngine";
import { toast } from "../components/ui/Toast";
import * as XLSX from "xlsx";

// ── Import all Scenario Case Detail subcomponents ─────────────────
import CaseSummary from "../components/casedetail/CaseSummary";
import CaseLifecycleStepper from "../components/casedetail/CaseLifecycleStepper";
import InvestigationTimeline from "../components/casedetail/InvestigationTimeline";
import NetworkGraph from "../components/casedetail/NetworkGraph";
import EvidencePanel from "../components/casedetail/EvidencePanel";
import ConclusionPanel from "../components/casedetail/ConclusionPanel";
import DecisionUI from "../components/casedetail/DecisionUI";
import TransactionHistory from "../components/casedetail/TransactionHistory";
import KYCPanel from "../components/casedetail/KYCPanel";
import ComplaintsPanel from "../components/casedetail/ComplaintsPanel";
import RiskScoreDrawer from "../components/casedetail/RiskScoreDrawer";

// ── Constants ──────────────────────────────────────────────────────
const DEMO_PHASES = {
  IDLE: "idle",
  LOADING: "loading",
  BASELINE: "baseline",
  ENHANCED: "enhanced",
  QUEUE: "queue",
  INVESTIGATING: "investigating",
  REPORT: "report",
};

const RISK_CONFIG = {
  HIGH:   { color: "#EF4444", bg: "rgba(239,68,68,0.10)", border: "rgba(239,68,68,0.25)", label: "HIGH" },
  MEDIUM: { color: "#F97316", bg: "rgba(249,115,22,0.10)", border: "rgba(249,115,22,0.25)", label: "MEDIUM" },
  LOW:    { color: "#10B981", bg: "rgba(16,185,129,0.10)", border: "rgba(16,185,129,0.25)", label: "LOW" },
};

const REC_CONFIG = {
  ESCALATE: {
    color: "#EF4444",
    bg: "rgba(239,68,68,0.12)",
    border: "rgba(239,68,68,0.30)",
    icon: Flag,
    label: "ESCALATE TO SAR",
    actionTitle: "Confirm SAR Escalation",
    desc: "File Suspicious Activity Report (SAR) with FinCEN / Financial Intelligence Unit.",
    defaultNotes: [
      "Confirmed structuring pattern near $10,000 CTR statutory threshold.",
      "High-risk crypto layering with obscured counterparty origin.",
      "Repeated nocturnal high-value transfers without legitimate business purpose.",
      "Cross-institution money mule velocity detected across high-risk accounts."
    ]
  },
  REVIEW: {
    color: "#F97316",
    bg: "rgba(249,115,22,0.12)",
    border: "rgba(249,115,22,0.30)",
    icon: Eye,
    label: "SEND FOR REVIEW",
    actionTitle: "Initiate Enhanced Analyst Review",
    desc: "Hold transaction and request additional KYC verification and source of funds documentation.",
    defaultNotes: [
      "Requested source of funds proof and originating branch invoice documentation.",
      "Transferred case to Senior Compliance Officer for counterparty verification.",
      "Pending enhanced customer due diligence (EDD) documentation.",
      "Monitoring linked network accounts for subsequent 48-hour velocity."
    ]
  },
  CLEAR: {
    color: "#10B981",
    bg: "rgba(16,185,129,0.12)",
    border: "rgba(16,185,129,0.30)",
    icon: CheckCircle2,
    label: "CLEAR TRANSACTION",
    actionTitle: "Clear as False Positive",
    desc: "Verify legitimate commercial activity and dismiss automated ML alert.",
    defaultNotes: [
      "Verified against commercial supply chain invoice; legitimate payment.",
      "Clean KYC rating and mature historical account profile confirm false alarm.",
      "Recurring corporate payroll batch transfer verified against institutional records.",
      "Customer confirmed travel status; transaction within legitimate profile."
    ]
  },
};

const AGENT_ICONS = {
  search: Search, user: Users, history: Clock, network: Network,
  alert: AlertTriangle, shield: Shield, report: FileText,
};

const VOLUME_PRESETS = [1000, 5000, 8000, 10000, 25000, 50000];

// ── Typing text animation ──────────────────────────────────────────
function TypedText({ text, speed = 16 }) {
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

// ── Risk badge ─────────────────────────────────────────────────────
function RiskBadge({ level, size = "sm" }) {
  const cfg = RISK_CONFIG[level] || RISK_CONFIG.LOW;
  const cls = size === "sm" ? "text-[10px] px-2 py-0.5" : "text-xs px-2.5 py-1";
  return (
    <span
      className={`${cls} font-black rounded-full inline-block`}
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
    >
      {level}
    </span>
  );
}

// ══════════════════════════════════════════════════════════════════
//  AMLDemoPage — Main Component
// ══════════════════════════════════════════════════════════════
export default function AMLDemoPage() {
  const [phase, setPhase] = useState(DEMO_PHASES.IDLE);

  // Custom batch scan volume state
  const [scanVolume, setScanVolume] = useState(1000);
  const [customVolumeInput, setCustomVolumeInput] = useState("");

  // Dataset & ML state
  const [dataset, setDataset] = useState([]);
  const [processed, setProcessed] = useState(0);
  const [baselineResults, setBaselineResults] = useState([]);
  const [enhancedResults, setEnhancedResults] = useState([]);
  const [suspiciousItems, setSuspiciousItems] = useState([]);
  const [enhancedProcessed, setEnhancedProcessed] = useState(0);

  // Investigation state
  const [selectedTx, setSelectedTx] = useState(null);
  const [agentSteps, setAgentSteps] = useState([]);
  const [currentStepId, setCurrentStepId] = useState(null);
  const [investigationReport, setInvestigationReport] = useState(null);
  const [whyOpen, setWhyOpen] = useState(false);

  // Loading state
  const [loadingMsg, setLoadingMsg] = useState("Initializing…");
  const [error, setError] = useState(null);

  // ── Queue Filter, Search & Pagination State ─────────────────────
  const [queueFilter, setQueueFilter] = useState("ALL");
  const [queueSearch, setQueueSearch] = useState("");
  const [queueSort, setQueueSort] = useState("RISK_DESC");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // ── Analyst Decisions & Action Log State ─────────────────────────
  const [analystDecisions, setAnalystDecisions] = useState([]);
  const [decisionModal, setDecisionModal] = useState({
    open: false,
    actionKey: "ESCALATE",
    item: null,
    report: null,
  });
  const [modalNote, setModalNote] = useState("");
  const [logFilter, setLogFilter] = useState("ALL");
  const [logSearch, setLogSearch] = useState("");

  // Computed stats from real data
  const totalTransactions = dataset.length || scanVolume || 1000;
  const baselineSuspicious = baselineResults.filter((r) => r.score.risk_score >= 45).length;
  const baselineNormal = baselineResults.length - baselineSuspicious;
  const confirmedHigh = enhancedResults.filter((r) => r.score.risk_level === "HIGH").length;
  const confirmedMedium = enhancedResults.filter((r) => r.score.risk_level === "MEDIUM").length;
  const confirmedLow = enhancedResults.filter((r) => r.score.risk_level === "LOW").length;

  // Decision counts
  const escalatedCount = analystDecisions.filter((d) => d.actionKey === "ESCALATE").length;
  const reviewCount = analystDecisions.filter((d) => d.actionKey === "REVIEW").length;
  const clearedCount = analystDecisions.filter((d) => d.actionKey === "CLEAR").length;

  // ── Reset demo ──────────────────────────────────────────────────
  const resetDemo = () => {
    setPhase(DEMO_PHASES.IDLE);
    setDataset([]);
    setProcessed(0);
    setBaselineResults([]);
    setEnhancedResults([]);
    setSuspiciousItems([]);
    setEnhancedProcessed(0);
    setSelectedTx(null);
    setAgentSteps([]);
    setCurrentStepId(null);
    setInvestigationReport(null);
    setWhyOpen(false);
    setError(null);
    setCurrentPage(1);
  };

  // ── RUN DEMO (Dynamic Volume) ───────────────────────────────────
  const runDemo = useCallback(async () => {
    setError(null);
    setPhase(DEMO_PHASES.LOADING);

    const volume = Math.max(100, Math.min(100000, Number(scanVolume) || 1000));

    try {
      // ── Step 1: Dataset Loading ──────────────────────────────────
      setLoadingMsg(`Connecting to dataset stream (${volume.toLocaleString()} transactions)…`);
      await new Promise((r) => setTimeout(r, 400));
      setLoadingMsg(`Synthesizing & ingesting ${volume.toLocaleString()} temporal transaction records…`);
      const txns = await loadDemoDataset(volume);
      setDataset(txns);
      setLoadingMsg(`Ingested ${txns.length.toLocaleString()} transactions. Initializing Baseline ML pipeline…`);
      await new Promise((r) => setTimeout(r, 600));

      // ── Step 2: Baseline ML Scan ─────────────────────────────────
      setPhase(DEMO_PHASES.BASELINE);
      setProcessed(0);
      const bResults = await runBaselineScan(txns, (count) => setProcessed(count));
      setBaselineResults(bResults);

      const flagged = bResults.filter((r) => r.score.risk_score >= 45);
      setSuspiciousItems(flagged);

      await new Promise((r) => setTimeout(r, 600));

      // ── Step 3: Enhanced ML ──────────────────────────────────────
      setPhase(DEMO_PHASES.ENHANCED);
      setEnhancedProcessed(0);
      const eResults = await runEnhancedScan(flagged, (count) => setEnhancedProcessed(count));
      setEnhancedResults(eResults);

      await new Promise((r) => setTimeout(r, 600));

      // ── Step 4: Investigation Queue ──────────────────────────────
      setCurrentPage(1);
      setPhase(DEMO_PHASES.QUEUE);
    } catch (err) {
      setError(err.message);
      setPhase(DEMO_PHASES.IDLE);
    }
  }, [scanVolume]);

  // ── RUN AGENT INVESTIGATION ──────────────────────────────────────
  const investigateTx = useCallback(async (item) => {
    setSelectedTx(item);
    setAgentSteps([]);
    setCurrentStepId(AGENT_STEPS[0].id);
    setInvestigationReport(null);
    setWhyOpen(false);
    setPhase(DEMO_PHASES.INVESTIGATING);

    const report = await runInvestigation(item.tx, item.score, ({ stepId, status, completedSteps }) => {
      setCurrentStepId(stepId);
      setAgentSteps(completedSteps);
    });

    setInvestigationReport(report);
    setPhase(DEMO_PHASES.REPORT);
  }, []);

  // ── OPEN ACTION CONFIRMATION MODAL ───────────────────────────────
  const openActionModal = (actionKey, item = selectedTx, report = investigationReport) => {
    const cfg = REC_CONFIG[actionKey];
    const defaultNote = cfg.defaultNotes[0] || "Action logged by AML Analyst.";
    setModalNote(defaultNote);
    setDecisionModal({
      open: true,
      actionKey,
      item: item || selectedTx,
      report: report || investigationReport,
    });
  };

  // ── RECORD ANALYST DECISION & LOG IT ────────────────────────────
  const commitAnalystDecision = () => {
    const { actionKey, item, report } = decisionModal;
    if (!item) return;

    const tx = item.tx || {};
    const score = item.score || {};
    const txId = tx.transaction_id || `TXN-${Date.now()}`;
    const cfg = REC_CONFIG[actionKey];

    const newDecision = {
      id: `ACT-${Date.now()}`,
      actionKey,
      actionLabel: cfg.label,
      color: cfg.color,
      bg: cfg.bg,
      border: cfg.border,
      transaction_id: txId,
      from_account: tx.from_account_id || "ACC-SOURCE",
      to_account: tx.to_account_id || "ACC-DEST",
      amount: tx.amount_paid || 0,
      currency: tx.payment_currency || "US Dollar",
      payment_format: tx.payment_format || "Wire",
      risk_score: score.risk_score || report?.risk_score || 75,
      risk_level: score.risk_level || report?.risk_level || "HIGH",
      typology: score.typology || report?.typology || "SUSPICIOUS_PATTERN",
      ai_recommendation: report?.recommendation || score.risk_level || "REVIEW",
      notes: modalNote.trim() || cfg.desc,
      analyst_name: "Jainam S.",
      analyst_role: "Senior AML Compliance Investigator",
      analyst_id: "ID #AML-8842",
      timestamp: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      date: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
      isoTime: new Date().toISOString(),
    };

    // Update state (prepend to list)
    setAnalystDecisions((prev) => [
      newDecision,
      ...prev.filter((d) => d.transaction_id !== txId),
    ]);

    // If current report is open, update its caseData decision status as well
    if (investigationReport?.caseData?.transaction_id === txId) {
      setInvestigationReport((prev) => ({
        ...prev,
        caseData: {
          ...prev.caseData,
          decision: actionKey,
          status: actionKey === "ESCALATE" ? "ESCALATED" : actionKey === "CLEAR" ? "CLEARED" : "UNDER_REVIEW",
          decided_by: "Analyst Jainam S.",
          decided_at: new Date().toISOString(),
        }
      }));
    }

    setDecisionModal({ open: false, actionKey: "ESCALATE", item: null, report: null });

    // Toast feedback — short txId to keep toast clean
    const shortId = txId.length > 18 ? txId.slice(0, 18) + "…" : txId;
    if (actionKey === "ESCALATE") {
      toast(`🚩 ${shortId} escalated to SAR registry.`, "error");
    } else if (actionKey === "REVIEW") {
      toast(`👁 ${shortId} sent for analyst review.`, "warning");
    } else {
      toast(`✓ ${shortId} cleared as false positive.`, "success");
    }
  };

  // ── EXPORT AUDIT LOG — Proper .xlsx with column widths ──────────────
  const exportLogToCSV = () => {
    if (analystDecisions.length === 0) {
      toast("No analyst decisions recorded yet.", "warning");
      return;
    }

    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    // ── Column definitions: header + width (chars) ─────────────────────────
    const COLS = [
      { header: "#",                   key: (d, i) => i + 1,                              width: 5  },
      { header: "Action ID",           key: (d)    => d.id,                               width: 20 },
      { header: "Date",                key: (d)    => d.date,                             width: 14 },
      { header: "Time",                key: (d)    => d.timestamp,                        width: 12 },
      { header: "Transaction ID",      key: (d)    => d.transaction_id,                   width: 28 },
      { header: "Decision",            key: (d)    => d.actionLabel,                      width: 20 },
      { header: "Amount (USD)",         key: (d)    => Number(d.amount || 0),              width: 16 },
      { header: "Currency",            key: (d)    => d.currency,                         width: 14 },
      { header: "Payment Format",      key: (d)    => d.payment_format,                   width: 16 },
      { header: "Risk Score",          key: (d)    => d.risk_score,                       width: 12 },
      { header: "Risk Level",          key: (d)    => d.risk_level,                       width: 12 },
      { header: "Fraud Typology",      key: (d)    => (d.typology || "").replace(/_/g, " "), width: 26 },
      { header: "AI Recommendation",   key: (d)    => d.ai_recommendation,                width: 20 },
      { header: "From Account",        key: (d)    => d.from_account,                     width: 20 },
      { header: "To Account",          key: (d)    => d.to_account,                       width: 20 },
      { header: "Analyst Name",        key: (d)    => d.analyst_name,                     width: 18 },
      { header: "Analyst ID",          key: (d)    => d.analyst_id,                       width: 14 },
      { header: "Compliance Notes",    key: (d)    => d.notes || "",                      width: 48 },
    ];

    // ── Build rows: headers + one row per decision ────────────────────────
    const headerRow  = COLS.map((c) => c.header);
    const dataRows   = analystDecisions.map((d, i) => COLS.map((c) => c.key(d, i)));

    // Create worksheet from array of arrays
    const wsData = [headerRow, ...dataRows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // ── Column widths ───────────────────────────────────────────────
    ws["!cols"] = COLS.map((c) => ({ wch: c.width }));

    // ── Freeze the header row ───────────────────────────────────────
    ws["!freeze"] = { xSplit: 0, ySplit: 1, topLeftCell: "A2" };

    // ── Build workbook with cover sheet + data sheet ─────────────────────
    const escalated = analystDecisions.filter((d) => d.actionKey === "ESCALATE").length;
    const review    = analystDecisions.filter((d) => d.actionKey === "REVIEW").length;
    const cleared   = analystDecisions.filter((d) => d.actionKey === "CLEAR").length;

    const summaryData = [
      ["FinCrime AI — AML Analyst Decision Audit Report"],
      ["Generated By",          "Jainam S.  |  Senior AML Compliance Investigator  |  ID #AML-8842"],
      ["Report Date",           dateStr],
      ["Report Time",           timeStr],
      [""],
      ["SUMMARY"],
      ["Total Decisions",       analystDecisions.length],
      ["Escalated to SAR",      escalated],
      ["Sent for Review",       review],
      ["Cleared (False +ve)",   cleared],
      ["Transactions Scanned",  dataset.length || scanVolume || 0],
      ["Flagged by Enhanced ML", enhancedResults.length],
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    wsSummary["!cols"] = [{ wch: 28 }, { wch: 70 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsSummary, "Report Summary");
    XLSX.utils.book_append_sheet(wb, ws, "Decision Log");

    // ── Download as .xlsx ───────────────────────────────────────────────
    const fileName = `AML_Audit_${dateStr}.xlsx`;
    XLSX.writeFile(wb, fileName);
    toast(`Audit report exported — ${fileName}`, "success");
  };



  // ── FILTERED & SORTED QUEUE (Supports 1000s of cases) ───────────
  const filteredAndSortedQueue = useMemo(() => {
    let list = [...enhancedResults];

    // Filter by risk category
    if (queueFilter !== "ALL") {
      list = list.filter((item) => item.score.risk_level === queueFilter);
    }

    // Filter by search query
    if (queueSearch.trim()) {
      const q = queueSearch.toLowerCase().trim();
      list = list.filter((item) => {
        const tx = item.tx || {};
        const score = item.score || {};
        return (
          (tx.transaction_id && tx.transaction_id.toLowerCase().includes(q)) ||
          (tx.from_account_id && tx.from_account_id.toLowerCase().includes(q)) ||
          (tx.to_account_id && tx.to_account_id.toLowerCase().includes(q)) ||
          (tx.payment_format && tx.payment_format.toLowerCase().includes(q)) ||
          (score.typology && score.typology.toLowerCase().includes(q)) ||
          String(tx.amount_paid).includes(q)
        );
      });
    }

    // Sort list
    list.sort((a, b) => {
      if (queueSort === "RISK_DESC") return b.score.risk_score - a.score.risk_score;
      if (queueSort === "RISK_ASC") return a.score.risk_score - b.score.risk_score;
      if (queueSort === "AMOUNT_DESC") return (b.tx.amount_paid || 0) - (a.tx.amount_paid || 0);
      if (queueSort === "AMOUNT_ASC") return (a.tx.amount_paid || 0) - (b.tx.amount_paid || 0);
      return 0;
    });

    return list;
  }, [enhancedResults, queueFilter, queueSearch, queueSort]);

  // Paginated slice
  const totalQueuePages = pageSize === -1 ? 1 : Math.max(1, Math.ceil(filteredAndSortedQueue.length / pageSize));
  const paginatedQueue = useMemo(() => {
    if (pageSize === -1) return filteredAndSortedQueue;
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedQueue.slice(start, start + pageSize);
  }, [filteredAndSortedQueue, currentPage, pageSize]);

  // Filtered decisions list
  const filteredDecisions = analystDecisions.filter((d) => {
    const matchesFilter = logFilter === "ALL" || d.actionKey === logFilter;
    const matchesSearch =
      !logSearch ||
      d.transaction_id.toLowerCase().includes(logSearch.toLowerCase()) ||
      (d.typology && d.typology.toLowerCase().includes(logSearch.toLowerCase())) ||
      (d.notes && d.notes.toLowerCase().includes(logSearch.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  // ══════════════════════════════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════════════════════════════
  return (
    <>
      {/* ── Why This Score? Side Drawer (From CaseDetailPage) ── */}
      {investigationReport && (
        <RiskScoreDrawer
          isOpen={whyOpen}
          riskData={investigationReport.riskFactors}
          caseData={investigationReport.caseData}
          onClose={() => setWhyOpen(false)}
        />
      )}

      <div className="page-enter max-w-[1400px] mx-auto space-y-6 pb-16">

        {/* ── HERO HEADER ──────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card overflow-hidden"
          style={{ background: "linear-gradient(135deg, #0F1629 0%, #1a1040 50%, #0d2040 100%)" }}
        >
          <div className="px-8 py-7 relative">
            {/* Background glow */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-10"
                style={{ background: "radial-gradient(circle, #3B82F6, transparent)", transform: "translate(30%, -30%)" }} />
              <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full opacity-8"
                style={{ background: "radial-gradient(circle, #7C3AED, transparent)", transform: "translate(-30%, 30%)" }} />
            </div>

            <div className="relative flex items-center justify-between flex-wrap gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg, #3B82F6, #7C3AED)" }}>
                    <Zap size={20} className="text-white" />
                  </div>
                  <div>
                    <h1 className="text-xl font-black text-white leading-none">Live AML Investigation Demo</h1>
                    <p className="text-xs font-medium mt-0.5" style={{ color: "#7DD3FC" }}>
                      Baseline ML → Enhanced ML → AI Agent Investigation → Scenario Case Dossier
                    </p>
                  </div>
                  {phase !== DEMO_PHASES.IDLE && (
                    <span className="flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1 rounded-full"
                      style={{ background: "rgba(59,130,246,0.2)", color: "#60A5FA", border: "1px solid rgba(59,130,246,0.3)" }}>
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                      LIVE
                    </span>
                  )}
                </div>
                <p className="text-sm" style={{ color: "#94A3B8" }}>
                  Real Transaction Stream ({scanVolume.toLocaleString()} txns) · In-Browser Scorer · Scenario 001 Dossier · Full Audit Registry
                </p>
              </div>

              <div className="flex items-center gap-3">
                {analystDecisions.length > 0 && (
                  <a
                    href="#analyst-decision-log"
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all"
                    style={{ background: "rgba(124,58,237,0.2)", color: "#C4B5FD", border: "1px solid rgba(124,58,237,0.4)" }}
                  >
                    <History size={14} />
                    <span>Log: {analystDecisions.length} Decisions</span>
                  </a>
                )}
                {phase !== DEMO_PHASES.IDLE && phase !== DEMO_PHASES.LOADING && (
                  <button
                    onClick={resetDemo}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                    style={{ background: "rgba(255,255,255,0.08)", color: "#94A3B8", border: "1px solid rgba(255,255,255,0.12)" }}
                  >
                    <RefreshCw size={14} /> Reset
                  </button>
                )}
                {phase === DEMO_PHASES.IDLE && (
                  <button
                    id="run-demo-btn"
                    onClick={runDemo}
                    className="flex items-center gap-2.5 px-6 py-3 rounded-xl font-bold text-sm transition-all relative overflow-hidden group"
                    style={{
                      background: "linear-gradient(135deg, #3B82F6, #7C3AED)",
                      color: "white",
                      boxShadow: "0 4px 20px rgba(59,130,246,0.4)",
                    }}
                  >
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ background: "linear-gradient(135deg, #2563EB, #6D28D9)" }} />
                    <Play size={16} className="relative z-10" />
                    <span className="relative z-10">Scan {scanVolume.toLocaleString()} Transactions</span>
                  </button>
                )}
              </div>
            </div>

            {/* Pipeline flow indicator */}
            {phase !== DEMO_PHASES.IDLE && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-5 flex items-center gap-2 flex-wrap"
              >
                {[
                  { id: DEMO_PHASES.LOADING, label: "Dataset", icon: Database },
                  { id: DEMO_PHASES.BASELINE, label: "Baseline ML", icon: Cpu },
                  { id: DEMO_PHASES.ENHANCED, label: "Enhanced ML", icon: TrendingUp },
                  { id: DEMO_PHASES.QUEUE, label: "Queue", icon: AlertTriangle },
                  { id: DEMO_PHASES.INVESTIGATING, label: "AI Agent", icon: Bot },
                  { id: DEMO_PHASES.REPORT, label: "Case Dossier", icon: FileText },
                ].map((step, i, arr) => {
                  const phases = Object.values(DEMO_PHASES);
                  const currentIdx = phases.indexOf(phase);
                  const stepIdx = phases.indexOf(step.id);
                  const isDone = currentIdx > stepIdx;
                  const isActive = currentIdx === stepIdx;
                  const Icon = step.icon;

                  return (
                    <div key={step.id} className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center"
                          style={{
                            background: isDone ? "rgba(16,185,129,0.2)" : isActive ? "rgba(59,130,246,0.3)" : "rgba(255,255,255,0.06)",
                            border: isDone ? "1px solid rgba(16,185,129,0.5)" : isActive ? "1px solid rgba(59,130,246,0.6)" : "1px solid rgba(255,255,255,0.12)",
                          }}>
                          {isDone
                            ? <CheckCircle2 size={10} style={{ color: "#10B981" }} />
                            : isActive
                            ? <Loader2 size={9} className="animate-spin" style={{ color: "#60A5FA" }} />
                            : <Icon size={9} style={{ color: "#64748B" }} />
                          }
                        </div>
                        <span className="text-[10px] font-semibold"
                          style={{ color: isDone ? "#10B981" : isActive ? "#60A5FA" : "#64748B" }}>
                          {step.label}
                        </span>
                      </div>
                      {i < arr.length - 1 && (
                        <ChevronRight size={10} style={{ color: "#334155" }} />
                      )}
                    </div>
                  );
                })}
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* ── TRANSACTION BATCH VOLUME SELECTOR (Interactive Slider & Presets) ── */}
        {phase === DEMO_PHASES.IDLE && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-6"
          >
            <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-indigo-50 text-indigo-600 border border-indigo-200">
                  <Sliders size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Select Transactions Batch Size</h3>
                  <p className="text-xs text-slate-500">
                    Choose volume to scan in real-time — from standard demo (1K) to enterprise stress test (50K+).
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400">Current Stream Size:</span>
                <span className="text-sm font-black px-3 py-1 rounded-xl bg-indigo-600 text-white shadow-sm">
                  {scanVolume.toLocaleString()} txns
                </span>
              </div>
            </div>

            {/* Presets + Custom input */}
            <div className="flex items-center justify-between flex-wrap gap-4 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-slate-500 mr-1 flex items-center gap-1">
                  <Layers size={13} /> Quick Presets:
                </span>
                {VOLUME_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    onClick={() => {
                      setScanVolume(preset);
                      setCustomVolumeInput("");
                    }}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all"
                    style={{
                      background: scanVolume === preset ? "#0F172A" : "rgba(15,23,42,0.04)",
                      color: scanVolume === preset ? "white" : "#475569",
                      border: scanVolume === preset ? "1px solid #0F172A" : "1px solid rgba(15,23,42,0.08)",
                      boxShadow: scanVolume === preset ? "0 2px 8px rgba(0,0,0,0.12)" : "none"
                    }}
                  >
                    {preset >= 1000 ? `${preset / 1000}K` : preset} ({preset.toLocaleString()})
                  </button>
                ))}
              </div>

              {/* Custom input box */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">Custom Count:</span>
                <div className="flex items-center rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs shadow-sm focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500">
                  <input
                    type="number"
                    min="100"
                    max="100000"
                    step="500"
                    placeholder="e.g. 8000"
                    value={customVolumeInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCustomVolumeInput(val);
                      if (val && !isNaN(val)) {
                        setScanVolume(Number(val));
                      }
                    }}
                    className="outline-none w-24 text-xs font-bold text-slate-800"
                  />
                  <span className="text-slate-400 font-semibold text-[11px]">txns</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── ERROR ───────────────────────────────────────────────── */}
        {error && (
          <div className="glass-card p-4 flex items-center gap-3"
            style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <XCircle size={16} style={{ color: "#EF4444" }} />
            <p className="text-sm" style={{ color: "#EF4444" }}>Error: {error}</p>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            PHASE: LOADING
        ══════════════════════════════════════════════════════════════ */}
        <AnimatePresence>
          {phase === DEMO_PHASES.LOADING && (
            <motion.div
              key="loading"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="glass-card p-8 text-center"
            >
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
                style={{ background: "linear-gradient(135deg, rgba(59,130,246,0.15), rgba(124,58,237,0.15))", border: "2px solid rgba(59,130,246,0.25)" }}>
                <Database size={28} style={{ color: "#3B82F6" }} />
              </div>
              <h3 className="text-lg font-black mb-1" style={{ color: "#0F172A" }}>
                Ingesting {scanVolume.toLocaleString()} Transactions Stream
              </h3>
              <p className="text-sm mb-6" style={{ color: "#64748B" }}>
                <TypedText text={loadingMsg} speed={18} />
              </p>
              <div className="flex items-center justify-center gap-2 text-xs font-medium" style={{ color: "#94A3B8" }}>
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ══════════════════════════════════════════════════════════
            PHASE: BASELINE ML SCAN
        ══════════════════════════════════════════════════════════════ */}
        <AnimatePresence>
          {phase === DEMO_PHASES.BASELINE && (
            <motion.div
              key="baseline"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="glass-card overflow-hidden"
            >
              {/* Header */}
              <div className="px-6 py-5 flex items-center justify-between"
                style={{ borderBottom: "1px solid rgba(15,23,42,0.06)", background: "linear-gradient(135deg, rgba(59,130,246,0.04), rgba(124,58,237,0.04))" }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg, #3B82F6, #2563EB)", boxShadow: "0 4px 12px rgba(59,130,246,0.3)" }}>
                    <Cpu size={18} className="text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-black" style={{ color: "#0F172A" }}>Step 2 — Baseline ML Scan</p>
                    <p className="text-xs" style={{ color: "#64748B" }}>
                      {totalTransactions.toLocaleString()} Transactions Stream → Baseline Fraud Detection Model
                    </p>
                  </div>
                </div>
                <span className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full"
                  style={{ background: "rgba(59,130,246,0.1)", color: "#2563EB" }}>
                  <Loader2 size={10} className="animate-spin" /> ANALYZING STREAM
                </span>
              </div>

              {/* Progress bar */}
              <div className="px-6 pt-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold" style={{ color: "#64748B" }}>High-Throughput ML Progress</span>
                  <span className="text-xs font-black" style={{ color: "#3B82F6" }}>
                    {Math.round((processed / totalTransactions) * 100)}% ({processed.toLocaleString()} / {totalTransactions.toLocaleString()})
                  </span>
                </div>
                <div className="h-3 rounded-full overflow-hidden" style={{ background: "#F1F5F9" }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: "linear-gradient(90deg, #3B82F6, #7C3AED)" }}
                    animate={{ width: `${(processed / totalTransactions) * 100}%` }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                  />
                </div>
              </div>

              {/* Live counters */}
              <div className="grid grid-cols-4 gap-4 p-6">
                {[
                  { label: "Transactions Scanned", value: processed, color: "#3B82F6", icon: Activity },
                  { label: "Normal Transactions", value: baselineResults.filter((r) => r.score.risk_score < 45).length, color: "#10B981", icon: CheckCircle2 },
                  { label: "Suspicious Flagged", value: baselineResults.filter((r) => r.score.risk_score >= 45).length, color: "#EF4444", icon: AlertTriangle },
                  { label: "Scan Progress", value: Math.round((processed / totalTransactions) * 100), color: "#7C3AED", icon: TrendingUp, suffix: "%" },
                ].map(({ label, value, color, icon: Icon, suffix = "" }) => (
                  <div key={label} className="rounded-2xl p-4"
                    style={{ background: `${color}0a`, border: `1px solid ${color}22` }}>
                    <div className="flex items-center gap-2 mb-2">
                      <Icon size={14} style={{ color }} />
                      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color }}>{label}</p>
                    </div>
                    <p className="text-3xl font-black" style={{ color }}>
                      {value.toLocaleString()}{suffix}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ══════════════════════════════════════════════════════════
            PHASE: ENHANCED ML
        ══════════════════════════════════════════════════════════════ */}
        <AnimatePresence>
          {phase === DEMO_PHASES.ENHANCED && (
            <motion.div
              key="enhanced"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="space-y-4"
            >
              {/* Baseline summary banner */}
              <div className="glass-card p-5"
                style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.04), rgba(5,150,105,0.04))", border: "1px solid rgba(16,185,129,0.15)" }}>
                <div className="flex items-center gap-3 mb-3">
                  <CheckCircle2 size={18} style={{ color: "#10B981" }} />
                  <p className="text-sm font-black" style={{ color: "#0F172A" }}>Baseline ML Triage Completed</p>
                </div>
                <div className="flex items-center gap-6 text-sm flex-wrap">
                  <span style={{ color: "#64748B" }}><strong style={{ color: "#0F172A" }}>{totalTransactions.toLocaleString()}</strong> transactions processed</span>
                  <ArrowRight size={14} style={{ color: "#94A3B8" }} />
                  <span style={{ color: "#10B981" }}><strong>{baselineNormal.toLocaleString()}</strong> passed as normal</span>
                  <span style={{ color: "#EF4444" }}><strong>{baselineSuspicious.toLocaleString()}</strong> flagged for enhanced ML verification</span>
                </div>
              </div>

              {/* Enhanced scan card */}
              <div className="glass-card overflow-hidden">
                <div className="px-6 py-5 flex items-center justify-between"
                  style={{ borderBottom: "1px solid rgba(15,23,42,0.06)", background: "linear-gradient(135deg, rgba(249,115,22,0.04), rgba(234,88,12,0.04))" }}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: "linear-gradient(135deg, #F97316, #EA580C)", boxShadow: "0 4px 12px rgba(249,115,22,0.3)" }}>
                      <TrendingUp size={18} className="text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-black" style={{ color: "#0F172A" }}>Step 3 — Enhanced ML Validation</p>
                      <p className="text-xs" style={{ color: "#64748B" }}>
                        Deep Multi-Modal Scoring (+KYC Verification, Network Degree, Complaint Registry & Account Maturity)
                      </p>
                    </div>
                  </div>
                  <span className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full"
                    style={{ background: "rgba(249,115,22,0.1)", color: "#EA580C" }}>
                    <Loader2 size={10} className="animate-spin" /> RUNNING ENHANCED MODEL
                  </span>
                </div>

                <div className="px-6 pt-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold" style={{ color: "#64748B" }}>Enhanced Validation Progress</span>
                    <span className="text-xs font-black" style={{ color: "#F97316" }}>
                      {enhancedProcessed.toLocaleString()}/{suspiciousItems.length.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-3 rounded-full overflow-hidden" style={{ background: "#F1F5F9" }}>
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: "linear-gradient(90deg, #F97316, #EF4444)" }}
                      animate={{ width: `${suspiciousItems.length > 0 ? (enhancedProcessed / suspiciousItems.length) * 100 : 0}%` }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4 p-6">
                  {[
                    { label: "Enhanced Validated", value: enhancedProcessed, color: "#F97316" },
                    { label: "Confirmed HIGH Risk", value: confirmedHigh, color: "#EF4444" },
                    { label: "Confirmed MEDIUM Risk", value: confirmedMedium, color: "#F97316" },
                    { label: "Filtered False Positives", value: confirmedLow, color: "#10B981" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="rounded-2xl p-4"
                      style={{ background: `${color}0a`, border: `1px solid ${color}22` }}>
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color }}>{label}</p>
                      <p className="text-3xl font-black" style={{ color }}>{value.toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ══════════════════════════════════════════════════════════
            PHASE: INVESTIGATION QUEUE (FULL BROWSER WITH PAGINATION)
        ══════════════════════════════════════════════════════════════ */}
        <AnimatePresence>
          {(phase === DEMO_PHASES.QUEUE || phase === DEMO_PHASES.INVESTIGATING || phase === DEMO_PHASES.REPORT) && (
            <motion.div
              key="queue"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {/* Summary KPIs Banner */}
              <div className="glass-card p-5">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{ background: "linear-gradient(135deg, #EF4444, #DC2626)", boxShadow: "0 4px 12px rgba(239,68,68,0.3)" }}>
                      <AlertTriangle size={16} className="text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-black" style={{ color: "#0F172A" }}>AML Suspicious Investigation Queue</p>
                      <p className="text-xs" style={{ color: "#64748B" }}>
                        All <strong>{enhancedResults.length.toLocaleString()}</strong> flagged cases available for AI investigation out of <strong>{totalTransactions.toLocaleString()}</strong> scanned
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs flex-wrap">
                    {[
                      { label: "ALL FLAGGED", key: "ALL", count: enhancedResults.length, color: "#4F46E5" },
                      { label: "HIGH RISK", key: "HIGH", count: confirmedHigh, color: "#EF4444" },
                      { label: "MEDIUM RISK", key: "MEDIUM", count: confirmedMedium, color: "#F97316" },
                      { label: "CLEARED / LOW", key: "LOW", count: confirmedLow, color: "#10B981" },
                    ].map(({ label, key, count, color }) => (
                      <button
                        key={key}
                        onClick={() => {
                          setQueueFilter(key);
                          setCurrentPage(1);
                        }}
                        className="font-bold px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 text-xs"
                        style={{
                          background: queueFilter === key ? color : `${color}12`,
                          color: queueFilter === key ? "white" : color,
                          border: `1px solid ${color}40`,
                          boxShadow: queueFilter === key ? `0 2px 8px ${color}40` : "none"
                        }}
                      >
                        <span>{label}</span>
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black"
                          style={{ background: queueFilter === key ? "rgba(255,255,255,0.25)" : `${color}25` }}>
                          {count.toLocaleString()}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Search & Sort Controls Toolbar */}
                <div className="flex items-center justify-between flex-wrap gap-3 mt-4 pt-4 border-t border-slate-100">
                  {/* Search box */}
                  <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs shadow-sm flex-1 min-w-[260px] max-w-md">
                    <Search size={14} className="text-slate-400 shrink-0" />
                    <input
                      type="text"
                      placeholder="Search any Txn ID, Account ID, Amount, Format, Typology…"
                      value={queueSearch}
                      onChange={(e) => {
                        setQueueSearch(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="outline-none bg-transparent w-full text-xs font-medium text-slate-800"
                    />
                    {queueSearch && (
                      <button onClick={() => { setQueueSearch(""); setCurrentPage(1); }} className="text-slate-400 hover:text-slate-600">
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  {/* Sort & Per Page Controls */}
                  <div className="flex items-center gap-3 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400 font-semibold flex items-center gap-1">
                        <ArrowUpDown size={12} /> Sort:
                      </span>
                      <select
                        value={queueSort}
                        onChange={(e) => setQueueSort(e.target.value)}
                        className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700 outline-none"
                      >
                        <option value="RISK_DESC">Highest Risk Score</option>
                        <option value="RISK_ASC">Lowest Risk Score</option>
                        <option value="AMOUNT_DESC">Highest Amount ($)</option>
                        <option value="AMOUNT_ASC">Lowest Amount ($)</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400 font-semibold">Per Page:</span>
                      <select
                        value={pageSize}
                        onChange={(e) => {
                          setPageSize(Number(e.target.value));
                          setCurrentPage(1);
                        }}
                        className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700 outline-none"
                      >
                        <option value="25">25 cases</option>
                        <option value="50">50 cases</option>
                        <option value="100">100 cases</option>
                        <option value="-1">Show All</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Transaction cards grid */}
              <div className="space-y-3">
                {filteredAndSortedQueue.length === 0 ? (
                  <div className="glass-card p-12 text-center">
                    <AlertTriangle size={24} className="mx-auto text-amber-500 mb-2" />
                    <p className="text-sm font-bold text-slate-800">No Flagged Transactions Found</p>
                    <p className="text-xs text-slate-500 mt-1">Try resetting your search query or filter category.</p>
                  </div>
                ) : (
                  paginatedQueue.map((item, i) => {
                    const cfg = RISK_CONFIG[item.score.risk_level] || RISK_CONFIG.LOW;
                    const isSelected = selectedTx?.tx?.transaction_id === item.tx.transaction_id;
                    const isInvestigating = isSelected && phase === DEMO_PHASES.INVESTIGATING;
                    const pastDecision = analystDecisions.find((d) => d.transaction_id === item.tx.transaction_id);

                    return (
                      <motion.div
                        key={item.tx.transaction_id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                        className="glass-card px-5 py-4"
                        style={isSelected ? { border: `1.5px solid ${cfg.color}55`, boxShadow: `0 0 20px ${cfg.bg}` } : {}}
                      >
                        <div className="flex items-center gap-4 flex-wrap justify-between">
                          {/* Left Side: Score & Details */}
                          <div className="flex items-center gap-4 flex-1 min-w-[280px]">
                            {/* Risk score badge */}
                            <div className="w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0"
                              style={{ background: cfg.bg, border: `1.5px solid ${cfg.border}` }}>
                              <span className="text-lg font-black leading-none" style={{ color: cfg.color }}>
                                {item.score.risk_score}
                              </span>
                              <span className="text-[8px] font-bold" style={{ color: cfg.color }}>SCORE</span>
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className="font-mono text-xs font-bold" style={{ color: "#1E293B" }}>
                                  {item.tx.transaction_id}
                                </span>
                                <RiskBadge level={item.score.risk_level} />
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                                  style={{ background: "rgba(15,23,42,0.05)", color: "#64748B" }}>
                                  {item.tx.payment_format}
                                </span>
                                {item.score.typology && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                                    style={{ background: "rgba(124,58,237,0.08)", color: "#7C3AED" }}>
                                    {item.score.typology.replace(/_/g, " ")}
                                  </span>
                                )}
                                {/* Past decision badge if actioned */}
                                {pastDecision && (
                                  <span
                                    className="text-[10px] px-2 py-0.5 rounded-full font-black flex items-center gap-1"
                                    style={{ background: pastDecision.bg, color: pastDecision.color, border: `1px solid ${pastDecision.border}` }}
                                  >
                                    <UserCheck size={10} />
                                    {pastDecision.actionLabel}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-4 text-xs flex-wrap" style={{ color: "#64748B" }}>
                                <span>From: <strong style={{ color: "#334155" }}>{item.tx.from_account_id}</strong></span>
                                <ArrowRight size={10} />
                                <span>To: <strong style={{ color: "#334155" }}>{item.tx.to_account_id}</strong></span>
                                <span className="font-bold" style={{ color: "#0F172A" }}>
                                  ${(item.tx.amount_paid || 0).toLocaleString()} {item.tx.payment_currency}
                                </span>
                              </div>

                              {/* Top evidence factor */}
                              {item.score.top_factors?.[0] && (
                                <p className="text-[11px] mt-1.5 leading-relaxed truncate" style={{ color: "#64748B" }}>
                                  ⚠ {item.score.top_factors[0]}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Right Side: Action Buttons */}
                          <div className="flex items-center gap-2 shrink-0">
                            {/* Quick Decision Buttons */}
                            <button
                              onClick={() => openActionModal("ESCALATE", item, null)}
                              title="Quick Escalate to SAR"
                              className="px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                              style={{ background: "rgba(239,68,68,0.08)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.2)" }}
                            >
                              <Flag size={11} /> Escalate
                            </button>
                            <button
                              onClick={() => openActionModal("REVIEW", item, null)}
                              title="Quick Send for Review"
                              className="px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                              style={{ background: "rgba(249,115,22,0.08)", color: "#EA580C", border: "1px solid rgba(249,115,22,0.2)" }}
                            >
                              <Eye size={11} /> Review
                            </button>
                            <button
                              onClick={() => openActionModal("CLEAR", item, null)}
                              title="Quick Clear as False Positive"
                              className="px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                              style={{ background: "rgba(16,185,129,0.08)", color: "#10B981", border: "1px solid rgba(16,185,129,0.2)" }}
                            >
                              <CheckCircle2 size={11} /> Clear
                            </button>

                            {/* Full Agent Investigation button */}
                            <button
                              id={`investigate-btn-${item.tx.transaction_id}`}
                              onClick={() => !isInvestigating && investigateTx(item)}
                              disabled={isInvestigating || phase === DEMO_PHASES.INVESTIGATING}
                              className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition-all shrink-0 ml-1"
                              style={{
                                background: isInvestigating
                                  ? "rgba(59,130,246,0.1)"
                                  : `linear-gradient(135deg, #3B82F6, #7C3AED)`,
                                color: isInvestigating ? "#2563EB" : "white",
                                boxShadow: isInvestigating ? "none" : `0 4px 12px rgba(59,130,246,0.35)`,
                                opacity: (!isSelected && phase === DEMO_PHASES.INVESTIGATING) ? 0.4 : 1,
                                cursor: (!isSelected && phase === DEMO_PHASES.INVESTIGATING) ? "not-allowed" : "pointer",
                              }}
                            >
                              {isInvestigating
                                ? <><Loader2 size={12} className="animate-spin" /> Investigating…</>
                                : <><Bot size={13} /> Run AI Agent</>
                              }
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>

              {/* Pagination Bar */}
              {pageSize !== -1 && totalQueuePages > 1 && (
                <div className="glass-card px-6 py-4 flex items-center justify-between flex-wrap gap-4">
                  <p className="text-xs font-semibold text-slate-500">
                    Showing <strong>{((currentPage - 1) * pageSize) + 1}</strong> to <strong>{Math.min(currentPage * pageSize, filteredAndSortedQueue.length).toLocaleString()}</strong> of <strong>{filteredAndSortedQueue.length.toLocaleString()}</strong> flagged cases
                  </p>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      <ChevronLeft size={13} /> Previous
                    </button>

                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalQueuePages) }, (_, idx) => {
                        let pageNum = currentPage;
                        if (totalQueuePages <= 5) pageNum = idx + 1;
                        else if (currentPage <= 3) pageNum = idx + 1;
                        else if (currentPage >= totalQueuePages - 2) pageNum = totalQueuePages - 4 + idx;
                        else pageNum = currentPage - 2 + idx;

                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            className="w-8 h-8 rounded-xl text-xs font-black transition-all"
                            style={{
                              background: currentPage === pageNum ? "#0F172A" : "white",
                              color: currentPage === pageNum ? "white" : "#475569",
                              border: currentPage === pageNum ? "1px solid #0F172A" : "1px solid rgba(15,23,42,0.1)",
                            }}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalQueuePages, p + 1))}
                      disabled={currentPage === totalQueuePages}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      Next <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ══════════════════════════════════════════════════════════
            PHASE: RUNNING AGENT TELEMETRY (Visual Step Animation)
        ══════════════════════════════════════════════════════════════ */}
        <AnimatePresence>
          {phase === DEMO_PHASES.INVESTIGATING && selectedTx && (
            <motion.div
              key="investigating-telemetry"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="glass-card overflow-hidden"
            >
              <div className="px-6 py-5 flex items-center justify-between"
                style={{ borderBottom: "1px solid rgba(15,23,42,0.06)", background: "linear-gradient(135deg, #0F1629, #1a1040)" }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg, #3B82F6, #7C3AED)" }}>
                    <Bot size={18} className="text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-black text-white">Autonomous AML Multi-Agent Engine</p>
                      <span className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full"
                        style={{ background: "rgba(59,130,246,0.25)", color: "#60A5FA", border: "1px solid rgba(59,130,246,0.4)" }}>
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" /> LIVE TELEMETRY
                      </span>
                    </div>
                    <p className="text-xs" style={{ color: "#7DD3FC" }}>
                      Synthesizing Case Dossier for: <span className="font-mono font-bold">{selectedTx.tx.transaction_id}</span>
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs" style={{ color: "#94A3B8" }}>
                    Executing Node {agentSteps.length + 1} of {AGENT_STEPS.length}
                  </p>
                  <div className="h-1.5 w-36 rounded-full mt-1.5" style={{ background: "rgba(255,255,255,0.1)" }}>
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: "linear-gradient(90deg, #3B82F6, #7C3AED)" }}
                      animate={{ width: `${(agentSteps.length / AGENT_STEPS.length) * 100}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </div>
              </div>

              {/* Progress step cards */}
              <div className="p-6 space-y-3">
                {AGENT_STEPS.map((step) => {
                  const completedStep = agentSteps.find((s) => s.id === step.id);
                  const isDone = !!completedStep;
                  const isRunning = currentStepId === step.id;
                  const Icon = AGENT_ICONS[step.icon] || Bot;

                  return (
                    <div
                      key={step.id}
                      className="p-3.5 rounded-xl transition-all flex items-center justify-between"
                      style={{
                        background: isDone
                          ? "rgba(16,185,129,0.04)"
                          : isRunning
                          ? "rgba(59,130,246,0.06)"
                          : "rgba(15,23,42,0.02)",
                        border: isDone
                          ? "1px solid rgba(16,185,129,0.18)"
                          : isRunning
                          ? "1.5px solid rgba(59,130,246,0.3)"
                          : "1px solid rgba(15,23,42,0.05)",
                        opacity: isDone || isRunning ? 1 : 0.45
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                          style={{ background: isDone ? "rgba(16,185,129,0.1)" : isRunning ? "rgba(59,130,246,0.15)" : "transparent" }}>
                          <Icon size={14} style={{ color: isDone ? "#10B981" : isRunning ? "#3B82F6" : "#94A3B8" }} />
                        </div>
                        <div>
                          <p className="text-xs font-bold" style={{ color: isDone ? "#059669" : isRunning ? "#2563EB" : "#64748B" }}>
                            {step.label}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {isDone && completedStep?.result ? completedStep.result : step.description}
                          </p>
                        </div>
                      </div>

                      <div>
                        {isDone ? (
                          <CheckCircle2 size={16} className="text-emerald-500" />
                        ) : isRunning ? (
                          <Loader2 size={16} className="animate-spin text-blue-500" />
                        ) : (
                          <div className="w-3.5 h-3.5 rounded-full border border-slate-300" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ══════════════════════════════════════════════════════════
            PHASE: REPORT (EXACT SCENARIO 001 CASE DETAIL PAGE FORMAT)
        ══════════════════════════════════════════════════════════════ */}
        <AnimatePresence>
          {phase === DEMO_PHASES.REPORT && investigationReport && investigationReport.caseData && (
            <motion.div
              key="scenario-case-detail-view"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="space-y-5"
            >
              {/* Back to Queue Bar */}
              <div className="flex items-center justify-between flex-wrap gap-3 pb-1">
                <button
                  onClick={() => setPhase(DEMO_PHASES.QUEUE)}
                  className="flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors"
                >
                  <ArrowLeft size={16} /> Back to Suspicious Investigation Queue ({enhancedResults.length.toLocaleString()} Cases)
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openActionModal("ESCALATE")}
                    className="btn-danger text-xs flex items-center gap-1.5 px-4 py-2 font-bold"
                  >
                    <Flag size={13} /> Escalate to SAR
                  </button>
                  <button
                    onClick={() => openActionModal("REVIEW")}
                    className="btn-warning text-xs flex items-center gap-1.5 px-4 py-2 font-bold"
                  >
                    <Eye size={13} /> Send for Review
                  </button>
                  <button
                    onClick={() => openActionModal("CLEAR")}
                    className="btn-success text-xs flex items-center gap-1.5 px-4 py-2 font-bold"
                  >
                    <CheckCircle2 size={13} /> Clear False Positive
                  </button>
                </div>
              </div>

              {/* 1. Case Lifecycle Stepper (Exact same as CaseDetailPage) */}
              <CaseLifecycleStepper caseData={investigationReport.caseData} />

              {/* 2. Case Summary Banner with "Why This Score?" Trigger */}
              <CaseSummary
                caseData={investigationReport.caseData}
                onWhyScore={() => setWhyOpen(true)}
              />

              {/* 3. Two-Column Scenario Layout */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                {/* Left Column */}
                <div className="space-y-5">
                  {/* AI Investigation Timeline */}
                  <InvestigationTimeline steps={investigationReport.timeline} />

                  {/* Transaction History Table */}
                  <TransactionHistory
                    txHistory={investigationReport.txHistory}
                    currentTxnId={investigationReport.caseData.transaction_id}
                  />

                  {/* Evidence Panel (Categorized & Structured with Proof) */}
                  <EvidencePanel
                    evidence={investigationReport.caseData.evidence}
                    structuredEvidence={investigationReport.structuredEvidence}
                  />
                </div>

                {/* Right Column */}
                <div className="space-y-5">
                  {/* Interactive Network Graph */}
                  <NetworkGraph
                    networkData={investigationReport.network}
                    kycData={investigationReport.kycData}
                  />

                  {/* KYC Profile Panel */}
                  <KYCPanel kycData={investigationReport.kycData} />

                  {/* Complaints History Panel */}
                  <ComplaintsPanel complaints={investigationReport.complaints} />

                  {/* AI Synthesized Conclusion Panel */}
                  <ConclusionPanel caseData={investigationReport.caseData} />

                  {/* Decision UI Component */}
                  <DecisionUI
                    caseData={investigationReport.caseData}
                    onDecisionMade={(decision) => {
                      const actionKey = decision === "CLEAR" || decision === "FALSE_POSITIVE" ? "CLEAR" : decision === "ESCALATE" ? "ESCALATE" : "REVIEW";
                      openActionModal(actionKey, selectedTx, investigationReport);
                    }}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ══════════════════════════════════════════════════════════
            DEDICATED SECTION: ANALYST DECISION LOG & AUDIT REGISTRY
        ══════════════════════════════════════════════════════════════ */}
        <div id="analyst-decision-log" className="space-y-4 pt-6">
          <div className="glass-card overflow-hidden">
            {/* Header */}
            <div className="px-6 py-5 flex items-center justify-between flex-wrap gap-4"
              style={{ background: "linear-gradient(135deg, #0F172A, #1e1b4b)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, #7C3AED, #4F46E5)", boxShadow: "0 4px 14px rgba(124,58,237,0.3)" }}>
                  <History size={18} className="text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-black text-white">Analyst Decision Log & Regulatory Audit Registry</p>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                      style={{ background: "rgba(124,58,237,0.25)", color: "#C4B5FD", border: "1px solid rgba(124,58,237,0.4)" }}>
                      {analystDecisions.length} RECORDED
                    </span>
                  </div>
                  <p className="text-xs" style={{ color: "#94A3B8" }}>
                    Immutable audit trail of compliance officer escalations, manual reviews, and cleared dispositions.
                  </p>
                </div>
              </div>

              {/* Export CSV Button */}
              <button
                onClick={exportLogToCSV}
                disabled={analystDecisions.length === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all"
                style={{
                  background: analystDecisions.length > 0 ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)",
                  color: analystDecisions.length > 0 ? "white" : "#64748B",
                  border: "1px solid rgba(255,255,255,0.12)",
                  cursor: analystDecisions.length > 0 ? "pointer" : "not-allowed"
                }}
              >
                <Download size={13} /> Export Audit Log (.CSV)
              </button>
            </div>

            {/* Decision KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5" style={{ background: "rgba(15,23,42,0.02)", borderBottom: "1px solid rgba(15,23,42,0.06)" }}>
              {[
                { label: "Total Decisions Made", value: analystDecisions.length, color: "#7C3AED", icon: UserCheck },
                { label: "Escalated to SAR", value: escalatedCount, color: "#EF4444", icon: Flag },
                { label: "Under Manual Review", value: reviewCount, color: "#F97316", icon: Eye },
                { label: "Cleared False Positives", value: clearedCount, color: "#10B981", icon: CheckCircle2 },
              ].map(({ label, value, color, icon: Icon }) => (
                <div key={label} className="p-3.5 rounded-xl" style={{ background: `${color}0c`, border: `1px solid ${color}20` }}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <Icon size={14} style={{ color }} />
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color }}>{label}</p>
                  </div>
                  <p className="text-2xl font-black" style={{ color }}>{value}</p>
                </div>
              ))}
            </div>

            {/* Filter & Search Bar */}
            <div className="px-6 py-3 flex items-center justify-between flex-wrap gap-3"
              style={{ borderBottom: "1px solid rgba(15,23,42,0.06)", background: "#FAFBFD" }}>
              <div className="flex items-center gap-2">
                <Filter size={12} style={{ color: "#94A3B8" }} />
                {["ALL", "ESCALATE", "REVIEW", "CLEAR"].map((flt) => (
                  <button
                    key={flt}
                    onClick={() => setLogFilter(flt)}
                    className="text-xs px-3 py-1 rounded-lg font-bold transition-all"
                    style={{
                      background: logFilter === flt ? "#0F172A" : "transparent",
                      color: logFilter === flt ? "white" : "#64748B",
                    }}
                  >
                    {flt === "ALL" ? "All Actions" : flt === "ESCALATE" ? "Escalated" : flt === "REVIEW" ? "Under Review" : "Cleared"}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs"
                style={{ background: "white", borderColor: "rgba(15,23,42,0.12)" }}>
                <Search size={12} style={{ color: "#94A3B8" }} />
                <input
                  type="text"
                  placeholder="Search Txn ID, Typology, Notes…"
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  className="outline-none bg-transparent text-xs w-48 text-slate-800"
                />
                {logSearch && (
                  <button onClick={() => setLogSearch("")} style={{ color: "#94A3B8" }}>
                    <X size={10} />
                  </button>
                )}
              </div>
            </div>

            {/* Decisions List */}
            <div className="p-6">
              {filteredDecisions.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
                    style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)" }}>
                    <History size={20} style={{ color: "#7C3AED" }} />
                  </div>
                  <p className="text-sm font-bold text-slate-800">No Analyst Decisions Recorded Yet</p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                    Run the live AML demo, inspect any suspicious transaction, and take an action (Escalate / Review / Clear) to generate an immutable audit trail entry.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredDecisions.map((dec) => {
                    const cfg = REC_CONFIG[dec.actionKey] || REC_CONFIG.REVIEW;
                    const DecIcon = cfg.icon;

                    return (
                      <motion.div
                        key={dec.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4 rounded-xl transition-all"
                        style={{
                          background: "white",
                          border: `1px solid rgba(15,23,42,0.08)`,
                          boxShadow: "0 2px 8px rgba(0,0,0,0.02)"
                        }}
                      >
                        <div className="flex items-start justify-between flex-wrap gap-3 mb-2.5">
                          <div className="flex items-center gap-3">
                            {/* Action Icon Badge */}
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                              style={{ background: dec.bg, border: `1.5px solid ${dec.border}` }}>
                              <DecIcon size={16} style={{ color: dec.color }} />
                            </div>

                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-xs font-black text-slate-900">
                                  {dec.transaction_id}
                                </span>
                                <span
                                  className="text-[10px] font-black px-2.5 py-0.5 rounded-full"
                                  style={{ background: dec.bg, color: dec.color, border: `1px solid ${dec.border}` }}
                                >
                                  {dec.actionLabel}
                                </span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                  Risk: {dec.risk_score}/100 ({dec.risk_level})
                                </span>
                                {dec.typology && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">
                                    {dec.typology.replace(/_/g, " ")}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                Amount: <strong className="text-slate-800">${dec.amount?.toLocaleString()} {dec.currency}</strong> via {dec.payment_format} · AI Recommendation: <strong className="text-slate-700">{dec.ai_recommendation}</strong>
                              </p>
                            </div>
                          </div>

                          {/* Timestamp & Analyst Sign */}
                          <div className="text-right">
                            <p className="text-xs font-bold text-slate-800">{dec.timestamp}</p>
                            <p className="text-[10px] text-slate-400">{dec.date}</p>
                          </div>
                        </div>

                        {/* Compliance Rationale / Reason Note */}
                        <div className="p-3 rounded-lg text-xs leading-relaxed"
                          style={{ background: "rgba(15,23,42,0.03)", border: "1px solid rgba(15,23,42,0.06)", color: "#334155" }}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                              <MessageSquare size={10} /> Compliance Rationale & Notes:
                            </span>
                            <span className="text-[10px] font-semibold text-indigo-600 flex items-center gap-1">
                              <ShieldCheck size={10} /> {dec.analyst_name} ({dec.analyst_id})
                            </span>
                          </div>
                          <p className="text-xs font-medium text-slate-700">{dec.notes}</p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── IDLE STATE (3 Highlights) ──────────────────────────── */}
        <AnimatePresence>
          {phase === DEMO_PHASES.IDLE && (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-4"
            >
              {[
                {
                  icon: Database,
                  color: "#3B82F6",
                  title: "Dynamic Scale Stream",
                  desc: "Scan anywhere from 1,000 to 50,000+ real AML transactions with instant live counters and ML classification.",
                },
                {
                  icon: Cpu,
                  color: "#7C3AED",
                  title: "Baseline → Enhanced ML",
                  desc: "Baseline ML flags ~8-10% of alerts; Enhanced ML validates them against KYC, network graph, and complaints.",
                },
                {
                  icon: UserCheck,
                  color: "#10B981",
                  title: "Scenario 001 Case Dossier",
                  desc: "Full interactive report with Network Graph, AI Timeline, Proof Evidence, and Decision Audit Registry.",
                },
              ].map(({ icon: Icon, color, title, desc }) => (
                <div key={title} className="glass-card p-5 text-center">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
                    style={{ background: `${color}12`, border: `1px solid ${color}25` }}>
                  <Icon size={22} style={{ color }} />
                </div>
                <p className="text-sm font-bold mb-1" style={{ color: "#0F172A" }}>{title}</p>
                <p className="text-xs leading-relaxed" style={{ color: "#64748B" }}>{desc}</p>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════
          ANALYST ACTION CONFIRMATION MODAL
      ══════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {decisionModal.open && decisionModal.item && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDecisionModal({ open: false, actionKey: "ESCALATE", item: null, report: null })}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />

            {/* Modal Dialog */}
            <motion.div
              initial={{ scale: 0.94, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl z-10 space-y-5"
              style={{ border: "1px solid rgba(15,23,42,0.1)" }}
            >
              {(() => {
                const cfg = REC_CONFIG[decisionModal.actionKey] || REC_CONFIG.REVIEW;
                const ModalIcon = cfg.icon;
                const tx = decisionModal.item.tx || {};
                const score = decisionModal.item.score || {};

                return (
                  <>
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{ background: cfg.bg, border: `1.5px solid ${cfg.border}` }}>
                          <ModalIcon size={20} style={{ color: cfg.color }} />
                        </div>
                        <div>
                          <h3 className="text-base font-black text-slate-900">{cfg.actionTitle}</h3>
                          <p className="text-xs text-slate-500">
                            Transaction: <strong className="font-mono text-slate-800">{tx.transaction_id}</strong>
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setDecisionModal({ open: false, actionKey: "ESCALATE", item: null, report: null })}
                        className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    {/* Summary Chip Grid */}
                    <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200/60 text-xs">
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400">Amount</p>
                        <p className="font-bold text-slate-900">${tx.amount_paid?.toLocaleString()} {tx.payment_currency}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400">ML Score</p>
                        <p className="font-bold text-red-600">{score.risk_score || 75}/100 ({score.risk_level || "HIGH"})</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400">Channel</p>
                        <p className="font-bold text-slate-900">{tx.payment_format}</p>
                      </div>
                    </div>

                    {/* Suggested Rationale Reason Chips */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-2">
                        Quick Reason Templates:
                      </label>
                      <div className="space-y-1.5">
                        {cfg.defaultNotes.map((note, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setModalNote(note)}
                            className="w-full text-left text-xs p-2 rounded-lg transition-all flex items-center justify-between"
                            style={{
                              background: modalNote === note ? `${cfg.color}15` : "rgba(15,23,42,0.03)",
                              border: modalNote === note ? `1.5px solid ${cfg.color}` : "1px solid rgba(15,23,42,0.06)",
                              color: modalNote === note ? cfg.color : "#334155",
                              fontWeight: modalNote === note ? 700 : 500
                            }}
                          >
                            <span>{note}</span>
                            {modalNote === note && <Check size={12} />}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Custom Note input */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Compliance Officer Notes & Disposition Rationale:
                      </label>
                      <textarea
                        rows={3}
                        value={modalNote}
                        onChange={(e) => setModalNote(e.target.value)}
                        placeholder="Enter justification for compliance audit trail…"
                        className="w-full text-xs p-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800"
                      />
                    </div>

                    {/* Analyst Signature badge */}
                    <div className="flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-slate-100 text-slate-600">
                      <span className="flex items-center gap-1.5 font-semibold">
                        <UserCheck size={13} className="text-indigo-600" />
                        Analyst: Jainam S. (ID #AML-8842)
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">Timestamp: Live</span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-3 pt-2">
                      <button
                        onClick={() => setDecisionModal({ open: false, actionKey: "ESCALATE", item: null, report: null })}
                        className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={commitAnalystDecision}
                        className="px-5 py-2.5 rounded-xl text-xs font-black text-white transition-all shadow-md flex items-center gap-2"
                        style={{ background: cfg.color }}
                      >
                        <CheckCircle2 size={14} />
                        Confirm & Record Action
                      </button>
                    </div>
                  </>
                );
              })()}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  </>
);
}
