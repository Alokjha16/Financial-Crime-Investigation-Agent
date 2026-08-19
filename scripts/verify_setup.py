#!/usr/bin/env python3
"""Quick verification script for Person 3's backend setup."""

import sys
from pathlib import Path

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

errors = []
skipped_imports = False

# Test 1: Can we import all modules?
try:
    from backend.database.connection import get_connection, init_db
    print("[PASS] Database connection imports successfully")
except ImportError as e:
    skipped_imports = True
    print(f"[SKIP] Database import (install dependencies first): {e}")

try:
    from backend.database.repository import (
        AccountRepository, TransactionRepository, CaseRepository,
        KYCRepository, AccountLinkRepository, ComplaintRepository, MockDataRepository
    )
    print("[PASS] Repository imports successfully")
except ImportError as e:
    skipped_imports = True
    print(f"[SKIP] Repository import (install dependencies first): {e}")

try:
    from backend.api.schemas import (
        MLOutputContract, AgentOutputContract, CaseObjectContract,
        TransactionIngestRequest, DecisionRequest, CaseDetailResponse, AuditLogResponse
    )
    print("[PASS] Pydantic schemas import successfully")
except ImportError as e:
    skipped_imports = True
    print(f"[SKIP] Schemas import (install dependencies first): {e}")

try:
    from backend.main import app
    print("[PASS] FastAPI app imports successfully")
except ImportError as e:
    skipped_imports = True
    print(f"[SKIP] FastAPI app import (install dependencies first): {e}")

# Test 2: Can we create tables?
if not skipped_imports:
    try:
        init_db()
        print("[PASS] Database tables initialized successfully")
    except Exception as e:
        errors.append(f"DB init failed: {e}")
        print(f"[FAIL] DB init: {e}")

    # Test 3: Can we use mock data?
    try:
        cases = MockDataRepository.get_mock_cases()
        assert len(cases) == 3
        print(f"[PASS] Mock data works: {len(cases)} cases loaded")
    except Exception as e:
        errors.append(f"Mock data failed: {e}")
        print(f"[FAIL] Mock data: {e}")

    # Test 4: MySQL connection test
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT 1")
        row = cursor.fetchone()
        cursor.close()
        conn.close()
        assert row[0] == 1
        print("[PASS] MySQL connection test passed")
    except Exception as e:
        errors.append(f"MySQL connection failed: {e}")
        print(f"[FAIL] MySQL connection: {e}")
else:
    print("[SKIP] Runtime checks (dependencies not installed)")

# Summary
print("\n" + "="*50)
if skipped_imports and not errors:
    print("RESULT: Files created. Install dependencies to run full verification.")
    print("\nNext steps:")
    print("1. cd backend")
    print("2. python -m venv venv")
    print("3. venv\\Scripts\\activate")
    print("4. pip install -r requirements.txt")
    print("5. python verify_setup.py")
elif errors:
    print(f"RESULT: {len(errors)} error(s) found")
    for err in errors:
        print(f"  - {err}")
    sys.exit(1)
else:
    print("RESULT: All checks passed! Backend is ready.")
    print("\nNext steps:")
    print("1. Run: python backend/run.py")
    print("2. Visit: http://localhost:8000/docs")
    print("3. Share API contracts with Person 1, 2, 4")
