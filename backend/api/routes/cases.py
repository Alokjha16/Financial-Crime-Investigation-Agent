import json
from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from backend.database.repository import (
    CaseRepository,
    MockDataRepository,
    TransactionRepository,
)
from backend.api.schemas import (
    CaseObjectContract,
    DecisionRequest,
    DecisionType,
    CaseStatus,
    CaseDetailResponse,
    InvestigationTimelineEntry,
    AuditLogResponse,
    InvestigateResponse,
    AgentResultContract,
    AgentResultResponse,
    EvidenceResponse,
)

router = APIRouter()


@router.get("/", response_model=List[CaseObjectContract])
def get_cases(status: Optional[str] = None, limit: int = 100):
    repo = CaseRepository()
    cases = repo.get_all(status=status, limit=limit)
    result = []
    for c in cases:
        evidence = c.get("evidence")
        if isinstance(evidence, str):
            try:
                evidence = json.loads(evidence)
            except (json.JSONDecodeError, TypeError):
                evidence = []
        result.append(
            CaseObjectContract(
                case_id=c["case_id"],
                status=c["status"],
                risk_score=c["risk_score"],
                risk_level=c["risk_level"],
                evidence=evidence or [],
                decision=c.get("decision"),
                created_at=c["created_at"],
            )
        )
    return result


# ── Aggregate stats for the dashboard ──────────────────────────────────────
@router.get("/stats")
def get_stats():
    """Aggregate case statistics for the analyst dashboard."""
    repo = CaseRepository()
    all_cases = repo.get_all(limit=10000)

    counts = {
        "total": len(all_cases),
        "new": 0,
        "under_investigation": 0,
        "under_review": 0,
        "escalated": 0,
        "closed": 0,
        "false_positive": 0,
    }
    risk_scores = []

    for c in all_cases:
        status = (c.get("status") or "new").lower()
        if status in counts:
            counts[status] += 1
        score = c.get("risk_score")
        if score is not None:
            risk_scores.append(int(score))

    avg_risk = round(sum(risk_scores) / len(risk_scores), 1) if risk_scores else 0
    high   = sum(1 for c in all_cases if (c.get("risk_level") or "").upper() == "HIGH")
    medium = sum(1 for c in all_cases if (c.get("risk_level") or "").upper() == "MEDIUM")
    low    = sum(1 for c in all_cases if (c.get("risk_level") or "").upper() == "LOW")

    return {
        **counts,
        "avg_risk_score": avg_risk,
        "high_risk": high,
        "medium_risk": medium,
        "low_risk": low,
    }


