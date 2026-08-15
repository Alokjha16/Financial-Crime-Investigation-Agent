import os
from pathlib import Path
from dotenv import load_dotenv
from mysql.connector import pooling

_env_path = Path(__file__).parent.parent / ".env"
load_dotenv(_env_path)

dbconfig = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": int(os.getenv("DB_PORT", 3306)),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD", ""),
    "database": os.getenv("DB_NAME", "financial_crime"),
    "charset": "utf8mb4",
    "collation": "utf8mb4_unicode_ci",
}

connection_pool = pooling.MySQLConnectionPool(
    pool_name="financial_crime_pool", pool_size=5, pool_reset_session=True, **dbconfig
)


def get_connection():
    return connection_pool.get_connection()


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
