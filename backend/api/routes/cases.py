import json
from fastapi import APIRouter, Depends, HTTPException
from mysql.connector import Error
from mysql.connector.cursor import MySQLCursorDict
from typing import List, Optional
from backend.database.connection import get_connection
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

    # Prevent duplicate decisions
    if case.get("decision"):
        raise HTTPException(status_code=400, detail="Decision already made for this case")

    # Only allow decisions on cases in UNDER_REVIEW status
    if case.get("status") != CaseStatus.UNDER_REVIEW.value:
        raise HTTPException(
            status_code=400, 
            detail=f"Can only make decisions on cases in {CaseStatus.UNDER_REVIEW.value} status"
        )

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

    conn = get_connection()
    try:
        cursor = conn.cursor()
        
        # Update case with agent results
        cursor.execute(
            """
            UPDATE cases 
            SET risk_score = %s, 
                risk_level = %s, 
                typology = %s, 
                evidence = %s, 
                recommendation = %s,
                status = %s,
                updated_at = NOW()
            WHERE case_id = %s
            """,
            (
                agent_result.risk_score,
                agent_result.risk_level,
                agent_result.typology,
                json.dumps(agent_result.evidence),
                agent_result.recommendation,
                CaseStatus.UNDER_REVIEW.value,
                case_id,
            ),
        )
        conn.commit()

        # Store investigation trace as evidence
        for trace_event in agent_result.investigation_trace:
            repo.add_evidence(
                case_id=case_id,
                evidence_data={
                    "evidence_type": "investigation_trace",
                    "description": f"Investigation trace event: {trace_event.get('event_type')}",
                    "source": "agent",
                    "data": trace_event,
                },
            )

        # Store risk breakdown as evidence
        repo.add_evidence(
            case_id=case_id,
            evidence_data={
                "evidence_type": "risk_breakdown",
                "description": "Risk assessment breakdown",
                "source": "agent",
                "data": {"risk_breakdown": agent_result.risk_breakdown},
            },
        )

        # Store pattern analysis as evidence
        repo.add_evidence(
            case_id=case_id,
            evidence_data={
                "evidence_type": "pattern_analysis",
                "description": "Pattern analysis results",
                "source": "agent",
                "data": agent_result.pattern_analysis,
            },
        )

        # Store investigator explanation as evidence
        repo.add_evidence(
            case_id=case_id,
            evidence_data={
                "evidence_type": "investigator_explanation",
                "description": "Investigator explanation",
                "source": agent_result.explanation_source,
                "data": {
                    "explanation": agent_result.investigator_explanation,
                    "source": agent_result.explanation_source,
                },
            },
        )

        # Log agent result received
        repo.add_audit_log(
            case_id=case_id,
            action="agent_result_received",
            actor="agent",
            actor_type="ai_agent",
            details={
                "risk_score": agent_result.risk_score,
                "risk_level": agent_result.risk_level,
                "typology": agent_result.typology,
                "recommendation": agent_result.recommendation,
            },
        )

        # Log investigation completed
        repo.add_audit_log(
            case_id=case_id,
            action="investigation_completed",
            actor="agent",
            actor_type="ai_agent",
            details={
                "final_status": CaseStatus.UNDER_REVIEW.value,
                "recommendation": agent_result.recommendation,
            },
        )

    except Error as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        cursor.close()
        conn.close()

    return AgentResultResponse(
        case_id=case_id,
        status=CaseStatus.UNDER_REVIEW,
        message="Agent investigation result received and case updated",
    )
