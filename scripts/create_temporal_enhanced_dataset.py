import os
import pandas as pd

TRANSACTIONS = "data/processed/transactions_ml.csv"
KYC = "data/synthetic/kyc.csv"
COMPLAINTS = "data/synthetic/complaints.csv"
RELATIONSHIPS = "data/synthetic/account_relationships.csv"

OUTPUT_DIR = "data/processed"
OUTPUT = os.path.join(
    OUTPUT_DIR,
    "transactions_enhanced_temporal.csv"
)

print("Loading transactions...")
tx = pd.read_csv(TRANSACTIONS)
tx["timestamp"] = pd.to_datetime(tx["timestamp"], errors="coerce")

print("Loading KYC...")
kyc = pd.read_csv(KYC)
kyc["account_open_date"] = pd.to_datetime(
    kyc["account_open_date"],
    errors="coerce"
)
kyc["kyc_verified_date"] = pd.to_datetime(
    kyc["kyc_verified_date"],
    errors="coerce"
)

print("Loading complaints...")
complaints = pd.read_csv(COMPLAINTS)
complaints["complaint_date"] = pd.to_datetime(
    complaints["complaint_date"],
    errors="coerce"
)

print("Loading relationships...")
relationships = pd.read_csv(RELATIONSHIPS)
relationships["relationship_start_date"] = pd.to_datetime(
    relationships["relationship_start_date"],
    errors="coerce"
)

# =========================================================
# 1. KYC — ONLY INFORMATION AVAILABLE BY TRANSACTION DATE
# =========================================================

print("\nCreating temporal KYC features...")

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
        "risk_rating": "kyc_risk_rating"
    }
)

# Keep only KYC records that existed by the transaction date.
# merge_asof performs a time-aware join.
tx = tx.sort_values("timestamp")
kyc_features = kyc_features.sort_values("kyc_verified_date")

tx = pd.merge_asof(
    tx,
    kyc_features,
    left_on="timestamp",
    right_on="kyc_verified_date",
    left_by="from_account_id",
    right_by="from_account_id",
    direction="backward"
)

# =========================================================
# 2. COMPLAINTS — ONLY COMPLAINTS BEFORE TRANSACTION
# =========================================================

print("Creating temporal complaint features...")

tx["_row_id"] = range(len(tx))

complaints = complaints[
    [
        "account_id",
        "complaint_date",
        "severity"
    ]
].copy()

# Join transactions with complaints by account.
tx_complaints = tx[
    [
        "_row_id",
        "from_account_id",
        "timestamp"
    ]
].merge(
    complaints,
    left_on="from_account_id",
    right_on="account_id",
    how="left"
)

# IMPORTANT:
# Complaint must already exist at transaction time.
tx_complaints = tx_complaints[
    tx_complaints["complaint_date"].notna()
    & (
        tx_complaints["complaint_date"]
        <= tx_complaints["timestamp"]
    )
]

complaint_counts = (
    tx_complaints
    .groupby("_row_id")
    .size()
    .rename("complaint_count")
)

high_complaints = (
    tx_complaints
    .assign(
        high_flag=(
            tx_complaints["severity"] == "HIGH"
        ).astype(int)
    )
    .groupby("_row_id")["high_flag"]
    .sum()
    .rename("high_severity_complaints")
)

tx["complaint_count"] = (
    tx["_row_id"]
    .map(complaint_counts)
    .fillna(0)
)

tx["high_severity_complaints"] = (
    tx["_row_id"]
    .map(high_complaints)
    .fillna(0)
)

# =========================================================
# 3. ACCOUNT RELATIONSHIPS — ONLY ACTIVE BY TRANSACTION
# =========================================================

print("Creating temporal relationship features...")

relationships = relationships[
    [
        "account_id",
        "connected_account_id",
        "relationship_start_date"
    ]
].copy()

tx_relationships = tx[
    [
        "_row_id",
        "from_account_id",
        "timestamp"
    ]
].merge(
    relationships,
    left_on="from_account_id",
    right_on="account_id",
    how="left"
)

# Relationship must have started by transaction time.
tx_relationships = tx_relationships[
    tx_relationships["relationship_start_date"].notna()
    & (
        tx_relationships["relationship_start_date"]
        <= tx_relationships["timestamp"]
    )
]

outgoing = (
    tx_relationships
    .groupby("_row_id")
    .size()
    .rename("outgoing_connections")
)

incoming = (
    tx_relationships
    .groupby("_row_id")["connected_account_id"]
    .nunique()
    .rename("incoming_connections")
)

tx["outgoing_connections"] = (
    tx["_row_id"]
    .map(outgoing)
    .fillna(0)
)

tx["incoming_connections"] = (
    tx["_row_id"]
    .map(incoming)
    .fillna(0)
)

# =========================================================
# 4. ACCOUNT AGE — ONLY AT TRANSACTION TIME
# =========================================================

print("Creating account age...")

tx["account_open_date"] = pd.to_datetime(
    tx["account_open_date"],
    errors="coerce"
)

tx["account_age_days"] = (
    tx["timestamp"] - tx["account_open_date"]
).dt.days

# If no valid account opening date is available.
tx["account_age_days"] = (
    tx["account_age_days"]
    .fillna(0)
)

# Prevent impossible negative ages.
tx.loc[
    tx["account_age_days"] < 0,
    "account_age_days"
] = 0

# =========================================================
# 5. CLEAN TEMPORARY COLUMN
# =========================================================

tx = tx.drop(columns=["_row_id"])

# =========================================================
# 6. SAVE
# =========================================================

os.makedirs(OUTPUT_DIR, exist_ok=True)

tx.to_csv(
    OUTPUT,
    index=False
)

print("\n========================================")
print("TEMPORAL ENHANCED DATASET CREATED")
print("========================================")
print("Output:", OUTPUT)
print("Rows:", len(tx))
print("Columns:", len(tx.columns))

print("\nTemporal features:")
for col in [
    "kyc_country",
    "kyc_occupation",
    "kyc_status",
    "kyc_risk_rating",
    "account_open_date",
    "kyc_verified_date",
    "complaint_count",
    "high_severity_complaints",
    "outgoing_connections",
    "incoming_connections",
    "account_age_days"
]:
    print("-", col)