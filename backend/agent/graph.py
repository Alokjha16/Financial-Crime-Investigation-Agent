import json
import sys
from langgraph.graph import StateGraph, START, END

from agent.state import InvestigationState
from agent.tools import (
    get_transactions,
    get_kyc,
    get_linked_accounts,
    get_complaints,
    get_transaction_graph,
        get_scenario_transactions,
)
from agent.gemini import choose_investigation_plan
from agent.risk import correlate_evidence
from agent.pattern_engine import detect_all_patterns


CONTROLLED_SCENARIOS = frozenset({
    "SCN-001",
    "SCN-002",
    "SCN-003",
    "SCN-004",
    "SCN-005",
})


def has_scenario_evidence(state: InvestigationState) -> bool:
    """Return whether controlled scenario transactions are already loaded."""
    return any(
        "scenario_evidence" in observation
        for observation in state["observations"]
    )


def get_investigation_config(state: InvestigationState) -> dict:
    """Read optional controlled-scenario configuration from evidence."""
    for observation in reversed(state["observations"]):
        scenario_evidence = observation.get("scenario_evidence")

        if scenario_evidence:
            return scenario_evidence.get("investigation_config", {})

    return {}

def add_trace_event(
    state: InvestigationState,
    event_type: str,
    **details,
):
    """Append one structured audit event without changing the CLI timeline."""
    return [
        *state["investigation_trace"],
        {
            "event_type": event_type,
            **details,
        },
    ]

# =========================================================
# GEMINI / DEMO AGENT NODE
# =========================================================

