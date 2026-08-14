import os
import pandas as pd
import joblib

from sklearn.model_selection import train_test_split
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder
from sklearn.pipeline import Pipeline
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score

DATA_PATH = "data/processed/transactions_enhanced.csv"
MODEL_DIR = "models"

os.makedirs(MODEL_DIR, exist_ok=True)

print("Loading enhanced dataset...")
df = pd.read_csv(DATA_PATH)

print("Rows:", len(df))
print("Columns:", len(df.columns))

target = "is_laundering"

# Features from transaction + KYC + complaints + relationships
features = [
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

    "account_age_days"
]

# Keep only required columns
df = df.dropna(subset=[target])

X = df[features]
y = df[target]

print("\nLabel distribution:")
print(y.value_counts())

numeric_features = [
    "amount_received",
    "amount_paid",
    "complaint_count",
    "high_severity_complaints",
    "outgoing_connections",
    "incoming_connections",
    "account_age_days"
]

categorical_features = [
    "payment_format",
    "receiving_currency",
    "payment_currency",
    "kyc_country",
    "kyc_occupation",
    "kyc_status",
    "kyc_risk_rating"
]

preprocessor = ColumnTransformer(
    transformers=[
        (
            "num",
            "passthrough",
            numeric_features
        ),
        (
            "cat",
            OneHotEncoder(handle_unknown="ignore"),
            categorical_features
        )
    ]
)

model = RandomForestClassifier(
    n_estimators=100,
    random_state=42,
    class_weight="balanced",
    n_jobs=-1
)

pipeline = Pipeline(
    steps=[
        ("preprocessor", preprocessor),
        ("model", model)
    ]
)

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42,
    stratify=y
)

print("\nTraining samples:", len(X_train))
print("Testing samples:", len(X_test))

print("\nTraining enhanced Random Forest...")
pipeline.fit(X_train, y_train)

predictions = pipeline.predict(X_test)
probabilities = pipeline.predict_proba(X_test)[:, 1]

print("\n=== Classification Report ===")
print(classification_report(y_test, predictions))

print("=== Confusion Matrix ===")
print(confusion_matrix(y_test, predictions))

print("=== ROC-AUC ===")
print(roc_auc_score(y_test, probabilities))

model_path = os.path.join(
    MODEL_DIR,
    "enhanced_fraud_model.joblib"
)

joblib.dump(pipeline, model_path)

print("\nEnhanced model saved to:")
print(model_path)