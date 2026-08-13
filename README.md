# Autonomous Financial Crime Investigation Agent/./

SIH PS-2 prototype.

## Goal
Build an explainable, human-in-the-loop financial crime investigation system that:
1. detects suspicious transactions,
2. autonomously gathers relevant evidence,
3. analyzes linked accounts and transaction networks,
4. generates an evidence-backed investigation report,
5. recommends Escalate / Human Review / Close while keeping the final decision with a human analyst.

## Target Architecture

Transaction Data
→ Feature Engineering
→ ML Risk Detector
→ Investigation Case
→ LangGraph Investigation Agent
→ Investigation Tools
→ Evidence Aggregation
→ Risk/Typology Analysis
→ Network Graph Analysis
→ Structured Investigation Report
→ FastAPI
→ React Analyst Dashboard
→ Human Decision

## Repository Layout

- `backend/ml/` — fraud/anomaly detection
- `backend/agent/` — LangGraph agent and state
- `backend/tools/` — transaction, KYC, complaints, linked-account tools
- `backend/graph/` — NetworkX investigation graph
- `backend/database/` — database models/repositories
- `backend/reports/` — structured investigation reports
- `backend/api/` — FastAPI routes
- `frontend/` — React dashboard
- `data/raw/` — source datasets (not committed)
- `data/processed/` — cleaned/merged datasets (not committed)
- `data/scenarios/` — controlled demo fraud scenarios
- `tests/` — unit and integration tests
- `docs/` — architecture and demo documentation

## Prototype Definition
The first milestone is an end-to-end demo:
Suspicious transaction → ML score → agent investigation → 4+ evidence tools → network analysis → evidence-backed report → analyst decision.

## Initial Tools
- `get_transaction_history(account_id)`
- `get_kyc_details(account_id)`
- `get_linked_accounts(account_id)`
- `check_past_complaints(account_id)`

Device/IP investigation can be added after the core flow works.

## Important Design Rule
The LLM must not be the sole source of the final risk score. Risk should be based on observable evidence, deterministic/ML signals, and an auditable investigation trail. The AI recommendation is advisory; the final action remains with the human analyst.