def agent_node(state: InvestigationState):

    timeline = state["timeline"]

    # =====================================================
    # CONTROLLED SCENARIO INVESTIGATIONS
    # =====================================================

    scenario_id = state.get("scenario_id")

    if scenario_id in CONTROLLED_SCENARIOS:

        if not has_scenario_evidence(state):

            timeline.append(
                "AGENT: Using deterministic controlled scenario flow"
            )

            timeline.append(
                "AGENT DECISION: get_scenario_evidence"
            )

            timeline.append(
                "AGENT REASON: Loading controlled scenario transaction "
                "evidence before analysis."
            )

            return {
                "decision": "get_scenario_evidence",
                "timeline": timeline,
                "investigation_trace": add_trace_event(
                  state,
                 "AGENT_DECISION",
                 decision="get_scenario_evidence",
            ),

            }

        investigation_config = get_investigation_config(state)
        deterministic_tools = investigation_config.get(
            "deterministic_tools",
            [],
        )

        if deterministic_tools and not state.get("investigation_plan"):

            timeline.append(
                "AGENT: Using configured deterministic investigation plan"
            )

            timeline.append(
                f"AGENT PLAN: {', '.join(deterministic_tools)}"
            )

            return {
                "investigation_plan": deterministic_tools,
                "decision": deterministic_tools[0],
                "timeline": timeline,
                "investigation_trace": add_trace_event(
                    state,
                    "AGENT_DECISION",
                    decision=deterministic_tools[0],
                ),
            }

        # SCN-002 keeps its deterministic contextual evidence sequence.
        # The other controlled scenarios have sufficient scenario evidence
        # to continue straight to pattern analysis.
        if scenario_id != "SCN-002" and not deterministic_tools:

            timeline.append(
                "AGENT: Using deterministic demo investigation flow"
            )

            timeline.append(
                "AGENT DECISION: investigation_complete"
            )

            timeline.append(
                "AGENT REASON: "
                "Scenario-level transaction evidence is sufficient "
                "for network pattern analysis."
            )

            return {
                "decision": "investigation_complete",
                "timeline": timeline,
                "investigation_trace": add_trace_event(
                    state,
                    "AGENT_DECISION",
                    decision="investigation_complete",
                ),
            }

        # =====================================================
    # DEMO MODE — NO GEMINI CALL
    # =====================================================

    if state.get("demo_mode", False):

        if not state.get("investigation_plan"):

            tools = [
                "get_transactions",
                "get_kyc",
                "get_linked_accounts",
                "get_complaints"
            ]

            timeline.append(
                "AGENT: Deterministic demo mode"
            )

            timeline.append(
                f"AGENT PLAN: {', '.join(tools)}"
            )

            timeline.append(
                "AGENT REASON: "
                "Using a predefined investigation plan "
                "for reproducible demo execution."
            )

            return {
                "investigation_plan": tools,
                "decision": tools[0],
                "timeline": timeline,
                "investigation_trace": add_trace_event(
                    state,
                    "AGENT_DECISION",
                    decision=tools[0],
                ),
            }

    # =====================================================
    # LIVE GEMINI PLAN
    # =====================================================

    if not state.get("investigation_plan"):

        timeline.append(
            "AGENT: Asking Gemini to create investigation plan"
        )

        plan = choose_investigation_plan(
            account_key=state["account_key"],
            observations=state["observations"],
        )

        if plan and plan.get("tools"):

            tools = plan["tools"]

            timeline.append(
                "AGENT: Gemini investigation plan received"
            )

            timeline.append(
                f"AGENT PLAN: {', '.join(tools)}"
            )

            timeline.append(
                f"AGENT REASON: {plan.get('reason', '')}"
            )

            return {
                "investigation_plan": tools,
                "decision": tools[0],
                "timeline": timeline,
                "investigation_trace": add_trace_event(
                    state,
                    "AGENT_DECISION",
                    decision=tools[0],
                ),
            }

        timeline.append(
            "AGENT: Gemini unavailable"
        )

        fallback_plan = [
            "get_transactions",
            "get_kyc",
            "get_linked_accounts",
            "get_complaints"
        ]

        timeline.append(
            "AGENT: Falling back to deterministic investigation plan"
        )

        timeline.append(
            f"AGENT PLAN: {', '.join(fallback_plan)}"
        )

        return {
            "investigation_plan": fallback_plan,
            "decision": fallback_plan[0],
            "timeline": timeline,
            "investigation_trace": add_trace_event(
                state,
                "AGENT_DECISION",
                decision=fallback_plan[0],
            ),
        }
        # =================================================
        # GEMINI FALLBACK
        # =================================================

        timeline.append(
            "AGENT: Gemini unavailable"
        )

        timeline.append(
            "AGENT: Falling back to deterministic investigation plan"
        )

        fallback_plan = [
            "get_transactions",
            "get_kyc",
            "get_linked_accounts",
            "get_complaints"
        ]

        timeline.append(
            f"AGENT PLAN: {', '.join(fallback_plan)}"
        )

        return {
            "investigation_plan": fallback_plan,
            "decision": fallback_plan[0],
            "timeline": timeline,
        }

    # =====================================================
    # EXECUTE EXISTING PLAN
    # =====================================================

    plan = state["investigation_plan"]

    used_tools = state["used_tools"]

    remaining_tools = [
        tool
        for tool in plan
        if tool not in used_tools
    ]

    # =====================================================
    # PLAN COMPLETE
    # =====================================================

    if not remaining_tools:

        timeline.append(
            "AGENT DECISION: investigation_complete"
        )

        timeline.append(
            "AGENT REASON: "
            "All tools selected by the investigation plan "
            "have been executed."
        )

        return {
            "decision": "investigation_complete",
            "timeline": timeline,
            "investigation_trace": add_trace_event(
                state,
                "AGENT_DECISION",
                decision="investigation_complete",
            ),
        }

    # =====================================================
    # NEXT TOOL FROM EXISTING PLAN
    # =====================================================

    tool_name = remaining_tools[0]

    timeline.append(
        f"AGENT DECISION: {tool_name}"
    )

    timeline.append(
        "AGENT REASON: "
        "Executing the next tool from the investigation plan."
    )

    return {
        "decision": tool_name,
        "timeline": timeline,
        "investigation_trace": add_trace_event(
            state,
            "AGENT_DECISION",
            decision=tool_name,
        ),
    }

    # =========================================================
# TRANSACTION TOOL NODE
# =========================================================

