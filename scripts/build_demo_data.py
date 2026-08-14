import json
import csv
from pathlib import Path
from datetime import datetime

ROOT = Path(__file__).resolve().parents[1]

GROUND_TRUTH = ROOT / "data" / "ground_truth" / "laundering_patterns.json"
SCENARIO_DIR = ROOT / "data" / "scenarios"
SYNTHETIC_DIR = ROOT / "data" / "synthetic"

SCENARIO_DIR.mkdir(parents=True, exist_ok=True)
SYNTHETIC_DIR.mkdir(parents=True, exist_ok=True)

# Four demo cases requested for the investigation-agent demo.
SCENARIOS = [
    {
        "scenario_id": "SCN-001",
        "name": "Fan-Out Investigation",
        "pattern_type": "FAN-OUT:  Max 16-degree Fan-Out",
        "typology": "FAN-OUT",
        "description": "One source account distributes funds across many destination accounts.",
    },
    {
        "scenario_id": "SCN-002",
        "name": "Cycle Investigation",
        "pattern_type": "CYCLE:  Max 10 hops",
        "typology": "CYCLE",
        "description": "Funds move through a multi-hop circular transaction network.",
    },
    {
        "scenario_id": "SCN-003",
        "name": "Stack Investigation",
        "pattern_type": "STACK",
        "typology": "STACK",
        "description": "Transactions form a stacked laundering structure requiring transaction and account correlation.",
    },
    {
        "scenario_id": "SCN-004",
        "name": "Bipartite Network Investigation",
        "pattern_type": "BIPARTITE",
        "typology": "BIPARTITE",
        "description": "A bipartite transaction network connects groups of sending and receiving accounts.",
    },
]

def load_ground_truth():
    with open(GROUND_TRUTH, "r", encoding="utf-8") as f:
        return json.load(f)

def unique_accounts(transactions):
    accounts = []

    for tx in transactions:
        for field in ("from_account", "to_account"):
            account = tx.get(field)

            if account and account not in accounts:
                accounts.append(account)

    return accounts

def main():
    gt = load_ground_truth()
    patterns = gt["patterns"]

    generated_scenarios = []
    kyc_rows = []
    complaint_rows = []

    all_seen_accounts = set()

    for scenario in SCENARIOS:

        matches = [
            p for p in patterns
            if p.get("pattern_type") == scenario["pattern_type"]
        ]

        if not matches:
            print(
                f"[ERROR] Ground-truth pattern not found: "
                f"{scenario['pattern_type']}"
            )
            continue

        # Use an existing IBM ground-truth laundering instance.
        pattern = matches[0]
        transactions = pattern.get("transactions", [])
        accounts = unique_accounts(transactions)

        scenario_data = {
            "scenario_id": scenario["scenario_id"],
            "name": scenario["name"],
            "description": scenario["description"],
            "source": "IBM HI-Small ground truth",
            "synthetic_evidence": True,
            "pattern_type": scenario["pattern_type"],
            "typology": scenario["typology"],
            "ground_truth": {
                "pattern_index": patterns.index(pattern),
                "transaction_count": pattern.get("transaction_count", len(transactions)),
                "is_laundering": True
            },
            "entry_evidence": {
                "account_ids": accounts[:20],
                "transactions": transactions
            },
            "tools_expected": [
                "transactions",
                "account_kyc",
                "linked_accounts",
                "complaints"
            ],
            "investigation_flow": [
                "transaction lookup",
                "account/KYC lookup",
                "linked-account discovery",
                "complaint lookup",
                "graph/network analysis",
                "pattern detection",
                "evidence correlation",
                "risk scoring",
                "investigation report"
            ]
        }

        # Individual scenario JSON
        output_file = SCENARIO_DIR / f"{scenario['scenario_id']}.json"

        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(scenario_data, f, indent=2)

        generated_scenarios.append({
            "scenario_id": scenario["scenario_id"],
            "name": scenario["name"],
            "typology": scenario["typology"],
            "pattern_type": scenario["pattern_type"],
            "source": "IBM HI-Small ground truth",
            "ground_truth_pattern_index": patterns.index(pattern)
        })

        # Synthetic KYC evidence
        for account_id in accounts[:20]:

            if account_id in all_seen_accounts:
                continue

            all_seen_accounts.add(account_id)

            kyc_rows.append({
                "account_id": account_id,
                "kyc_status": "VERIFIED",
                "customer_type": "SYNTHETIC_DEMO_CUSTOMER",
                "country": "SYNTHETIC",
                "risk_rating": "HIGH",
                "account_open_date": "2020-01-15",
                "occupation": "International Trading",
                "source_of_funds": "Business Revenue",
                "pep_flag": "false",
                "sanctions_flag": "false",
                "kyc_last_review_date": "2022-08-15",
                "evidence_source": "SYNTHETIC_DEMO_DATA"
            })

        # Synthetic complaint for each scenario.
        complaint_rows.append({
            "complaint_id": f"{scenario['scenario_id']}-CMP-001",
            "scenario_id": scenario["scenario_id"],
            "account_id": accounts[0] if accounts else "",
            "complaint_date": "2022-09-05",
            "complaint_type": "SUSPICIOUS_TRANSACTION",
            "severity": "HIGH",
            "status": "OPEN",
            "description": (
                f"Synthetic complaint associated with the "
                f"{scenario['typology']} investigation scenario."
            ),
            "evidence_source": "SYNTHETIC_DEMO_DATA"
        })

    # Master scenario configuration
    scenario_index = {
        "version": "1.0",
        "description": "Four demo investigation scenarios built on existing IBM HI-Small ground-truth instances.",
        "ground_truth_source": "data/ground_truth/laundering_patterns.json",
        "total_ground_truth_patterns": gt.get("total_patterns"),
        "synthetic_evidence": True,
        "scenarios": generated_scenarios
    }

    with open(
        SCENARIO_DIR / "demo_scenarios.json",
        "w",
        encoding="utf-8"
    ) as f:
        json.dump(scenario_index, f, indent=2)

    # Synthetic KYC CSV
    if kyc_rows:
        with open(
            SYNTHETIC_DIR / "kyc_demo.csv",
            "w",
            newline="",
            encoding="utf-8"
        ) as f:
            writer = csv.DictWriter(f, fieldnames=kyc_rows[0].keys())
            writer.writeheader()
            writer.writerows(kyc_rows)

    # Synthetic complaints CSV
    if complaint_rows:
        with open(
            SYNTHETIC_DIR / "complaints_demo.csv",
            "w",
            newline="",
            encoding="utf-8"
        ) as f:
            writer = csv.DictWriter(
                f,
                fieldnames=complaint_rows[0].keys()
            )
            writer.writeheader()
            writer.writerows(complaint_rows)

    print()
    print("=" * 60)
    print("DEMO DATA BUILD COMPLETE")
    print("=" * 60)
    print(f"Ground-truth patterns available : {gt.get('total_patterns')}")
    print(f"Demo scenarios created          : {len(generated_scenarios)}")
    print(f"Synthetic KYC accounts          : {len(kyc_rows)}")
    print(f"Synthetic complaints            : {len(complaint_rows)}")
    print()
    print("Scenario files:")
    for s in generated_scenarios:
        print(f"  {s['scenario_id']} -> {s['typology']}")
    print()
    print(f"Scenarios : {SCENARIO_DIR}")
    print(f"Synthetic : {SYNTHETIC_DIR}")
    print("=" * 60)

if __name__ == "__main__":
    main()
