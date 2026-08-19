// ══════════════════════════════════════════════════════════════════
//  demoAgentEngine.js
//  Simulates the LangGraph investigation agent steps and creates
//  the full rich case dossier matching CaseDetailPage format (CASE-001)
//  with comprehensive structured evidence, proof details, and graph nodes.
// ══════════════════════════════════════════════════════════════════

const BASE_URL = "http://localhost:8000";

// ── Agent step definitions ────────────────────────────────────────
export const AGENT_STEPS = [
  {
    id: "evidence_collection",
    label: "Evidence Collection",
    icon: "search",
    description: "Gathering transaction records, bank statements, and initial evidence",
    durationMs: 1200,
  },
  {
    id: "account_analysis",
    label: "Account & KYC Analysis",
    icon: "user",
    description: "Analyzing KYC documentation, account maturity, and ownership profiles",
    durationMs: 1400,
  },
  {
    id: "transaction_history",
    label: "Historical Transaction Baseline",
    icon: "history",
    description: "Analyzing 90-day transaction history and detecting volume anomalies",
    durationMs: 1200,
  },
  {
    id: "network_graph",
    label: "Graph & Cluster Analysis",
    icon: "network",
    description: "Mapping counterparty graph, fan-in/fan-out hubs, and money mule clusters",
    durationMs: 1500,
  },
  {
    id: "pattern_detection",
    label: "Typology & Rule Correlation",
    icon: "alert",
    description: "Matching behavioral signatures to known AML financial crime typologies",
    durationMs: 1300,
  },
  {
    id: "risk_assessment",
    label: "Enhanced Risk Scoring",
    icon: "shield",
    description: "Synthesizing multi-modal signals into calibrated risk score (0-100)",
    durationMs: 1100,
  },
  {
    id: "ai_report",
    label: "AI Investigation Synthesis",
    icon: "report",
    description: "Generating structured regulatory dossier with immutable audit trail",
    durationMs: 1300,
  },
];

// ── Generate step result based on transaction data ────────────────
function generateStepResult(stepId, tx, enhancedScore) {
  const amt = tx.amount_paid || 0;
  const fmt = tx.payment_format || "Wire";
  const score = enhancedScore?.risk_score || 75;
  const typology = (enhancedScore?.typology || "SUSPICIOUS_PATTERN").replace(/_/g, " ");
  const kyc = tx.kyc_status || "INCOMPLETE";
  const complaints = tx.complaint_count || 0;
  const outgoing = tx.outgoing_connections || 3;
  const ageDays = tx.account_age_days || 45;

  switch (stepId) {
    case "evidence_collection":
      return `Corroborated transaction of $${amt.toLocaleString()} via ${fmt}. Source: Bank ${tx.from_bank_id} (${tx.from_account_id}), Destination: Bank ${tx.to_bank_id} (${tx.to_account_id}). ${tx.currency_mismatch ? "Currency conversion detected." : "Standard currency transaction."}`;

    case "account_analysis":
      return `Destination account age: ${ageDays} days. KYC Status: ${kyc} (Rating: ${tx.kyc_risk_rating || "MEDIUM"}). ${complaints > 0 ? `${complaints} prior fraud complaint(s) on record.` : "Clean complaint history."}`;

    case "transaction_history":
      return `90-day baseline analysis: ${tx.is_odd_hour ? `Unusual nocturnal timing at ${tx.txn_hour}:00.` : "Normal operating hours."} Volume exceeds historical cohort average by ${amt > 100000 ? "4.8x" : "2.1x"}.`;

    case "network_graph":
      return `Mapped ${outgoing + 3} connected counterparties. ${outgoing > 5 ? `Identified high-degree fan-out hub (${outgoing} outgoing links) indicative of fund dispersion.` : "Network connections within normal bounds."}`;

    case "pattern_detection":
      return `Typology match confirmed: ${typology}. Confidence score: ${score}%. ${amt >= 9000 && amt <= 10000 ? "Sub-threshold structuring pattern detected." : ""}`;

    case "risk_assessment":
      return `Final composite risk score: ${score}/100. Fraud probability: ${(score / 100).toFixed(2)}. Risk Level: ${enhancedScore?.risk_level || "HIGH"}.`;

    case "ai_report":
      return `Investigation dossier compiled. Recommendation: ${score >= 70 ? "ESCALATE TO SAR" : score >= 45 ? "SEND FOR REVIEW" : "CLEAR AS FALSE POSITIVE"}. Awaiting compliance officer action.`;

    default:
      return "Step completed.";
  }
}

