import unittest

from agent.tools import get_complaints, get_kyc


FALSE_POSITIVE_SENDER = "0112733:804BD7DC0"
FALSE_POSITIVE_RECEIVER = "0013029:8058F2A30"


class ToolDataSourceTests(unittest.TestCase):
    def test_demo_kyc_behavior_is_unchanged(self):
        result = get_kyc("021174:800737690")

        self.assertTrue(result["found"])
        self.assertEqual(result["kyc_status"], "VERIFIED")
        self.assertEqual(result["risk_rating"], "HIGH")
        self.assertEqual(
            result["customer_type"],
            "SYNTHETIC_DEMO_CUSTOMER",
        )

    def test_demo_complaint_behavior_is_unchanged(self):
        result = get_complaints("021174:800737690")

        self.assertEqual(result["complaint_count"], 1)
        self.assertEqual(result["complaints"][0]["scenario_id"], "SCN-001")
        self.assertEqual(
            result["complaints"][0]["severity"],
            "HIGH",
        )

    def test_full_kyc_finds_false_positive_accounts(self):
        for account_key in (
            FALSE_POSITIVE_SENDER,
            FALSE_POSITIVE_RECEIVER,
        ):
            with self.subTest(account_key=account_key):
                result = get_kyc(account_key, source="full")

                self.assertTrue(result["found"])
                self.assertEqual(result["kyc_status"], "VERIFIED")
                self.assertEqual(result["risk_rating"], "LOW")

    def test_full_complaints_are_absent_for_false_positive_accounts(self):
        for account_key in (
            FALSE_POSITIVE_SENDER,
            FALSE_POSITIVE_RECEIVER,
        ):
            with self.subTest(account_key=account_key):
                result = get_complaints(account_key, source="full")

                self.assertEqual(result["complaint_count"], 0)
                self.assertEqual(result["complaints"], [])


if __name__ == "__main__":
    unittest.main()
