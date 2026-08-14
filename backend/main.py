from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.api.routes import cases, transactions, accounts, audit, ml

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
