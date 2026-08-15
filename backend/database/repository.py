import json
from typing import Optional, List, Dict, Any
from mysql.connector import Error
from backend.database.connection import get_connection


# =========================================================
# CASE STATE MACHINE VALIDATION
# =========================================================

VALID_STATE_TRANSITIONS = {
    "new": ["under_investigation", "closed"],
    "under_investigation": ["under_review", "closed"],
    "under_review": ["escalated", "closed", "false_positive"],
    "escalated": ["closed"],
    "closed": [],  # Terminal state
    "false_positive": [],  # Terminal state
}


def validate_state_transition(current_status: str, new_status: str) -> bool:
    """
    Validate that a state transition is allowed.
    
    Args:
        current_status: Current case status
        new_status: Desired new status
    
    Returns:
        bool: True if transition is valid, False otherwise
    """
    if current_status not in VALID_STATE_TRANSITIONS:
        return False
    
    return new_status in VALID_STATE_TRANSITIONS[current_status]


class AccountRepository:
    def get_by_id(self, account_id: str) -> Optional[Dict[str, Any]]:
        conn = get_connection()
        try:
            cursor = conn.cursor(dictionary=True)
            cursor.execute(
                "SELECT * FROM accounts WHERE account_id = %s", (account_id,)
            )
            return cursor.fetchone()
        finally:
            cursor.close()
            conn.close()

    def get_by_bank_id(self, bank_id: str) -> List[Dict[str, Any]]:
        conn = get_connection()
        try:
            cursor = conn.cursor(dictionary=True)
            cursor.execute("SELECT * FROM accounts WHERE bank_id = %s", (bank_id,))
            return cursor.fetchall()
        finally:
            cursor.close()
            conn.close()

    def create(self, account_data: Dict[str, Any]) -> Dict[str, Any]:
        conn = get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO accounts (account_id, bank_id, account_type, account_age_days, kyc_status, is_business)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (
                    account_data.get("account_id"),
                    account_data.get("bank_id"),
                    account_data.get("account_type", "personal"),
                    account_data.get("account_age_days", 365),
                    account_data.get("kyc_status", "pending"),
                    account_data.get("is_business", False),
                ),
            )
            conn.commit()
            return account_data
        except Error as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
            conn.close()

    def bulk_create(self, accounts_data: List[Dict[str, Any]]) -> int:
        conn = get_connection()
        try:
            cursor = conn.cursor()
            query = """
                INSERT INTO accounts (account_id, bank_id, account_type, account_age_days, kyc_status, is_business)
                VALUES (%s, %s, %s, %s, %s, %s)
            """
            values = [
                (
                    d.get("account_id"),
                    d.get("bank_id"),
                    d.get("account_type", "personal"),
                    d.get("account_age_days", 365),
                    d.get("kyc_status", "pending"),
                    d.get("is_business", False),
                )
                for d in accounts_data
            ]
            cursor.executemany(query, values)
            conn.commit()
            return cursor.rowcount
        except Error as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
            conn.close()


