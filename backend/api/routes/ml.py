import json
import json
from uuid import uuid4
from fastapi import APIRouter, HTTPException, BackgroundTasks
from backend.database.repository import TransactionRepository, CaseRepository
from backend.api.schemas import MLOutputContract, MLScoreResponse
from backend.agent.service import trigger_investigation_for_case

router = APIRouter()


def _should_create_case(ml_output: MLOutputContract) -> bool:
    baseline_low = 20
    baseline_high = 65
    enhanced_threshold = 45

    baseline_score = ml_output.baseline_score
    final_score = ml_output.risk_score
    stage = (ml_output.stage or "").strip().lower()

    if baseline_score is not None:
        if baseline_score >= baseline_high:
            return True
        if baseline_score < baseline_low:
            return False
        return final_score >= enhanced_threshold

    if stage == "enhanced":
        return final_score >= enhanced_threshold
    if stage == "baseline":
        return final_score >= baseline_high

    return final_score >= baseline_high


@router.post("/score", response_model=MLScoreResponse)
def score_transaction(ml_output: MLOutputContract, background_tasks: BackgroundTasks):
    txn_repo = TransactionRepository()
    case_repo = CaseRepository()

    txn = txn_repo.get_by_id(ml_output.transaction_id)
    if not txn:
        raise HTTPException(
            status_code=404, detail="Transaction not found. Ingest transaction first."
        )

    existing_case = case_repo.get_by_transaction_id(ml_output.transaction_id)
    if existing_case:
        return MLScoreResponse(
            case_id=existing_case["case_id"],
            status=existing_case["status"],
            transaction_id=ml_output.transaction_id,
            risk_score=ml_output.risk_score,
            risk_level=ml_output.risk_level,
            message="Case already exists for this transaction",
        )

    if _should_create_case(ml_output):
        case_id = f"CASE-{uuid4().hex.upper()}"
        case_repo.create(
            {
                "case_id": case_id,
                "transaction_id": ml_output.transaction_id,
                "account_id": txn["from_account_id"],
                "status": "new",
                "risk_score": ml_output.risk_score,
                "risk_level": ml_output.risk_level,
                "typology": None,
                "evidence": ml_output.top_factors,
                "recommendation": None,
            }
        )

        case_repo.add_audit_log(
            case_id=case_id,
            action="case_created",
            actor="ml_engine",
            actor_type="system",
            details={
                "risk_score": ml_output.risk_score,
                "risk_level": ml_output.risk_level,
                "top_factors": ml_output.top_factors,
            },
        )

        # Automatically trigger investigation agent in background
        background_tasks.add_task(trigger_investigation_for_case, case_id)

        return MLScoreResponse(
            case_id=case_id,
            status="new",
            transaction_id=ml_output.transaction_id,
            risk_score=ml_output.risk_score,
            risk_level=ml_output.risk_level,
            message="Suspicious case created and investigation triggered",
        )
    else:
        return MLScoreResponse(
            case_id="",
            status="new",
            transaction_id=ml_output.transaction_id,
            risk_score=ml_output.risk_score,
            risk_level=ml_output.risk_level,
            message="Transaction not suspicious enough for case creation",
        )
