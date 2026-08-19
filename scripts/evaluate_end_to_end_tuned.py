"""
End-to-end evaluation of the tuned staged hybrid architecture.

Uses the ACTUAL backend routing logic:
  - backend.ml.scorer.score_transaction()
  - backend.api.routes.transactions._run_ml_scoring_and_investigate() logic

Tests on the temporally-corrected held-out data (20k transactions from
transactions_enhanced_temporal.csv using the same train_test_split
parameters as training: test_size=0.2, random_state=42, stratify=y).

Measures:
  - Accuracy, Precision, Recall, F1, FPR, FNR
  - Missed laundering count
  - False positive count
  - Cases created
  - Agent invocations

Validates that the 20/65/45 implementation matches the offline evaluation.
"""

import os
import sys
import json
import time
import joblib
import pandas as pd
import numpy as np
from datetime import datetime
from pathlib import Path
from sklearn.model_selection import train_test_split

# Ensure backend is importable
PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

from backend.ml.scorer import score_transaction, get_enhanced_model, get_baseline_model

# ============================================================================
# CONFIG
# ============================================================================

DATA_PATH = PROJECT_ROOT / "data" / "processed" / "transactions_enhanced_temporal.csv"
RESULTS_DIR = PROJECT_ROOT / "results"
os.makedirs(RESULTS_DIR, exist_ok=True)

RANDOM_STATE = 42
TEST_SIZE = 0.20

# Thresholds matching the tuned staged hybrid
BASELINE_LOW = 20
BASELINE_HIGH = 65
ENHANCED_THRESH = 45

# ============================================================================
# METRICS HELPER
# ============================================================================

def compute_metrics(y_true, y_pred):
    tp = int(((y_true == 1) & (y_pred == 1)).sum())
    tn = int(((y_true == 0) & (y_pred == 0)).sum())
    fp = int(((y_true == 0) & (y_pred == 1)).sum())
    fn = int(((y_true == 1) & (y_pred == 0)).sum())

    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0
    accuracy = (tp + tn) / (tp + tn + fp + fn)
    fpr = fp / (fp + tn) if (fp + tn) > 0 else 0.0
    fnr = fn / (fn + tp) if (fn + tp) > 0 else 0.0

    return {
        "accuracy": round(float(accuracy), 6),
        "precision": round(float(precision), 6),
        "recall": round(float(recall), 6),
        "f1": round(float(f1), 6),
        "fpr": round(float(fpr), 6),
        "fnr": round(float(fnr), 6),
        "confusion_matrix": {"tp": tp, "tn": tn, "fp": fp, "fn": fn},
        "missed_laundering": fn,
        "total_laundering": int((y_true == 1).sum()),
        "total_legitimate": int((y_true == 0).sum()),
        "false_positives": fp,
        "cases_created": tp + fp,
    }


# ============================================================================
# MAIN
# ============================================================================

