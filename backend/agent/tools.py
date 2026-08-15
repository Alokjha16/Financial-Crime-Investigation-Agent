import json
from pathlib import Path
from functools import lru_cache

import pandas as pd


# =========================================================
# PROJECT PATHS
# =========================================================

PROJECT_ROOT = Path(__file__).resolve().parents[1]

TRANSACTIONS_FILE = (
    PROJECT_ROOT
    / "data"
    / "processed"
    / "transactions_ml.csv"
)

KYC_FILES = {
    "demo": PROJECT_ROOT / "data" / "synthetic" / "kyc_demo.csv",
    "full": PROJECT_ROOT / "data" / "synthetic" / "kyc.csv",
}

COMPLAINTS_FILES = {
    "demo": (
        PROJECT_ROOT / "data" / "synthetic" / "complaints_demo.csv"
    ),
    "full": PROJECT_ROOT / "data" / "synthetic" / "complaints.csv",
}


# =========================================================
# HELPERS
# =========================================================

def account_id_from_key(account_key: str) -> str:
    """
    Convert:

        021174:800737690

    into:

        800737690

    KYC and complaints use account_id,
    while transactions use account_key.
    """

    return account_key.split(":", 1)[-1]


# =========================================================
# LOAD TRANSACTIONS
# =========================================================

@lru_cache(maxsize=1)
def load_transactions() -> pd.DataFrame:

    if not TRANSACTIONS_FILE.exists():
        raise FileNotFoundError(
            f"Transaction dataset not found:\n"
            f"{TRANSACTIONS_FILE}"
        )

    df = pd.read_csv(
        TRANSACTIONS_FILE,
        dtype=str
    )

    # Numeric columns
    df["amount_paid"] = pd.to_numeric(
        df["amount_paid"],
        errors="coerce"
    )

    df["amount_received"] = pd.to_numeric(
        df["amount_received"],
        errors="coerce"
    )

    return df


# =========================================================
# LOAD KYC
# =========================================================

@lru_cache(maxsize=2)
def load_kyc(source: str = "demo") -> pd.DataFrame:

    try:
        kyc_file = KYC_FILES[source]
    except KeyError as error:
        raise ValueError(f"Unknown KYC source: {source}") from error

    if not kyc_file.exists():
        raise FileNotFoundError(
            f"KYC dataset not found:\n"
            f"{kyc_file}"
        )

    return pd.read_csv(
        kyc_file,
        dtype=str
    )


# =========================================================
# LOAD COMPLAINTS
# =========================================================

@lru_cache(maxsize=2)
def load_complaints(source: str = "demo") -> pd.DataFrame:

    try:
        complaints_file = COMPLAINTS_FILES[source]
    except KeyError as error:
        raise ValueError(
            f"Unknown complaints source: {source}"
        ) from error

    if not complaints_file.exists():
        raise FileNotFoundError(
            f"Complaints dataset not found:\n"
            f"{complaints_file}"
        )

    return pd.read_csv(
        complaints_file,
        dtype=str
    )


# =========================================================
# TRANSACTION INVESTIGATION TOOL
# =========================================================

def get_transactions(account_key: str):

    df = load_transactions()

    account_transactions = df[
        (df["from_account_key"] == account_key)
        | (df["to_account_key"] == account_key)
    ].copy()

    if account_transactions.empty:

        return {
            "account_key": account_key,
            "transaction_count": 0,
            "summary": {
                "total_sent": 0,
                "total_received": 0,
                "unique_senders": 0,
                "unique_receivers": 0
            },
            "transactions": []
        }

    # Determine transaction direction

    account_transactions["direction"] = (
        account_transactions.apply(
            lambda row:
            "SENT"
            if row["from_account_key"] == account_key
            else "RECEIVED",
            axis=1
        )
    )

    sent = account_transactions[
        account_transactions["direction"] == "SENT"
    ]

    received = account_transactions[
        account_transactions["direction"] == "RECEIVED"
    ]

    summary = {

        "total_sent": round(
            sent["amount_paid"].sum(),
            2
        ),

        "total_received": round(
            received["amount_received"].sum(),
            2
        ),

        "unique_senders": int(
            received["from_account_key"].nunique()
        ),

        "unique_receivers": int(
            sent["to_account_key"].nunique()
        )
    }

    # Keep only the most recent 50 transactions

    transactions = account_transactions[
        [
            "timestamp",
            "from_account_key",
            "to_account_key",
            "amount_paid",
            "amount_received",
            "payment_currency",
            "receiving_currency",
            "payment_format",
            "direction",
            "is_laundering"
        ]
    ].tail(50)

    return {

        "account_key": account_key,

        "transaction_count": int(
            len(account_transactions)
        ),

        "summary": summary,

        "transactions": transactions.to_dict(
            orient="records"
        )
    }


# =========================================================
# KYC INVESTIGATION TOOL
# =========================================================

def get_kyc(account_key: str, source: str = "demo"):

    df = load_kyc(source)

    account_id = account_id_from_key(
        account_key
    )

    result = df[
        df["account_id"] == account_id
    ]

    if result.empty:

        return {
            "account_key": account_key,
            "account_id": account_id,
            "found": False,
            "message": "KYC record not found"
        }

    row = result.iloc[0]

    return {
        "account_key": account_key,
        "account_id": account_id,
        "found": True,

        "kyc_status": row["kyc_status"],
        "customer_type": row.get("customer_type"),
        "country": row["country"],
        "risk_rating": row["risk_rating"],
        "account_open_date": row["account_open_date"],
        "occupation": row["occupation"],
        "source_of_funds": row.get("source_of_funds"),
        "pep_flag": row.get("pep_flag"),
        "sanctions_flag": row.get("sanctions_flag"),
        "kyc_last_review_date": row.get(
            "kyc_last_review_date",
            row.get("kyc_verified_date"),
        )
    }