def transaction_tool_node(
    state: InvestigationState
):

    timeline = state["timeline"]

    timeline.append(
        "TOOL CALL: get_transactions()"
    )

    result = get_transactions(
        state["account_key"]
    )

    timeline.append(
        f"TOOL RESULT: "
        f"{result['transaction_count']} transactions found"
    )

    return {
    "transactions": result["transactions"],

    "observations": [
        *state["observations"],
        result,
    ],

    "used_tools": [
        *state["used_tools"],
        "get_transactions",
    ],

    "timeline": timeline,

    "investigation_trace": [
        *state["investigation_trace"],
        {
            "event_type": "TOOL_CALL",
            "tool": "get_transactions",
        },
        {
            "event_type": "TOOL_RESULT",
            "tool": "get_transactions",
            "status": "SUCCESS",
            "transaction_count": result["transaction_count"],
        },
    ],
}

# =========================================================
# KYC TOOL NODE
# =========================================================

def kyc_tool_node(
    state: InvestigationState
):

    timeline = state["timeline"]

    timeline.append(
        "TOOL CALL: get_kyc()"
    )

    result = get_kyc(
        state["account_key"],
        source=get_investigation_config(state).get(
            "kyc_source",
            "demo",
        ),
    )

    if result.get("found"):

        timeline.append(
            f"TOOL RESULT: "
            f"KYC={result.get('kyc_status')}, "
            f"Risk={result.get('risk_rating')}"
        )

    else:

        timeline.append(
            "TOOL RESULT: KYC record not found"
        )

    return {
      "observations": [
        *state["observations"],
        result,
    ],

    "used_tools": [
        *state["used_tools"],
        "get_kyc",
    ],

    "timeline": timeline,

    "investigation_trace": [
        *state["investigation_trace"],
        {
            "event_type": "TOOL_CALL",
            "tool": "get_kyc",
        },
        {
            "event_type": "TOOL_RESULT",
            "tool": "get_kyc",
            "status": "SUCCESS",
            "kyc_status": result.get("kyc_status"),
            "risk_rating": result.get("risk_rating"),
        },
    ],
}


# =========================================================
# LINKED ACCOUNTS TOOL NODE
# =========================================================

def linked_accounts_tool_node(
    state: InvestigationState
):

    timeline = state["timeline"]

    timeline.append(
        "TOOL CALL: get_linked_accounts()"
    )

    result = get_linked_accounts(
        state["account_key"]
    )

    timeline.append(
        f"TOOL RESULT: "
        f"{result['total_linked_accounts']} "
        f"linked accounts found"
    )

    return {
        "observations": [
            *state["observations"],
            result,
        ],

        "used_tools": [
            *state["used_tools"],
            "get_linked_accounts",
        ],

        "timeline": timeline,

        "investigation_trace": [
            *state["investigation_trace"],
            {
                "event_type": "TOOL_CALL",
                "tool": "get_linked_accounts",
            },
            {
                "event_type": "TOOL_RESULT",
                "tool": "get_linked_accounts",
                "status": "SUCCESS",
                "total_linked_accounts": result["total_linked_accounts"],
            },
        ],
    }


# =========================================================
# COMPLAINTS TOOL NODE
# =========================================================

def complaints_tool_node(
    state: InvestigationState
):

    timeline = state["timeline"]

    timeline.append(
        "TOOL CALL: get_complaints()"
    )

    result = get_complaints(
        state["account_key"],
        source=get_investigation_config(state).get(
            "complaints_source",
            "demo",
        ),
    )

    timeline.append(
        f"TOOL RESULT: "
        f"{result.get('complaint_count', 0)} complaints found"
    )

    return {
        "observations": [
            *state["observations"],
            result,
        ],

        "used_tools": [
            *state["used_tools"],
            "get_complaints",
        ],

        "timeline": timeline,

        "investigation_trace": [
    *state["investigation_trace"],
    {
        "event_type": "TOOL_CALL",
        "tool": "get_complaints",
    },
    {
        "event_type": "TOOL_RESULT",
        "tool": "get_complaints",
        "status": "SUCCESS",
        "complaint_count": result.get("complaint_count", 0),
    },
],
    }


# =========================================================
# COUNTERPARTY EVIDENCE NODES
# =========================================================

