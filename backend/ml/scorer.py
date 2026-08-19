from typing import Dict, Any, Optional
import joblib
import pandas as pd
from datetime import datetime
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
MODEL_PATHS = {
    "baseline": PROJECT_ROOT / "models" / "baseline_fraud_model_temporal.joblib",
    "enhanced": PROJECT_ROOT / "models" / "enhanced_fraud_model_temporal.joblib",
}
BASELINE_MODEL_PATH = MODEL_PATHS["baseline"]
ENHANCED_MODEL_PATH = MODEL_PATHS["enhanced"]

_baseline_model = None
_enhanced_model = None

# CSV data paths
TRANSACTIONS_ENHANCED_CSV = PROJECT_ROOT / "data" / "processed" / "transactions_enhanced_temporal.csv"
KYC_CSV = PROJECT_ROOT / "data" / "synthetic" / "kyc.csv"
COMPLAINTS_CSV = PROJECT_ROOT / "data" / "synthetic" / "complaints.csv"
RELATIONSHIPS_CSV = PROJECT_ROOT / "data" / "synthetic" / "account_relationships.csv"

# Cached dataframes
_enhanced_df: Optional[pd.DataFrame] = None
_kyc_df: Optional[pd.DataFrame] = None
_complaints_df: Optional[pd.DataFrame] = None
_relationships_df: Optional[pd.DataFrame] = None


def _load_csv(path: Path) -> Optional[pd.DataFrame]:
    if not path.exists():
        return None
    return pd.read_csv(path, dtype=str)


def _get_enhanced_df() -> Optional[pd.DataFrame]:
    global _enhanced_df
    if _enhanced_df is None:
        _enhanced_df = _load_csv(TRANSACTIONS_ENHANCED_CSV)
    return _enhanced_df


def _get_kyc_df() -> Optional[pd.DataFrame]:
    global _kyc_df
    if _kyc_df is None:
        _kyc_df = _load_csv(KYC_CSV)
    return _kyc_df


def _get_complaints_df() -> Optional[pd.DataFrame]:
    global _complaints_df
    if _complaints_df is None:
        _complaints_df = _load_csv(COMPLAINTS_CSV)
    return _complaints_df


def _get_relationships_df() -> Optional[pd.DataFrame]:
    global _relationships_df
    if _relationships_df is None:
        _relationships_df = _load_csv(RELATIONSHIPS_CSV)
    return _relationships_df


def _load_model(model_name: str):
    model_path = MODEL_PATHS[model_name]
    if not model_path.exists():
        raise FileNotFoundError(f"{model_name.title()} model not found: {model_path}")
    return joblib.load(model_path)


def get_baseline_model():
    global _baseline_model
    if _baseline_model is None:
        _baseline_model = _load_model("baseline")
    return _baseline_model


def get_enhanced_model():
    global _enhanced_model
    if _enhanced_model is None:
        _enhanced_model = _load_model("enhanced")
    return _enhanced_model


BASELINE_FEATURES = [
    "amount_received",
    "amount_paid",
    "payment_format",
    "receiving_currency",
    "payment_currency",
]

