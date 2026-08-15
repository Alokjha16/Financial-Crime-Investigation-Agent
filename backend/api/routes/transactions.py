from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from datetime import datetime
from backend.database.connection import get_connection
from backend.database.repository import (
    TransactionRepository,
    AccountRepository,
    CaseRepository,
)
from backend.api.schemas import TransactionIngestRequest, TransactionResponse
from backend.ml.scorer import score_transaction
from backend.agent.service import trigger_investigation_for_case

router = APIRouter()


def _run_ml_scoring_and_investigate(transaction_id: str, account_id: str):
    try:
        txn_repo = TransactionRepository()
        case_repo = CaseRepository()

        txn = txn_repo.get_by_id(transaction_id)
        if not txn:
            return

        existing_case = case_repo.get_by_transaction_id(transaction_id)
        if existing_case:
            return

        ml_output = score_transaction(txn)
        if not ml_output:
            return

        if ml_output["risk_score"] >= 50:
            from datetime import datetime

            case_id = f"CASE-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
            case_repo.create(
                {
                    "case_id": case_id,
                    "transaction_id": transaction_id,
                    "account_id": account_id,
                    "status": "new",
                    "risk_score": ml_output["risk_score"],
                    "risk_level": ml_output["risk_level"],
                    "typology": None,
                    "evidence": ml_output["top_factors"],
                    "recommendation": None,
                }
            )

            case_repo.add_audit_log(
                case_id=case_id,
                action="case_created",
                actor="ml_engine",
                actor_type="system",
                details={
                    "risk_score": ml_output["risk_score"],
                    "risk_level": ml_output["risk_level"],
                    "top_factors": ml_output["top_factors"],
                    "fraud_probability": ml_output["fraud_probability"],
                },
            )

            trigger_investigation_for_case(case_id)
    except Exception as e:
        print(f"[ML SCORER BACKGROUND ERROR] {e}")


@router.post("/")
def ingest_transaction(request: TransactionIngestRequest, background_tasks: BackgroundTasks):
    txn_data = {
        "transaction_id": f"TXN-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
        "from_bank_id": request.from_bank_id,
        "from_account_id": request.from_account_id,
        "to_bank_id": request.to_bank_id,
        "to_account_id": request.to_account_id,
        "amount_paid": request.amount_paid,
        "payment_currency": request.payment_currency,
        "amount_received": request.amount_received,
        "receiving_currency": request.receiving_currency,
        "payment_format": request.payment_format,
        "timestamp": request.timestamp,
        "transaction_hour": request.timestamp.hour,
        "is_laundering": False,
        "laundering_pattern": None,
    }

    txn_repo = TransactionRepository()
    account_repo = AccountRepository()
    case_repo = CaseRepository()

    from_acc = account_repo.get_by_id(request.from_account_id)
    to_acc = account_repo.get_by_id(request.to_account_id)

    if not from_acc:
        account_repo.create(
            {
                "account_id": request.from_account_id,
                "bank_id": request.from_bank_id,
                "account_age_days": 365,
                "kyc_status": "pending",
            }
        )

    if not to_acc:
        account_repo.create(
            {
                "account_id": request.to_account_id,
                "bank_id": request.to_bank_id,
                "account_age_days": 1,
                "kyc_status": "incomplete",
            }
        )

    txn_repo.bulk_create([txn_data])

    background_tasks.add_task(
        _run_ml_scoring_and_investigate,
        transaction_id=txn_data["transaction_id"],
        account_id=request.from_account_id,
    )

    return TransactionResponse(
        transaction_id=txn_data["transaction_id"],
        from_bank_id=txn_data["from_bank_id"],
        from_account_id=txn_data["from_account_id"],
        to_bank_id=txn_data["to_bank_id"],
        to_account_id=txn_data["to_account_id"],
        amount_paid=txn_data["amount_paid"],
        payment_currency=txn_data["payment_currency"],
        amount_received=txn_data["amount_received"],
        receiving_currency=txn_data["receiving_currency"],
        payment_format=txn_data["payment_format"],
        timestamp=txn_data["timestamp"],
        is_laundering=txn_data["is_laundering"],
        laundering_pattern=txn_data["laundering_pattern"],
    )
