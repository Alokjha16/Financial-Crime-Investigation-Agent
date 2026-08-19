from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.api.routes import cases, transactions, accounts, audit, ml
from backend.database.repository import CaseRepository

app = FastAPI(
    title="Financial Crime Investigation Agent API",
    description="Backend API for autonomous financial crime investigation system",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(cases.router, prefix="/cases", tags=["cases"])
app.include_router(transactions.router, prefix="/transactions", tags=["transactions"])
app.include_router(accounts.router, prefix="/accounts", tags=["accounts"])
app.include_router(audit.router, prefix="/audit", tags=["audit"])
app.include_router(ml.router, prefix="/ml", tags=["ml"])


@app.get("/health", tags=["health"])
def health_check():
    return {"status": "ok", "service": "financial-crime-agent-backend"}


@app.get("/agent/activity", tags=["agent"])
def get_agent_activity(limit: int = 20):
    """
    Returns the most recent agent/system audit log entries across all cases.
    Used by the frontend dashboard to show live agent activity feed.
    """
    from backend.database.connection import get_connection
    import json

    conn = get_connection()
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT al.id, al.case_id, al.action, al.actor, al.actor_type,
                   al.details, al.timestamp
            FROM audit_logs al
            ORDER BY al.timestamp DESC
            LIMIT %s
            """,
            (limit,),
        )
        rows = cursor.fetchall()
        for row in rows:
            if isinstance(row.get("details"), str):
                try:
                    row["details"] = json.loads(row["details"])
                except Exception:
                    row["details"] = {}
            if hasattr(row.get("timestamp"), "isoformat"):
                row["timestamp"] = row["timestamp"].isoformat()
        return rows
    finally:
        cursor.close()
        conn.close()