@router.get("/{case_id}", response_model=CaseDetailResponse)
def get_case(case_id: str):
    repo = CaseRepository()
    case = repo.get_by_id(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    timeline_logs = repo.get_audit_logs(case_id)
    timeline = [
        InvestigationTimelineEntry(
            timestamp=log["timestamp"],
            action=log["action"],
            actor=log["actor"],
            actor_type=log["actor_type"],
            details=log.get("details") or {},
        )
        for log in timeline_logs
    ]

    # Parse evidence from JSON if it's a string
    evidence = case.get("evidence")
    if isinstance(evidence, str):
        try:
            evidence = json.loads(evidence)
        except (json.JSONDecodeError, TypeError):
            evidence = []

    return CaseDetailResponse(
        case_id=case["case_id"],
        status=case["status"],
        risk_score=case["risk_score"],
        risk_level=case["risk_level"],
        evidence=evidence or [],
        decision=case.get("decision"),
        created_at=case["created_at"],
        typology=case.get("typology"),
        recommendation=case.get("recommendation"),
        timeline=timeline if timeline else None,
    )


# ── Timeline: audit log events formatted for the frontend ──────────────────
@router.get("/{case_id}/timeline")
def get_case_timeline(case_id: str):
    """Returns audit log events formatted as a frontend investigation timeline."""
    repo = CaseRepository()
    case = repo.get_by_id(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    logs = repo.get_audit_logs(case_id)
    return [
        {
            "timestamp": (
                log["timestamp"].isoformat()
                if hasattr(log["timestamp"], "isoformat")
                else str(log["timestamp"])
            ),
            "action": log["action"],
            "actor": log["actor"],
            "actor_type": log["actor_type"],
            "details": log.get("details") or {},
        }
        for log in logs
    ]


# ── Network graph derived from pattern_analysis evidence ───────────────────
@router.get("/{case_id}/network")
def get_case_network(case_id: str):
    """
    Build a network graph from the case's stored pattern_analysis evidence.
    Returns { nodes, edges, summary }.
    """
    repo = CaseRepository()
    case = repo.get_by_id(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    evidence_rows = repo.get_evidence(case_id)
    nodes: list = []
    edges: list = []
    typology = case.get("typology") or "UNKNOWN"
    node_ids: set = set()

    def add_node(node_id: str, node_type: str = "secondary"):
        if node_id and node_id not in node_ids:
            nodes.append({"id": node_id, "label": node_id[:14], "type": node_type})
            node_ids.add(node_id)

    for row in evidence_rows:
        if row.get("evidence_type") != "pattern_analysis":
            continue
        data = row.get("data") or {}
        for pattern in data.get("patterns_detected", []):
            if not pattern.get("pattern_detected"):
                continue
            ev = pattern.get("evidence", {})
            src = case.get("account_id", "")
            add_node(src, "primary")

            for dest in (ev.get("destination_accounts") or [])[:20]:
                add_node(dest, "secondary")
                edges.append({"source": src, "target": dest, "suspicious": True})

            for src_acc in (ev.get("source_accounts") or [])[:20]:
                add_node(src_acc, "secondary")
                edges.append({"source": src_acc, "target": src, "suspicious": True})

            cycle_path = ev.get("cycle_path") or []
            for i, acc in enumerate(cycle_path):
                add_node(acc, "cycle")
                if i > 0:
                    edges.append({"source": cycle_path[i - 1], "target": acc, "suspicious": True})

    # Minimal fallback: single primary node
    if not nodes:
        account_id = case.get("account_id") or "ACCOUNT"
        add_node(account_id, "primary")

    return {
        "nodes": nodes,
        "edges": edges,
        "summary": {"node_count": len(nodes), "edge_count": len(edges), "typology": typology},
    }


# ── Risk factors from evidence table ───────────────────────────────────────
@router.get("/{case_id}/risk-factors")
def get_risk_factors(case_id: str):
    """Returns the agent's itemised risk breakdown stored after investigation."""
    repo = CaseRepository()
    case = repo.get_by_id(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    for row in repo.get_evidence(case_id):
        if row.get("evidence_type") == "risk_breakdown":
            data = row.get("data") or {}
            return {
                "case_id": case_id,
                "risk_score": case.get("risk_score", 0),
                "risk_level": case.get("risk_level", "UNKNOWN"),
                "risk_breakdown": data.get("risk_breakdown", []),
            }

    # Fallback: derive from evidence strings
    evidence = case.get("evidence")
    if isinstance(evidence, str):
        try:
            evidence = json.loads(evidence)
        except Exception:
            evidence = []

    return {
        "case_id": case_id,
        "risk_score": case.get("risk_score", 0),
        "risk_level": case.get("risk_level", "UNKNOWN"),
        "risk_breakdown": [
            {"factor": item, "points": None, "reason": item}
            for item in (evidence or [])
        ],
    }


@router.get("/{case_id}/evidence", response_model=List[EvidenceResponse])
def get_case_evidence(case_id: str):
    repo = CaseRepository()
    case = repo.get_by_id(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    evidence = repo.get_evidence(case_id)
    return evidence


@router.post("/{case_id}/investigate", response_model=InvestigateResponse)
def investigate_case(case_id: str):
    repo = CaseRepository()
    case = repo.get_by_id(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    if case.get("status") != CaseStatus.NEW.value:
        raise HTTPException(
            status_code=400,
            detail=f"Investigation can only be started on cases in {CaseStatus.NEW.value} status. Current status: {case.get('status')}",
        )

    repo.update_status(case_id, CaseStatus.UNDER_INVESTIGATION.value)

    repo.add_audit_log(
        case_id=case_id,
        action="investigation_started",
        actor="agent",
        actor_type="ai_agent",
        details={"trigger": "manual"},
    )

    return InvestigateResponse(
        case_id=case_id,
        status=CaseStatus.UNDER_INVESTIGATION.value,
        message="Investigation started. Agent will process this case.",
    )


@router.post("/{case_id}/decision")
def submit_decision(case_id: str, request: DecisionRequest):
    repo = CaseRepository()
    case = repo.get_by_id(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    decision_val = request.decision.value if hasattr(request.decision, "value") else str(request.decision).lower()

    repo.update_decision(
        case_id=case_id,
        decision=decision_val,
        notes=request.notes,
        decided_by=request.decided_by or "analyst",
    )

    repo.add_audit_log(
        case_id=case_id,
        action="decision_made",
        actor=request.decided_by or "analyst",
        actor_type="human",
        details={"decision": decision_val, "notes": request.notes},
    )

    # Update corresponding status in DB
    target_status = CaseStatus.UNDER_REVIEW.value
    if decision_val == "escalate":
        target_status = CaseStatus.ESCALATED.value
    elif decision_val == "clear":
        target_status = CaseStatus.CLOSED.value
    elif decision_val == "false_positive":
        target_status = CaseStatus.FALSE_POSITIVE.value

    try:
        from backend.database.connection import get_connection
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE cases SET status = %s, updated_at = NOW() WHERE case_id = %s", (target_status, case_id))
        conn.commit()
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"Status update warning: {e}")

    return {"status": "success", "case_id": case_id, "decision": decision_val, "new_status": target_status}


@router.post("/{case_id}/agent-result", response_model=AgentResultResponse)
def submit_agent_result(case_id: str, agent_result: AgentResultContract):
    repo = CaseRepository()
    case = repo.get_by_id(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    # Validate case is in appropriate state for agent result
    if case.get("status") not in [CaseStatus.NEW.value, CaseStatus.UNDER_INVESTIGATION.value]:
        raise HTTPException(
            status_code=400,
            detail=f"Case must be in {CaseStatus.NEW.value} or {CaseStatus.UNDER_INVESTIGATION.value} status"
        )

    # Validate case_id matches
    if agent_result.case_id != case_id:
        raise HTTPException(status_code=400, detail="Case ID mismatch")

    try:
        repo.submit_agent_result(case_id, agent_result.model_dump())
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

    return AgentResultResponse(
        case_id=case_id,
        status=CaseStatus.UNDER_REVIEW,
        message="Agent investigation result received and case updated",
    )