ENHANCED_FEATURES = [
    "amount_received",
    "amount_paid",
    "payment_format",
    "receiving_currency",
    "payment_currency",
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


def _coerce_timestamp(value: Optional[Any]) -> Optional[pd.Timestamp]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return pd.Timestamp(value)
    try:
        return pd.to_datetime(value)
    except Exception:
        return None


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        if pd.isna(value):
            return default
        return int(float(value))
    except (TypeError, ValueError):
        return default


def _select_temporal_enhanced_row(
    enhanced_df: pd.DataFrame,
    account_id: str,
    from_bank_id: str,
    txn_dt: Optional[pd.Timestamp],
) -> Optional[pd.Series]:
    matches = enhanced_df[
        (enhanced_df["from_bank_id"] == str(from_bank_id))
        & (enhanced_df["from_account_id"] == str(account_id))
    ]
    if matches.empty:
        return None

    if txn_dt is None or "timestamp" not in matches.columns:
        return matches.iloc[0]

    matches = matches.copy()
    matches["_txn_dt"] = pd.to_datetime(matches["timestamp"], errors="coerce")
    valid = matches[(matches["_txn_dt"].notna()) & (matches["_txn_dt"] <= txn_dt)]
    if valid.empty:
        return None
    return valid.sort_values("_txn_dt").iloc[-1]


def _extract_enhanced_row_features(row: pd.Series) -> Dict[str, Any]:
    return {
        "kyc_country": row.get("kyc_country", ""),
        "kyc_occupation": row.get("kyc_occupation", ""),
        "kyc_status": row.get("kyc_status", ""),
        "kyc_risk_rating": row.get("kyc_risk_rating", ""),
        "account_age_days": _safe_int(row.get("account_age_days"), default=365),
        "complaint_count": _safe_int(row.get("complaint_count"), default=0),
        "high_severity_complaints": _safe_int(row.get("high_severity_complaints"), default=0),
        "outgoing_connections": _safe_int(row.get("outgoing_connections"), default=0),
        "incoming_connections": _safe_int(row.get("incoming_connections"), default=0),
    }


def _lookup_enhanced_features(account_id: str, from_bank_id: str, transaction_timestamp: Optional[Any] = None) -> Optional[Dict[str, Any]]:
    try:
        txn_dt = _coerce_timestamp(transaction_timestamp)

        # Try enhanced transactions CSV first (fastest - direct column lookup)
        enhanced_df = _get_enhanced_df()
        if enhanced_df is not None:
            row = _select_temporal_enhanced_row(
                enhanced_df,
                account_id=account_id,
                from_bank_id=from_bank_id,
                txn_dt=txn_dt,
            )
            if row is not None:
                return _extract_enhanced_row_features(row)

        # Fallback: compute from individual CSVs with temporal bounds
        kyc_df = _get_kyc_df()
        complaints_df = _get_complaints_df()
        relationships_df = _get_relationships_df()

        kyc_row = None
        if kyc_df is not None:
            kyc_match = kyc_df[kyc_df["account_id"] == account_id]
            if not kyc_match.empty:
                if txn_dt is not None:
                    kyc_match = kyc_match.copy()
                    kyc_match["_kyc_verified_dt"] = pd.to_datetime(kyc_match["kyc_verified_date"], errors="coerce")
                    valid_kyc = kyc_match[kyc_match["_kyc_verified_dt"] <= txn_dt]
                    if not valid_kyc.empty:
                        kyc_row = valid_kyc.sort_values("_kyc_verified_dt").iloc[-1]
                else:
                    kyc_row = kyc_match.iloc[0]

        complaint_count = 0
        high_severity_complaints = 0
        if complaints_df is not None:
            acc_complaints = complaints_df[complaints_df["account_id"] == account_id]
            if txn_dt is not None and not acc_complaints.empty:
                acc_complaints = acc_complaints.copy()
                acc_complaints["_complaint_dt"] = pd.to_datetime(acc_complaints["complaint_date"], errors="coerce")
                valid_complaints = acc_complaints[acc_complaints["_complaint_dt"] <= txn_dt]
                complaint_count = len(valid_complaints)
                high_severity_complaints = int((valid_complaints["severity"].str.upper() == "HIGH").sum())
            else:
                complaint_count = len(acc_complaints)
                high_severity_complaints = int((acc_complaints["severity"].str.upper() == "HIGH").sum())

        outgoing = 0
        incoming = 0
        if relationships_df is not None:
            rels = relationships_df.copy()
            if txn_dt is not None:
                rels["_rel_start_dt"] = pd.to_datetime(rels["relationship_start_date"], errors="coerce")
                outgoing = int(len(rels[(rels["account_id"] == account_id) & (rels["_rel_start_dt"] <= txn_dt)]))
                incoming = int(len(rels[(rels["connected_account_id"] == account_id) & (rels["_rel_start_dt"] <= txn_dt)]))
            else:
                outgoing = int(len(rels[rels["account_id"] == account_id]))
                incoming = int(len(rels[rels["connected_account_id"] == account_id]))

        account_age_days = 365
        if kyc_row is not None:
            open_date = kyc_row.get("account_open_date") or kyc_row.get("kyc_verified_date")
            if pd.notna(open_date) and open_date:
                try:
                    open_dt = pd.to_datetime(open_date)
                    if txn_dt is not None:
                        account_age_days = (txn_dt - open_dt).days
                    else:
                        account_age_days = (datetime.now() - open_dt).days
                except Exception:
                    pass

        return {
            "kyc_country": kyc_row.get("country", "") if kyc_row is not None else "",
            "kyc_occupation": kyc_row.get("occupation", "") if kyc_row is not None else "",
            "kyc_status": kyc_row.get("kyc_status", "") if kyc_row is not None else "",
            "kyc_risk_rating": kyc_row.get("risk_rating", "") if kyc_row is not None else "",
            "account_age_days": _safe_int(account_age_days, default=365),
            "complaint_count": _safe_int(complaint_count, default=0),
            "high_severity_complaints": _safe_int(high_severity_complaints, default=0),
            "outgoing_connections": _safe_int(outgoing, default=0),
            "incoming_connections": _safe_int(incoming, default=0),
        }

    except Exception as e:
        print(f"[ENHANCED FEATURE LOOKUP ERROR] {e}")
        return None


def score_baseline(transaction: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    try:
        model = get_baseline_model()

        df = pd.DataFrame([{
            "amount_received": transaction.get("amount_received", 0),
            "amount_paid": transaction.get("amount_paid", 0),
            "payment_format": transaction.get("payment_format", ""),
            "receiving_currency": transaction.get("receiving_currency", ""),
            "payment_currency": transaction.get("payment_currency", ""),
        }])

        prediction = model.predict(df)[0]
        probability = float(model.predict_proba(df)[0][1])
        risk_score = int(round(probability * 100))

        if risk_score >= 75:
            risk_level = "HIGH"
        elif risk_score >= 40:
            risk_level = "MEDIUM"
        else:
            risk_level = "LOW"

        top_factors = []
        if probability >= 0.7:
            top_factors.append("high_fraud_probability")
        if _safe_int(transaction.get("amount_paid", 0), default=0) > 100000:
            top_factors.append("high_value_transaction")
        if transaction.get("payment_format") in ["wire", "cheque"]:
            top_factors.append("high_risk_payment_format")
        if not top_factors:
            top_factors.append("ml_model_detection")

        return {
            "transaction_id": transaction.get("transaction_id"),
            "fraud_probability": probability,
            "risk_score": risk_score,
            "risk_level": risk_level,
            "top_factors": top_factors,
            "prediction": int(prediction),
            "model": "baseline",
        }

    except Exception as e:
        print(f"[BASELINE SCORER ERROR] {e}")
        return None


def score_enhanced(transaction: Dict[str, Any], account_id: str, from_bank_id: str) -> Optional[Dict[str, Any]]:
    try:
        model = get_enhanced_model()
        features = _lookup_enhanced_features(account_id, from_bank_id, transaction.get("timestamp"))
        if features is None:
            return None

        df = pd.DataFrame([{
            "amount_received": transaction.get("amount_received", 0),
            "amount_paid": transaction.get("amount_paid", 0),
            "payment_format": transaction.get("payment_format", ""),
            "receiving_currency": transaction.get("receiving_currency", ""),
            "payment_currency": transaction.get("payment_currency", ""),
            **features,
        }])

        # Ensure all required columns exist
        for col in ENHANCED_FEATURES:
            if col not in df.columns:
                df[col] = ""

        # Convert all numeric columns to proper types before model prediction
        numeric_cols = ["amount_received", "amount_paid", "complaint_count", 
                       "high_severity_complaints", "outgoing_connections", 
                       "incoming_connections", "account_age_days"]
        for col in numeric_cols:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

        prediction = model.predict(df)[0]
        probability = float(model.predict_proba(df)[0][1])
        risk_score = int(round(probability * 100))

        if risk_score >= 75:
            risk_level = "HIGH"
        elif risk_score >= 40:
            risk_level = "MEDIUM"
        else:
            risk_level = "LOW"

        top_factors = []
        if probability >= 0.7:
            top_factors.append("high_fraud_probability")
        if transaction.get("amount_paid", 0) > 100000:
            top_factors.append("high_value_transaction")
        if features.get("kyc_status", "").upper() in ["INCOMPLETE", "PENDING"]:
            top_factors.append("incomplete_kyc")
        if features.get("complaint_count", 0) > 0:
            top_factors.append("has_complaints")
        if features.get("account_age_days", 365) < 30:
            top_factors.append("new_account")
        if not top_factors:
            top_factors.append("ml_model_detection")

        return {
            "transaction_id": transaction.get("transaction_id"),
            "fraud_probability": probability,
            "risk_score": risk_score,
            "risk_level": risk_level,
            "top_factors": top_factors,
            "prediction": int(prediction),
            "model": "enhanced",
            "features_used": features,
        }

    except Exception as e:
        print(f"[ENHANCED SCORER ERROR] {e}")
        return None


def score_transaction(transaction: Dict[str, Any], account_id: Optional[str] = None, from_bank_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
    try:
        baseline_result = score_baseline(transaction)
        if baseline_result is None:
            return None

        baseline_score = baseline_result["risk_score"]

        if baseline_score >= 65:
            baseline_result["stage"] = "baseline_high"
            return baseline_result

        if baseline_score < 20:
            baseline_result["stage"] = "baseline_low"
            return baseline_result

        if account_id and from_bank_id:
            enhanced_result = score_enhanced(transaction, account_id, from_bank_id)
            if enhanced_result is not None:
                enhanced_result["baseline_score"] = baseline_score
                enhanced_result["stage"] = "enhanced"
                return enhanced_result

        baseline_result["stage"] = "baseline_medium"
        return baseline_result

    except Exception as e:
        print(f"[ML SCORER ERROR] {e}")
        return None
