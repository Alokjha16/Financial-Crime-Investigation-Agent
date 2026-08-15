# Backend

FastAPI backend for the Financial Crime Investigation Agent.

## Architecture

The backend contains the investigation agent under `backend/agent/`.

The investigation flow is:

Case
→ Agent / Investigation Plan
→ Evidence Tools
→ Pattern Engine
→ Risk Engine
→ Investigator Explanation
→ Final Report

### Controlled scenarios

Controlled scenarios use deterministic investigation plans so demo results are reproducible.

Supported scenarios:

- SCN-001 — FAN-OUT
- SCN-002 — CYCLE
- SCN-003 — STACK
- SCN-004 — BIPARTITE
- SCN-005 — False Positive / No Supported Pattern

### Live investigation

For non-controlled/live investigations, Gemini can dynamically select the evidence tools required for the investigation.

Gemini is used for investigation planning. It does not directly calculate the final risk score.

The remaining evidence collection, pattern analysis and risk assessment are handled by the investigation agent components.

---

## Requirements

- Python 3.10+
- MySQL
- Gemini API key for live planning
- Internet connection for Gemini API calls

Install dependencies:

```bash
pip install -r backend/requirements.txt