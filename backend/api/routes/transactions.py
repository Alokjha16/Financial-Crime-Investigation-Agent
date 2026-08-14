from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
from backend.database.connection import get_connection
from backend.database.repository import TransactionRepository, AccountRepository, CaseRepository
from backend.api.schemas import TransactionIngestRequest, TransactionResponse

router = APIRouter()


@router.post("/")
def ingest_transaction(request: TransactionIngestRequest):
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
        account_repo.create({
            "account_id": request.from_account_id,
            "bank_id": request.from_bank_id,
            "account_age_days": 365,
            "kyc_status": "pending",
        })

    if not to_acc:
        account_repo.create({
            "account_id": request.to_account_id,
            "bank_id": request.to_bank_id,
            "account_age_days": 1,
            "kyc_status": "incomplete",
        })

    txn_repo.bulk_create([txn_data])

    case_repo.add_audit_log(
        case_id="PENDING",
        action="transaction_ingested",
        actor="system",
        actor_type="ingestion",
        details={"transaction_id": txn_data["transaction_id"]},
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
