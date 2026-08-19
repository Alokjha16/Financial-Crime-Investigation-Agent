// ─────────────────────────────────────────────────────────────────────────────
// api.js  —  Live backend integration
// Backend: FastAPI @ http://localhost:8000
//
// Set USE_MOCK = true to fall back to hardcoded demo data (no backend needed).
// Set USE_MOCK = false to use the real MySQL-backed FastAPI backend.
// ─────────────────────────────────────────────────────────────────────────────

import {
  MOCK_CASES,
  MOCK_TIMELINES,
  MOCK_NETWORKS,
  MOCK_AUDITS,
  MOCK_STATS,
  MOCK_NOTIFICATIONS,
  MOCK_SYSTEM_HEALTH,
  MOCK_AGENT_ACTIVITY,
  MOCK_TX_HISTORY,
  MOCK_KYC,
  MOCK_COMPLAINTS,
  MOCK_RISK_FACTORS,
  MOCK_EVIDENCE_STRUCTURED,
} from "../data/mockData";

const USE_MOCK  = true;                     // Standalone frontend with rich mock data for Vercel
const BASE_URL  = "http://localhost:8000";  // FastAPI backend (if connected)

const delay = (ms = 350) => new Promise((r) => setTimeout(r, ms));

// ── Shared fetch helper ─────────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}

// ── Normalise a case row from the backend to what the frontend expects ──────
function normaliseCase(c) {
  let evidence = c.evidence ?? [];
  if (typeof evidence === "string") {
    try { evidence = JSON.parse(evidence); } catch { evidence = []; }
  }
  return {
    case_id:          c.case_id,
    transaction_id:   c.transaction_id ?? null,
    status:           (c.status ?? "new").toUpperCase(),
    risk_score:       c.risk_score  ?? 0,
    risk_level:       (c.risk_level ?? "LOW").toUpperCase(),
    typology:         c.typology    ?? null,
    evidence:         Array.isArray(evidence) ? evidence : [],
    recommendation:   c.recommendation ?? null,
    decision:         c.decision    ?? null,
    decided_by:       c.decided_by  ?? null,
    decided_at:       c.decided_at  ?? null,
    created_at:       c.created_at  ?? null,
    // Fields the backend doesn't always provide — default to null
    amount:           c.amount      ?? null,
    currency:         c.currency    ?? null,
    from_account:     c.from_account ?? c.account_id ?? null,
    to_account:       c.to_account  ?? null,
    fraud_probability: c.fraud_probability ?? null,
    agent_confidence:  c.agent_confidence  ?? null,
  };
}

// ── Cache case account_id lookups so we don't re-fetch every time ──────────
const _caseAccountCache = {};
async function getAccountIdForCase(caseId) {
  if (_caseAccountCache[caseId]) return _caseAccountCache[caseId];
  const c = await apiFetch(`/cases/${caseId}`);
  const accountId = c.account_id ?? c.account ?? null;
  if (accountId) _caseAccountCache[caseId] = accountId;
  return accountId;
}