def main():
    print("=" * 70)
    print("END-TO-END EVALUATION: TUNED STAGED HYBRID (20/65/45)")
    print("=" * 70)

    # Load temporal-corrected dataset
    print("\nLoading temporal-corrected dataset...")
    df = pd.read_csv(DATA_PATH)

    for col in ["amount_received", "amount_paid", "complaint_count",
                "high_severity_complaints", "outgoing_connections",
                "incoming_connections", "account_age_days"]:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    df = df.dropna(subset=["amount_received", "amount_paid", "payment_format",
                            "receiving_currency", "payment_currency", "is_laundering"])

    print(f"Dataset rows after cleaning: {len(df)}")

    # Reconstruct the same train/test split used during training
    feature_cols = ["amount_received", "amount_paid", "payment_format",
                    "receiving_currency", "payment_currency",
                    "kyc_country", "kyc_occupation", "kyc_status", "kyc_risk_rating",
                    "complaint_count", "high_severity_complaints",
                    "outgoing_connections", "incoming_connections", "account_age_days"]
    X = df[feature_cols]
    y = df["is_laundering"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=TEST_SIZE, random_state=RANDOM_STATE, stratify=y
    )

    # Keep original indices to look up timestamps and account info
    test_indices = X_test.index
    test_df = df.loc[test_indices].reset_index(drop=True)

    print(f"Test set: {len(test_df)} transactions")
    print(f"Test laundering: {test_df['is_laundering'].sum()} / {len(test_df)}")

    # Warm up models (first call loads from disk)
    print("\nWarming up models...")
    warmup_txn = {
        "transaction_id": "WARMUP",
        "amount_received": 1000,
        "amount_paid": 1000,
        "payment_format": "wire",
        "receiving_currency": "USD",
        "payment_currency": "USD",
        "timestamp": datetime(2022, 9, 1),
    }
    score_transaction(warmup_txn, account_id="test", from_bank_id="1")
    print("Models loaded.")

    # ========================================================================
    # Run end-to-end routing on test set
    # ========================================================================
    print(f"\nRunning end-to-end routing on {len(X_test)} transactions...")
    print(f"Thresholds: baseline_low={BASELINE_LOW}, baseline_high={BASELINE_HIGH}, enhanced_thresh={ENHANCED_THRESH}")

    start_time = time.time()
    predictions = []
    cases_created = 0
    agent_invocations = 0
    errors = 0

    for idx, (_, row) in enumerate(test_df.iterrows()):
        if idx % 2000 == 0:
            elapsed = time.time() - start_time
            print(f"  Processed {idx}/{len(test_df)} ({elapsed:.1f}s)")

        txn = {
            "transaction_id": f"TXN-{idx}",
            "amount_received": float(row["amount_received"]),
            "amount_paid": float(row["amount_paid"]),
            "payment_format": str(row["payment_format"]),
            "receiving_currency": str(row["receiving_currency"]),
            "payment_currency": str(row["payment_currency"]),
            "timestamp": pd.to_datetime(row["timestamp"]),
        }

        account_id = str(row["from_account_id"])
        from_bank_id = str(row["from_bank_id"])

        try:
            ml_output = score_transaction(txn, account_id=account_id, from_bank_id=from_bank_id)
            if ml_output is None:
                predictions.append(0)
                continue

            baseline_score = ml_output.get("baseline_score")
            final_score = ml_output["risk_score"]

            # Exact routing logic from _run_ml_scoring_and_investigate()
            if baseline_score is not None:
                if baseline_score >= BASELINE_HIGH:
                    predictions.append(1)
                    cases_created += 1
                    agent_invocations += 1
                elif baseline_score < BASELINE_LOW:
                    predictions.append(0)
                else:
                    if final_score >= ENHANCED_THRESH:
                        predictions.append(1)
                        cases_created += 1
                        agent_invocations += 1
                    else:
                        predictions.append(0)
            else:
                if final_score >= 50:
                    predictions.append(1)
                    cases_created += 1
                    agent_invocations += 1
                else:
                    predictions.append(0)

        except Exception as e:
            errors += 1
            predictions.append(0)
            if errors <= 5:
                print(f"  ERROR at idx {idx}: {e}")

    elapsed = time.time() - start_time
    print(f"\nCompleted in {elapsed:.1f}s")
    print(f"Errors: {errors}")

    # ========================================================================
    # Compute metrics
    # ========================================================================
    y_true = test_df["is_laundering"].values
    y_pred = np.array(predictions)

    metrics = compute_metrics(y_true, y_pred)

    print("\n" + "=" * 70)
    print("END-TO-END METRICS (20/65/45 TUNED STAGED HYBRID)")
    print("=" * 70)
    print(f"Accuracy:            {metrics['accuracy']:.4f}")
    print(f"Precision:           {metrics['precision']:.4f}")
    print(f"Recall:              {metrics['recall']:.4f}")
    print(f"F1 Score:            {metrics['f1']:.4f}")
    print(f"FPR:                 {metrics['fpr']:.4f}")
    print(f"FNR:                 {metrics['fnr']:.4f}")
    print(f"Missed Laundering:   {metrics['missed_laundering']} / {metrics['total_laundering']}")
    print(f"False Positives:     {metrics['false_positives']} / {metrics['total_legitimate']}")
    print(f"Cases Created:       {metrics['cases_created']}")
    print(f"Agent Invocations:   {agent_invocations}")
    print(f"Confusion Matrix:    {metrics['confusion_matrix']}")

    # ========================================================================
    # Compare to offline evaluation
    # ========================================================================
    print("\n" + "=" * 70)
    print("COMPARISON TO OFFLINE EVALUATION")
    print("=" * 70)

    offline = {
        "accuracy": 0.95305,
        "precision": 0.538772,
        "recall": 0.644444,
        "f1": 0.586890,
        "fpr": 0.030108,
        "fnr": 0.355556,
        "missed_laundering": 368,
    }

    comparison = []
    for key in ["accuracy", "precision", "recall", "f1", "fpr", "fnr", "missed_laundering"]:
        impl_val = metrics[key]
        off_val = offline[key]
        diff = impl_val - off_val
        match = "MATCH" if abs(diff) < 0.01 else "MISMATCH"
        comparison.append({
            "metric": key,
            "offline": off_val,
            "implementation": impl_val,
            "diff": round(diff, 4),
            "status": match,
        })

    comp_df = pd.DataFrame(comparison)
    print(comp_df.to_string(index=False))

    # ========================================================================
    # Save results
    # ========================================================================
    output = {
        "timestamp": datetime.utcnow().isoformat(),
        "thresholds": {
            "baseline_low": BASELINE_LOW,
            "baseline_high": BASELINE_HIGH,
            "enhanced_thresh": ENHANCED_THRESH,
        },
        "metrics": metrics,
        "cases_created": cases_created,
        "agent_invocations": agent_invocations,
        "errors": errors,
        "elapsed_seconds": round(elapsed, 2),
        "offline_comparison": comparison,
    }

    output_path = RESULTS_DIR / "end_to_end_evaluation_tuned.json"
    with open(output_path, "w") as f:
        json.dump(output, f, indent=2, default=str)

    print(f"\nResults saved to: {output_path}")

    # Check for significant discrepancies
    mismatches = [c for c in comparison if c["status"] == "MISMATCH"]
    if mismatches:
        print("\nWARNING: Significant discrepancies detected!")
        for m in mismatches:
            print(f"  {m['metric']}: offline={m['offline']}, impl={m['implementation']}, diff={m['diff']}")
    else:
        print("\nAll metrics within expected tolerance (+/- 0.01).")


if __name__ == "__main__":
    main()
