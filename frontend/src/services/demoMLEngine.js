// ══════════════════════════════════════════════════════════════════
//  demoMLEngine.js
//  JavaScript port of backend/ml/scorer.py
//  Implements Baseline + Enhanced ML scoring in-browser.
//  Matches MLOutputContract schema from backend/api/schemas.py
//  
//  BASELINE_FEATURES: amount_paid, payment_format, receiving_currency, payment_currency, temporal signals
//  ENHANCED_FEATURES: + kyc_status, kyc_risk_rating, complaint_count, outgoing_connections,
//                       incoming_connections, account_age_days
// ══════════════════════════════════════════════════════════════════

const BASE_URL = "http://localhost:8000";

// ── Seeded PRNG for deterministic features ────────────────────────
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Typology detection ────────────────────────────────────────────
function detectTypology(tx, score) {
  if (tx.injected_typology && tx.injected_typology !== "NORMAL") {
    return tx.injected_typology;
  }
  const amt = tx.amount_paid;
  const fmt = tx.payment_format;
  const currency = tx.payment_currency;

  if (fmt === "Bitcoin" || currency === "Bitcoin") return "CRYPTO_LAYERING";
  if (tx.same_account && amt > 50000) return "ROUND_TRIP";
  if (amt >= 9000 && amt <= 10000) return "STRUCTURING";
  if (amt > 500000) return "LARGE_WIRE_TRANSFER";
  if (tx.currency_mismatch) return "CURRENCY_EXCHANGE_LAUNDERING";
  if (tx.is_odd_hour && amt > 50000) return "AFTER_HOURS_SUSPICIOUS";
  if (!tx.same_bank && amt > 100000) return "MONEY_MULE";
  if (score >= 70) return "HIGH_RISK_TRANSFER";
  return "SUSPICIOUS_PATTERN";
}

// ── Build evidence list ───────────────────────────────────────────
function buildEvidence(tx, score, stage) {
  const evidence = [];
  const amt = tx.amount_paid || 0;

  if (tx.payment_format === "Bitcoin") {
    evidence.push("Payment via Bitcoin — non-custodial crypto transfer with obscured provenance.");
  }
  if (amt >= 9000 && amt <= 10000) {
    evidence.push(`Amount ($${amt.toLocaleString()}) falls just below $10,000 CTR statutory reporting threshold (structuring indicator).`);
  }
  if (amt > 1000000) {
    evidence.push(`Ultra high-value transaction: $${amt.toLocaleString()} (> $1,000,000 threshold).`);
  } else if (amt > 100000) {
    evidence.push(`High-value transaction: $${amt.toLocaleString()} via ${tx.payment_format}.`);
  }
  if (tx.same_account && amt > 25000) {
    evidence.push("Self-to-self high-value movement — potential round-trip layering pattern.");
  }
  if (tx.currency_mismatch) {
    evidence.push(`Cross-currency conversion: ${tx.payment_currency} → ${tx.receiving_currency}.`);
  }
  if (tx.is_odd_hour && amt > 10000) {
    evidence.push(`Nocturnal transaction timing at ${tx.txn_hour}:00 (outside normal commercial settlement window).`);
  }

  if (stage === "enhanced") {
    if (tx.kyc_risk_rating === "HIGH") {
      evidence.push("KYC Risk Rating: HIGH — entity flagged for enhanced due diligence.");
    }
    if (tx.kyc_status === "INCOMPLETE" || tx.kyc_status === "PENDING") {
      evidence.push(`KYC documentation status: ${tx.kyc_status}.`);
    }
    if ((tx.complaint_count || 0) > 0) {
      evidence.push(`${tx.complaint_count} prior fraud/compliance complaint(s) linked to source account.`);
    }
    if ((tx.outgoing_connections || 0) > 5) {
      evidence.push(`Elevated network degree: ${tx.outgoing_connections} outgoing counterparty connections.`);
    }
    if ((tx.account_age_days || 365) < 30) {
      evidence.push(`Dormant / New account anomaly: account active for only ${tx.account_age_days} days.`);
    }
  }

  if (evidence.length === 0) {
    evidence.push(`Baseline model score ${score}/100 — anomaly detected against peer cohort.`);
  }

  return evidence;
}

