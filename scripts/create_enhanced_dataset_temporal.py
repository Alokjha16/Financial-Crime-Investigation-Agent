import os
import pandas as pd

TRANSACTIONS = "data/processed/transactions_ml.csv"
KYC = "data/synthetic/kyc.csv"
COMPLAINTS = "data/synthetic/complaints.csv"
RELATIONSHIPS = "data/synthetic/account_relationships.csv"

OUTPUT_DIR = "data/processed"
OUTPUT = os.path.join(OUTPUT_DIR, "transactions_enhanced_temporal.csv")

print("Loading transactions...")
tx = pd.read_csv(TRANSACTIONS, dtype=str)

print("Loading KYC...")
kyc = pd.read_csv(KYC, dtype=str)

print("Loading complaints...")
complaints = pd.read_csv(COMPLAINTS, dtype=str)

print("Loading account relationships...")
relationships = pd.read_csv(RELATIONSHIPS, dtype=str)

# Convert dates
tx["timestamp"] = pd.to_datetime(tx["timestamp"], errors="coerce")
kyc["account_open_date"] = pd.to_datetime(kyc["account_open_date"], errors="coerce")
kyc["kyc_verified_date"] = pd.to_datetime(kyc["kyc_verified_date"], errors="coerce")
complaints["complaint_date"] = pd.to_datetime(complaints["complaint_date"], errors="coerce")
relationships["relationship_start_date"] = pd.to_datetime(relationships["relationship_start_date"], errors="coerce")

# Sort for efficient temporal filtering
complaints = complaints.sort_values("complaint_date").reset_index(drop=True)
relationships = relationships.sort_values("relationship_start_date").reset_index(drop=True)
kyc = kyc.sort_values("kyc_verified_date").reset_index(drop=True)

# Pre-group by account for faster lookup
complaints_by_account = {k: v for k, v in complaints.groupby("account_id")}
relationships_by_account = {k: v for k, v in relationships.groupby("account_id")}
relationships_by_connected = {k: v for k, v in relationships.groupby("connected_account_id")}
kyc_by_account = {k: v for k, v in kyc.groupby("account_id")}

features_list = []

print("Computing temporal-enhanced features for", len(tx), "transactions...")

for idx, row in tx.iterrows():
    account_id = row["from_account_id"]
    timestamp = row["timestamp"]
    
    # KYC - only records verified at or before transaction time
    kyc_rows = kyc_by_account.get(account_id, pd.DataFrame())
    if not kyc_rows.empty:
        valid_kyc = kyc_rows[kyc_rows["kyc_verified_date"] <= timestamp]
        if not valid_kyc.empty:
            kyc_row = valid_kyc.iloc[0]
        else:
            kyc_row = kyc_rows.iloc[0]
    else:
        kyc_row = None
    
    # Complaints - only complaints at or before transaction time
    acc_complaints = complaints_by_account.get(account_id, pd.DataFrame())
    if not acc_complaints.empty:
        valid_complaints = acc_complaints[acc_complaints["complaint_date"] <= timestamp]
        complaint_count = len(valid_complaints)
        high_severity_complaints = int((valid_complaints["severity"].str.upper() == "HIGH").sum())
    else:
        complaint_count = 0
        high_severity_complaints = 0
    
    # Relationships - only relationships started at or before transaction time
    outgoing_rows = relationships_by_account.get(account_id, pd.DataFrame())
    incoming_rows = relationships_by_connected.get(account_id, pd.DataFrame())
    
    if not outgoing_rows.empty:
        outgoing = len(outgoing_rows[outgoing_rows["relationship_start_date"] <= timestamp])
    else:
        outgoing = 0
    
    if not incoming_rows.empty:
        incoming = len(incoming_rows[incoming_rows["relationship_start_date"] <= timestamp])
    else:
        incoming = 0
    
    # Account age at transaction time
    account_age_days = 365
    if kyc_row is not None:
        open_date = kyc_row.get("account_open_date") or kyc_row.get("kyc_verified_date")
        if pd.notna(open_date) and open_date:
            try:
                account_age_days = (timestamp - pd.to_datetime(open_date)).days
            except Exception:
                pass
    
    features_list.append({
        "kyc_country": kyc_row.get("country", "") if kyc_row is not None else "",
        "kyc_occupation": kyc_row.get("occupation", "") if kyc_row is not None else "",
        "kyc_status": kyc_row.get("kyc_status", "") if kyc_row is not None else "",
        "kyc_risk_rating": kyc_row.get("risk_rating", "") if kyc_row is not None else "",
        "account_age_days": account_age_days,
        "complaint_count": complaint_count,
        "high_severity_complaints": high_severity_complaints,
        "outgoing_connections": outgoing,
        "incoming_connections": incoming,
    })

features_df = pd.DataFrame(features_list)

# Merge features back into transactions
tx = pd.concat([tx.reset_index(drop=True), features_df], axis=1)

# Save
os.makedirs(OUTPUT_DIR, exist_ok=True)
tx.to_csv(OUTPUT, index=False)

print("\nEnhanced dataset created:")
print(OUTPUT)
print("Rows:", len(tx))
print("Columns:", len(tx.columns))

print("\nNew temporal features:")
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
