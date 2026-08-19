import json
from mysql.connector import Error
from backend.database.connection import get_connection


def get_db():
    conn = get_connection()
    try:
        yield conn
    finally:
        conn.close()


def init_db():
    from backend.database.connection import init_db as _init_db

    _init_db()
