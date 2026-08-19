from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class AccountType(str, Enum):
    PERSONAL = "personal"
    BUSINESS = "business"


class KYCStatus(str, Enum):
    COMPLETE = "complete"
    INCOMPLETE = "incomplete"
    PENDING = "pending"
    REJECTED = "rejected"


class CaseStatus(str, Enum):
    NEW = "new"
    UNDER_INVESTIGATION = "under_investigation"
    UNDER_REVIEW = "under_review"
    ESCALATED = "escalated"
    CLOSED = "closed"
    FALSE_POSITIVE = "false_positive"


class DecisionType(str, Enum):
    ESCALATE = "escalate"
    CLEAR = "clear"
    FALSE_POSITIVE = "false_positive"
    REVIEW = "review"


class MLOutputContract(BaseModel):
    transaction_id: str
    fraud_probability: float = Field(ge=0, le=1)
    risk_score: int = Field(ge=0, le=100)
    risk_level: str
    top_factors: List[str]
    baseline_score: Optional[int] = Field(default=None, ge=0, le=100)
    stage: Optional[str] = None
    model: Optional[str] = None


class AgentOutputContract(BaseModel):
    case_id: str
    risk_score: int = Field(ge=0, le=100)
    risk_level: str
    typology: str
    evidence: List[str]
    recommendation: str


class CaseObjectContract(BaseModel):
    case_id: str
    status: CaseStatus
    risk_score: int = Field(ge=0, le=100)
    risk_level: str
    evidence: List[str]
    decision: Optional[DecisionType] = None
    created_at: datetime


class TransactionIngestRequest(BaseModel):
    from_bank_id: str
    from_account_id: str
    to_bank_id: str
    to_account_id: str
    amount_paid: float
    payment_currency: str
    amount_received: float
    receiving_currency: str
    payment_format: str
    timestamp: datetime


class TransactionResponse(BaseModel):
    transaction_id: str
    from_bank_id: str
    from_account_id: str
    to_bank_id: str
    to_account_id: str
    amount_paid: float
    payment_currency: str
    amount_received: float
    receiving_currency: str
    payment_format: str
    timestamp: datetime
    is_laundering: bool
    laundering_pattern: Optional[str] = None

    class Config:
        from_attributes = True


class DecisionRequest(BaseModel):
    decision: DecisionType
    notes: Optional[str] = None
    decided_by: Optional[str] = "analyst"


class InvestigationTimelineEntry(BaseModel):
    timestamp: datetime
    action: str
    actor: str
    actor_type: str
    details: Dict[str, Any]


class CaseDetailResponse(CaseObjectContract):
    transaction: Optional[TransactionResponse] = None
    account: Optional[Dict[str, Any]] = None
    typology: Optional[str] = None
    recommendation: Optional[str] = None
    timeline: Optional[List[InvestigationTimelineEntry]] = None


class AuditLogResponse(BaseModel):
    id: int
    case_id: str
    action: str
    actor: str
    actor_type: str
    details: Dict[str, Any]
    timestamp: datetime

    class Config:
        from_attributes = True


class CaseListResponse(BaseModel):
    cases: List[CaseObjectContract]
    total: int


class TransactionHistoryResponse(BaseModel):
    account_id: str
    transactions: List[Dict[str, Any]]
    total_count: int


class KYCResponse(BaseModel):
    account_id: str
    full_name: str
    id_number: str
    id_type: str
    date_of_birth: datetime
    nationality: str
    address: str
    phone_number: str
    email: str
    occupation: str
    employer: str
    completeness_score: float
    verified: bool
    account_open_date: Optional[datetime] = None
    account_age_days: Optional[int] = None

    class Config:
        from_attributes = True


class LinkedAccountResponse(BaseModel):
    account_id: str
    linked_accounts: List[Dict[str, Any]]
    total_count: int


class MLScoreResponse(BaseModel):
    case_id: str
    status: CaseStatus
    transaction_id: str
    risk_score: int = Field(ge=0, le=100)
    risk_level: str
    message: str


class InvestigateResponse(BaseModel):
    case_id: str
    status: CaseStatus
    message: str
    agent_output: Optional[Dict[str, Any]] = None


class ComplaintsResponse(BaseModel):
    account_id: str
    complaints: List[Dict[str, Any]]
    total_count: int


class AgentResultContract(BaseModel):
    case_id: str
    account_key: str
    risk_score: int = Field(ge=0, le=100)
    risk_level: str
    typology: str
    evidence: List[str]
    risk_breakdown: List[Dict[str, Any]]
    pattern_analysis: Dict[str, Any]
    collected_evidence: List[Dict[str, Any]]
    investigation_trace: List[Dict[str, Any]]
    recommendation: str
    investigator_explanation: str
    explanation_source: str


class AgentResultResponse(BaseModel):
    case_id: str
    status: CaseStatus
    message: str


class EvidenceResponse(BaseModel):
    id: int
    case_id: str
    evidence_type: str
    description: Optional[str] = None
    source: Optional[str] = None
    data: Dict[str, Any]
    created_at: datetime

    class Config:
        from_attributes = True