def counterparty_transactions_tool_node(state: InvestigationState):
    timeline = state["timeline"]
    counterparty_key = get_investigation_config(state)[
        "counterparty_account_key"
    ]

    timeline.append("TOOL CALL: get_counterparty_transactions()")
    result = get_transactions(counterparty_key)
    timeline.append(
        f"TOOL RESULT: {result['transaction_count']} "
        "counterparty transactions found"
    )

    return {
        "observations": [
            *state["observations"],
            {"counterparty_transaction_evidence": result},
        ],
        "used_tools": [
            *state["used_tools"],
            "get_counterparty_transactions",
        ],
        "timeline": timeline,

        "investigation_trace": [
            *state["investigation_trace"],
            {
                "event_type": "TOOL_CALL",
                "tool": "get_counterparty_transactions",
            },
            {
                "event_type": "TOOL_RESULT",
                "tool": "get_counterparty_transactions",
                "status": "SUCCESS",
                "transaction_count": result["transaction_count"],
            },
        ],
    }


def counterparty_kyc_tool_node(state: InvestigationState):
    timeline = state["timeline"]
    config = get_investigation_config(state)
    counterparty_key = config["counterparty_account_key"]

    timeline.append("TOOL CALL: get_counterparty_kyc()")
    result = get_kyc(
        counterparty_key,
        source=config.get("kyc_source", "demo"),
    )
    timeline.append(
        "TOOL RESULT: "
        f"Counterparty KYC={result.get('kyc_status')}, "
        f"Risk={result.get('risk_rating')}"
    )

    return {
        "observations": [
            *state["observations"],
            {"counterparty_kyc_evidence": result},
        ],
        "used_tools": [
            *state["used_tools"],
            "get_counterparty_kyc",
        ],
        "timeline": timeline,

        "investigation_trace": [
    *state["investigation_trace"],
    {
        "event_type": "TOOL_CALL",
        "tool": "get_counterparty_kyc",
    },
    {
        "event_type": "TOOL_RESULT",
        "tool": "get_counterparty_kyc",
        "status": "SUCCESS",
        "kyc_status": result.get("kyc_status"),
        "risk_rating": result.get("risk_rating"),
    },
    ],
    }


def counterparty_complaints_tool_node(state: InvestigationState):
    timeline = state["timeline"]
    config = get_investigation_config(state)
    counterparty_key = config["counterparty_account_key"]

    timeline.append("TOOL CALL: get_counterparty_complaints()")
    result = get_complaints(
        counterparty_key,
        source=config.get("complaints_source", "demo"),
    )
    timeline.append(
        "TOOL RESULT: "
        f"{result['complaint_count']} counterparty complaints found"
    )

    return {
        "observations": [
            *state["observations"],
            {"counterparty_complaint_evidence": result},
        ],
        "used_tools": [
            *state["used_tools"],
            "get_counterparty_complaints",
        ],
        "timeline": timeline,
        "investigation_trace": [
    *state["investigation_trace"],
    {
        "event_type": "TOOL_CALL",
        "tool": "get_counterparty_complaints",
    },
    {
        "event_type": "TOOL_RESULT",
        "tool": "get_counterparty_complaints",
        "status": "SUCCESS",
        "complaint_count": result.get("complaint_count", 0),
    },
],
    }


# =========================================================
# SCENARIO EVIDENCE NODE
# =========================================================

def scenario_evidence_node(
    state: InvestigationState
):
    timeline = state["timeline"]

    timeline.append(
        f"SCENARIO ENGINE: Loading full evidence for "
        f"{state['scenario_id']}"
    )

    result = get_scenario_transactions(
        state["scenario_id"]
    )

    timeline.append(
        f"SCENARIO EVIDENCE: "
        f"{result['transaction_count']} transactions loaded"
    )

    return {
        "transactions": result["transactions"],

        "observations": [
            *state["observations"],
            {
                "scenario_evidence": result
            }
        ],

        "timeline": timeline,

        "investigation_trace": [
            *state["investigation_trace"],
            {
                "event_type": "TOOL_CALL",
                "tool": "get_scenario_transactions",
            },
            {
                "event_type": "TOOL_RESULT",
                "tool": "get_scenario_transactions",
                "status": "SUCCESS",
                "scenario_id": state["scenario_id"],
                "transaction_count": result["transaction_count"],
            },
        ],
    }

