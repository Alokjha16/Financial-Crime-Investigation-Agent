import os
from pathlib import Path
from dotenv import load_dotenv
from mysql.connector import pooling

# Look for .env in root and backend directories
load_dotenv(Path(__file__).resolve().parent.parent / ".env")
load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env")
load_dotenv()

host = os.getenv("DB_HOST", "localhost")
dbconfig = {
    "host": host,
    "port": int(os.getenv("DB_PORT", 3306)),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD", ""),
    "database": os.getenv("DB_NAME", "financial_crime"),
    "charset": "utf8mb4",
    "collation": "utf8mb4_unicode_ci",
}

# TiDB and cloud databases require SSL/TLS
if "localhost" not in host and "127.0.0.1" not in host:
    dbconfig["ssl_verify_cert"] = False
    dbconfig["ssl_verify_identity"] = False

import mysql.connector

def get_connection():
    return mysql.connector.connect(**dbconfig)


def init_db():
    conn = get_connection()
    try:
        cursor = conn.cursor()
        schema_path = Path(__file__).parent / "schema.sql"
        with open(schema_path, "r", encoding="utf-8") as f:
            sql_script = f.read()
        for statement in sql_script.split(";"):
            stmt = statement.strip()
            if stmt:
                cursor.execute(stmt)
        conn.commit()
        print("Database schema initialized.")
    except Exception as e:
        print(f"Schema init error: {e}")
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()
