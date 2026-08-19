#!/usr/bin/env python3
"""
Data ingestion script for Financial Crime Investigation Agent.
Reads preprocessed data from Person 1 and loads it into MySQL.
"""

import os
import sys
import json
import argparse
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any

import pandas as pd

# Add project root to path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from backend.database.connection import init_db
from backend.database.repository import (
    AccountRepository,
    TransactionRepository,
    KYCRepository,
    AccountLinkRepository,
    ComplaintRepository,
)


def ingest_accounts(accounts_df: pd.DataFrame) -> int:
    repo = AccountRepository()
    count = 0
    batch = []
    for _, row in accounts_df.iterrows():
        batch.append({
            "account_id": str(row.get("account_id", row.get("Account", ""))),
            "bank_id": str(row.get("bank_id", row.get("BankID", ""))),
            "account_type": row.get("account_type", "personal"),
            "account_age_days": int(row.get("account_age_days", 365)),
            "kyc_status": row.get("kyc_status", "pending"),
            "is_business": bool(row.get("is_business", False)),
        })
    if batch:
        count = repo.bulk_create(batch)
    return count


def ingest_transactions(transactions_df: pd.DataFrame) -> int:
    repo = TransactionRepository()
    count = 0
    batch = []
    for _, row in transactions_df.iterrows():
        batch.append({
            "transaction_id": str(row.get("transaction_id", row.get("TransactionID", ""))),
            "from_bank_id": str(row.get("from_bank_id", row.get("FromBank", ""))),
            "from_account_id": str(row.get("from_account_id", row.get("Account", ""))),
            "to_bank_id": str(row.get("to_bank_id", row.get("ToBank", ""))),
            "to_account_id": str(row.get("to_account_id", row.get("Account.1", ""))),
            "amount_paid": float(row.get("amount_paid", row.get("AmountPaid", 0))),
            "payment_currency": str(row.get("payment_currency", row.get("PaymentCurrency", "USD"))),
            "amount_received": float(row.get("amount_received", row.get("AmountReceived", 0))),
            "receiving_currency": str(row.get("receiving_currency", row.get("ReceivingCurrency", "USD"))),
            "payment_format": str(row.get("payment_format", row.get("PaymentFormat", "wire"))),
            "timestamp": pd.to_datetime(row.get("timestamp", row.get("Timestamp", datetime.utcnow()))),
            "transaction_hour": int(row.get("transaction_hour", 0)),
            "is_laundering": bool(row.get("is_laundering", row.get("IsLaundering", False))),
            "laundering_pattern": row.get("laundering_pattern", None),
        })
    if batch:
        count = repo.bulk_create(batch)
    return count


def ingest_kyc(kyc_df: pd.DataFrame) -> int:
    repo = KYCRepository()
    count = 0
    for _, row in kyc_df.iterrows():
        try:
            repo.create({
                "account_id": str(row.get("account_id", "")),
                "full_name": str(row.get("full_name", "")),
                "id_number": str(row.get("id_number", "")),
                "id_type": str(row.get("id_type", "passport")),
                "date_of_birth": pd.to_datetime(row.get("date_of_birth", datetime.utcnow())),
                "nationality": str(row.get("nationality", "")),
                "address": str(row.get("address", "")),
                "phone_number": str(row.get("phone_number", "")),
                "email": str(row.get("email", "")),
                "occupation": str(row.get("occupation", "")),
                "employer": str(row.get("employer", "")),
                "completeness_score": float(row.get("completeness_score", 0.0)),
                "verified": bool(row.get("verified", False)),
                "verification_date": pd.to_datetime(row.get("verification_date", datetime.utcnow())) if pd.notna(row.get("verification_date")) else None,
            })
            count += 1
        except Exception:
            pass
    return count


def ingest_links(links_df: pd.DataFrame) -> int:
    repo = AccountLinkRepository()
    count = 0
    for _, row in links_df.iterrows():
        try:
            repo.create({
                "from_account_id": str(row.get("from_account_id", "")),
                "to_account_id": str(row.get("to_account_id", "")),
                "link_type": str(row.get("link_type", "unknown")),
                "strength": float(row.get("strength", 1.0)),
                "is_suspicious": bool(row.get("is_suspicious", False)),
            })
            count += 1
        except Exception:
            pass
    return count