class TransactionRepository:
    def get_by_id(self, transaction_id: str) -> Optional[Dict[str, Any]]:
        conn = get_connection()
        try:
            cursor = conn.cursor(dictionary=True)
            cursor.execute(
                "SELECT * FROM transactions WHERE transaction_id = %s",
                (transaction_id,),
            )
            return cursor.fetchone()
        finally:
            cursor.close()
            conn.close()

    def get_by_account(self, account_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        conn = get_connection()
        try:
            cursor = conn.cursor(dictionary=True)
            cursor.execute(
                """
                SELECT * FROM transactions
                WHERE from_account_id = %s OR to_account_id = %s
                ORDER BY timestamp DESC
                LIMIT %s
                """,
                (account_id, account_id, limit),
            )
            return cursor.fetchall()
        finally:
            cursor.close()
            conn.close()

    def get_suspicious(self, limit: int = 100) -> List[Dict[str, Any]]:
        conn = get_connection()
        try:
            cursor = conn.cursor(dictionary=True)
            cursor.execute(
                """
                SELECT * FROM transactions
                WHERE is_laundering = 1
                ORDER BY timestamp DESC
                LIMIT %s
                """,
                (limit,),
            )
            return cursor.fetchall()
        finally:
            cursor.close()
            conn.close()

    def bulk_create(self, transactions_data: List[Dict[str, Any]]) -> int:
        conn = get_connection()
        try:
            cursor = conn.cursor()
            query = """
                INSERT INTO transactions
                (transaction_id, from_bank_id, from_account_id, to_bank_id, to_account_id,
                 amount_paid, payment_currency, amount_received, receiving_currency,
                 payment_format, timestamp, transaction_hour, is_laundering, laundering_pattern)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """
            values = [
                (
                    d.get("transaction_id"),
                    d.get("from_bank_id"),
                    d.get("from_account_id"),
                    d.get("to_bank_id"),
                    d.get("to_account_id"),
                    d.get("amount_paid"),
                    d.get("payment_currency"),
                    d.get("amount_received"),
                    d.get("receiving_currency"),
                    d.get("payment_format"),
                    d.get("timestamp"),
                    d.get("transaction_hour"),
                    d.get("is_laundering", False),
                    d.get("laundering_pattern"),
                )
                for d in transactions_data
            ]
            cursor.executemany(query, values)
            conn.commit()
            return cursor.rowcount
        except Error as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
            conn.close()

    def update_pattern(self, transaction_id: str, pattern: str) -> bool:
        conn = get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE transactions SET is_laundering = 1, laundering_pattern = %s WHERE transaction_id = %s",
                (pattern, transaction_id),
            )
            conn.commit()
            return cursor.rowcount > 0
        except Error as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
            conn.close()


