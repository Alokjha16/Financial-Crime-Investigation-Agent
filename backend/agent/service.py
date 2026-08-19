"""
Agent Service - Handles automatic investigation agent invocation
"""
import json
import sys
import time
import traceback
from typing import Optional, Dict, Any
from pathlib import Path

# Add the backend directory to the path for imports
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from backend.agent.graph import graph
from backend.agent.state import InvestigationState
from backend.database.repository import CaseRepository, TransactionRepository
from backend.database.connection import get_connection
from backend.agent.tools import USE_BACKEND_API
import requests

BACKEND_API_URL = "http://localhost:8000"


def _revert_case_to_new_for_retry(case_id: str, reason: str) -> None:
    """Best-effort recovery: make the case re-runnable if submission could not be persisted."""
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            UPDATE cases
            SET status = %s, updated_at = NOW()
            WHERE case_id = %s AND status = %s
            """,
            ("new", case_id, "under_investigation"),
        )
        cursor.execute(
            """
            INSERT INTO audit_logs (case_id, action, actor, actor_type, details)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (
                case_id,
                "agent_result_submission_recovery",
                "agent_service",
                "system",
                json.dumps({"reason": reason, "status_reverted_to": "new"}),
            ),
        )
        conn.commit()
    except Exception:
        conn.rollback()
    finally:
        cursor.close()
        conn.close()


def _submit_agent_result_with_retries(
    case_repo: CaseRepository,
    case_id: str,
    agent_result: Dict[str, Any],
    status_set_by_service: bool,
) -> bool:
    max_attempts = 3
    last_error = None

    for attempt in range(1, max_attempts + 1):
        try:
            response = requests.post(
                f"{BACKEND_API_URL}/cases/{case_id}/agent-result",
                json=agent_result,
                timeout=30,
            )

            if response.status_code == 200:
                print(f"[AGENT SERVICE] Successfully submitted agent result for case {case_id}")
                return True

            last_error = (
                f"HTTP {response.status_code}: {response.text[:500]}"
            )
            print(
                f"[AGENT SERVICE] Agent result submission attempt {attempt}/{max_attempts} "
                f"failed for {case_id}: {last_error}"
            )
        except Exception as e:
            last_error = str(e)
            print(
                f"[AGENT SERVICE] Agent result submission attempt {attempt}/{max_attempts} "
                f"errored for {case_id}: {e}"
            )

        if attempt < max_attempts:
            time.sleep(attempt)

    # Network/API fallback: persist locally in-process using the same repository logic.
    try:
        case_repo.submit_agent_result(case_id, agent_result)
        case_repo.add_audit_log(
            case_id=case_id,
            action="agent_result_submission_fallback",
            actor="agent_service",
            actor_type="system",
            details={
                "mode": "local_repository_fallback",
                "reason": last_error,
            },
        )
        print(
            f"[AGENT SERVICE] Persisted agent result via local fallback for case {case_id}"
        )
        return True
    except Exception as fallback_error:
        print(
            f"[AGENT SERVICE] Local fallback persistence failed for case {case_id}: "
            f"{fallback_error}"
        )

    try:
        case_repo.add_audit_log(
            case_id=case_id,
            action="agent_result_submission_failed",
            actor="agent_service",
            actor_type="system",
            details={
                "reason": last_error,
                "recovery": "status_reverted_to_new" if status_set_by_service else "none",
            },
        )
    except Exception:
        pass

    if status_set_by_service:
        _revert_case_to_new_for_retry(
            case_id,
            reason=f"API and local persistence failed: {last_error}",
        )

    return False


