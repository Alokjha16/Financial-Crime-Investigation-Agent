from fastapi import APIRouter, HTTPException
from backend.database.repository import TransactionRepository, CaseRepository
from backend.api.schemas import MLOutputContract, MLScoreResponse

router = APIRouter()


@router.post("/score", response_model=MLScoreResponse)
def score_transaction(ml_output: MLOutputContract):
    txn_repo = TransactionRepository()
    case_repo = CaseRepository()

    txn = txn_repo.get_by_id(ml_output.transaction_id)
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found. Ingest transaction first.")

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

    if ml_output.risk_score >= 50:
        from datetime import datetime
        case_id = f"CASE-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        case_repo.create({
            "case_id": case_id,
            "transaction_id": ml_output.transaction_id,
            "account_id": txn["from_account_id"],
            "status": "new",
            "risk_score": ml_output.risk_score,
            "risk_level": ml_output.risk_level,
            "typology": None,
            "evidence": ml_output.top_factors,
            "recommendation": None,
        })

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

        return MLScoreResponse(
            case_id=case_id,
            status="new",
            transaction_id=ml_output.transaction_id,
            risk_score=ml_output.risk_score,
            risk_level=ml_output.risk_level,
            message="Suspicious case created",
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
