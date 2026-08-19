import pandas as pd
import random
from datetime import datetime, timedelta

random.seed(42)

INPUT = "data/processed/accounts_ml.csv"
OUTPUT = "data/synthetic/account_relationships.csv"

accounts = pd.read_csv(INPUT)

account_ids = accounts["account_id"].tolist()

relationship_types = [
    "SHARED_OWNER",
    "BENEFICIAL_OWNER",
    "RELATED_ACCOUNT",
    "AUTHORIZED_USER",
    "BUSINESS_ASSOCIATE"
]

rows = []

# Generate around 50,000 relationships
for i in range(50000):

    a, b = random.sample(account_ids, 2)

    rows.append({
        "relationship_id": f"REL-{i+1:07d}",
        "account_id": a,
        "connected_account_id": b,
        "relationship_type": random.choice(relationship_types),
        "ownership_percentage": round(
            random.uniform(5, 100), 2
        ),
        "relationship_start_date": (
            datetime(2018, 1, 1) +
            timedelta(days=random.randint(0, 2500))
        ).strftime("%Y-%m-%d")
    })

df = pd.DataFrame(rows)

df.to_csv(OUTPUT, index=False)

print("Relationships generated:", len(df))
print("Saved:", OUTPUT)