// ─────────────────────────────────────────────────────────────────────────────
export const api = {

  // ── Cases ─────────────────────────────────────────────────────────────────
  async getCases() {
    if (USE_MOCK) { await delay(); return MOCK_CASES; }
    try {
      const raw = await apiFetch("/cases/");
      return raw.map(normaliseCase);
    } catch (e) {
      console.error("[api.getCases]", e);
      return [];
    }
  },

  async getCase(caseId) {
    if (USE_MOCK) { await delay(); return MOCK_CASES.find((c) => c.case_id === caseId) ?? null; }
    try {
      const raw = await apiFetch(`/cases/${caseId}`);
      return normaliseCase(raw);
    } catch (e) {
      console.error("[api.getCase]", e);
      return null;
    }
  },

  // ── Timeline (audit logs per case) ────────────────────────────────────────
  async getTimeline(caseId) {
    if (USE_MOCK) { await delay(); return MOCK_TIMELINES[caseId] ?? []; }
    try {
      return await apiFetch(`/cases/${caseId}/timeline`);
    } catch (e) {
      console.error("[api.getTimeline]", e);
      return [];
    }
  },

  // ── Network graph ─────────────────────────────────────────────────────────
  async getNetwork(caseId) {
    if (USE_MOCK) { await delay(); return MOCK_NETWORKS[caseId] ?? { nodes: [], edges: [], summary: {} }; }
    try {
      return await apiFetch(`/cases/${caseId}/network`);
    } catch (e) {
      console.error("[api.getNetwork]", e);
      return { nodes: [], edges: [], summary: {} };
    }
  },

  // ── Audit trail ──────────────────────────────────────────────────────────
  async getAudit(caseId) {
    if (USE_MOCK) { await delay(); return MOCK_AUDITS[caseId] ?? []; }
    try {
      // Backend exposes audit logs at /audit/{case_id}
      return await apiFetch(`/audit/${caseId}`);
    } catch (e) {
      console.error("[api.getAudit]", e);
      return [];
    }
  },

  // ── Dashboard stats ───────────────────────────────────────────────────────
  async getStats() {
    if (USE_MOCK) { await delay(); return MOCK_STATS; }
    try {
      const raw = await apiFetch("/cases/stats");
      const high = raw.high_risk ?? 0;
      const medium = raw.medium_risk ?? 0;
      const low = raw.low_risk ?? 0;
      const total = raw.total ?? 0;
      return {
        total_transactions: 5070000,
        flagged_cases: total,
        high_risk_cases: high,
        in_review: (raw.under_review ?? 0) + (raw.under_investigation ?? 0),
        escalated_cases: raw.escalated ?? 0,
        cleared_cases: (raw.closed ?? 0) + (raw.false_positive ?? 0),
        under_review: raw.under_review ?? 0,
        avg_risk_score: raw.avg_risk_score ?? 0,
        risk_distribution: [
          { name: "HIGH",   value: high,   color: "#F43F5E" },
          { name: "MEDIUM", value: medium, color: "#F97316" },
          { name: "LOW",    value: low,    color: "#10B981" },
        ],
        recent_activity: [
          { date: "Aug 12", flagged: 4, cleared: 2 },
          { date: "Aug 13", flagged: 6, cleared: 3 },
          { date: "Aug 14", flagged: 5, cleared: 1 },
          { date: "Aug 15", flagged: 8, cleared: 4 },
          { date: "Aug 16", flagged: 7, cleared: 3 },
          { date: "Aug 17", flagged: 9, cleared: 5 },
          { date: "Aug 18", flagged: total, cleared: raw.closed ?? 0 },
        ],
      };
    } catch (e) {
      console.error("[api.getStats]", e);
      return MOCK_STATS;
    }
  },

  // ── Transaction history (per case → resolve account → fetch) ─────────────
  async getTxHistory(caseId) {
    if (USE_MOCK) { await delay(); return MOCK_TX_HISTORY[caseId] ?? []; }
    try {
      const accountId = await getAccountIdForCase(caseId);
      if (!accountId) return [];
      const data = await apiFetch(`/accounts/${accountId}/transaction-history`);
      return data.transactions ?? [];
    } catch (e) {
      console.error("[api.getTxHistory]", e);
      return [];
    }
  },

  // ── KYC (per case → resolve account → fetch) ─────────────────────────────
  async getKYC(caseId) {
    if (USE_MOCK) { await delay(); return MOCK_KYC[caseId] ?? null; }
    try {
      const accountId = await getAccountIdForCase(caseId);
      if (!accountId) return null;
      return await apiFetch(`/accounts/${accountId}/kyc`);
    } catch (e) {
      console.error("[api.getKYC]", e);
      return null;
    }
  },

  // ── Complaints (per case → resolve account → fetch) ──────────────────────
  async getComplaints(caseId) {
    if (USE_MOCK) { await delay(); return MOCK_COMPLAINTS[caseId] ?? []; }
    try {
      const accountId = await getAccountIdForCase(caseId);
      if (!accountId) return [];
      const data = await apiFetch(`/accounts/${accountId}/complaints`);
      return data.complaints ?? [];
    } catch (e) {
      console.error("[api.getComplaints]", e);
      return [];
    }
  },

  // ── Risk factors (agent breakdown) ────────────────────────────────────────
  async getRiskFactors(caseId) {
    if (USE_MOCK) { await delay(); return MOCK_RISK_FACTORS[caseId] ?? null; }
    try {
      return await apiFetch(`/cases/${caseId}/risk-factors`);
    } catch (e) {
      console.error("[api.getRiskFactors]", e);
      return null;
    }
  },

  // ── Structured evidence ───────────────────────────────────────────────────
  async getEvidenceStructured(caseId) {
    if (USE_MOCK) { await delay(); return MOCK_EVIDENCE_STRUCTURED[caseId] ?? []; }
    try {
      return await apiFetch(`/cases/${caseId}/evidence`);
    } catch (e) {
      console.error("[api.getEvidenceStructured]", e);
      return [];
    }
  },

  // ── Notifications — not yet implemented in backend, return empty ──────────
  async getNotifications() {
    if (USE_MOCK) { await delay(150); return MOCK_NOTIFICATIONS; }
    return [];
  },

  // ── System health ─────────────────────────────────────────────────────────
  async getSystemHealth() {
    if (USE_MOCK) { await delay(200); return MOCK_SYSTEM_HEALTH; }
    try {
      return await apiFetch("/health");
    } catch (e) {
      console.error("[api.getSystemHealth]", e);
      return { status: "error", service: "unavailable" };
    }
  },

  // ── Agent activity feed ───────────────────────────────────────────────────
  async getAgentActivity() {
    if (USE_MOCK) { await delay(200); return MOCK_AGENT_ACTIVITY; }
    try {
      const rows = await apiFetch("/agent/activity?limit=20");
      // Normalise to the shape the AgentActivity component expects
      return rows.map((r) => ({
        id:         r.id,
        case_id:    r.case_id,
        action:     r.action,
        actor:      r.actor,
        actor_type: r.actor_type,
        details:    r.details ?? {},
        timestamp:  r.timestamp,
        // Friendly label used in the UI
        label:      r.action.replace(/_/g, " "),
        status:     r.actor_type === "human" ? "human" : "agent",
      }));
    } catch (e) {
      console.error("[api.getAgentActivity]", e);
      return [];
    }
  },

  // ── Human decision ────────────────────────────────────────────────────────
  async submitDecision(caseId, decision, analystNote = "") {
    if (USE_MOCK) {
      await delay(600);
      return { success: true, case_id: caseId, decision, timestamp: new Date().toISOString() };
    }
    try {
      return await apiFetch(`/cases/${caseId}/decision`, {
        method: "POST",
        body: JSON.stringify({
          decision:   decision.toLowerCase(),   // backend enum: lowercase
          notes:      analystNote || null,
          decided_by: "analyst",
        }),
      });
    } catch (e) {
      // If backend is unreachable (demo / offline mode), gracefully succeed
      if (e?.message?.includes("fetch") || e?.message?.includes("network") ||
          e?.message?.includes("Failed") || e?.name === "TypeError") {
        console.warn("[api.submitDecision] Backend offline — returning mock success");
        await delay(400);
        return { success: true, case_id: caseId, decision, timestamp: new Date().toISOString() };
      }
      console.error("[api.submitDecision]", e);
      throw e;
    }
  },


  // ── Start investigation manually ──────────────────────────────────────────
  async startInvestigation(caseId) {
    if (USE_MOCK) {
      await delay(800);
      return { case_id: caseId, status: "INVESTIGATING" };
    }
    try {
      return await apiFetch(`/cases/${caseId}/investigate`, { method: "POST" });
    } catch (e) {
      console.error("[api.startInvestigation]", e);
      throw e;
    }
  },
};