# =========================================================
# PATTERN ANALYSIS NODE
# =========================================================

def pattern_analysis_node(
    state: InvestigationState
):

    timeline = state["timeline"]

    timeline.append(
        "PATTERN ENGINE: Analyzing transaction network"
    )

    if state["scenario_id"] in CONTROLLED_SCENARIOS:

        scenario_evidence = next(
            (
                observation["scenario_evidence"]
                for observation in reversed(state["observations"])
                if "scenario_evidence" in observation
            ),
            {},
        )

        graph_transactions = scenario_evidence.get(
            "transactions",
            state["transactions"],
        )

    else:

        graph_result = get_transaction_graph(
            state["account_key"],
            max_hops=10
        )

        graph_transactions = graph_result.get(
            "transactions",
            []
        )

    result = detect_all_patterns(
        graph_transactions,
        state["account_key"],
        include_network_patterns=(
            state["scenario_id"] in CONTROLLED_SCENARIOS
        )
    )

    patterns = result.get(
        "patterns_detected",
        []
    )

    detected_typology = "NONE"

    if result.get("pattern_count", 0) > 0:

        for pattern in patterns:

            if not pattern.get(
                "pattern_detected",
                False
            ):
                continue

            typology = pattern.get(
                "typology",
                "UNKNOWN"
            )

            if detected_typology == "NONE":
                detected_typology = typology

            timeline.append(
                f"PATTERN DETECTED: {typology}"
            )

            evidence = pattern.get(
                "evidence",
                {}
            )

            if typology == "CYCLE":

                cycle_path = evidence.get(
                    "cycle_path",
                    []
                )

                timeline.append(
                    f"CYCLE EVIDENCE: "
                    f"{max(len(cycle_path) - 1, 0)} "
                    f"hop transaction path"
                )

            elif typology == "FAN-OUT":

                destinations = pattern.get(
                    "unique_destinations",
                    0
                )

                timeline.append(
                    f"FAN-OUT EVIDENCE: "
                    f"{destinations} destination accounts"
                )

            elif typology == "FAN-IN":

                sources = pattern.get(
                    "unique_sources",
                    0
                )

                timeline.append(
                    f"FAN-IN EVIDENCE: "
                    f"{sources} source accounts"
                )

            elif typology == "STACK":

                chain_count = pattern.get(
                    "chain_count",
                    0
                )

                timeline.append(
                    f"STACK EVIDENCE: "
                    f"{chain_count} transaction chains"
                )

            elif typology == "BIPARTITE":

                sender_count = pattern.get(
                    "sender_count",
                    0
                )

                receiver_count = pattern.get(
                    "receiver_count",
                    0
                )

                timeline.append(
                    f"BIPARTITE EVIDENCE: "
                    f"{sender_count} senders -> "
                    f"{receiver_count} receivers"
                )

    else:

        timeline.append(
            "PATTERN ENGINE: "
            "No known laundering pattern detected"
        )

    return {
        "observations": [
            *state["observations"],
            {
                "pattern_analysis": result
            }
        ],

        "timeline": timeline,

        "investigation_trace": add_trace_event(
            state,
            "PATTERN_ANALYSIS",
            status="SUCCESS",
            pattern_count=result.get("pattern_count", 0),
            typology=detected_typology,
        ),
    }


# =========================================================
# RISK ASSESSMENT NODE
# =========================================================

