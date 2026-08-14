# Backend

FastAPI backend for the Financial Crime Investigation Agent.

## Setup

```bash
# Create virtual environment
python -m venv venv
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment file
copy .env.example .env

# Run server
python run.py
```

Server will be available at `http://localhost:8000`.

## API Endpoints

### Core Endpoints
- `POST /transactions` - Ingest a transaction
- `POST /ml/score` - Receive ML output, create suspicious case
- `GET /cases` - List cases (dashboard)
- `GET /cases/{case_id}` - Case detail
- `POST /cases/{case_id}/investigate` - Trigger agent investigation
- `POST /cases/{case_id}/decision` - Analyst decision
- `GET /audit/{case_id}` - Audit trail for a case

### Investigation Tool Endpoints (for LangGraph Agent)
- `GET /accounts/{account_id}/transaction-history`
- `GET /accounts/{account_id}/kyc`
- `GET /accounts/{account_id}/linked-accounts`
- `GET /accounts/{account_id}/complaints`

## Data Ingestion

Once Person 1 shares preprocessed data files in `data/processed/`, run:

```bash
python scripts/ingest_data.py --init-db
```

This will create all tables and load:
- `accounts.csv`
- `transactions.csv`
- `kyc.csv`
- `account_links.csv`
- `complaints.csv`
- `patterns.json` (IBM ground truth labels)

## API Docs

When server is running, visit `http://localhost:8000/docs` for interactive API documentation.
