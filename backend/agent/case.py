# =========================================================
# TEST INVESTIGATION CASE
# =========================================================

DUMMY_CASE = {
    "case_id": "CASE-001",

    # IBM AML account identifier
    "account_key": "0127593:80A2A5100",

    # Why this case entered investigation
    # This currently represents the output from
    # the detection/ML layer.
    "detection": {
        "fraud_probability": 0.91,
        "risk_score": 91,
        "risk_level": "HIGH"
    }
}
