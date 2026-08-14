from fastapi import APIRouter, Depends, HTTPException
from mysql.connector import Error
from typing import List, Optional
from backend.database.connection import get_connection
from backend.database.repository import (
    TransactionRepository,
    KYCRepository,
    AccountLinkRepository,
    ComplaintRepository,
    MockDataRepository,
)
from backend.api.schemas import (
    TransactionHistoryResponse,
    KYCResponse,
    LinkedAccountResponse,
    ComplaintsResponse,
)

router = APIRouter()


@router.get("/{account_id}/transaction-history", response_model=TransactionHistoryResponse)
def get_transaction_history(account_id: str, limit: int = 50):
    repo = TransactionRepository()
    transactions = repo.get_by_account(account_id, limit=limit)
    return TransactionHistoryResponse(
        account_id=account_id,
        transactions=[
            {
                "transaction_id": t["transaction_id"],
                "timestamp": t["timestamp"].isoformat() if hasattr(t["timestamp"], "isoformat") else str(t["timestamp"]),
                "amount": t["amount_paid"],
                "from_account": t["from_account_id"],
                "to_account": t["to_account_id"],
                "payment_format": t["payment_format"],
                "is_laundering": t["is_laundering"],
            }
            for t in transactions
        ],
        total_count=len(transactions),
    )


@router.get("/{account_id}/kyc", response_model=KYCResponse)
def get_kyc_details(account_id: str):
    repo = KYCRepository()
    kyc = repo.get_by_account_id(account_id)
    if not kyc:
        raise HTTPException(status_code=404, detail="KYC details not found")
    return KYCResponse(
        account_id=kyc["account_id"],
        full_name=kyc["full_name"],
        id_number=kyc["id_number"],
        id_type=kyc["id_type"],
        date_of_birth=kyc["date_of_birth"],
        nationality=kyc["nationality"],
        address=kyc["address"],
        phone_number=kyc["phone_number"],
        email=kyc["email"],
        occupation=kyc["occupation"],
        employer=kyc["employer"],
        completeness_score=kyc["completeness_score"],
        verified=kyc["verified"],
    )


@router.get("/{account_id}/linked-accounts", response_model=LinkedAccountResponse)
def get_linked_accounts(account_id: str):
    repo = AccountLinkRepository()
    links = repo.get_by_account(account_id)
    return LinkedAccountResponse(
        account_id=account_id,
        linked_accounts=[
            {
                "account_id": link["to_account_id"] if link["from_account_id"] == account_id else link["from_account_id"],
                "link_type": link["link_type"],
                "strength": link["strength"],
                "is_suspicious": link["is_suspicious"],
            }
            for link in links
        ],
        total_count=len(links),
    )


@router.get("/{account_id}/complaints", response_model=ComplaintsResponse)
def get_complaints(account_id: str):
    repo = ComplaintRepository()
    complaints = repo.get_by_account(account_id)
    return ComplaintsResponse(
        account_id=account_id,
        complaints=[
            {
                "id": c["id"],
                "complaint_type": c["complaint_type"],
                "description": c["description"],
                "status": c["status"],
                "filed_at": c["filed_at"].isoformat() if hasattr(c["filed_at"], "isoformat") else str(c["filed_at"]),
            }
            for c in complaints
        ],
        total_count=len(complaints),
    )