def risk_assessment_node(
    state: InvestigationState
):

    timeline = state["timeline"]

    timeline.append(
        "RISK ENGINE: Correlating collected evidence"
    )

    result = correlate_evidence(
        state["observations"]
    )

    pattern_analysis = {}

    for observation in state["observations"]:

        if "pattern_analysis" in observation:

            pattern_analysis = observation[
                "pattern_analysis"
            ]

    updated_trace = add_trace_event(
        state,
        "RISK_ASSESSMENT",
        status="SUCCESS",
        risk_score=result["risk_score"],
        risk_level=result["risk_level"],
        typology=result["typology"],
        recommendation=result["recommendation"],
    )

    updated_trace = [
        *updated_trace,
        {
            "event_type": "INVESTIGATION_COMPLETE",
            "decision": "investigation_complete",
            "recommendation": result["recommendation"],
        },
    ]

    report = {
        "case_id": state["case_id"],
        "account_key": state["account_key"],
        "risk_score": result["risk_score"],
        "risk_level": result["risk_level"],
        "typology": result["typology"],
        "evidence": result["evidence"],
        "risk_breakdown": result["risk_breakdown"],
        "pattern_analysis": pattern_analysis,
        "collected_evidence": state["observations"],
        "investigation_trace": updated_trace,
        "recommendation": result["recommendation"],
    }

    if state["scenario_id"] == "SCN-005":
                report["investigator_explanation"] = (
            f"The investigation identified a "
            f"{result['risk_level']} risk case with a "
            f"score of {result['risk_score']}/100.\n\n"
            "why_not_suspicious:\n"
            "The high-value transaction did not produce a "
            "supported laundering pattern. The investigated "
            "sender and counterparty both have VERIFIED, "
            "LOW-risk KYC records and no associated complaints. "
            "The sender's collected transaction history contains "
            "no laundering-labelled transactions.\n\n"
            "key_evidence:\n"
            "- Transaction amount: 714701452.89 Rupee\n"
            "- Payment format: Cheque\n"
            "- Transaction laundering label: 0\n"
            "- Sender KYC: VERIFIED / LOW\n"
            "- Counterparty KYC: VERIFIED / LOW\n"
            "- Sender complaints: 0\n"
            "- Counterparty complaints: 0\n"
            "- Supported laundering pattern: none\n\n"
            "investigator_action:\n"
            "Recommendation: CLEAR. "
            "No escalation is recommended based on the "
            "collected evidence."
        )
    else:
        report["investigator_explanation"] = (
            "The investigation identified a "
            f"{result['risk_level']} risk case with a "
            f"score of {result['risk_score']}/100. "
            f"The detected typology is {result['typology']}. "
            f"Recommendation: {result['recommendation']}."
        )

    report["explanation_source"] = "DETERMINISTIC"

    timeline.append(
        f"RISK RESULT: "
        f"{result['risk_level']} "
        f"({result['risk_score']}/100)"
    )

    timeline.append(
        f"TYPOLOGY: {result['typology']}"
    )

    timeline.append(
        f"RECOMMENDATION: "
        f"{result['recommendation']}"
    )

    return {
        "decision": "investigation_complete",
        "timeline": timeline,
        "report": report,
        "investigation_trace": updated_trace,
    }
# =========================================================
# ROUTER
# =========================================================

def route_after_agent(
    state: InvestigationState
):

    decision = state["decision"]

    if decision == "get_transactions":
        return "transactions"

    if decision == "get_kyc":
        return "kyc"

    if decision == "get_linked_accounts":
        return "linked_accounts"

    if decision == "get_complaints":

        return "complaints"
    if decision == "get_counterparty_kyc":
        return "counterparty_kyc"

    if decision == "get_counterparty_complaints":
        return "counterparty_complaints"

    if decision == "get_scenario_evidence":
        return "scenario_evidence"

    if decision == "investigation_complete":
        return "pattern_analysis"

    raise ValueError(
        f"Unknown agent decision: {decision}"
    )

# =========================================================
# BUILD GRAPH
# =========================================================

graph_builder = StateGraph(
    InvestigationState
)

graph_builder.add_node(
    "agent",
    agent_node
)

graph_builder.add_node(
    "transactions",
    transaction_tool_node
)

graph_builder.add_node(
    "pattern_analysis",
    pattern_analysis_node
)

graph_builder.add_node(
    "scenario_evidence",
    scenario_evidence_node
)

graph_builder.add_node(
    "kyc",
    kyc_tool_node
)

graph_builder.add_node(
    "linked_accounts",
    linked_accounts_tool_node
)

graph_builder.add_node(
    "complaints",
    complaints_tool_node
)
graph_builder.add_node(
    "counterparty_kyc",
    counterparty_kyc_tool_node
)

