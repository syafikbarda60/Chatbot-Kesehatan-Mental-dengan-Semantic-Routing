"""Dev seed: dummy counselors + open consultation slots for the next 7 days. Idempotent.

    cd apps/backend
    venv/Scripts/python scripts/seed_jadwal.py

Connects as the superuser (`sanctuary`), like seed_dev_users.py, so it can create
counselor accounts and their slots directly. Local development only.
"""
import os
import uuid
from datetime import date, timedelta

import bcrypt
import psycopg
from dotenv import load_dotenv

load_dotenv()
DB = os.getenv("SEED_DB_URL", "postgresql://sanctuary:sanctuary@localhost:5432/sanctuary")

PASSWORD = "konselor1234"
COUNSELORS = [
    ("rina.konselor@example.com", "Rina Maharani, M.Psi."),
    ("bagus.konselor@example.com", "Bagus Pratama, M.Psi."),
    ("sari.konselor@example.com", "Sari Wulandari, S.Psi."),
]
# (start, end) per counselor; each keeps a different daily pattern
SLOTS = [
    [("09:00", "10:00"), ("10:30", "11:30"), ("13:00", "14:00")],
    [("11:00", "12:00"), ("14:00", "15:00"), ("15:30", "16:30")],
    [("08:00", "09:00"), ("13:30", "14:30")],
]

with psycopg.connect(DB, autocommit=True) as conn:
    pw_hash = bcrypt.hashpw(PASSWORD.encode(), bcrypt.gensalt()).decode()
    today = date.today()
    total = 0
    for i, (email, nama) in enumerate(COUNSELORS):
        uid = conn.execute(
            "insert into users (user_id, email, nama, role, password_hash) values (%s, %s, %s, 'konselor', %s) "
            "on conflict (email) do update set nama = excluded.nama, role = 'konselor' returning user_id",
            (str(uuid.uuid4()), email, nama, pw_hash),
        ).fetchone()[0]
        created = 0
        for d in range(7):
            day = today + timedelta(days=d)
            if day.weekday() == 6 and i != 0:  # Sunday: only the first counselor is available
                continue
            for start, end in SLOTS[i]:
                exists = conn.execute(
                    "select 1 from jadwal_konsultasi where konselor_id = %s and tanggal = %s and waktu_mulai = %s",
                    (uid, day, start),
                ).fetchone()
                if not exists:
                    conn.execute(
                        "insert into jadwal_konsultasi (konselor_id, tanggal, waktu_mulai, waktu_selesai, status) "
                        "values (%s, %s, %s, %s, 'tersedia')",
                        (uid, day, start, end),
                    )
                    created += 1
        total += created
        print(f"{nama:26} {email:28} {created} slot baru")

print(f"\nSelesai. {total} slot dibuat. Password semua konselor: {PASSWORD}")