// ── BASELINE SCORER ───────────────────────────────────────────────
export function scoreBaseline(tx) {
  let score = 10; // base retail score
  const amt = tx.amount_paid || 0;

  // 1. Payment format & Currency
  if (tx.payment_format === "Bitcoin" || tx.payment_currency === "Bitcoin") {
    score += 45;
  } else if (tx.payment_format === "Wire") {
    score += 25;
  } else if (tx.payment_format === "Cheque" && amt > 50000) {
    score += 22;
  } else if (tx.payment_format === "ACH" && amt > 50000) {
    score += 18;
  }

  // 2. Structuring Detection ($9,000 - $9,999)
  if (amt >= 9000 && amt <= 10000) {
    score += 42;
  }

  // 3. High-Value Thresholds
  if (amt > 1000000) {
    score += 35;
  } else if (amt > 500000) {
    score += 28;
  } else if (amt > 100000) {
    score += 20;
  } else if (amt > 25000) {
    score += 12;
  }

  // 4. Cross-Currency
  if (tx.currency_mismatch) {
    score += 18;
  }

  // 5. Odd Hours (Midnight to 5 AM)
  if (tx.is_odd_hour && amt > 5000) {
    score += 16;
  }

  // 6. Round-trip transfers
  if (tx.same_account && amt > 50000) {
    score += 24;
  }

  score = Math.min(100, Math.max(8, Math.round(score)));
  const fraudProb = parseFloat((score / 100).toFixed(4));
  const riskLevel = score >= 65 ? "HIGH" : score >= 45 ? "MEDIUM" : "LOW";

  return {
    transaction_id: tx.transaction_id,
    fraud_probability: fraudProb,
    risk_score: score,
    risk_level: riskLevel,
    top_factors: buildEvidence(tx, score, "baseline"),
    baseline_score: score,
    stage: "baseline",
    model: "baseline_fraud_model_temporal",
  };
}

// ── SEED ENHANCED FEATURES ────────────────────────────────────────
function seedEnhancedFeatures(tx, baselineScore) {
  let h = 0;
  for (let i = 0; i < tx.transaction_id.length; i++) {
    h = (Math.imul(31, h) + tx.transaction_id.charCodeAt(i)) | 0;
  }
  const rng = mulberry32(Math.abs(h));

  const kycStatuses = ["COMPLETE", "INCOMPLETE", "PENDING", "REJECTED"];
  const isHighRisk = baselineScore >= 65;
  const isMedRisk = baselineScore >= 45 && baselineScore < 65;

  const isTrueAnomaly = isHighRisk ? rng() < 0.85 : isMedRisk ? rng() < 0.65 : rng() < 0.20;

  let kycStatus = "COMPLETE";
  let kycRating = "LOW";
  let complaints = 0;
  let outgoing = Math.floor(1 + rng() * 4);
  let incoming = Math.floor(1 + rng() * 3);
  let accountAge = Math.floor(180 + rng() * 1200);

  if (isTrueAnomaly) {
    kycStatus = rng() < 0.5 ? "INCOMPLETE" : rng() < 0.8 ? "PENDING" : "REJECTED";
    kycRating = rng() < 0.7 ? "HIGH" : "MEDIUM";
    complaints = Math.floor(1 + rng() * 4);
    outgoing = Math.floor(6 + rng() * 12);
    incoming = Math.floor(4 + rng() * 8);
    accountAge = Math.floor(8 + rng() * 45);
  } else {
    kycStatus = "COMPLETE";
    kycRating = "LOW";
    complaints = 0;
    outgoing = Math.floor(1 + rng() * 3);
    accountAge = Math.floor(500 + rng() * 900);
  }

  return {
    ...tx,
    kyc_status: kycStatus,
    kyc_risk_rating: kycRating,
    complaint_count: complaints,
    outgoing_connections: outgoing,
    incoming_connections: incoming,
    account_age_days: accountAge,
    is_true_anomaly: isTrueAnomaly,
  };
}

// ── ENHANCED SCORER ───────────────────────────────────────────────
export function scoreEnhanced(tx) {
  const baseline = scoreBaseline(tx);
  let score = baseline.risk_score;

  if (tx.kyc_status === "INCOMPLETE") score += 12;
  else if (tx.kyc_status === "PENDING") score += 10;
  else if (tx.kyc_status === "REJECTED") score += 25;
  else if (tx.kyc_status === "COMPLETE" && tx.kyc_risk_rating === "LOW") {
    score -= 15;
  }

  if (tx.kyc_risk_rating === "HIGH") score += 14;
  else if (tx.kyc_risk_rating === "MEDIUM") score += 5;

  if (tx.complaint_count > 0) score += Math.min(20, tx.complaint_count * 6);
  if (tx.outgoing_connections > 8) score += 12;
  else if (tx.outgoing_connections > 5) score += 6;

  if (tx.account_age_days < 30) score += 14;
  else if (tx.account_age_days > 365 && tx.complaint_count === 0) {
    score -= 8;
  }

  score = Math.min(99, Math.max(10, Math.round(score)));
  const fraudProb = parseFloat((score / 100).toFixed(4));
  const riskLevel = score >= 70 ? "HIGH" : score >= 45 ? "MEDIUM" : "LOW";

  return {
    transaction_id: tx.transaction_id,
    fraud_probability: fraudProb,
    risk_score: score,
    risk_level: riskLevel,
    top_factors: buildEvidence(tx, score, "enhanced"),
    baseline_score: baseline.risk_score,
    stage: "enhanced",
    model: "enhanced_fraud_model_temporal",
    typology: detectTypology(tx, score),
  };
}

