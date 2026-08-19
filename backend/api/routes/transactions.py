from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from datetime import datetime, UTC
from typing import Any, Dict
from uuid import uuid4
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


def _create_case_and_investigate(
    case_repo: CaseRepository,
    transaction_id: str,
    account_id: str,
    ml_output: Dict[str, Any],
):
    case_id = f"CASE-{uuid4().hex.upper()}"
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
            "model": ml_output.get("model", "unknown"),
            "stage": ml_output.get("stage", "unknown"),
        },
    )

    trigger_investigation_for_case(case_id)


def _run_ml_scoring_and_investigate(transaction_id: str, account_id: str, from_bank_id: str):
    try:
        txn_repo = TransactionRepository()
        case_repo = CaseRepository()

        txn = txn_repo.get_by_id(transaction_id)
        if not txn:
            return

        existing_case = case_repo.get_by_transaction_id(transaction_id)
        if existing_case:
            return

        from backend.ml.scorer import score_transaction

        ml_output = score_transaction(txn, account_id=account_id, from_bank_id=from_bank_id)
        if not ml_output:
            return

        baseline_score = ml_output.get("baseline_score")
        final_score = ml_output["risk_score"]

        if baseline_score is not None:
            if baseline_score >= 65:
                _create_case_and_investigate(case_repo, transaction_id, account_id, ml_output)
            elif baseline_score < 20:
                return
            else:
                if final_score >= 45:
                    _create_case_and_investigate(case_repo, transaction_id, account_id, ml_output)
        else:
            if final_score >= 65:
                _create_case_and_investigate(case_repo, transaction_id, account_id, ml_output)

    except Exception as e:
        print(f"[ML SCORER BACKGROUND ERROR] {e}")


@router.post("/")
def ingest_transaction(request: TransactionIngestRequest, background_tasks: BackgroundTasks):
    txn_data = {
        "transaction_id": f"TXN-{datetime.now(UTC).strftime('%Y%m%d%H%M%S%f')}-{uuid4().hex[:8].upper()}",
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
        from_bank_id=request.from_bank_id,
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