// ── Build Full Case Detail Bundle (Exact CaseDetailPage schema) ───
export function buildFullCaseDetailBundle(tx, enhancedScore) {
  const score = enhancedScore?.risk_score || 75;
  const riskLevel = enhancedScore?.risk_level || "HIGH";
  const typology = enhancedScore?.typology || "SUSPICIOUS_PATTERN";
  const amt = tx.amount_paid || 0;
  const curr = tx.payment_currency || "US Dollar";
  const caseId = `CASE-${tx.transaction_id ? tx.transaction_id.slice(-6) : "DEMO"}`;
  const now = new Date();
  const timestampStr = tx.timestamp || now.toISOString();

  let recommendation = "REVIEW";
  if (score >= 70) recommendation = "ESCALATE";
  else if (score < 45) recommendation = "CLEAR";

  // 1. Case Data (Matches MOCK_CASES)
  const caseData = {
    case_id: caseId,
    transaction_id: tx.transaction_id,
    status: score >= 70 ? "FLAGGED" : score >= 45 ? "UNDER_REVIEW" : "CLEARED",
    risk_score: score,
    risk_level: riskLevel,
    typology: typology,
    amount: amt,
    currency: curr,
    from_account: tx.from_account_id,
    to_account: tx.to_account_id,
    from_bank: `Bank #${tx.from_bank_id}`,
    to_bank: `Bank #${tx.to_bank_id}`,
    timestamp: timestampStr,
    created_at: timestampStr,
    fraud_probability: parseFloat((score / 100).toFixed(2)),
    agent_confidence: parseFloat((Math.min(0.96, Math.max(0.72, (score + 10) / 100))).toFixed(2)),
    evidence: enhancedScore?.top_factors || [
      `Elevated risk score ${score}/100 detected by Enhanced ML.`,
      `Payment format: ${tx.payment_format}`,
    ],
    recommendation,
    decision: null,
    decided_by: null,
    decided_at: null,
    agent_reasoning: `Autonomous AI Agent evaluated ${tx.transaction_id} using 8 investigation nodes. Enhanced multi-modal scoring synthesized transaction velocity ($${amt.toLocaleString()} via ${tx.payment_format}), counterparty graph analysis (${tx.outgoing_connections || 3} connections), and KYC rating (${tx.kyc_risk_rating || "MEDIUM"}). Recommended disposition: ${recommendation}.`,
  };

  // 2. Investigation Timeline (Matches MOCK_TIMELINES)
  const timeline = [
    {
      step: 1,
      time: "00:00:01",
      label: "ML Pipeline Trigger & Baseline Flag",
      icon: "bot",
      status: "done",
      why: `Baseline fraud model flagged ${tx.transaction_id} with risk score ${enhancedScore?.baseline_score || 55}/100.`,
      result: `Investigation case ${caseId} opened automatically. Multi-agent workflow dispatched.`,
      tool_input: { trigger: "BASELINE_ML_ALERT", transaction_id: tx.transaction_id, baseline_score: enhancedScore?.baseline_score || 55 },
      tool_output: { case_id: caseId, status: "INVESTIGATING", model: "baseline_fraud_model_temporal" },
    },
    {
      step: 2,
      time: "00:00:02",
      label: `Transaction History for ${tx.from_account_id}`,
      icon: "history",
      status: "done",
      why: `Transaction amount $${amt.toLocaleString()} requires historical cohort context to detect volume anomalies.`,
      result: `Lookback analysis complete. ${amt > 100000 ? `Transaction is ${(amt / 25000).toFixed(1)}x above cohort baseline.` : "Amount within standard operating thresholds."}`,
      tool_input: { tool: "get_transaction_history", account_id: tx.from_account_id, lookback_days: 90 },
      tool_output: { current_amount: amt, format: tx.payment_format, anomaly_detected: amt > 50000 },
    },
    {
      step: 3,
      time: "00:00:03",
      label: `KYC & Counterparty Profiling (${tx.to_account_id})`,
      icon: "id-card",
      status: "done",
      why: "Evaluated KYC registration status, risk rating, and account maturity.",
      result: `Account age: ${tx.account_age_days || 14} days. KYC Status: ${tx.kyc_status || "INCOMPLETE"}. Risk Rating: ${tx.kyc_risk_rating || "HIGH"}.`,
      tool_input: { tool: "get_kyc_details", account_id: tx.to_account_id },
      tool_output: { kyc_status: tx.kyc_status, account_age_days: tx.account_age_days, risk_rating: tx.kyc_risk_rating },
    },
    {
      step: 4,
      time: "00:00:04",
      label: "Temporal & Nocturnal Anomaly Check",
      icon: "alert",
      status: "done",
      why: "Assessing transaction timing against commercial clearing windows.",
      result: tx.is_odd_hour
        ? `Nocturnal execution at ${tx.txn_hour}:00 (outside normal commercial settlement window). High anomaly score.`
        : `Transaction executed during standard business hours (${tx.txn_hour || 14}:00). Normal temporal signature.`,
      tool_input: { tool: "analyze_temporal_signature", timestamp: timestampStr },
      tool_output: { hour: tx.txn_hour, is_odd_hour: tx.is_odd_hour },
    },
    {
      step: 5,
      time: "00:00:05",
      label: "Counterparty Graph & Cluster Mapping",
      icon: "network",
      status: "done",
      why: "Graph traversal to identify fan-in/fan-out clusters and money mule layering links.",
      result: `Mapped ${tx.outgoing_connections || 4} connected counterparties. ${(tx.outgoing_connections || 0) > 5 ? "Rapid fund dispersion cluster identified." : "Direct counterparty relationship confirmed."}`,
      tool_input: { tool: "get_network_graph", account_id: tx.to_account_id, max_hops: 2 },
      tool_output: { connections_found: tx.outgoing_connections || 4, cluster_type: (tx.outgoing_connections || 0) > 5 ? "FAN_OUT_HUB" : "DIRECT" },
    },
    {
      step: 6,
      time: "00:00:06",
      label: `Typology Matching: ${typology.replace(/_/g, " ")}`,
      icon: "graph",
      status: "done",
      why: "Correlating all collected evidence against standard FATF and regulatory AML typologies.",
      result: `Signature matched typology: ${typology.replace(/_/g, " ")}. Match confidence: ${score}%.`,
      tool_input: { tool: "correlate_typology_rules", matched_patterns: [typology] },
      tool_output: { typology, confidence: score / 100 },
    },
    {
      step: 7,
      time: "00:00:07",
      label: `Enhanced ML Synthesis — Score ${score}/100`,
      icon: "shield",
      status: "done",
      why: "Synthesizing multi-modal features with calibrated weights.",
      result: `Composite Risk Score: ${score}/100 (${riskLevel}). Fraud probability: ${(score / 100).toFixed(2)}.`,
      tool_input: { tool: "enhanced_risk_scorer", risk_score: score, risk_level: riskLevel },
      tool_output: { final_score: score, risk_level: riskLevel, model: "enhanced_fraud_model_temporal" },
    },
    {
      step: 8,
      time: "00:00:08",
      label: `AI Recommendation: ${recommendation}`,
      icon: "flag",
      status: "done",
      why: "Generating final operational disposition for compliance officer decision.",
      result: `Recommendation: ${recommendation}. Dossier submitted to Compliance Investigation Queue.`,
      tool_input: { recommendation, case_id: caseId },
      tool_output: { status: "AWAITING_ANALYST_ACTION" },
    },
  ];

  // 3. Network Graph Data (Matches MOCK_NETWORKS ReactFlow format with complete node metadata)
  const network = {
    nodes: [
      {
        id: tx.from_account_id,
        position: { x: 260, y: 200 },
        data: {
          label: `${tx.from_account_id}\nSender (Source)`,
          type: "sender",
          account_id: tx.from_account_id,
          holder: `Entity Profile #${tx.from_account_id.slice(-4)}`,
          bank: `Bank #${tx.from_bank_id || "1420"} (Core Clearing)`,
          account_type: "Commercial Corporate Account",
          account_age: "3 Years 6 Months",
          kyc_status: "COMPLETE",
          kyc_rating: "LOW",
          balance: `$${(amt * 3.4).toLocaleString()} Flow`,
          risk: "LOW",
          flags: "Originating entity initiating transfer batch.",
        },
        type: "custom",
      },
      {
        id: tx.to_account_id,
        position: { x: 560, y: 200 },
        data: {
          label: `${tx.to_account_id}\nReceiver (${score >= 70 ? "Mule" : "Beneficiary"})`,
          type: score >= 70 ? "mule" : "linked",
          account_id: tx.to_account_id,
          holder: `Beneficiary #${tx.to_account_id.slice(-4)}`,
          bank: `Bank #${tx.to_bank_id || "3208"} (Destination)`,
          account_type: "Personal Chequing",
          account_age: `${tx.account_age_days || 14} Days (New)`,
          kyc_status: tx.kyc_status || "INCOMPLETE",
          kyc_rating: tx.kyc_risk_rating || "HIGH",
          balance: `$${amt.toLocaleString()} Flow`,
          risk: score >= 70 ? "HIGH" : "MEDIUM",
          flags: score >= 70 ? "Identified as primary rapid fund collection mule node." : "Direct counterparty receiving funds.",
        },
        type: "custom",
      },
      {
        id: "FEEDER-1",
        position: { x: 80, y: 120 },
        data: {
          label: "ACC-F901\nFeeder Account",
          type: "feeder",
          account_id: "ACC-F901",
          holder: "Inbound Transit Node #1",
          bank: "Bank #12 (Regional Transit)",
          account_type: "Intermediary Account",
          account_age: "45 Days",
          kyc_status: "PENDING",
          balance: `$${Math.round(amt * 0.45).toLocaleString()} Flow`,
          risk: "MEDIUM",
          flags: "Funneled 45% of total funds into sender prior to execution.",
        },
        type: "custom",
      },
      {
        id: "FEEDER-2",
        position: { x: 80, y: 280 },
        data: {
          label: "ACC-F902\nFeeder Account",
          type: "feeder",
          account_id: "ACC-F902",
          holder: "Inbound Transit Node #2",
          bank: "Bank #1665 (Metro Branch)",
          account_type: "Personal Transit Account",
          account_age: "28 Days",
          kyc_status: "INCOMPLETE",
          balance: `$${Math.round(amt * 0.55).toLocaleString()} Flow`,
          risk: "HIGH",
          flags: "Structured sub-threshold deposits aggregated into main sender account.",
        },
        type: "custom",
      },
      {
        id: "LINKED-1",
        position: { x: 820, y: 100 },
        data: {
          label: "ACC-L101\nLinked Destination",
          type: "linked",
          account_id: "ACC-L101",
          holder: "Offshore Layering Gateway",
          bank: "Bank #211050 (Cross-Border)",
          account_type: "Digital Asset Settlement",
          account_age: "18 Days",
          kyc_status: "INCOMPLETE",
          balance: `$${Math.round(amt * 0.32).toLocaleString()} Flow`,
          risk: "HIGH",
          flags: "Rapid outbound dispersal hop to unhosted entity within 15 minutes of receipt.",
        },
        type: "custom",
      },
      {
        id: "LINKED-2",
        position: { x: 860, y: 200 },
        data: {
          label: "ACC-L102\nLinked Destination",
          type: "linked",
          account_id: "ACC-L102",
          holder: "Secondary Dispersion Mule",
          bank: "Bank #1688 (International)",
          account_type: "Retail Chequing",
          account_age: "12 Days",
          kyc_status: "REJECTED",
          balance: `$${Math.round(amt * 0.28).toLocaleString()} Flow`,
          risk: "HIGH",
          flags: "High velocity mule recipient flagged for multiple identity mismatches.",
        },
        type: "custom",
      },
      {
        id: "LINKED-3",
        position: { x: 820, y: 300 },
        data: {
          label: "ACC-L103\nLinked Destination",
          type: "linked",
          account_id: "ACC-L103",
          holder: "Commercial Trade Clearing",
          bank: "Bank #3209 (Commercial)",
          account_type: "Commercial Merchant",
          account_age: "2 Years",
          kyc_status: "COMPLETE",
          balance: `$${Math.round(amt * 0.35).toLocaleString()} Flow`,
          risk: "LOW",
          flags: "Standard commercial trade merchant endpoint.",
        },
        type: "custom",
      },
    ],
    edges: [
      {
        id: "e-main",
        source: tx.from_account_id,
        target: tx.to_account_id,
        animated: true,
        label: `$${amt.toLocaleString()}`,
        data: { amount: amt, suspicious: score >= 50 },
      },
      {
        id: "e-f1",
        source: "FEEDER-1",
        target: tx.from_account_id,
        data: { amount: Math.round(amt * 0.45) },
      },
      {
        id: "e-f2",
        source: "FEEDER-2",
        target: tx.from_account_id,
        data: { amount: Math.round(amt * 0.55) },
      },
      {
        id: "e-l1",
        source: tx.to_account_id,
        target: "LINKED-1",
        animated: score >= 70,
        data: { amount: Math.round(amt * 0.32) },
      },
      {
        id: "e-l2",
        source: tx.to_account_id,
        target: "LINKED-2",
        animated: score >= 70,
        data: { amount: Math.round(amt * 0.28) },
      },
      {
        id: "e-l3",
        source: tx.to_account_id,
        target: "LINKED-3",
        animated: score >= 70,
        data: { amount: Math.round(amt * 0.35) },
      },
    ],
    summary: { senders: 1, mules: 1, linked: 3, feeders: 2, total: 7 },
  };

  // 4. Transaction History (Matches MOCK_TX_HISTORY)
  const txHistory = [
    {
      txn_id: tx.transaction_id,
      date: "2026-08-18",
      from: tx.from_account_id,
      to: tx.to_account_id,
      amount: amt,
      channel: tx.payment_format,
      risk: riskLevel,
      current: true,
    },
    {
      txn_id: `TXN-P${String(Math.floor(1000 + Math.random() * 9000))}`,
      date: "2026-08-14",
      from: tx.from_account_id,
      to: `ACC-${String(Math.floor(1000 + Math.random() * 9000))}`,
      amount: Math.round(amt * 0.15 + 1200),
      channel: tx.payment_format,
      risk: "LOW",
      current: false,
    },
    {
      txn_id: `TXN-P${String(Math.floor(1000 + Math.random() * 9000))}`,
      date: "2026-08-10",
      from: tx.from_account_id,
      to: `ACC-${String(Math.floor(1000 + Math.random() * 9000))}`,
      amount: Math.round(amt * 0.22 + 2500),
      channel: "ACH",
      risk: "LOW",
      current: false,
    },
    {
      txn_id: `TXN-P${String(Math.floor(1000 + Math.random() * 9000))}`,
      date: "2026-08-04",
      from: tx.from_account_id,
      to: `ACC-${String(Math.floor(1000 + Math.random() * 9000))}`,
      amount: Math.round(amt * 0.18 + 1800),
      channel: "Credit Card",
      risk: "LOW",
      current: false,
    },
  ];

  // 5. KYC Data (Matches MOCK_KYC)
  const kycData = {
    account_id: tx.to_account_id,
    account_age_days: tx.account_age_days || 14,
    account_age_label: `${tx.account_age_days || 14} Days`,
    kyc_status: tx.kyc_status || "INCOMPLETE",
    account_type: "Personal",
    business_verification: tx.kyc_status === "COMPLETE" ? "Verified" : "Not Available",
    last_kyc_update: (tx.account_age_days || 14) < 30 ? "Never" : "2025-10-12",
    risk_indicators: [
      `KYC Risk Rating: ${tx.kyc_risk_rating || "MEDIUM"}`,
      (tx.account_age_days || 14) < 30 ? "Recently created account (< 30 days old)" : "Mature account age",
      tx.kyc_status !== "COMPLETE" ? "Incomplete identity documents" : "Fully verified identity documents",
      `${tx.outgoing_connections || 3} counterparty accounts mapped in network`,
    ],
  };

  // 6. Complaints Data (Matches MOCK_COMPLAINTS)
  const complaints = (tx.complaint_count || 0) > 0 ? [
    {
      id: "CMP-8812",
      type: "UNAUTHORIZED_TRANSFER",
      type_label: "Unauthorized Transfer",
      date: "2026-08-12",
      status: "OPEN",
      description: "Counterparty reported unauthorized high-value transfer into beneficiary account.",
    },
    {
      id: "CMP-8540",
      type: "FRAUD_SUSPICION",
      type_label: "Suspicious Mule Activity",
      date: "2026-08-05",
      status: "RESOLVED",
      description: "Automated AML alert triggered on rapid dispersion of funds.",
    }
  ] : [];

  // 7. Risk Factors (Matches MOCK_RISK_FACTORS / RiskScoreDrawer format: { label, points })
  const riskFactors = {
    risk_score: score,
    ml_probability: parseFloat((score / 100).toFixed(2)),
    agent_confidence: 0.92,
    factors: [
      {
        label: `Transaction amount ($${amt.toLocaleString()}) volume deviation`,
        points: amt > 100000 ? 28 : amt >= 9000 && amt <= 10000 ? 25 : 14,
      },
      {
        label: `Payment channel & routing risk (${tx.payment_format})`,
        points: tx.payment_format === "Bitcoin" ? 30 : tx.payment_format === "Wire" ? 22 : 12,
      },
      {
        label: `KYC profile & account maturity (${tx.account_age_days || 14} days, ${tx.kyc_status || "INCOMPLETE"})`,
        points: tx.kyc_status === "COMPLETE" ? -14 : 20,
      },
      {
        label: `Counterparty graph dispersion (${tx.outgoing_connections || 3} connected nodes)`,
        points: (tx.outgoing_connections || 0) > 5 ? 18 : 8,
      },
      {
        label: tx.is_odd_hour ? `Nocturnal execution timing (${tx.txn_hour}:00 IST)` : "Standard business hours timing",
        points: tx.is_odd_hour ? 12 : -5,
      },
    ],
  };

  // 8. Structured Evidence (Matches MOCK_EVIDENCE_STRUCTURED with full proof details)
  const isStructuring = amt >= 9000 && amt <= 10000;
  const isLarge = amt > 100000;

  const structuredEvidence = [
    {
      source: "Core Banking Ledger",
      observed: `$${amt.toLocaleString()} via ${tx.payment_format}`,
      expected: isStructuring ? "Random retail amounts" : "< $25,000 baseline",
      impact: isLarge ? 28 : isStructuring ? 25 : 12,
      label: isStructuring
        ? `Amount ($${amt.toLocaleString()}) falls just below $10,000 CTR statutory reporting threshold`
        : `Transaction amount $${amt.toLocaleString()} exceeds peer group average by ${amt > 100000 ? "5.4x" : "2.2x"}`,
      severity: isLarge || isStructuring ? "HIGH" : "MEDIUM",
    },
    {
      source: "Transaction Event Log",
      observed: `${tx.txn_hour || 14}:00 IST (${tx.is_odd_hour ? "Odd Hours" : "Business Hours"})`,
      expected: "08:00 AM – 08:00 PM standard window",
      impact: tx.is_odd_hour ? 16 : -4,
      label: tx.is_odd_hour
        ? `Nocturnal transaction executed at ${tx.txn_hour}:00 outside standard commercial clearing window`
        : `Transaction initiated during standard business operating hours`,
      severity: tx.is_odd_hour ? "MEDIUM" : "LOW",
    },
    {
      source: "KYC Registry",
      observed: `${tx.kyc_status || "INCOMPLETE"} (${tx.account_age_days || 14} days old)`,
      expected: "COMPLETE (> 180 days)",
      impact: tx.kyc_status === "COMPLETE" ? -12 : 22,
      label: tx.kyc_status !== "COMPLETE"
        ? `Receiver account KYC is ${tx.kyc_status || "INCOMPLETE"} with account age only ${tx.account_age_days || 14} days`
        : `Receiver KYC fully verified and account well-established (${tx.account_age_days || 365} days)`,
      severity: tx.kyc_status !== "COMPLETE" ? "HIGH" : "LOW",
    },
    {
      source: "Graph Analytics Engine",
      observed: `${tx.outgoing_connections || 3} linked accounts (${tx.outgoing_connections > 5 ? "High Fan-out" : "Direct"})`,
      expected: "< 3 counterparty accounts",
      impact: (tx.outgoing_connections || 0) > 5 ? 18 : 6,
      label: (tx.outgoing_connections || 0) > 5
        ? `Identified suspicious fan-out cluster: ${tx.outgoing_connections} rapid outbound counterparties mapped`
        : `Counterparty graph connectivity within normal commercial thresholds (${tx.outgoing_connections || 3} links)`,
      severity: (tx.outgoing_connections || 0) > 5 ? "HIGH" : "MEDIUM",
    },
  ];

  return {
    caseData,
    timeline,
    network,
    txHistory,
    kycData,
    complaints,
    riskFactors,
    structuredEvidence,
  };
}

