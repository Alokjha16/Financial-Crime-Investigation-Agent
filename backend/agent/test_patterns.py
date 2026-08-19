from typing import Dict, Any

from backend.agent.patterns import (
    detect_fan_out,
    detect_fan_in,
    detect_cycle,
    detect_stack,
    detect_bipartite,
)


def detect_all_patterns(
    transactions: list[dict],
    account_key: str | None = None,
    include_network_patterns: bool = True,
) -> Dict[str, Any]:
    """
    Run AML pattern detectors.

    Account-centric detectors:
        FAN-OUT
        FAN-IN
        CYCLE

    Evidence-level detectors:
        STACK
        BIPARTITE

    include_network_patterns can be disabled when the supplied
    transactions are a large multi-hop graph. This prevents
    unrelated network edges from creating false-positive
    STACK/BIPARTITE detections.
    """

    patterns = []

    # =====================================================
    # ACCOUNT-CENTRIC DETECTORS
    # =====================================================

    if account_key:

        fan_out = detect_fan_out(transactions, account_key)

        if fan_out["pattern_detected"]:
            patterns.append(fan_out)

        fan_in = detect_fan_in(transactions, account_key)

        if fan_in["pattern_detected"]:
            patterns.append(fan_in)

        cycle = detect_cycle(transactions, account_key, max_hops=10)

        if cycle["pattern_detected"]:
            patterns.append(cycle)

    # =====================================================
    # EVIDENCE-LEVEL DETECTORS
    # =====================================================

    if include_network_patterns:

        stack = detect_stack(transactions)

        if stack["pattern_detected"]:
            patterns.append(stack)

        bipartite = detect_bipartite(transactions)

        if bipartite["pattern_detected"]:
            patterns.append(bipartite)

    # =====================================================
    # FINAL RESULT
    # =====================================================

    return {
        "account_key": account_key,
        "patterns_detected": patterns,
        "pattern_count": len(patterns),
    }