def run_investigation_agent(case_id: str, account_key: Optional[str] = None, scenario_id: Optional[str] = None) -> bool:
    """
    Run the investigation agent for a given case.
    
    Args:
        case_id: The case ID to investigate
        account_key: The account key to investigate (optional, will be fetched from case if not provided)
        scenario_id: Optional scenario ID for controlled scenarios
    
    Returns:
        bool: True if investigation completed successfully, False otherwise
    """
    try:
        # Fetch case details
        case_repo = CaseRepository()
        case = case_repo.get_by_id(case_id)
        
        if not case:
            print(f"[AGENT SERVICE] Case {case_id} not found")
            return False

        status_set_by_service = False
        
        # Get account_key from case if not provided
        if not account_key:
            # Try to get account_key from transaction
            txn_repo = TransactionRepository()
            if case.get("transaction_id"):
                transaction = txn_repo.get_by_id(case["transaction_id"])
                if transaction:
                    # Construct account_key from transaction data
                    # Format: bank_id:account_id
                    account_key = f"{transaction.get('from_bank_id')}:{transaction.get('from_account_id')}"
        
        if not account_key:
            print(f"[AGENT SERVICE] Could not determine account_key for case {case_id}")
            return False
        
        current_status = case.get("status")
        if current_status == "new":
            case_repo.update_status(case_id, "under_investigation")
            status_set_by_service = True
            case_repo.add_audit_log(
                case_id=case_id,
                action="investigation_started",
                actor="agent_service",
                actor_type="system",
                details={"trigger": "automatic", "account_key": account_key},
            )
        elif current_status == "under_investigation":
            case_repo.add_audit_log(
                case_id=case_id,
                action="investigation_resumed",
                actor="agent_service",
                actor_type="system",
                details={
                    "trigger": "automatic",
                    "account_key": account_key,
                    "reason": "idempotent_reentry",
                },
            )
        else:
            case_repo.add_audit_log(
                case_id=case_id,
                action="investigation_skipped",
                actor="agent_service",
                actor_type="system",
                details={
                    "current_status": current_status,
                    "reason": "case_not_investigable",
                },
            )
            return True
        
        # Initialize investigation state
        initial_state: InvestigationState = {
            "case_id": case_id,
            "scenario_id": scenario_id or "",
            "account_key": account_key,
            "transactions": [],
            "observations": [],
            "decision": "",
            "timeline": [f"CASE RECEIVED: {case_id}"],
            "investigation_trace": [],
            "used_tools": [],
            "investigation_plan": [],
            "report": {},
            "demo_mode": False,  # Use live mode for automatic investigations
        }
        
        # Enable backend API mode for live investigations
        import backend.agent.tools as tools_module
        original_api_mode = tools_module.USE_BACKEND_API
        tools_module.USE_BACKEND_API = True
        
        try:
            # Run the investigation graph
            print(f"[AGENT SERVICE] Starting investigation for case {case_id}")
            result = graph.invoke(initial_state)
        finally:
            # Restore original API mode
            tools_module.USE_BACKEND_API = original_api_mode
        
        # Extract the final report
        report = result.get("report", {})
        
        if not report:
            print(f"[AGENT SERVICE] Investigation completed but no report generated for case {case_id}")
            return False
        
        # Submit agent result to backend
        agent_result = {
            "case_id": case_id,
            "account_key": account_key,
            "risk_score": report.get("risk_score", 0),
            "risk_level": report.get("risk_level", "UNKNOWN"),
            "typology": report.get("typology", "UNKNOWN"),
            "evidence": report.get("evidence", []),
            "risk_breakdown": report.get("risk_breakdown", []),
            "pattern_analysis": report.get("pattern_analysis", {}),
            "collected_evidence": report.get("collected_evidence", []),
            "investigation_trace": report.get("investigation_trace", []),
            "recommendation": report.get("recommendation", "REVIEW"),
            "investigator_explanation": report.get("investigator_explanation", ""),
            "explanation_source": report.get("explanation_source", "UNKNOWN"),
        }
        
        return _submit_agent_result_with_retries(
            case_repo=case_repo,
            case_id=case_id,
            agent_result=agent_result,
            status_set_by_service=status_set_by_service,
        )
            
    except Exception as e:
        print(f"[AGENT SERVICE] Error running investigation for case {case_id}: {e}")
        traceback.print_exc()
        
        # Log the failure
        try:
            case_repo = CaseRepository()
            case_repo.add_audit_log(
                case_id=case_id,
                action="investigation_failed",
                actor="agent_service",
                actor_type="system",
                details={"error": str(e), "traceback": traceback.format_exc()}
            )
        except:
            pass
        
        return False


def trigger_investigation_for_case(case_id: str) -> bool:
    """
    Trigger investigation for a newly created case.
    This is called automatically when ML creates a suspicious case.
    
    Args:
        case_id: The case ID to investigate
    
    Returns:
        bool: True if investigation was triggered successfully
    """
    return run_investigation_agent(case_id)