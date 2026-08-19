import os
import pandas as pd

TRANSACTIONS = "data/processed/transactions_ml.csv"
KYC = "data/synthetic/kyc.csv"
COMPLAINTS = "data/synthetic/complaints.csv"
RELATIONSHIPS = "data/synthetic/account_relationships.csv"

OUTPUT_DIR = "data/processed"
OUTPUT = os.path.join(OUTPUT_DIR, "transactions_enhanced.csv")

print("Loading transactions...")
tx = pd.read_csv(TRANSACTIONS)

print("Loading KYC...")
kyc = pd.read_csv(KYC)

print("Loading complaints...")
complaints = pd.read_csv(COMPLAINTS)

print("Loading account relationships...")
relationships = pd.read_csv(RELATIONSHIPS)


# -------------------------------------------------
# KYC FEATURES
# -------------------------------------------------

kyc_features = kyc[
    [
        "account_id",
        "country",
        "occupation",
        "kyc_status",
        "risk_rating",
        "account_open_date",
        "kyc_verified_date"
    ]
].copy()

kyc_features = kyc_features.rename(
    columns={
        "account_id": "from_account_id",
        "country": "kyc_country",
        "occupation": "kyc_occupation",
        "kyc_status": "kyc_status",
        "risk_rating": "kyc_risk_rating",
        "account_open_date": "account_open_date",
        "kyc_verified_date": "kyc_verified_date"
    }
)

# Join sender account KYC
tx = tx.merge(
    kyc_features,
    on="from_account_id",
    how="left"
)


# -------------------------------------------------
# COMPLAINT FEATURES
# -------------------------------------------------

complaint_counts = (
    complaints
    .groupby("account_id")
    .size()
    .reset_index(name="complaint_count")
)

high_complaints = (
    complaints.assign(
        high_flag=(complaints["severity"] == "HIGH").astype(int)
    )
    .groupby("account_id")["high_flag"]
    .sum()
    .reset_index(name="high_severity_complaints")
)

complaint_features = complaint_counts.merge(
    high_complaints,
    on="account_id",
    how="left"
)

complaint_features = complaint_features.rename(
    columns={"account_id": "from_account_id"}
)

tx = tx.merge(
    complaint_features,
    on="from_account_id",
    how="left"
)

tx["complaint_count"] = tx["complaint_count"].fillna(0)
tx["high_severity_complaints"] = tx[
    "high_severity_complaints"
].fillna(0)


# -------------------------------------------------
# ACCOUNT RELATIONSHIP FEATURES
# -------------------------------------------------

outgoing = (
    relationships
    .groupby("account_id")
    .size()
    .reset_index(name="outgoing_connections")
)

incoming = (
    relationships
    .groupby("connected_account_id")
    .size()
    .reset_index(name="incoming_connections")
)

outgoing = outgoing.rename(
    columns={"account_id": "from_account_id"}
)

incoming = incoming.rename(
    columns={"connected_account_id": "from_account_id"}
)

relationship_features = outgoing.merge(
    incoming,
    on="from_account_id",
    how="outer"
)

relationship_features = relationship_features.fillna(0)

tx = tx.merge(
    relationship_features,
    on="from_account_id",
    how="left"
)

tx["outgoing_connections"] = tx[
    "outgoing_connections"
].fillna(0)

tx["incoming_connections"] = tx[
    "incoming_connections"
].fillna(0)


# -------------------------------------------------
# ACCOUNT AGE
# -------------------------------------------------

tx["timestamp"] = pd.to_datetime(tx["timestamp"])
tx["account_open_date"] = pd.to_datetime(
    tx["account_open_date"],
    errors="coerce"
)

tx["account_age_days"] = (
    tx["timestamp"] - tx["account_open_date"]
).dt.days

tx["account_age_days"] = tx[
    "account_age_days"
].fillna(0)


# -------------------------------------------------
# SAVE
# -------------------------------------------------

os.makedirs(OUTPUT_DIR, exist_ok=True)

tx.to_csv(
    OUTPUT,
    index=False
)

print("\nEnhanced dataset created:")
print(OUTPUT)

print("Rows:", len(tx))
print("Columns:", len(tx.columns))

print("\nNew synthetic features:")
for col in [
    "kyc_country",
    "kyc_occupation",
    "kyc_status",
    "kyc_risk_rating",
    "complaint_count",
    "high_severity_complaints",
    "outgoing_connections",
    "incoming_connections",
    "account_age_days"
]:
    print("-", col)