def ingest_complaints(complaints_df: pd.DataFrame) -> int:
    repo = ComplaintRepository()
    count = 0
    for _, row in complaints_df.iterrows():
        try:
            repo.create({
                "account_id": str(row.get("account_id", "")),
                "complaint_type": str(row.get("complaint_type", "")),
                "description": str(row.get("description", "")),
                "status": str(row.get("status", "open")),
                "filed_at": pd.to_datetime(row.get("filed_at", datetime.utcnow())),
                "resolved_at": pd.to_datetime(row.get("resolved_at", datetime.utcnow())) if pd.notna(row.get("resolved_at")) else None,
            })
            count += 1
        except Exception:
            pass
    return count


def ingest_patterns(patterns_json_path: str) -> int:
    if not os.path.exists(patterns_json_path):
        print(f"Patterns file not found: {patterns_json_path}")
        return 0

    repo = TransactionRepository()
    with open(patterns_json_path, "r") as f:
        patterns = json.load(f)

    count = 0
    for pattern in patterns:
        txn_id = pattern.get("transaction_id")
        if not txn_id:
            continue
        if repo.update_pattern(txn_id, pattern.get("pattern_family", "unknown")):
            count += 1
    return count


def main():
    parser = argparse.ArgumentParser(description="Ingest preprocessed data into MySQL")
    parser.add_argument("--data-dir", default="data/processed", help="Directory containing processed data files")
    parser.add_argument("--init-db", action="store_true", help="Initialize database tables from schema.sql")
    args = parser.parse_args()

    data_dir = Path(args.data_dir)
    if not data_dir.exists():
        print(f"Data directory not found: {data_dir}")
        sys.exit(1)

    if args.init_db:
        print("Initializing database schema...")
        init_db()
        print("Database schema initialized.")

    print("Starting data ingestion...")

    accounts_file = data_dir / "accounts.csv"
    if accounts_file.exists():
        print(f"Ingesting accounts from {accounts_file}...")
        df = pd.read_csv(accounts_file)
        count = ingest_accounts(df)
        print(f"  Ingested {count} accounts.")
    else:
        print(f"  No accounts file found at {accounts_file}")

    transactions_file = data_dir / "transactions.csv"
    if transactions_file.exists():
        print(f"Ingesting transactions from {transactions_file}...")
        df = pd.read_csv(transactions_file)
        count = ingest_transactions(df)
        print(f"  Ingested {count} transactions.")
    else:
        print(f"  No transactions file found at {transactions_file}")

    kyc_file = data_dir / "kyc.csv"
    if kyc_file.exists():
        print(f"Ingesting KYC from {kyc_file}...")
        df = pd.read_csv(kyc_file)
        count = ingest_kyc(df)
        print(f"  Ingested {count} KYC records.")
    else:
        print(f"  No KYC file found at {kyc_file}")

    links_file = data_dir / "account_links.csv"
    if links_file.exists():
        print(f"Ingesting account links from {links_file}...")
        df = pd.read_csv(links_file)
        count = ingest_links(df)
        print(f"  Ingested {count} account links.")
    else:
        print(f"  No account links file found at {links_file}")

    complaints_file = data_dir / "complaints.csv"
    if complaints_file.exists():
        print(f"Ingesting complaints from {complaints_file}...")
        df = pd.read_csv(complaints_file)
        count = ingest_complaints(df)
        print(f"  Ingested {count} complaints.")
    else:
        print(f"  No complaints file found at {complaints_file}")

    patterns_file = data_dir / "patterns.json"
    if patterns_file.exists():
        print(f"Ingesting patterns from {patterns_file}...")
        count = ingest_patterns(str(patterns_file))
        print(f"  Updated {count} transactions with pattern labels.")
    else:
        print(f"  No patterns file found at {patterns_file}")

    print("Data ingestion complete!")


if __name__ == "__main__":
    main()
