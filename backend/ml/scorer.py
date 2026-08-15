import os
from typing import Dict, Any, Optional
import joblib
import pandas as pd
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
MODEL_PATH = PROJECT_ROOT / "models" / "baseline_fraud_model.joblib"

_model = None


def get_model():
    global _model
    if _model is None:
        if not MODEL_PATH.exists():
            raise FileNotFoundError(f"ML model not found: {MODEL_PATH}")
        _model = joblib.load(MODEL_PATH)
    return _model


FEATURES = [
    "amount_received",
    "amount_paid",
    "payment_format",
    "receiving_currency",
    "payment_currency",
]


def score_transaction(transaction: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    try:
        model = get_model()

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
        if transaction.get("amount_paid", 0) > 100000:
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
        }

    except Exception as e:
        print(f"[ML SCORER ERROR] {e}")
        return None
