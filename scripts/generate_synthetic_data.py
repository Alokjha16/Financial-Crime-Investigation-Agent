import pandas as pd
import random
from datetime import datetime, timedelta

random.seed(42)

INPUT = "data/processed/accounts_ml.csv"
OUTPUT = "data/synthetic/kyc.csv"

accounts = pd.read_csv(INPUT)

first_names = [
    "Aarav", "Rohan", "Arjun", "Rahul", "Vikram",
    "Daniel", "Michael", "James", "David", "Robert",
    "Emma", "Olivia", "Sophia", "Ava", "Mia"
]

last_names = [
    "Sharma", "Patel", "Singh", "Kumar", "Mehta",
    "Smith", "Brown", "Wilson", "Taylor", "Anderson"
]

countries = [
    "India", "USA", "UK", "Canada", "Germany",
    "Portugal", "Japan", "France", "Australia"
]

occupations = [
    "Software Engineer",
    "Business Owner",
    "Consultant",
    "Accountant",
    "Trader",
    "Manager",
    "Student",
    "Self Employed"
]

kyc_statuses = ["VERIFIED", "VERIFIED", "VERIFIED", "PENDING"]
risk_ratings = ["LOW", "MEDIUM", "HIGH"]

rows = []

for i, row in accounts.iterrows():

    account_id = row["account_id"]

    customer_id = f"CUST-{i+1:07d}"

    name = random.choice(first_names) + " " + random.choice(last_names)

    country = random.choice(countries)

    open_date = datetime(2018, 1, 1) + timedelta(
        days=random.randint(0, 3000)
    )

    verified_date = open_date + timedelta(
        days=random.randint(1, 30)
    )

    rows.append({
        "customer_id": customer_id,
        "account_id": account_id,
        "full_name": name,
        "date_of_birth": (
            datetime(1965, 1, 1) +
            timedelta(days=random.randint(0, 18000))
        ).strftime("%Y-%m-%d"),
        "country": country,
        "occupation": random.choice(occupations),
        "kyc_status": random.choice(kyc_statuses),
        "risk_rating": random.choice(risk_ratings),
        "account_open_date": open_date.strftime("%Y-%m-%d"),
        "kyc_verified_date": verified_date.strftime("%Y-%m-%d")
    })

df = pd.DataFrame(rows)

df.to_csv(OUTPUT, index=False)

print("KYC generated:", len(df))
print("Saved:", OUTPUT)