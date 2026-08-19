import pandas as pd
import random
from datetime import datetime, timedelta

random.seed(42)

KYC_FILE = "data/synthetic/kyc.csv"
OUTPUT = "data/synthetic/complaints.csv"

kyc = pd.read_csv(KYC_FILE)

complaint_types = [
    "Suspicious Transaction",
    "Unauthorized Transfer",
    "Fraud Report",
    "Identity Concern",
    "Unusual Account Activity"
]

severities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]

statuses = [
    "OPEN",
    "UNDER_REVIEW",
    "RESOLVED"
]

descriptions = [
    "Customer reported unusual transaction activity.",
    "Customer reported an unexpected transfer.",
    "Potential fraudulent activity was reported.",
    "Customer raised an identity verification concern.",
    "Unusual account behaviour was reported."
]

rows = []

# Around 5% accounts receive complaints
sample = kyc.sample(
    n=max(1, int(len(kyc) * 0.05)),
    random_state=42
)

for i, row in sample.reset_index(drop=True).iterrows():

    complaint_date = datetime(2022, 1, 1) + timedelta(
        days=random.randint(0, 1000)
    )

    rows.append({
        "complaint_id": f"CMP-{i+1:06d}",
        "account_id": row["account_id"],
        "customer_id": row["customer_id"],
        "complaint_type": random.choice(complaint_types),
        "description": random.choice(descriptions),
        "severity": random.choice(severities),
        "complaint_date": complaint_date.strftime("%Y-%m-%d"),
        "status": random.choice(statuses)
    })

df = pd.DataFrame(rows)

df.to_csv(OUTPUT, index=False)

print("Complaints generated:", len(df))
print("Saved:", OUTPUT)