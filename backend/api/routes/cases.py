from fastapi import APIRouter, Depends, HTTPException
from mysql.connector import Error
from mysql.connector.cursor import MySQLCursorDict
from typing import List, Optional
from backend.database.connection import get_connection
from backend.database.repository import CaseRepository, MockDataRepository, TransactionRepository
from backend.api.schemas import (
    CaseObjectContract,
    DecisionRequest,
    DecisionType,
    CaseStatus,
    CaseDetailResponse,
    InvestigationTimelineEntry,
    AuditLogResponse,
    InvestigateResponse,
)

router = APIRouter()


@router.get("/", response_model=List[CaseObjectContract])
def get_cases(status: Optional[str] = None, limit: int = 100):
    repo = CaseRepository()
    cases = repo.get_all(status=status, limit=limit)
    return [
        CaseObjectContract(
            case_id=c["case_id"],
            status=c["status"],
            risk_score=c["risk_score"],
            risk_level=c["risk_level"],
            evidence=c.get("evidence") or [],
            decision=c.get("decision"),
            created_at=c["created_at"],
        )
        for c in cases
    ]


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

    return CaseDetailResponse(
        case_id=case["case_id"],
        status=case["status"],
        risk_score=case["risk_score"],
        risk_level=case["risk_level"],
        evidence=case.get("evidence") or [],
        decision=case.get("decision"),
        created_at=case["created_at"],
        typology=case.get("typology"),
        recommendation=case.get("recommendation"),
        timeline=timeline if timeline else None,
    )


@router.post("/{case_id}/investigate", response_model=InvestigateResponse)
def investigate_case(case_id: str):
    repo = CaseRepository()
    case = repo.get_by_id(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

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

    repo.update_decision(
        case_id=case_id,
        decision=request.decision.value,
        notes=request.notes,
        decided_by=request.decided_by,
    )

    repo.add_audit_log(
        case_id=case_id,
        action="decision_made",
        actor=request.decided_by or "analyst",
        actor_type="human",
        details={"decision": request.decision.value, "notes": request.notes},
    )

    if request.decision == DecisionType.ESCALATE:
        repo.update_status(case_id, CaseStatus.ESCALATED.value)
    elif request.decision == DecisionType.CLEAR:
        repo.update_status(case_id, CaseStatus.CLOSED.value)
    elif request.decision == DecisionType.FALSE_POSITIVE:
        repo.update_status(case_id, CaseStatus.FALSE_POSITIVE.value)

    return {"status": "success", "case_id": case_id, "decision": request.decision.value}