# =========================================================
# LINKED ACCOUNTS INVESTIGATION TOOL
# =========================================================

def get_linked_accounts(account_key: str):

    df = load_transactions()

    incoming = df[
        df["to_account_key"] == account_key
    ]

    outgoing = df[
        df["from_account_key"] == account_key
    ]

    incoming_accounts = (
        incoming["from_account_key"]
        .dropna()
        .unique()
        .tolist()
    )

    outgoing_accounts = (
        outgoing["to_account_key"]
        .dropna()
        .unique()
        .tolist()
    )

    linked_accounts = sorted(
        set(
            incoming_accounts
            + outgoing_accounts
        )
        - {account_key}
    )

    return {

        "account_key": account_key,

        "incoming_accounts":
            incoming_accounts,

        "outgoing_accounts":
            outgoing_accounts,

        "linked_accounts":
            linked_accounts,

        "incoming_count":
            len(incoming_accounts),

        "outgoing_count":
            len(outgoing_accounts),

        "total_linked_accounts":
            len(linked_accounts)
    }


# =========================================================
# COMPLAINTS INVESTIGATION TOOL
# =========================================================

def get_complaints(account_key: str, source: str = "demo"):

    df = load_complaints(source)

    account_id = account_id_from_key(
        account_key
    )

    result = df[
        df["account_id"] == account_id
    ]

    complaints = []

    for _, row in result.iterrows():

        complaints.append({

            "scenario_id":
                row.get("scenario_id"),

            "type":
                row["complaint_type"],

            "severity":
                row["severity"],

            "status":
                row["status"],

            "description":
                row["description"]
        })

    return {

        "account_key":
            account_key,

        "account_id":
            account_id,

        "complaint_count":
            len(complaints),

        "complaints":
            complaints
    }
    # =========================================================
# FULL TRANSACTION GRAPH TOOL
# =========================================================

# =========================================================
# FULL TRANSACTION GRAPH TOOL
# =========================================================

def get_transaction_graph(
    account_key: str,
    max_hops: int = 10
):
    """
    Retrieve the transaction network around an account.

    Unlike get_transactions(), this does not limit the
    evidence to transactions directly involving the account.

    It progressively follows connected accounts so that
    multi-hop patterns such as CYCLE and STACK can be detected.
    """

    df = load_transactions()

    # -----------------------------------------------------
    # Start from the target account
    # -----------------------------------------------------

    visited_accounts = {account_key}
    frontier = {account_key}

    collected_indices = set()

    # -----------------------------------------------------
    # Expand the network
    # -----------------------------------------------------

    for _ in range(max_hops):

        if not frontier:
            break

        relevant = df[
            df["from_account_key"].isin(frontier)
            | df["to_account_key"].isin(frontier)
        ]

        if relevant.empty:
            break

        # Keep transaction rows
        collected_indices.update(
            relevant.index.tolist()
        )

        # Find newly connected accounts
        connected_accounts = set(
            relevant["from_account_key"]
            .dropna()
            .tolist()
        ).union(
            set(
                relevant["to_account_key"]
                .dropna()
                .tolist()
            )
        )

        # Only continue to accounts we have not visited
        new_accounts = (
            connected_accounts
            - visited_accounts
        )

        visited_accounts.update(
            new_accounts
        )

        frontier = new_accounts

    # -----------------------------------------------------
    # Build result
    # -----------------------------------------------------

    if not collected_indices:

        return {
            "account_key": account_key,
            "transaction_count": 0,
            "accounts_discovered": 1,
            "transactions": []
        }

    graph_transactions = df.loc[
        sorted(collected_indices)
    ].copy()

    transactions = graph_transactions[
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

    return {
        "account_key": account_key,

        "transaction_count": int(
            len(transactions)
        ),

        "accounts_discovered": int(
            len(visited_accounts)
        ),

        "transactions": transactions.to_dict(
            orient="records"
        )
    }

def get_scenario_transactions(scenario_id: str):
    """
    Load the complete transaction evidence for a scenario.
    Used for evidence-level pattern investigation.
    """

    scenario_file = (
        PROJECT_ROOT
        / "data"
        / "scenarios"
        / f"{scenario_id}.json"
    )

    if not scenario_file.exists():
        raise FileNotFoundError(
            f"Scenario file not found:\n{scenario_file}"
        )

    with open(
        scenario_file,
        "r",
        encoding="utf-8"
    ) as f:
        scenario = json.load(f)

    transactions = (
        scenario
        .get("entry_evidence", {})
        .get("transactions", [])
    )

    normalized_transactions = []

    for tx in transactions:
        normalized_tx = dict(tx)
        normalized_tx["from_account_key"] = (
            f"{tx['from_bank']}:{tx['from_account']}"
        )
        normalized_tx["to_account_key"] = (
            f"{tx['to_bank']}:{tx['to_account']}"
        )
        normalized_transactions.append(normalized_tx)

    return {
    "scenario_id": scenario_id,
    "transaction_count": len(normalized_transactions),
    "transactions": normalized_transactions,
    "investigation_config": scenario.get(
        "investigation_config",
        {}
    ),
}