graph_builder.add_node(
    "counterparty_complaints",
    counterparty_complaints_tool_node
)

graph_builder.add_node(
    "risk_assessment",
    risk_assessment_node
)
graph_builder.add_edge(
    "scenario_evidence",
    "agent"
)

# =========================================================
# EDGES
# =========================================================

graph_builder.add_edge(
    START,
    "agent"
)

graph_builder.add_conditional_edges(
    "agent",
    route_after_agent
)
graph_builder.add_edge(
    "transactions",
    "agent"
)

graph_builder.add_edge(
    "kyc",
    "agent"
)

graph_builder.add_edge(
    "linked_accounts",
    "agent"
)

graph_builder.add_edge(
    "complaints",
    "agent"
)
graph_builder.add_edge(
    "counterparty_kyc",
    "agent"
)

graph_builder.add_edge(
    "counterparty_complaints",
    "agent"
)

graph_builder.add_edge(
    "risk_assessment",
    END
)
graph_builder.add_edge(
    "pattern_analysis",
    "risk_assessment"
)


# =========================================================
# COMPILE
# =========================================================

graph = graph_builder.compile()


# =========================================================
# TEST RUN
# =========================================================

# =========================================================
# TEST RUN
# =========================================================


if __name__ == "__main__":

    # =====================================================
    # SCENARIO SELECTION
    # =====================================================

    SCENARIOS = {
"SCN-001": {
    "case_id": "CASE-001",
    "account_key": "021174:800737690" ,
},
        "SCN-002": {
            "case_id": "CASE-002",
            "account_key": "01467:8013C4030",
        },

        "SCN-003": {
            "case_id": "CASE-003",
            "account_key": None,
        },

        "SCN-004": {
            "case_id": "CASE-004",
            "account_key": None,
        },
        "SCN-005": {
    "case_id": "CASE-005",
    "account_key": "0112733:804BD7DC0",
},
    }

    scenario_id = (
        sys.argv[1]
        if len(sys.argv) > 1
        else "SCN-002"
    )

    if scenario_id not in SCENARIOS:

        print(
            f"Unknown scenario: {scenario_id}"
        )

        print(
            "\nAvailable scenarios:"
        )

        for scenario in SCENARIOS:
            print(
                f"  {scenario}"
            )

        raise SystemExit(1)

    scenario = SCENARIOS[scenario_id]

    TEST_ACCOUNT = scenario["account_key"]

    CASE_ID = scenario["case_id"]

    # =====================================================
    # INITIAL STATE
    # =====================================================

    initial_state: InvestigationState = {

        "case_id": CASE_ID,

    "scenario_id": scenario_id,


        "account_key": TEST_ACCOUNT,

        "transactions": [],

        "observations": [],

        "decision": "",

        "timeline": [
            f"CASE RECEIVED: {CASE_ID}",
            f"SCENARIO: {scenario_id}"
        ],

        "investigation_trace": [],

        "used_tools": [],
        "investigation_plan": [],

        "report": {},

        "demo_mode": True
    }

    # =====================================================
    # RUN INVESTIGATION
    # =====================================================

    result = graph.invoke(
        initial_state
    )

    # =====================================================
    # PRINT RESULT
    # =====================================================

    print("\n")

    print(
        "======================================"
    )

    print(
        "   FINANCIAL CRIME INVESTIGATION"
    )

    print(
        "======================================"
    )

    print(
        f"\nScenario: {scenario_id}"
    )

    print(
        f"Case ID: {result['case_id']}"
    )

    print(
        f"Account: {result['account_key']}"
    )

    print(
        "\n---------- INVESTIGATION TIMELINE ----------"
    )

    for index, event in enumerate(
        result["timeline"],
        start=1
    ):

        print(
            f"{index}. {event}"
        )

    print(
        "\n---------- FINAL DECISION ----------"
    )

    print(
        result["decision"]
    )

    print(
        "\n---------- INVESTIGATION REPORT ----------"
    )

    print(
        json.dumps(
            result["report"],
            indent=4,
            default=str
        )
    )
