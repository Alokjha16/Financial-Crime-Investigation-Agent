from typing import TypedDict, List, Dict, Any


class InvestigationState(TypedDict):
    case_id: str
    account_key: str
    scenario_id: str

    transactions: List[Dict[str, Any]]

    observations: List[Dict[str, Any]]

    decision: str

    timeline: List[str]
    investigation_trace: List[Dict[str, Any]]
    used_tools: List[str]
    investigation_plan: list[str]

    report: Dict[str, Any]

    demo_mode: bool
