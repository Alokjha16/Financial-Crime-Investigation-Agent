"""
Comprehensive evaluation of Baseline vs Enhanced Temporal models
with threshold sweeps and architecture comparison.

Reconstructs train/test splits exactly as used during training:
  train_test_split(test_size=0.2, random_state=42, stratify=y)

Evaluates:
1. Baseline alone
2. Enhanced temporal alone
3. Current staged hybrid
4. Ensemble: max(baseline, enhanced)
5. Weighted ensemble
6. 3-tier CLEAR/REVIEW/ESCALATE

Metrics:
- Accuracy, Precision, Recall, F1, FPR, FNR
- Missed laundering count
- Per-tier classification accuracy
"""

import os
import json
import joblib
import pandas as pd
import numpy as np

from sklearn.model_selection import train_test_split
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder
from sklearn.pipeline import Pipeline
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    roc_auc_score,
    precision_recall_curve,
)

# ============================================================================
# CONFIG
# ============================================================================

DATA_PATH = "data/processed/transactions_enhanced_temporal.csv"
BASELINE_MODEL_DIR = "models"
ENHANCED_MODEL_DIR = "models"
RESULTS_DIR = "results"
os.makedirs(RESULTS_DIR, exist_ok=True)

RANDOM_STATE = 42
TEST_SIZE = 0.20

# ============================================================================
# FEATURES
# ============================================================================

BASELINE_FEATURES = [
    "amount_received",
    "amount_paid",
    "payment_format",
    "receiving_currency",
    "payment_currency",
]

ENHANCED_FEATURES = BASELINE_FEATURES + [
    "kyc_country",
    "kyc_occupation",
    "kyc_status",
    "kyc_risk_rating",
    "complaint_count",
    "high_severity_complaints",
    "outgoing_connections",
    "incoming_connections",
    "account_age_days",
]

NUMERIC_BASE = ["amount_received", "amount_paid"]
CATEGORICAL_BASE = ["payment_format", "receiving_currency", "payment_currency"]

NUMERIC_ENHANCED = NUMERIC_BASE + [
    "complaint_count",
    "high_severity_complaints",
    "outgoing_connections",
    "incoming_connections",
    "account_age_days",
]

CATEGORICAL_ENHANCED = CATEGORICAL_BASE + [
    "kyc_country",
    "kyc_occupation",
    "kyc_status",
    "kyc_risk_rating",
]

TARGET = "is_laundering"

# ============================================================================
# HELPER: build pipeline
# ============================================================================

def build_pipeline(numeric_features, categorical_features):
    preprocessor = ColumnTransformer(
        transformers=[
            ("num", "passthrough", numeric_features),
            (
                "cat",
                OneHotEncoder(handle_unknown="ignore", sparse_output=False),
                categorical_features,
            ),
        ]
    )
    model = RandomForestClassifier(
        n_estimators=100,
        random_state=RANDOM_STATE,
        class_weight="balanced",
        n_jobs=-1,
    )
    return Pipeline(steps=[("preprocessor", preprocessor), ("model", model)])


# ============================================================================
# HELPER: metrics
# ============================================================================

def compute_metrics(y_true, y_pred, y_prob=None):
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

    result = {
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
    }

    if y_prob is not None:
        try:
            result["roc_auc"] = round(float(roc_auc_score(y_true, y_prob)), 6)
        except Exception:
            result["roc_auc"] = None
    else:
        result["roc_auc"] = None

    return result


# ============================================================================
# MAIN
# ============================================================================

