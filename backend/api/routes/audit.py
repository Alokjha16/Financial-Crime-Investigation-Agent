from fastapi import APIRouter, Depends, HTTPException
from mysql.connector import Error
from typing import List
from backend.database.connection import get_connection
from backend.database.repository import CaseRepository, MockDataRepository
from backend.api.schemas import AuditLogResponse

router = APIRouter()


@router.get("/{case_id}", response_model=List[AuditLogResponse])
def get_audit_trail(case_id: str):
    repo = CaseRepository()
    case = repo.get_by_id(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    logs = repo.get_audit_logs(case_id)
    return [
        AuditLogResponse(
            id=log["id"],
            case_id=log["case_id"],
            action=log["action"],
            actor=log["actor"],
            actor_type=log["actor_type"],
            details=log.get("details") or {},
            timestamp=log["timestamp"],
        )
        for log in logs
    ]