// ── Full investigation result ─────────────────────────────────────
function buildInvestigationReport(tx, enhancedScore) {
  const score = enhancedScore?.risk_score || 75;
  const typology = enhancedScore?.typology || "SUSPICIOUS_PATTERN";
  const evidence = enhancedScore?.top_factors || [];
  const riskLevel = enhancedScore?.risk_level || "HIGH";

  let recommendation = "REVIEW";
  if (score >= 70) recommendation = "ESCALATE";
  else if (score < 45) recommendation = "CLEAR";

  const reasoning = [
    `The transaction of $${(tx.amount_paid || 0).toLocaleString()} via ${tx.payment_format} was flagged by baseline ML with score ${enhancedScore?.baseline_score || 60}/100.`,
    `Enhanced ML analysis incorporating KYC (${tx.kyc_status || "INCOMPLETE"}), network connections (${tx.outgoing_connections || 3}), and complaint history (${tx.complaint_count || 0} complaints) finalized the risk score at ${score}/100.`,
    `Pattern analysis matched known financial crime typology: ${typology.replace(/_/g, " ")}.`,
    `${tx.currency_mismatch ? `Currency conversion from ${tx.payment_currency} to ${tx.receiving_currency} indicates cross-border flight risk.` : ""}`,
    `${tx.is_odd_hour ? `Transaction at ${tx.txn_hour}:00 is outside standard commercial settlement hours.` : ""}`,
    `Recommendation: ${recommendation} — ${recommendation === "ESCALATE" ? "File SAR with financial intelligence unit." : recommendation === "REVIEW" ? "Escalate to senior analyst for manual review." : "Transaction cleared — no further action required."}`,
  ].filter(Boolean);

  const fullCaseBundle = buildFullCaseDetailBundle(tx, enhancedScore);

  return {
    ...fullCaseBundle,
    transaction_id: tx.transaction_id,
    from_account: tx.from_account_id,
    to_account: tx.to_account_id,
    amount: tx.amount_paid,
    payment_format: tx.payment_format,
    risk_score: score,
    risk_level: riskLevel,
    fraud_probability: score / 100,
    typology,
    evidence,
    suspicious_connections: tx.outgoing_connections || 3,
    transaction_pattern: typology.replace(/_/g, " "),
    reasoning,
    recommendation,
    generated_at: new Date().toISOString(),
  };
}

// ── PUBLIC: Run investigation ─────────────────────────────────────
export async function runInvestigation(tx, enhancedScore, onStepUpdate) {
  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 2000);
    const res = await fetch(`${BASE_URL}/api/investigations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transaction_id: tx.transaction_id }),
      signal: ctrl.signal,
    });
    clearTimeout(timeout);
    if (res.ok) {
      console.log("[Demo] Backend investigation endpoint responded.");
    }
  } catch (_) {}

  const completedSteps = [];
  for (const step of AGENT_STEPS) {
    const result = generateStepResult(step.id, tx, enhancedScore);

    if (onStepUpdate) {
      onStepUpdate({
        stepId: step.id,
        status: "running",
        completedSteps: [...completedSteps],
      });
    }

    await new Promise((r) => setTimeout(r, step.durationMs));
    completedSteps.push({ ...step, result, status: "done" });

    if (onStepUpdate) {
      onStepUpdate({
        stepId: step.id,
        status: "done",
        completedSteps: [...completedSteps],
      });
    }
  }

  return buildInvestigationReport(tx, enhancedScore);
}
