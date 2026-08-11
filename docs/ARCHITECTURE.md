# System Architecture

## Layer 1 — Data
PaySim + synthetic KYC/account/complaint/link data.

## Layer 2 — Detection
Feature engineering → supervised fraud model and/or anomaly detector → risk score.

## Layer 3 — Investigation Agent
LangGraph state machine:
START → inspect case → select tool → execute tool → record evidence → decide whether more evidence is needed → risk/typology analysis → report → END.

## Layer 4 — Tools
Each investigation source is exposed as a controlled Python tool. Tools return structured data and source identifiers.

## Layer 5 — Graph Analysis
NetworkX represents accounts as nodes and transactions/relationships as edges. The graph layer calculates useful network evidence such as degree, transaction concentration, and suspicious clusters.

## Layer 6 — Evidence & Reporting
All findings are normalized into evidence objects with:
- source
- field/value
- explanation
- severity
- timestamp/case reference

The report contains:
- case ID
- risk score
- risk level
- suspected typology
- evidence summary
- investigation timeline
- recommendation
- confidence
- audit trail

## Layer 7 — API
FastAPI exposes:
- cases
- transaction details
- investigation start/status
- evidence
- graph data
- reports
- analyst decisions

## Layer 8 — UI
React dashboard:
- case queue
- risk overview
- investigation timeline
- evidence panel
- network graph
- recommendation
- approve/review/close controls

## Core Demo
High-value odd-hour transaction → ML flags → agent checks history → KYC → linked accounts → complaints → graph reveals mule pattern → report says HIGH RISK / ESCALATE → analyst approves.
