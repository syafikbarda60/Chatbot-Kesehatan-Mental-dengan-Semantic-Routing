"""Encrypt journal entries written before journal content was encrypted (C500 F-04). Idempotent.

    cd apps/backend
    venv/bin/python scripts/encrypt_journals.py

Connects as the database owner (SEED_DB_URL) because it must see every user's rows; the app
role only sees its own under RLS. Rows already holding a Fernet token are skipped.
"""

import os
import sys

import psycopg
from cryptography.fernet import InvalidToken
from dotenv import load_dotenv

load_dotenv()
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from core.security import decrypt_text, encrypt_text  # noqa: E402

DB = os.getenv("SEED_DB_URL", "postgresql://sajiwa:sajiwa@localhost:5432/sajiwa")


def is_token(text):
    try:
        decrypt_text(text)
        return True
    except InvalidToken:
        return False


with psycopg.connect(DB) as conn:
    rows = conn.execute("select journal_id, content from journals").fetchall()
    todo = [(encrypt_text(c), j) for j, c in rows if not is_token(c)]
    with conn.cursor() as cur:
        # Skip the updated_at trigger: re-encoding is not an edit by the student
        cur.execute("set local session_replication_role = replica")
        cur.executemany("update journals set content = %s where journal_id = %s", todo)
    print(f"{len(todo)} of {len(rows)} journal entries encrypted")
