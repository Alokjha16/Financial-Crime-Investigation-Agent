import joblib
import pandas as pd

MODEL_PATH = "models/baseline_fraud_model.joblib"
DATA_PATH = "data/processed/transactions_ml.csv"

print("Loading model...")
model = joblib.load(MODEL_PATH)

print("Loading transactions...")
df = pd.read_csv(DATA_PATH)

features = [
    "amount_received",
    "amount_paid",
    "payment_format",
    "receiving_currency",
    "payment_currency"
]

# Take 20 real transactions
sample = df[features].head(20)

predictions = model.predict(sample)
probabilities = model.predict_proba(sample)[:, 1]

result = sample.copy()
result["predicted_laundering"] = predictions
result["risk_probability"] = probabilities

print("\n=== Model Predictions ===")
print(result.to_string(index=False))

print("\nPredicted suspicious transactions:",
      (predictions == 1).sum())

print("Predicted normal transactions:",
      (predictions == 0).sum())