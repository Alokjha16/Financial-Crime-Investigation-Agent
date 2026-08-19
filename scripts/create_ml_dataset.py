import pandas as pd
from pathlib import Path

# ============================================================
# PATHS
# ============================================================

BASE_DIR = Path(__file__).resolve().parent.parent

RAW_DIR = BASE_DIR.parent / "data" / "raw"
OUTPUT_DIR = BASE_DIR / "data" / "processed"

TRANSACTIONS_FILE = RAW_DIR / "HI-Small_Trans.csv"
ACCOUNTS_FILE = RAW_DIR / "HI-Small_accounts.csv"

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

OUTPUT_TRANSACTIONS = OUTPUT_DIR / "transactions_ml.csv"
OUTPUT_ACCOUNTS = OUTPUT_DIR / "accounts_ml.csv"

# ============================================================
# CONFIG
# ============================================================

TOTAL_TRANSACTIONS = 100_000
RANDOM_STATE = 42

print("=" * 70)
print("CREATING ML-READY DATASET")
print("=" * 70)

# ============================================================
# STEP 1 — LOAD TRANSACTIONS
# ============================================================

print("\nLoading transactions...")

transactions = pd.read_csv(
    TRANSACTIONS_FILE,
    dtype=str
)

print("Total transactions:", len(transactions))

# ============================================================
# STEP 2 — NORMALIZE COLUMN NAMES
# ============================================================

transactions.columns = [
    "timestamp",
    "from_bank_id",
    "from_account_id",
    "to_bank_id",
    "to_account_id",
    "amount_received",
    "receiving_currency",
    "amount_paid",
    "payment_currency",
    "payment_format",
    "is_laundering"
]

# ============================================================
# STEP 3 — SEPARATE POSITIVE / NEGATIVE
# ============================================================

laundering = transactions[
    transactions["is_laundering"] == "1"
].copy()

normal = transactions[
    transactions["is_laundering"] == "0"
].copy()

print("\nOriginal distribution:")
print("Laundering:", len(laundering))
print("Normal:", len(normal))

# ============================================================
# STEP 4 — KEEP ALL LAUNDERING TRANSACTIONS
# ============================================================

positive_count = len(laundering)

negative_count = TOTAL_TRANSACTIONS - positive_count

if negative_count <= 0:
    raise ValueError("TOTAL_TRANSACTIONS must be greater than laundering count.")

if negative_count > len(normal):
    raise ValueError("Not enough normal transactions.")

normal_sample = normal.sample(
    n=negative_count,
    random_state=RANDOM_STATE
)

# ============================================================
# STEP 5 — COMBINE
# ============================================================

ml_transactions = pd.concat(
    [laundering, normal_sample],
    ignore_index=True
)

# Shuffle dataset
ml_transactions = ml_transactions.sample(
    frac=1,
    random_state=RANDOM_STATE
).reset_index(drop=True)

# ============================================================
# STEP 6 — LOAD ACCOUNTS
# ============================================================

print("\nLoading accounts...")

accounts = pd.read_csv(
    ACCOUNTS_FILE,
    dtype=str
)

accounts.columns = [
    "bank_name",
    "bank_id",
    "account_id",
    "entity_id",
    "entity_name"
]

# ============================================================
# STEP 7 — FIND ACCOUNTS USED BY ML DATASET
# ============================================================

used_accounts = set(
    ml_transactions["from_account_id"]
).union(
    set(ml_transactions["to_account_id"])
)

print("Unique accounts used by transactions:", len(used_accounts))

ml_accounts = accounts[
    accounts["account_id"].isin(used_accounts)
].copy()

# Remove duplicate account IDs
ml_accounts = ml_accounts.drop_duplicates(
    subset=["account_id"]
)

# ============================================================
# STEP 8 — ADD ACCOUNT KEY
# ============================================================

ml_accounts["account_key"] = (
    ml_accounts["bank_id"].astype(str)
    + ":"
    + ml_accounts["account_id"].astype(str)
)

# Reorder columns
ml_accounts = ml_accounts[
    [
        "account_key",
        "account_id",
        "bank_id",
        "bank_name",
        "entity_id",
        "entity_name"
    ]
]

# ============================================================
# STEP 9 — ADD ACCOUNT KEYS TO TRANSACTIONS
# ============================================================

ml_transactions["from_account_key"] = (
    ml_transactions["from_bank_id"].astype(str)
    + ":"
    + ml_transactions["from_account_id"].astype(str)
)

ml_transactions["to_account_key"] = (
    ml_transactions["to_bank_id"].astype(str)
    + ":"
    + ml_transactions["to_account_id"].astype(str)
)

# Reorder
ml_transactions = ml_transactions[
    [
        "timestamp",
        "from_bank_id",
        "from_account_id",
        "from_account_key",
        "to_bank_id",
        "to_account_id",
        "to_account_key",
        "amount_received",
        "receiving_currency",
        "amount_paid",
        "payment_currency",
        "payment_format",
        "is_laundering"
    ]
]

# ============================================================
# STEP 10 — SAVE
# ============================================================

ml_transactions.to_csv(
    OUTPUT_TRANSACTIONS,
    index=False
)

ml_accounts.to_csv(
    OUTPUT_ACCOUNTS,
    index=False
)

# ============================================================
# STEP 11 — VALIDATION
# ============================================================

print("\n" + "=" * 70)
print("ML DATASET CREATED")
print("=" * 70)

print("\nTransactions:", len(ml_transactions))
print("Accounts:", len(ml_accounts))

print("\nLabel distribution:")
print(
    ml_transactions["is_laundering"].value_counts()
)

print("\nOutput files:")
print(OUTPUT_TRANSACTIONS)
print(OUTPUT_ACCOUNTS)

print("\n" + "=" * 70)
print("DONE")
print("=" * 70)