from typing import Dict, Any, List


def correlate_evidence(observations: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Correlate investigation evidence into an explainable
    risk assessment.

    Scoring weights are hackathon implementation rules.
    They are not IBM AML ground-truth labels.
    """

    findings = []
    risk_breakdown = []
    risk_score = 0

    transaction_evidence = {}
    kyc_evidence = {}
    network_evidence = {}
    complaint_evidence = {}
    pattern_evidence = {}

    # =====================================================
    # IDENTIFY EACH EVIDENCE SOURCE
    # =====================================================

    for observation in observations:

        if "transaction_count" in observation:
            transaction_evidence = observation

        elif "kyc_status" in observation:
            kyc_evidence = observation

        elif "total_linked_accounts" in observation:
            network_evidence = observation

        elif "complaint_count" in observation:
            complaint_evidence = observation

        elif "pattern_analysis" in observation:
            pattern_evidence = observation["pattern_analysis"]

    # =====================================================
    # TRANSACTION ANALYSIS
    # =====================================================

    if transaction_evidence:

        transaction_count = transaction_evidence.get("transaction_count", 0)

        summary = transaction_evidence.get("summary", {})

        unique_senders = summary.get("unique_senders", 0)

        unique_receivers = summary.get("unique_receivers", 0)

        findings.append(
            f"{transaction_count} transaction(s) " f"were identified for the account"
        )

        if unique_receivers > 1:

            findings.append(
                f"Account transacted with " f"{unique_receivers} unique receivers"
            )

            risk_score += 10

            risk_breakdown.append(
                {
                    "factor": "Multiple receivers",
                    "points": 10,
                    "reason": (f"{unique_receivers} unique receivers"),
                    "evidence_refs": ["transaction_history"],
                }
            )

        if unique_senders > 1:

            findings.append(
                f"Account received funds from " f"{unique_senders} unique senders"
            )

            risk_score += 10

            risk_breakdown.append(
                {
                    "factor": "Multiple senders",
                    "points": 10,
                    "reason": (f"{unique_senders} unique senders"),
                    "evidence_refs": ["transaction_history"],
                }
            )

    # =====================================================
    # KYC ANALYSIS
    # =====================================================

    if kyc_evidence:

        kyc_status = kyc_evidence.get("kyc_status")

        risk_rating = kyc_evidence.get("risk_rating")

        account_age = kyc_evidence.get("account_age_days")

        if kyc_status == "INCOMPLETE":

            findings.append("KYC is incomplete")

            risk_score += 20

            risk_breakdown.append(
                {
                    "factor": "Incomplete KYC",
                    "points": 20,
                    "reason": "KYC verification is incomplete",
                    "evidence_refs": ["kyc"],
                }
            )

        if risk_rating == "HIGH":

            findings.append("KYC risk rating is HIGH")

            risk_score += 20

            risk_breakdown.append(
                {
                    "factor": "High KYC risk",
                    "points": 20,
                    "reason": "KYC risk rating is HIGH",
                    "evidence_refs": ["kyc"],
                }
            )

        if account_age is not None:

            try:

                account_age = int(account_age)

                if account_age < 30:

                    findings.append(
                        f"Account is newly created " f"({account_age} days old)"
                    )

                    risk_score += 20

                    risk_breakdown.append(
                        {
                            "factor": "New account",
                            "points": 20,
                            "reason": (f"Account is {account_age} days old"),
                            "evidence_refs": ["kyc"],
                        }
                    )

            except (ValueError, TypeError):

                pass

    # =====================================================
    # NETWORK ANALYSIS
    # =====================================================

    if network_evidence:

        linked_count = network_evidence.get("total_linked_accounts", 0)

        if linked_count > 0:

            findings.append(
                f"Account has {linked_count} " f"directly linked account(s)"
            )

            points = min(linked_count * 5, 20)

            risk_score += points

            risk_breakdown.append(
                {
                    "factor": "Linked accounts",
                    "points": points,
                    "reason": (f"{linked_count} directly linked account(s)"),
                    "evidence_refs": ["linked_accounts"],
                }
            )

    # =====================================================
    # COMPLAINT ANALYSIS
    # =====================================================

    if complaint_evidence:

        complaint_count = complaint_evidence.get("complaint_count", 0)

        if complaint_count > 0:

            findings.append(
                f"{complaint_count} complaint(s) " f"are associated with the account"
            )

            points = min(complaint_count * 20, 20)

            risk_score += points

            risk_breakdown.append(
                {
                    "factor": "Complaints",
                    "points": points,
                    "reason": (
                        f"{complaint_count} complaint(s) "
                        f"associated with the account"
                    ),
                    "evidence_refs": ["complaints"],
                }
            )

    # =====================================================
    # PATTERN ANALYSIS
    # =====================================================

    detected_patterns = (
        pattern_evidence.get("patterns_detected", []) if pattern_evidence else []
    )

    detected_typologies = []

    for pattern in detected_patterns:

        if not pattern.get("pattern_detected", False):
            continue

        typology = pattern.get("typology", "UNKNOWN")

        detected_typologies.append(typology)

        # =================================================
        # FAN-OUT
        # =================================================

        if typology == "FAN-OUT":

            unique_destinations = pattern.get("unique_destinations", 0)

            findings.append(
                f"FAN-OUT pattern detected with "
                f"{unique_destinations} unique destination account(s)"
            )

            risk_score += 40

            risk_breakdown.append(
                {
                    "factor": "FAN-OUT pattern",
                    "points": 40,
                    "reason": (
                        f"{unique_destinations} unique " f"destination account(s)"
                    ),
                    "evidence_refs": ["pattern:FAN-OUT"],
                }
            )

        # =================================================
        # FAN-IN
        # =================================================

        elif typology == "FAN-IN":

            unique_sources = pattern.get("unique_sources", 0)

            findings.append(
                f"FAN-IN pattern detected with "
                f"{unique_sources} unique source account(s)"
            )

            risk_score += 40

            risk_breakdown.append(
                {
                    "factor": "FAN-IN pattern",
                    "points": 40,
                    "reason": (f"{unique_sources} unique " f"source account(s)"),
                    "evidence_refs": ["pattern:FAN-IN"],
                }
            )

        # =================================================
        # CYCLE
        # =================================================

        elif typology == "CYCLE":

            cycle_path = pattern.get("evidence", {}).get("cycle_path", [])

            hops = max(len(cycle_path) - 1, 0)

            findings.append(f"CYCLE pattern detected across " f"{hops} hop(s)")

            risk_score += 45

            risk_breakdown.append(
                {
                    "factor": "CYCLE pattern",
                    "points": 45,
                    "reason": (f"{hops} hop transaction cycle"),
                    "evidence_refs": ["pattern:CYCLE"],
                }
            )

        # =================================================
        # STACK
        # =================================================

        elif typology == "STACK":

            chain_count = pattern.get("chain_count", 0)

            findings.append(
                f"STACK pattern detected with " f"{chain_count} transaction chain(s)"
            )

            risk_score += 40

            risk_breakdown.append(
                {
                    "factor": "STACK pattern",
                    "points": 40,
                    "reason": (f"{chain_count} transaction chain(s)"),
                    "evidence_refs": ["pattern:STACK"],
                }
            )

        # =================================================
        # BIPARTITE
        # =================================================

        elif typology == "BIPARTITE":

            sender_count = pattern.get("sender_count", 0)

            receiver_count = pattern.get("receiver_count", 0)

            findings.append(
                f"BIPARTITE pattern detected connecting "
                f"{sender_count} sender(s) and "
                f"{receiver_count} receiver(s)"
            )

            risk_score += 40

            risk_breakdown.append(
                {
                    "factor": "BIPARTITE pattern",
                    "points": 40,
                    "reason": (
                        f"{sender_count} sender(s) -> " f"{receiver_count} receiver(s)"
                    ),
                    "evidence_refs": ["pattern:BIPARTITE"],
                }
            )

        # =================================================
        # UNKNOWN PATTERN
        # =================================================

        else:

            findings.append(f"{typology} laundering pattern detected")

            risk_score += 30

            risk_breakdown.append(
                {
                    "factor": f"{typology} pattern",
                    "points": 30,
                    "reason": "Laundering pattern detected",
                    "evidence_refs": [f"pattern:{typology}"],
                }
            )

    # =====================================================
    # FINAL SCORE
    # =====================================================

    risk_score = min(risk_score, 100)

    # =====================================================
    # RISK LEVEL
    # =====================================================

    if risk_score >= 75:

        risk_level = "HIGH"

    elif risk_score >= 40:

        risk_level = "MEDIUM"

    else:

        risk_level = "LOW"

    # =====================================================
    # TYPOLOGY
    # =====================================================

    if detected_typologies:

        typology = detected_typologies[0]

    else:

        typology = "UNKNOWN"

    # =====================================================
    # RECOMMENDATION
    # =====================================================

    if risk_level == "HIGH":

        recommendation = "ESCALATE"

    elif risk_level == "MEDIUM":

        recommendation = "REVIEW"

    else:

        recommendation = "CLEAR"

    # =====================================================
    # STRUCTURED RESULT
    # =====================================================

    return {
        "risk_score": risk_score,
        "risk_level": risk_level,
        "typology": typology,
        "evidence": findings,
        "risk_breakdown": risk_breakdown,
        "recommendation": recommendation,
    }
