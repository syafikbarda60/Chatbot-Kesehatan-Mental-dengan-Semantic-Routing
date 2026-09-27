import os
import uuid
import json
from datetime import datetime, timedelta
from dotenv import load_dotenv
from supabase import create_client

# Load environment variables
load_dotenv(".env")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("Error: Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env")
    exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def seed():
    print("Fetching users...")
    res = supabase.table("users").select("user_id").limit(1).execute()
    if not res.data:
        print("Belum ada user yang terdaftar. Harap login/register di aplikasi terlebih dahulu.")
        return
        
    user_id = res.data[0]['user_id']
    print(f"Menggunakan user ID: {user_id}")

    # Journals table
    print("Seeding Journals...")
    try:
        supabase.table("journals").insert([
            {
                "user_id": user_id,
                "mood": "Calm",
                "content": "Hari ini saya merasa sangat tenang karena progres skripsi saya berjalan lancar! Dosen pembimbing juga sangat supportif.",
                "created_at": (datetime.now() - timedelta(days=2)).isoformat()
            },
            {
                "user_id": user_id,
                "mood": "Anxious",
                "content": "Agak sedih dan cemas hari ini karena merasa sedikit tertinggal dari teman-teman yang lain. Tapi saya akan mencoba lebih baik lagi besok.",
                "created_at": (datetime.now() - timedelta(days=1)).isoformat()
            },
            {
                "user_id": user_id,
                "mood": "Focused",
                "content": "Hari yang produktif. Cuma fokus coding dan menyelesaikan tugas-tugas kampus.",
                "created_at": (datetime.now()).isoformat()
            }
        ]).execute()
        print("[OK] Journals seeded.")
    except Exception as e:
        print(f"Error seeding journals: {e}")

    # Chat Sessions
    print("Seeding Chat Sessions & Messages...")
    try:
        session_id = str(uuid.uuid4())
        
        supabase.table("chat_sessions").insert({
            "session_id": session_id,
            "user_id": user_id,
            "title": "Konsultasi tentang Kecemasan Skripsi",
            "started_at": (datetime.now() - timedelta(days=1)).isoformat()
        }).execute()

        msgs = [
            {
                "session_id": session_id,
                "user_id": user_id,
                "role": "user",
                "content": "Halo Sajiwa, akhir-akhir ini saya sering merasa cemas saat memikirkan skripsi. Apa yang harus saya lakukan?",
                "route_used": "conversational",
                "created_at": (datetime.now() - timedelta(minutes=10)).isoformat()
            },
            {
                "session_id": session_id,
                "user_id": user_id,
                "role": "assistant",
                "content": "Halo! Wajar sekali merasa cemas saat mengerjakan skripsi, banyak mahasiswa yang merasakan hal yang sama. Cobalah untuk memecah tugas skripsimu menjadi bagian-bagian kecil agar tidak terasa terlalu membebani. Apakah kamu sudah mencoba berdiskusi dengan teman atau dosen pembimbing?",
                "route_used": "conversational",
                "created_at": (datetime.now() - timedelta(minutes=9)).isoformat()
            }
        ]
        
        supabase.table("messages").insert(msgs).execute()
        print("[OK] Chat Messages seeded.")

    except Exception as e:
        print(f"Error seeding chat: {e}")

    # Assessments
    print("Seeding Assessments...")
    try:
        supabase.table("assessments").insert([
            {
                "user_id": user_id,
                "instrument_type": "PHQ-9",
                "answers": json.dumps([{"q": 1, "score": 1}]),
                "score": 8,
                "severity": "moderate",
                "taken_at": (datetime.now() - timedelta(days=5)).isoformat()
            },
            {
                "user_id": user_id,
                "instrument_type": "GAD-7",
                "answers": json.dumps([{"q": 1, "score": 2}]),
                "score": 12,
                "severity": "severe",
                "taken_at": (datetime.now()).isoformat()
            }
        ]).execute()
        print("[OK] Assessments seeded.")
    except Exception as e:
        print(f"Error seeding assessments: {e}")

    print("Selesai memasukkan data dummy!")

if __name__ == "__main__":
    seed()
