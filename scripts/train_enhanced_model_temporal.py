import os
import pandas as pd
import joblib

from sklearn.model_selection import train_test_split
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder
from sklearn.pipeline import Pipeline
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    roc_auc_score
)

DATA_PATH = "data/processed/transactions_enhanced_temporal.csv"
MODEL_DIR = "models"

os.makedirs(MODEL_DIR, exist_ok=True)

print("Loading leakage-safe enhanced dataset...")
df = pd.read_csv(DATA_PATH)

print("Rows:", len(df))
print("Columns:", len(df.columns))

# ---------------------------------------------------------
# TARGET
# ---------------------------------------------------------

target = "is_laundering"

# ---------------------------------------------------------
# FEATURES
# ---------------------------------------------------------

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

X = df[features]
y = df[target]

print("\nLabel distribution:")
print(y.value_counts())

# ---------------------------------------------------------
# NUMERICAL FEATURES
# ---------------------------------------------------------

numeric_features = [
    "amount_received",
    "amount_paid",
    "complaint_count",
    "high_severity_complaints",
    "outgoing_connections",
    "incoming_connections",
    "account_age_days"
]

# ---------------------------------------------------------
# CATEGORICAL FEATURES
# ---------------------------------------------------------

categorical_features = [
    "payment_format",
    "receiving_currency",
    "payment_currency",
    "kyc_country",
    "kyc_occupation",
    "kyc_status",
    "kyc_risk_rating"
]

# ---------------------------------------------------------
# PREPROCESSING
# ---------------------------------------------------------

preprocessor = ColumnTransformer(
    transformers=[
        (
            "num",
            "passthrough",
            numeric_features
        ),
        (
            "cat",
            OneHotEncoder(
                handle_unknown="ignore",
                sparse_output=False
            ),
            categorical_features
        )
    ]
)

# ---------------------------------------------------------
# ENHANCED RANDOM FOREST
# ---------------------------------------------------------

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

# ---------------------------------------------------------
# TRAIN / TEST SPLIT
# ---------------------------------------------------------

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.20,
    random_state=42,
    stratify=y
)

print("\nTraining samples:", len(X_train))
print("Testing samples:", len(X_test))

# ---------------------------------------------------------
# TRAIN
# ---------------------------------------------------------

print("\nTraining leakage-safe Enhanced Random Forest...")

pipeline.fit(X_train, y_train)

# ---------------------------------------------------------
# PREDICTIONS
# ---------------------------------------------------------

predictions = pipeline.predict(X_test)

probabilities = pipeline.predict_proba(
    X_test
)[:, 1]

# ---------------------------------------------------------
# EVALUATION
# ---------------------------------------------------------

print("\n========================================")
print("LEAKAGE-SAFE ENHANCED MODEL RESULTS")
print("========================================")

print("\n=== Classification Report ===")
print(
    classification_report(
        y_test,
        predictions
    )
)

print("=== Confusion Matrix ===")
print(
    confusion_matrix(
        y_test,
        predictions
    )
)

print("=== ROC-AUC ===")
print(
    roc_auc_score(
        y_test,
        probabilities
    )
)

# ---------------------------------------------------------
# SAVE MODEL
# ---------------------------------------------------------

model_path = os.path.join(
    MODEL_DIR,
    "enhanced_fraud_model_temporal.joblib"
)

joblib.dump(
    pipeline,
    model_path
)

print("\nModel saved to:")
print(model_path)