def main():
    print("Loading temporal-corrected dataset...")
    df = pd.read_csv(DATA_PATH)

    # Ensure numeric types
    for col in ["amount_received", "amount_paid", "complaint_count",
                "high_severity_complaints", "outgoing_connections",
                "incoming_connections", "account_age_days"]:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    # Drop rows with missing critical features
    df = df.dropna(subset=BASELINE_FEATURES + ["is_laundering"])

    print(f"Dataset rows after cleaning: {len(df)}")
    print(f"Laundering rate: {df[TARGET].mean():.4f}")

    # ========================================================================
    # Train/test split (same for all models for fair comparison)
    # ========================================================================
    X = df[ENHANCED_FEATURES]  # superset
    y = df[TARGET]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=TEST_SIZE, random_state=RANDOM_STATE, stratify=y
    )

    print(f"\nTrain: {len(X_train)}, Test: {len(X_test)}")
    print(f"Test laundering: {y_test.sum()} / {len(y_test)}")

    # ========================================================================
    # 1. Train Baseline model on temporal data
    # ========================================================================
    print("\n" + "=" * 70)
    print("1. TRAINING BASELINE MODEL ON TEMPORAL DATA")
    print("=" * 70)

    X_train_base = X_train[BASELINE_FEATURES]
    X_test_base = X_test[BASELINE_FEATURES]

    baseline_pipeline = build_pipeline(NUMERIC_BASE, CATEGORICAL_BASE)
    baseline_pipeline.fit(X_train_base, y_train)

    base_pred = baseline_pipeline.predict(X_test_base)
    base_prob = baseline_pipeline.predict_proba(X_test_base)[:, 1]

    baseline_metrics = compute_metrics(y_test.values, base_pred, base_prob)
    print("\nBaseline metrics on temporal held-out data:")
    for k, v in baseline_metrics.items():
        if k != "confusion_matrix":
            print(f"  {k}: {v}")
    print(f"  confusion_matrix: {baseline_metrics['confusion_matrix']}")

    baseline_model_path = os.path.join(BASELINE_MODEL_DIR, "baseline_fraud_model_temporal.joblib")
    joblib.dump(baseline_pipeline, baseline_model_path)
    print(f"\nSaved: {baseline_model_path}")

    # ========================================================================
    # 2. Train Enhanced Temporal model
    # ========================================================================
    print("\n" + "=" * 70)
    print("2. TRAINING ENHANCED TEMPORAL MODEL")
    print("=" * 70)

    X_train_enh = X_train[ENHANCED_FEATURES]
    X_test_enh = X_test[ENHANCED_FEATURES]

    enhanced_pipeline = build_pipeline(NUMERIC_ENHANCED, CATEGORICAL_ENHANCED)
    enhanced_pipeline.fit(X_train_enh, y_train)

    enh_pred = enhanced_pipeline.predict(X_test_enh)
    enh_prob = enhanced_pipeline.predict_proba(X_test_enh)[:, 1]

    enhanced_metrics = compute_metrics(y_test.values, enh_pred, enh_prob)
    print("\nEnhanced temporal metrics on held-out data:")
    for k, v in enhanced_metrics.items():
        if k != "confusion_matrix":
            print(f"  {k}: {v}")
    print(f"  confusion_matrix: {enhanced_metrics['confusion_matrix']}")

    enhanced_model_path = os.path.join(ENHANCED_MODEL_DIR, "enhanced_fraud_model_temporal.joblib")
    joblib.dump(enhanced_pipeline, enhanced_model_path)
    print(f"\nSaved: {enhanced_model_path}")

    # ========================================================================
    # 3. Build hybrid scores DataFrame
    # ========================================================================
    print("\n" + "=" * 70)
    print("3. BUILDING HYBRID SCORES")
    print("=" * 70)

    scores_df = pd.DataFrame({
        "y_true": y_test.values,
        "baseline_prob": base_prob,
        "baseline_score": (base_prob * 100).astype(int),
        "enhanced_prob": enh_prob,
        "enhanced_score": (enh_prob * 100).astype(int),
    })

    # ========================================================================
    # 4. Sweep thresholds
    # ========================================================================
    print("\n" + "=" * 70)
    print("4. THRESHOLD SWEEP")
    print("=" * 70)

    baseline_thresholds = [20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75]
    enhanced_thresholds = [20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75]

    results = []

    # --- Current staged approach ---
    for b_low in [40]:
        for b_high in [75]:
            for e_thresh in [40]:
                preds = []
                for _, row in scores_df.iterrows():
                    b_score = row["baseline_score"]
                    if b_score >= b_high:
                        preds.append(1 if row["enhanced_score"] >= e_thresh else 0)
                    elif b_score < b_low:
                        preds.append(0)
                    else:
                        preds.append(1 if row["enhanced_score"] >= e_thresh else 0)
                m = compute_metrics(scores_df["y_true"].values, np.array(preds))
                m["strategy"] = "staged_current"
                m["baseline_low"] = b_low
                m["baseline_high"] = b_high
                m["enhanced_thresh"] = e_thresh
                results.append(m)

    # --- Staged with different thresholds ---
    for b_low in [20, 25, 30, 35, 40]:
        for b_high in [65, 70, 75]:
            for e_thresh in [35, 40, 45, 50]:
                preds = []
                for _, row in scores_df.iterrows():
                    b_score = row["baseline_score"]
                    if b_score >= b_high:
                        preds.append(1 if row["enhanced_score"] >= e_thresh else 0)
                    elif b_score < b_low:
                        preds.append(0)
                    else:
                        preds.append(1 if row["enhanced_score"] >= e_thresh else 0)
                m = compute_metrics(scores_df["y_true"].values, np.array(preds))
                m["strategy"] = "staged"
                m["baseline_low"] = b_low
                m["baseline_high"] = b_high
                m["enhanced_thresh"] = e_thresh
                results.append(m)

    # --- Ensemble: max ---
    for thresh in [30, 35, 40, 45, 50, 55]:
        preds = (scores_df[["baseline_score", "enhanced_score"]].max(axis=1) >= thresh).astype(int).values
        m = compute_metrics(scores_df["y_true"].values, preds)
        m["strategy"] = "ensemble_max"
        m["threshold"] = thresh
        results.append(m)

    # --- Ensemble: weighted 0.6*base + 0.4*enh ---
    for thresh in [30, 35, 40, 45, 50, 55]:
        combined = (0.6 * scores_df["baseline_score"] + 0.4 * scores_df["enhanced_score"])
        preds = (combined >= thresh).astype(int).values
        m = compute_metrics(scores_df["y_true"].values, preds)
        m["strategy"] = "ensemble_weighted"
        m["threshold"] = thresh
        results.append(m)

    # --- Baseline only (reference) ---
    for thresh in baseline_thresholds:
        preds = (scores_df["baseline_score"] >= thresh).astype(int).values
        m = compute_metrics(scores_df["y_true"].values, preds)
        m["strategy"] = "baseline_only"
        m["threshold"] = thresh
        results.append(m)

    # --- Enhanced only (reference) ---
    for thresh in enhanced_thresholds:
        preds = (scores_df["enhanced_score"] >= thresh).astype(int).values
        m = compute_metrics(scores_df["y_true"].values, preds)
        m["strategy"] = "enhanced_only"
        m["threshold"] = thresh
        results.append(m)

    results_df = pd.DataFrame(results)

    # ========================================================================
    # 5. Show top performers by recall (minimize missed laundering)
    # ========================================================================
    print("\nTop 10 by Recall (minimizing missed laundering):")
    top_recall = results_df.nlargest(10, "recall")[
        ["strategy", "baseline_low", "baseline_high", "enhanced_thresh", "threshold",
         "accuracy", "precision", "recall", "f1", "fpr", "fnr", "missed_laundering"]
    ]
    print(top_recall.to_string(index=False))

    print("\nTop 10 by F1 score:")
    top_f1 = results_df.nlargest(10, "f1")[
        ["strategy", "baseline_low", "baseline_high", "enhanced_thresh", "threshold",
         "accuracy", "precision", "recall", "f1", "fpr", "fnr", "missed_laundering"]
    ]
    print(top_f1.to_string(index=False))

    # ========================================================================
    # 6. 3-tier CLEAR/REVIEW/ESCALATE evaluation
    # ========================================================================
    print("\n" + "=" * 70)
    print("5. 3-TIER CLEAR/REVIEW/ESCALATE EVALUATION")
    print("=" * 70)

    tier_results = []
    for clear_max in [25, 30, 35, 40]:
        for escalate_min in [60, 65, 70, 75]:
            # Strategy: ensemble_max with 3-tier
            combined = scores_df[["baseline_score", "enhanced_score"]].max(axis=1)
            preds_tier = []
            for score in combined:
                if score < clear_max:
                    preds_tier.append(0)  # CLEAR -> not flagged
                elif score >= escalate_min:
                    preds_tier.append(2)  # ESCALATE -> flagged
                else:
                    preds_tier.append(1)  # REVIEW -> flagged but lower priority

            y_true = scores_df["y_true"].values
            tp = int(((y_true == 1) & (np.array(preds_tier) >= 1)).sum())
            tn = int(((y_true == 0) & (np.array(preds_tier) == 0)).sum())
            fp_clear = int(((y_true == 0) & (np.array(preds_tier) >= 1)).sum())
            fn = int(((y_true == 1) & (np.array(preds_tier) == 0)).sum())

            # Binary metrics for "flagged vs not flagged"
            accuracy = (tp + tn) / len(y_true)
            precision = tp / (tp + fp_clear) if (tp + fp_clear) > 0 else 0
            recall = tp / (tp + fn) if (tp + fn) > 0 else 0
            f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0
            fpr = fp_clear / (fp_clear + tn) if (fp_clear + tn) > 0 else 0
            fnr = fn / (fn + tp) if (fn + tp) > 0 else 0

            # Tier distribution
            clear_count = int((np.array(preds_tier) == 0).sum())
            review_count = int((np.array(preds_tier) == 1).sum())
            escalate_count = int((np.array(preds_tier) == 2).sum())

            # Of laundering, how many hit each tier?
            laundering_mask = y_true == 1
            l_clear = int((laundering_mask & (np.array(preds_tier) == 0)).sum())
            l_review = int((laundering_mask & (np.array(preds_tier) == 1)).sum())
            l_escalate = int((laundering_mask & (np.array(preds_tier) == 2)).sum())

            tier_results.append({
                "clear_max": clear_max,
                "escalate_min": escalate_min,
                "accuracy": round(accuracy, 4),
                "precision": round(precision, 4),
                "recall": round(recall, 4),
                "f1": round(f1, 4),
                "fpr": round(fpr, 4),
                "fnr": round(fnr, 4),
                "missed_laundering": fn,
                "clear_count": clear_count,
                "review_count": review_count,
                "escalate_count": escalate_count,
                "l_clear": l_clear,
                "l_review": l_review,
                "l_escalate": l_escalate,
            })

    tier_df = pd.DataFrame(tier_results)
    print("\nTop 10 3-tier configs by Recall:")
    print(tier_df.nlargest(10, "recall")[
        ["clear_max", "escalate_min", "accuracy", "precision", "recall", "f1",
         "fpr", "fnr", "missed_laundering", "clear_count", "review_count", "escalate_count",
         "l_clear", "l_review", "l_escalate"]
    ].to_string(index=False))

    # ========================================================================
    # 7. Current staged on same data (for comparison)
    # ========================================================================
    print("\n" + "=" * 70)
    print("6. CURRENT STAGED HYBRID vs ENSEMBLE vs BASELINE-ONLY")
    print("=" * 70)

    comparison = []

    # Current staged (baseline <40 → not flagged, 40-74 → enhanced >=40 flagged, >=75 → enhanced flagged)
    staged_preds = []
    for _, row in scores_df.iterrows():
        b = row["baseline_score"]
        e = row["enhanced_score"]
        if b < 40:
            staged_preds.append(0)
        elif b >= 75:
            staged_preds.append(1 if e >= 40 else 0)
        else:
            staged_preds.append(1 if e >= 40 else 0)
    m = compute_metrics(scores_df["y_true"].values, np.array(staged_preds))
    m["strategy"] = "current_staged_40_75_40"
    comparison.append(m)

    # Ensemble max at 40
    preds = (scores_df[["baseline_score", "enhanced_score"]].max(axis=1) >= 40).astype(int).values
    m = compute_metrics(scores_df["y_true"].values, preds)
    m["strategy"] = "ensemble_max_40"
    comparison.append(m)

    # Ensemble max at 35
    preds = (scores_df[["baseline_score", "enhanced_score"]].max(axis=1) >= 35).astype(int).values
    m = compute_metrics(scores_df["y_true"].values, preds)
    m["strategy"] = "ensemble_max_35"
    comparison.append(m)

    # Baseline only at 40
    preds = (scores_df["baseline_score"] >= 40).astype(int).values
    m = compute_metrics(scores_df["y_true"].values, preds)
    m["strategy"] = "baseline_only_40"
    comparison.append(m)

    # Enhanced only at 40
    preds = (scores_df["enhanced_score"] >= 40).astype(int).values
    m = compute_metrics(scores_df["y_true"].values, preds)
    m["strategy"] = "enhanced_only_40"
    comparison.append(m)

    comp_df = pd.DataFrame(comparison)
    print(comp_df[
        ["strategy", "accuracy", "precision", "recall", "f1", "fpr", "fnr", "missed_laundering"]
    ].to_string(index=False))

    # ========================================================================
    # 8. Save results
    # ========================================================================
    results_df.to_csv(os.path.join(RESULTS_DIR, "threshold_sweep_results.csv"), index=False)
    tier_df.to_csv(os.path.join(RESULTS_DIR, "tier_evaluation_results.csv"), index=False)
    comp_df.to_csv(os.path.join(RESULTS_DIR, "architecture_comparison.csv"), index=False)

    # Save top configs as JSON
    top_configs = {
        "best_recall": results_df.loc[results_df["recall"].idxmax()].to_dict(),
        "best_f1": results_df.loc[results_df["f1"].idxmax()].to_dict(),
        "best_3tier_recall": tier_df.loc[tier_df["recall"].idxmax()].to_dict(),
        "baseline_only_40": comp_df[comp_df["strategy"] == "baseline_only_40"].iloc[0].to_dict(),
        "current_staged": comp_df[comp_df["strategy"] == "current_staged_40_75_40"].iloc[0].to_dict(),
        "ensemble_max_40": comp_df[comp_df["strategy"] == "ensemble_max_40"].iloc[0].to_dict(),
    }

    with open(os.path.join(RESULTS_DIR, "top_configs.json"), "w") as f:
        json.dump(top_configs, f, indent=2, default=str)

    print("\n" + "=" * 70)
    print("RESULTS SAVED TO results/")
    print("=" * 70)


if __name__ == "__main__":
    main()
