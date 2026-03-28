import sqlite3
from pathlib import Path

DB_PATH = Path("data/cards.db")

def get_connection():
    DB_PATH.parent.mkdir(exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row # row_factory helps to return rows as dictionaries for easier access (important for FastAPI)
    return conn