// ── RUN BASELINE SCAN (volume-proportional timing: 1K≈5s, 50K≈50s) ─
export async function runBaselineScan(transactions, onProgress) {
  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 2000);
    const res = await fetch(`${BASE_URL}/api/demo/scan/baseline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactions: transactions.slice(0, 5) }),
      signal: ctrl.signal,
    });
    clearTimeout(timeout);
    if (res.ok) {
      return await res.json();
    }
  } catch (_) {}

  const results = [];
  const total = transactions.length;

  // Target durations (ms) per volume bracket — baseline scan takes ~60% of total
  // 1K→3s, 5K→7s, 8K→11s, 10K→14s, 25K→25s, 50K→35s
  let targetMs;
  if (total <= 1000)        targetMs = 3000;
  else if (total <= 2000)   targetMs = 4500;
  else if (total <= 5000)   targetMs = 7000;
  else if (total <= 8000)   targetMs = 11000;
  else if (total <= 10000)  targetMs = 14000;
  else if (total <= 25000)  targetMs = 25000;
  else if (total <= 50000)  targetMs = 35000;
  else                       targetMs = 45000;

  // Choose batch size so we get ~50 progress ticks
  const BATCH = Math.max(1, Math.ceil(total / 50));
  const numBatches = Math.ceil(total / BATCH);
  const delayPerBatch = Math.max(1, Math.floor(targetMs / numBatches));

  for (let i = 0; i < total; i += BATCH) {
    const batch = transactions.slice(i, i + BATCH);
    for (const tx of batch) {
      results.push({ tx, score: scoreBaseline(tx) });
    }
    if (onProgress) onProgress(Math.min(i + BATCH, total));
    await new Promise((r) => setTimeout(r, delayPerBatch));
  }
  return results;
}

// ── RUN ENHANCED SCAN (volume-proportional timing: ~40% of total budget) ─
export async function runEnhancedScan(suspiciousItems, onProgress) {
  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 2000);
    const res = await fetch(`${BASE_URL}/api/demo/scan/enhanced`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactions: suspiciousItems.slice(0, 5).map((i) => i.tx) }),
      signal: ctrl.signal,
    });
    clearTimeout(timeout);
    if (res.ok) {
      return await res.json();
    }
  } catch (_) {}

  const results = [];
  const total = suspiciousItems.length;
  if (total === 0) return results;

  // Enhanced scan gets ~40% of the total target time budget
  // Flagged items ≈ 8-10% of total volume, so derive from approximate parent volume
  const approxParentVolume = Math.round(total / 0.09);
  let targetMs;
  if (approxParentVolume <= 1000)        targetMs = 2000;
  else if (approxParentVolume <= 2000)   targetMs = 3000;
  else if (approxParentVolume <= 5000)   targetMs = 4500;
  else if (approxParentVolume <= 8000)   targetMs = 7000;
  else if (approxParentVolume <= 10000)  targetMs = 9000;
  else if (approxParentVolume <= 25000)  targetMs = 16000;
  else if (approxParentVolume <= 50000)  targetMs = 22000;
  else                                    targetMs = 28000;

  // Process in batches of ~20 items, compute per-batch delay
  const BATCH = Math.max(1, Math.ceil(total / 40));
  const numBatches = Math.ceil(total / BATCH);
  const delayPerBatch = Math.max(1, Math.floor(targetMs / numBatches));

  for (let i = 0; i < total; i += BATCH) {
    const batchEnd = Math.min(i + BATCH, total);
    for (let j = i; j < batchEnd; j++) {
      const item = suspiciousItems[j];
      const txWithKyc = seedEnhancedFeatures(item.tx, item.score.risk_score);
      const enhanced = scoreEnhanced(txWithKyc);
      results.push({ tx: txWithKyc, score: enhanced });
    }
    if (onProgress) onProgress(Math.min(i + BATCH, total));
    await new Promise((r) => setTimeout(r, delayPerBatch));
  }
  return results;
}
