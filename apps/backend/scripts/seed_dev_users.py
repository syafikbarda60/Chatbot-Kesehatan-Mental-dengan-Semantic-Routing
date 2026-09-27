"""Create local development accounts. Idempotent — safe to re-run.

    cd apps/backend
    venv/bin/python scripts/seed_dev_users.py

Connects as the superuser (`sanctuary`) because the first admin cannot be created
through the API: POST /accounts requires an existing admin.

Emails use @example.com because the API's EmailStr rejects reserved TLDs such as
`.local` or `.test`.
"""

import os
import uuid

import bcrypt
import psycopg
from dotenv import load_dotenv

load_dotenv()

DB = os.getenv("SEED_DB_URL", "postgresql://sanctuary:sanctuary@localhost:5432/sanctuary")

USERS = [
    ("admin@example.com", "admin1234", "Admin Sanctuary", "admin"),
    ("konselor@example.com", "konselor1234", "Konselor Sanctuary", "konselor"),
    ("mahasiswa@example.com", "mahasiswa1234", "Mahasiswa Sanctuary", "mahasiswa"),
]

with psycopg.connect(DB, autocommit=True) as conn:
    for email, password, nama, role in USERS:
        conn.execute(
            "insert into users (user_id, email, nama, role, password_hash) "
            "values (%s, %s, %s, %s, %s) "
            "on conflict (email) do update set "
            "nama = excluded.nama, role = excluded.role, password_hash = excluded.password_hash",
            (str(uuid.uuid4()), email, nama, role, bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()),
        )
        print(f"{role:10}  {email:26}  {password}")

print("\nReady. Login through the app (not pgAdmin) with any row above.")
