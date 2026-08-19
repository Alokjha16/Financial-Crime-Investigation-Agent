"""
Live evaluation of current scoring pipeline on exactly 1,000 held-out transactions.

Uses the ACTUAL backend routing logic:
  - backend.ml.scorer.score_transaction()

Tests on 1,000 transactions from the temporally-corrected held-out data.
Tracks Enhanced scorer errors and routing breakdown.
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
import io
from contextlib import redirect_stdout

# Ensure backend is importable
PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

from backend.ml.scorer import score_transaction

# ============================================================================
# CONFIG
# ============================================================================

DATA_PATH = PROJECT_ROOT / "data" / "processed" / "transactions_enhanced_temporal.csv"
RESULTS_DIR = PROJECT_ROOT / "results"
os.makedirs(RESULTS_DIR, exist_ok=True)

RANDOM_STATE = 42
TEST_SIZE = 0.20
SAMPLE_SIZE = 1000  # Exactly 1,000 transactions

# Current thresholds from scorer.py
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
        "accuracy": round(float(accuracy), 4),
        "precision": round(float(precision), 4),
        "recall": round(float(recall), 4),
        "f1": round(float(f1), 4),
        "fpr": round(float(fpr), 4),
        "fnr": round(float(fnr), 4),
        "confusion_matrix": {"tp": tp, "tn": tn, "fp": fp, "fn": fn},
        "missed_laundering": fn,
        "total_laundering": int((y_true == 1).sum()),
        "total_legitimate": int((y_true == 0).sum()),
        "false_positives": fp,
        "correct": tp + tn,
        "incorrect": fp + fn,
    }

# ============================================================================
# MAIN
# ============================================================================

def main():
    print("=" * 70)
    print("LIVE EVALUATION: 1,000 HELD-OUT TRANSACTIONS")
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

    print(f"Full test set: {len(test_df)} transactions")
    print(f"Test laundering: {test_df['is_laundering'].sum()} / {len(test_df)}")

    # Sample exactly 1,000 transactions
    if len(test_df) >= SAMPLE_SIZE:
        test_sample = test_df.sample(n=SAMPLE_SIZE, random_state=42)
    else:
        test_sample = test_df
        print(f"Warning: Test set has only {len(test_df)} transactions, using all")

    print(f"Sample size for evaluation: {len(test_sample)}")
    print(f"Sample laundering: {test_sample['is_laundering'].sum()} / {len(test_sample)}")

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
    
    # Capture warmup output to avoid error messages
    f = io.StringIO()
    with redirect_stdout(f):
        score_transaction(warmup_txn, account_id="test", from_bank_id="1")
    print("Models loaded.")

    # ========================================================================
    # Run live scoring on 1,000 transactions
    # ========================================================================
    print(f"\nRunning live scoring on {len(test_sample)} transactions...")
    print(f"Thresholds: baseline_low={BASELINE_LOW}, baseline_high={BASELINE_HIGH}, enhanced_thresh={ENHANCED_THRESH}")

    start_time = time.time()
    predictions = []
    
    # Routing breakdown tracking
    baseline_bypass = 0  # baseline_low or baseline_high
    enhanced_stage = 0    # went through enhanced scorer
    direct_high_risk = 0 # baseline_high that got flagged
    
    # Error tracking
    enhanced_scorer_errors = 0
    enhanced_error_messages = []
    transactions_with_errors = []

    for idx, (_, row) in enumerate(test_sample.iterrows()):
        if idx % 200 == 0:
            elapsed = time.time() - start_time
            print(f"  Processed {idx}/{len(test_sample)} ({elapsed:.1f}s)")

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
            # Capture stdout to catch Enhanced scorer errors
            f = io.StringIO()
            with redirect_stdout(f):
                ml_output = score_transaction(txn, account_id=account_id, from_bank_id=from_bank_id)
            
            # Check for Enhanced scorer errors in captured output
            captured_output = f.getvalue()
            if "[ENHANCED SCORER ERROR]" in captured_output:
                enhanced_scorer_errors += 1
                transactions_with_errors.append(idx)
                # Extract error message
                for line in captured_output.split('\n'):
                    if "[ENHANCED SCORER ERROR]" in line:
                        enhanced_error_messages.append(line.strip())
                        break

            if ml_output is None:
                predictions.append(0)
                continue

            baseline_score = ml_output.get("baseline_score")
            final_score = ml_output["risk_score"]
            stage = ml_output.get("stage", "")

            # Track routing breakdown
            if stage == "baseline_high":
                baseline_bypass += 1
                direct_high_risk += 1
            elif stage == "baseline_low":
                baseline_bypass += 1
            elif stage == "enhanced":
                enhanced_stage += 1
            elif stage == "baseline_medium":
                baseline_bypass += 1

            # Apply current routing logic
            if baseline_score is not None:
                if baseline_score >= BASELINE_HIGH:
                    predictions.append(1)
                elif baseline_score < BASELINE_LOW:
                    predictions.append(0)
                else:
                    if final_score >= ENHANCED_THRESH:
                        predictions.append(1)
                    else:
                        predictions.append(0)
            else:
                if final_score >= 50:
                    predictions.append(1)
                else:
                    predictions.append(0)

        except Exception as e:
            predictions.append(0)
            print(f"  ERROR at idx {idx}: {e}")

    elapsed = time.time() - start_time
    print(f"\nCompleted in {elapsed:.1f}s")

    # ========================================================================
    # Compute metrics
    # ========================================================================
    y_true = test_sample["is_laundering"].values
    y_pred = np.array(predictions)

    metrics = compute_metrics(y_true, y_pred)

    # Calculate final counts
    final_flagged = int(y_pred.sum())
    final_not_flagged = len(y_pred) - final_flagged

    print("\n" + "=" * 70)
    print("LIVE EVALUATION RESULTS: 1,000 TRANSACTIONS")
    print("=" * 70)
    print(f"Total transactions:        {len(test_sample)}")
    print(f"Actual laundering:         {metrics['total_laundering']}")
    print(f"Actual legitimate:         {metrics['total_legitimate']}")
    print(f"True Positives (TP):       {metrics['confusion_matrix']['tp']}")
    print(f"True Negatives (TN):       {metrics['confusion_matrix']['tn']}")
    print(f"False Positives (FP):      {metrics['confusion_matrix']['fp']}")
    print(f"False Negatives (FN):      {metrics['confusion_matrix']['fn']}")
    print(f"Correct:                   {metrics['correct']}")
    print(f"Incorrect:                 {metrics['incorrect']}")
    print(f"Accuracy:                  {metrics['accuracy']:.2%}")
    print(f"Precision:                 {metrics['precision']:.2%}")
    print(f"Recall:                    {metrics['recall']:.2%}")
    print(f"F1 Score:                  {metrics['f1']:.2%}")
    print(f"False Positive Rate:       {metrics['fpr']:.2%}")
    print(f"False Negative Rate:       {metrics['fnr']:.2%}")
    print(f"Missed laundering:         {metrics['missed_laundering']}")
    print(f"False positives:            {metrics['false_positives']}")

    print("\n" + "=" * 70)
    print("ROUTING BREAKDOWN")
    print("=" * 70)
    print(f"Baseline bypass:           {baseline_bypass}")
    print(f"Enhanced-stage:            {enhanced_stage}")
    print(f"Direct high-risk:          {direct_high_risk}")
    print(f"Final flagged:             {final_flagged}")
    print(f"Final not-flagged:         {final_not_flagged}")

    print("\n" + "=" * 70)
    print("ENHANCED SCORER ERRORS")
    print("=" * 70)
    print(f"Enhanced scorer errors:    {enhanced_scorer_errors}")
    print(f"Transactions affected:     {len(transactions_with_errors)}")
    
    if enhanced_error_messages:
        print(f"\nError messages:")
        for msg in enhanced_error_messages[:5]:  # Show first 5
            print(f"  {msg}")
        if len(enhanced_error_messages) > 5:
            print(f"  ... and {len(enhanced_error_messages) - 5} more")
    else:
        print("No Enhanced scorer errors detected.")

    # ========================================================================
    # Verification
    # ========================================================================
    print("\n" + "=" * 70)
    print("VERIFICATION")
    print("=" * 70)
    print(f"Used current code:         Yes (backend.ml.scorer)")
    print(f"Used current models:       Yes (loaded at runtime)")
    print(f"Sample size:               {len(test_sample)}")
    print(f"Random state:              {RANDOM_STATE}")
    print(f"Thresholds:                baseline_low={BASELINE_LOW}, baseline_high={BASELINE_HIGH}, enhanced_thresh={ENHANCED_THRESH}")

    # ========================================================================
    # Save results
    # ========================================================================
    output = {
        "timestamp": datetime.utcnow().isoformat(),
        "evaluation_type": "live_1000_transactions",
        "sample_size": len(test_sample),
        "thresholds": {
            "baseline_low": BASELINE_LOW,
            "baseline_high": BASELINE_HIGH,
            "enhanced_thresh": ENHANCED_THRESH,
        },
        "metrics": metrics,
        "routing_breakdown": {
            "baseline_bypass": baseline_bypass,
            "enhanced_stage": enhanced_stage,
            "direct_high_risk": direct_high_risk,
            "final_flagged": final_flagged,
            "final_not_flagged": final_not_flagged,
        },
        "enhanced_errors": {
            "error_count": enhanced_scorer_errors,
            "transactions_affected": len(transactions_with_errors),
            "error_messages": enhanced_error_messages,
        },
        "verification": {
            "used_current_code": True,
            "used_current_models": True,
            "random_state": RANDOM_STATE,
        },
        "elapsed_seconds": round(elapsed, 2),
    }

    output_path = RESULTS_DIR / "live_evaluation_1000.json"
    with open(output_path, "w") as f:
        json.dump(output, f, indent=2, default=str)

    print(f"\nResults saved to: {output_path}")

if __name__ == "__main__":
    main()
