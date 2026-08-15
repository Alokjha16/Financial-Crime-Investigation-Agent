"""
Agent Service - Handles automatic investigation agent invocation
"""
import sys
import traceback
from typing import Optional, Dict, Any
from pathlib import Path

# Add the backend directory to the path for imports
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from backend.agent.graph import graph
from backend.agent.state import InvestigationState
from backend.database.repository import CaseRepository, TransactionRepository
import requests

BACKEND_API_URL = "http://localhost:8000"


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
        
        # Update case status to UNDER_INVESTIGATION
        case_repo.update_status(case_id, "under_investigation")
        case_repo.add_audit_log(
            case_id=case_id,
            action="investigation_started",
            actor="agent_service",
            actor_type="system",
            details={"trigger": "automatic", "account_key": account_key}
        )
        
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
        
        # Run the investigation graph
        print(f"[AGENT SERVICE] Starting investigation for case {case_id}")
        result = graph.invoke(initial_state)
        
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
        
        # Submit to backend API
        try:
            response = requests.post(
                f"{BACKEND_API_URL}/cases/{case_id}/agent-result",
                json=agent_result,
                timeout=30
            )
            
            if response.status_code == 200:
                print(f"[AGENT SERVICE] Successfully submitted agent result for case {case_id}")
                return True
            else:
                print(f"[AGENT SERVICE] Failed to submit agent result: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"[AGENT SERVICE] Error submitting agent result: {e}")
            return False
            
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