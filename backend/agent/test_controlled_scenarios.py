import unittest

from agent.graph import graph

SCENARIOS = {
    "SCN-001": {
        "case_id": "CASE-001",
        "account_key": "021174:800737690",
        "typology": "FAN-OUT",
        "risk_score": 40,
        "risk_level": "MEDIUM",
        "recommendation": "REVIEW",
    },
    "SCN-002": {
        "case_id": "CASE-002",
        "account_key": "01467:8013C4030",
        "typology": "CYCLE",
        "risk_score": 95,
        "risk_level": "HIGH",
        "recommendation": "ESCALATE",
    },
    "SCN-003": {
        "case_id": "CASE-003",
        "account_key": None,
        "typology": "STACK",
        "risk_score": 40,
        "risk_level": "MEDIUM",
        "recommendation": "REVIEW",
    },
    "SCN-004": {
        "case_id": "CASE-004",
        "account_key": None,
        "typology": "BIPARTITE",
        "risk_score": 40,
        "risk_level": "MEDIUM",
        "recommendation": "REVIEW",
    },
    "SCN-005": {
        "case_id": "CASE-005",
        "account_key": "0112733:804BD7DC0",
        "typology": "UNKNOWN",
        "risk_score": 10,
        "risk_level": "LOW",
        "recommendation": "CLEAR",
    },
}

# SCN-002 keeps its deterministic contextual evidence sequence.
# SCN-005 uses its own configured deterministic tool sequence
# (transaction history + KYC + complaints, sender and counterparty).
SCENARIO_EXPECTED_TOOLS = {
    "SCN-002": [
        "get_transactions",
        "get_kyc",
        "get_linked_accounts",
        "get_complaints",
    ],
    "SCN-005": [
        "get_transactions",
        "get_kyc",
        "get_complaints",
        "get_counterparty_kyc",
        "get_counterparty_complaints",
    ],
}


def initial_state(scenario_id: str) -> dict:
    scenario = SCENARIOS[scenario_id]
    return {
        "case_id": scenario["case_id"],
        "scenario_id": scenario_id,
        "account_key": scenario["account_key"],
        "transactions": [],
        "observations": [],
        "decision": "",
        "timeline": [],
        "investigation_trace": [],
        "used_tools": [],
        "investigation_plan": [],
        "report": {},
        "demo_mode": True,
    }


class ControlledScenarioRegressionTests(unittest.TestCase):
    def test_controlled_scenarios(self):
        for scenario_id, expected in SCENARIOS.items():
            with self.subTest(scenario_id=scenario_id):
                result = graph.invoke(initial_state(scenario_id))
                report = result["report"]

                # ---- core scoring / typology / recommendation ----
                # SCN-005 has no supported laundering pattern, so the
                # deterministic engine assigns typology "UNKNOWN".
                self.assertEqual(report["typology"], expected["typology"])
                self.assertEqual(report["risk_score"], expected["risk_score"])
                self.assertEqual(report["risk_level"], expected["risk_level"])
                self.assertEqual(
                    report["recommendation"],
                    expected["recommendation"],
                )

                # ---- scenario evidence loaded exactly once ----
                self.assertEqual(
                    sum(
                        "scenario_evidence" in observation
                        for observation in result["observations"]
                    ),
                    1,
                )

                # ---- contextual tool sequence ----
                expected_tools = SCENARIO_EXPECTED_TOOLS.get(scenario_id, [])
                self.assertEqual(result["used_tools"], expected_tools)

                # ---- Task 3: final report traceability ----
                self.assertIn("collected_evidence", report)
                self.assertIs(report["collected_evidence"], result["observations"])
                self.assertIn("investigation_trace", report)
                self.assertTrue(len(report["investigation_trace"]) > 0)

                # ---- Task 1: structured investigation trace ----
                trace = report["investigation_trace"]
                event_types = {event["event_type"] for event in trace}
                self.assertIn("AGENT_DECISION", event_types)
                self.assertIn("TOOL_CALL", event_types)
                self.assertIn("TOOL_RESULT", event_types)
                self.assertIn("PATTERN_ANALYSIS", event_types)
                self.assertIn("RISK_ASSESSMENT", event_types)
                self.assertIn("INVESTIGATION_COMPLETE", event_types)

                completion_events = [
                    event
                    for event in trace
                    if event["event_type"] == "INVESTIGATION_COMPLETE"
                ]
                self.assertEqual(len(completion_events), 1)
                self.assertEqual(
                    completion_events[0]["recommendation"],
                    expected["recommendation"],
                )

                risk_events = [
                    event for event in trace if event["event_type"] == "RISK_ASSESSMENT"
                ]
                self.assertEqual(len(risk_events), 1)
                self.assertEqual(risk_events[0]["risk_score"], expected["risk_score"])
                self.assertEqual(risk_events[0]["risk_level"], expected["risk_level"])

                # ---- Task 2: every risk factor is traceable ----
                for factor in report["risk_breakdown"]:
                    self.assertIn("evidence_refs", factor)
                    self.assertTrue(len(factor["evidence_refs"]) > 0)

    def test_scn005_has_full_kyc_and_complaint_evidence(self):
        result = graph.invoke(initial_state("SCN-005"))

        observations = result["observations"]

        counterparty_kyc = next(
            (
                observation["counterparty_kyc_evidence"]
                for observation in observations
                if "counterparty_kyc_evidence" in observation
            ),
            None,
        )
        counterparty_complaints = next(
            (
                observation["counterparty_complaint_evidence"]
                for observation in observations
                if "counterparty_complaint_evidence" in observation
            ),
            None,
        )

        self.assertIsNotNone(counterparty_kyc)
        self.assertTrue(counterparty_kyc["found"])
        self.assertEqual(counterparty_kyc["kyc_status"], "VERIFIED")
        self.assertEqual(counterparty_kyc["risk_rating"], "LOW")

        self.assertIsNotNone(counterparty_complaints)
        self.assertEqual(counterparty_complaints["complaint_count"], 0)

        sender_kyc = next(
            (
                observation
                for observation in observations
                if "kyc_status" in observation
            ),
            None,
        )
        self.assertIsNotNone(sender_kyc)
        self.assertEqual(sender_kyc["kyc_status"], "VERIFIED")
        self.assertEqual(sender_kyc["risk_rating"], "LOW")


if __name__ == "__main__":
    unittest.main()