class CaseRepository:
    def get_by_id(self, case_id: str) -> Optional[Dict[str, Any]]:
        conn = get_connection()
        try:
            cursor = conn.cursor(dictionary=True)
            cursor.execute("SELECT * FROM cases WHERE case_id = %s", (case_id,))
            return cursor.fetchone()
        finally:
            cursor.close()
            conn.close()

    def get_all(
        self, status: Optional[str] = None, limit: int = 100
    ) -> List[Dict[str, Any]]:
        conn = get_connection()
        try:
            cursor = conn.cursor(dictionary=True)
            if status:
                cursor.execute(
                    "SELECT * FROM cases WHERE status = %s ORDER BY created_at DESC LIMIT %s",
                    (status, limit),
                )
            else:
                cursor.execute(
                    "SELECT * FROM cases ORDER BY created_at DESC LIMIT %s",
                    (limit,),
                )
            return cursor.fetchall()
        finally:
            cursor.close()
            conn.close()

    def create(self, case_data: Dict[str, Any]) -> Dict[str, Any]:
        conn = get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO cases (case_id, transaction_id, account_id, status, risk_score,
                                   risk_level, typology, evidence, recommendation)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    case_data.get("case_id"),
                    case_data.get("transaction_id"),
                    case_data.get("account_id"),
                    case_data.get("status", "new"),
                    case_data.get("risk_score"),
                    case_data.get("risk_level"),
                    case_data.get("typology"),
                    json.dumps(case_data.get("evidence", [])),
                    case_data.get("recommendation"),
                ),
            )
            conn.commit()
            return case_data
        except Error as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
            conn.close()

    def update_status(self, case_id: str, status: str) -> Optional[Dict[str, Any]]:
        conn = get_connection()
        try:
            # Get current status
            cursor = conn.cursor(dictionary=True)
            cursor.execute("SELECT status FROM cases WHERE case_id = %s", (case_id,))
            case = cursor.fetchone()
            cursor.close()
            
            if not case:
                conn.close()
                return None
            
            current_status = case["status"]
            
            # Validate state transition
            if not validate_state_transition(current_status, status):
                conn.close()
                raise ValueError(
                    f"Invalid state transition: {current_status} -> {status}. "
                    f"Valid transitions from {current_status}: {VALID_STATE_TRANSITIONS.get(current_status, [])}"
                )
            
            # Update status
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE cases SET status = %s, updated_at = CURRENT_TIMESTAMP WHERE case_id = %s",
                (status, case_id),
            )
            conn.commit()
            cursor.close()
            
            # Log the state change inline (same connection)
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO audit_logs (case_id, action, actor, actor_type, details)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (case_id, "status_changed", "system", "system", json.dumps({"old_status": current_status, "new_status": status})),
            )
            conn.commit()
            cursor.close()
            
            conn.close()
            
            return self.get_by_id(case_id)
        except Error as e:
            conn.rollback()
            conn.close()
            raise e

    def update_decision(
        self,
        case_id: str,
        decision: str,
        notes: Optional[str],
        decided_by: Optional[str],
    ) -> Optional[Dict[str, Any]]:
        conn = get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                UPDATE cases
                SET decision = %s, decision_notes = %s, decided_by = %s, decided_at = NOW(), updated_at = NOW()
                WHERE case_id = %s
                """,
                (decision, notes, decided_by, case_id),
            )
            conn.commit()
            if cursor.rowcount > 0:
                return self.get_by_id(case_id)
            return None
        except Error as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
            conn.close()

    def add_evidence(
        self, case_id: str, evidence_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        conn = get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO evidence (case_id, evidence_type, description, source, data)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (
                    case_id,
                    evidence_data.get("evidence_type"),
                    evidence_data.get("description"),
                    evidence_data.get("source"),
                    json.dumps(evidence_data.get("data")),
                ),
            )
            conn.commit()
            evidence_data["id"] = cursor.lastrowid
            return evidence_data
        except Error as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
            conn.close()

    def add_audit_log(
        self,
        case_id: str,
        action: str,
        actor: str,
        actor_type: str,
        details: Dict[str, Any],
    ) -> Dict[str, Any]:
        conn = get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO audit_logs (case_id, action, actor, actor_type, details)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (case_id, action, actor, actor_type, json.dumps(details)),
            )
            conn.commit()
            log = {
                "id": cursor.lastrowid,
                "case_id": case_id,
                "action": action,
                "actor": actor,
                "actor_type": actor_type,
                "details": details,
            }
            return log
        except Error as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
            conn.close()

    def get_audit_logs(self, case_id: str) -> List[Dict[str, Any]]:
        conn = get_connection()
        try:
            cursor = conn.cursor(dictionary=True)
            cursor.execute(
                "SELECT * FROM audit_logs WHERE case_id = %s ORDER BY timestamp ASC",
                (case_id,),
            )
            rows = cursor.fetchall()
            for row in rows:
                if isinstance(row.get("details"), str):
                    row["details"] = json.loads(row["details"])
            return rows
        finally:
            cursor.close()
            conn.close()

    def get_by_transaction_id(self, transaction_id: str) -> Optional[Dict[str, Any]]:
        conn = get_connection()
        try:
            cursor = conn.cursor(dictionary=True)
            cursor.execute(
                "SELECT * FROM cases WHERE transaction_id = %s", (transaction_id,)
            )
            return cursor.fetchone()
        finally:
            cursor.close()
            conn.close()


class KYCRepository:
    def get_by_account_id(self, account_id: str) -> Optional[Dict[str, Any]]:
        conn = get_connection()
        try:
            cursor = conn.cursor(dictionary=True)
            cursor.execute("SELECT * FROM kyc WHERE account_id = %s", (account_id,))
            return cursor.fetchone()
        finally:
            cursor.close()
            conn.close()

    def create(self, kyc_data: Dict[str, Any]) -> Dict[str, Any]:
        conn = get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO kyc (account_id, full_name, id_number, id_type, date_of_birth,
                                  nationality, address, phone_number, email, occupation,
                                  employer, completeness_score, verified, verification_date)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    kyc_data.get("account_id"),
                    kyc_data.get("full_name"),
                    kyc_data.get("id_number"),
                    kyc_data.get("id_type"),
                    kyc_data.get("date_of_birth"),
                    kyc_data.get("nationality"),
                    kyc_data.get("address"),
                    kyc_data.get("phone_number"),
                    kyc_data.get("email"),
                    kyc_data.get("occupation"),
                    kyc_data.get("employer"),
                    kyc_data.get("completeness_score", 0.0),
                    kyc_data.get("verified", False),
                    kyc_data.get("verification_date"),
                ),
            )
            conn.commit()
            kyc_data["id"] = cursor.lastrowid
            return kyc_data
        except Error as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
            conn.close()


class AccountLinkRepository:
    def get_by_account(self, account_id: str) -> List[Dict[str, Any]]:
        conn = get_connection()
        try:
            cursor = conn.cursor(dictionary=True)
            cursor.execute(
                """
                SELECT * FROM account_links
                WHERE from_account_id = %s OR to_account_id = %s
                """,
                (account_id, account_id),
            )
            return cursor.fetchall()
        finally:
            cursor.close()
            conn.close()

    def create(self, link_data: Dict[str, Any]) -> Dict[str, Any]:
        conn = get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO account_links (from_account_id, to_account_id, link_type, strength, is_suspicious)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (
                    link_data.get("from_account_id"),
                    link_data.get("to_account_id"),
                    link_data.get("link_type"),
                    link_data.get("strength", 1.0),
                    link_data.get("is_suspicious", False),
                ),
            )
            conn.commit()
            link_data["id"] = cursor.lastrowid
            return link_data
        except Error as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
            conn.close()


class ComplaintRepository:
    def get_by_account(self, account_id: str) -> List[Dict[str, Any]]:
        conn = get_connection()
        try:
            cursor = conn.cursor(dictionary=True)
            cursor.execute(
                "SELECT * FROM complaints WHERE account_id = %s",
                (account_id,),
            )
            return cursor.fetchall()
        finally:
            cursor.close()
            conn.close()

    def create(self, complaint_data: Dict[str, Any]) -> Dict[str, Any]:
        conn = get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO complaints (account_id, complaint_type, description, status, filed_at, resolved_at)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (
                    complaint_data.get("account_id"),
                    complaint_data.get("complaint_type"),
                    complaint_data.get("description"),
                    complaint_data.get("status", "open"),
                    complaint_data.get("filed_at"),
                    complaint_data.get("resolved_at"),
                ),
            )
            conn.commit()
            complaint_data["id"] = cursor.lastrowid
            return complaint_data
        except Error as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
            conn.close()


class MockDataRepository:
    @staticmethod
    def get_mock_cases() -> List[Dict[str, Any]]:
        return [
            {
                "case_id": "CASE-001",
                "transaction_id": "TXN-001",
                "account_id": "ACC4521",
                "status": "under_review",
                "risk_score": 91,
                "risk_level": "HIGH",
                "typology": "MONEY_MULE",
                "evidence": ["New account", "Incomplete KYC", "Unusual amount"],
                "recommendation": "ESCALATE",
                "decision": None,
                "created_at": "2026-08-12T10:41:02Z",
            },
            {
                "case_id": "CASE-002",
                "transaction_id": "TXN-002",
                "account_id": "ACC8821",
                "status": "new",
                "risk_score": 45,
                "risk_level": "MEDIUM",
                "typology": "ACCOUNT_TAKEOVER",
                "evidence": ["Sudden device change", "New location", "Large transfer"],
                "recommendation": "REVIEW",
                "decision": None,
                "created_at": "2026-08-12T11:15:30Z",
            },
            {
                "case_id": "CASE-003",
                "transaction_id": "TXN-003",
                "account_id": "ACC1100",
                "status": "false_positive",
                "risk_score": 12,
                "risk_level": "LOW",
                "typology": "FALSE_POSITIVE",
                "evidence": [
                    "8-year-old account",
                    "Complete KYC",
                    "Normal behavior",
                    "Known recipient",
                ],
                "recommendation": "CLEAR",
                "decision": "false_positive",
                "created_at": "2026-08-12T09:22:11Z",
            },
        ]

    @staticmethod
    def get_mock_case_detail(case_id: str) -> Optional[Dict[str, Any]]:
        cases = MockDataRepository.get_mock_cases()
        for case in cases:
            if case["case_id"] == case_id:
                return case
        return None

    @staticmethod
    def get_mock_transaction_history(account_id: str) -> Dict[str, Any]:
        return {
            "account_id": account_id,
            "transactions": [
                {
                    "transaction_id": "TXN-001",
                    "timestamp": "2026-08-12T10:41:02Z",
                    "amount": 480000.0,
                    "from_account": account_id,
                    "to_account": "ACC8832",
                    "payment_format": "wire",
                    "is_laundering": True,
                },
                {
                    "transaction_id": "TXN-045",
                    "timestamp": "2026-08-11T14:22:10Z",
                    "amount": 50000.0,
                    "from_account": account_id,
                    "to_account": "ACC9912",
                    "payment_format": "ach",
                    "is_laundering": False,
                },
            ],
            "total_count": 2,
        }

    @staticmethod
    def get_mock_kyc(account_id: str) -> Dict[str, Any]:
        return {
            "account_id": account_id,
            "full_name": "John Doe",
            "id_number": "ID123456",
            "id_type": "passport",
            "date_of_birth": "1990-05-15",
            "nationality": "IN",
            "address": "123 Main St, Mumbai, India",
            "phone_number": "+919876543210",
            "email": "john@example.com",
            "occupation": "Business",
            "employer": "ABC Corp",
            "completeness_score": 0.3,
            "verified": False,
        }

    @staticmethod
    def get_mock_linked_accounts(account_id: str) -> Dict[str, Any]:
        return {
            "account_id": account_id,
            "linked_accounts": [
                {
                    "account_id": "ACC8832",
                    "link_type": "beneficiary",
                    "strength": 0.9,
                    "is_suspicious": True,
                },
                {
                    "account_id": "ACC9912",
                    "link_type": "previous_sender",
                    "strength": 0.4,
                    "is_suspicious": False,
                },
                {
                    "account_id": "ACC7721",
                    "link_type": "same_device",
                    "strength": 0.7,
                    "is_suspicious": True,
                },
            ],
            "total_count": 3,
        }

    @staticmethod
    def get_mock_complaints(account_id: str) -> Dict[str, Any]:
        return {
            "account_id": account_id,
            "complaints": [
                {
                    "id": 1,
                    "complaint_type": "unauthorized_transaction",
                    "description": "Customer reported unauthorized wire transfer",
                    "status": "open",
                    "filed_at": "2026-08-10T09:00:00Z",
                }
            ],
            "total_count": 1,
        }

    @staticmethod
    def get_mock_audit_trail(case_id: str) -> List[Dict[str, Any]]:
        return [
            {
                "id": 1,
                "case_id": case_id,
                "action": "case_created",
                "actor": "system",
                "actor_type": "ml_engine",
                "details": {"risk_score": 91, "risk_level": "HIGH"},
                "timestamp": "2026-08-12T10:41:02Z",
            },
            {
                "id": 2,
                "case_id": case_id,
                "action": "investigation_started",
                "actor": "agent",
                "actor_type": "ai_agent",
                "details": {"tool": "get_transaction_history"},
                "timestamp": "2026-08-12T10:41:03Z",
            },
            {
                "id": 3,
                "case_id": case_id,
                "action": "evidence_collected",
                "actor": "agent",
                "actor_type": "ai_agent",
                "details": {"tool": "get_kyc", "finding": "Incomplete KYC"},
                "timestamp": "2026-08-12T10:41:04Z",
            },
            {
                "id": 4,
                "case_id": case_id,
                "action": "decision_made",
                "actor": "analyst_1",
                "actor_type": "human",
                "details": {
                    "decision": "ESCALATE",
                    "notes": "Strong mule pattern confirmed",
                },
                "timestamp": "2026-08-12T10:45:00Z",
            },
        ]
