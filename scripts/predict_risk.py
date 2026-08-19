import joblib
import pandas as pd

MODEL_PATH = "models/baseline_fraud_model.joblib"

print("Loading baseline fraud model...")
model = joblib.load(MODEL_PATH)

# Example transaction
transaction = pd.DataFrame([{
    "amount_received": 15000.0,
    "amount_paid": 15000.0,
    "payment_format": "ACH",
    "receiving_currency": "US Dollar",
    "payment_currency": "US Dollar"
}])

# Predict
prediction = model.predict(transaction)[0]
probability = model.predict_proba(transaction)[0][1]

print("\n=== Fraud / Money Laundering Risk ===")

if prediction == 1:
    print("Prediction: HIGH RISK / SUSPICIOUS")
else:
    print("Prediction: LOW RISK")

print(f"Risk Probability: {probability:.4f}")
print(f"Risk Percentage: {probability * 100:.2f}%")