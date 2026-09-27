import os
import random
from datetime import datetime, timedelta
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY")

supabase: Client = create_client(url, key)

def seed_data():
    print("Mempersiapkan mock data secara massal...")
    
    # 1. Buat Konselor
    counselor_email = "konselor@sanctuary.com"
    try:
        res = supabase.auth.admin.create_user({
            "email": counselor_email,
            "password": "password123",
            "email_confirm": True,
            "user_metadata": {"nama": "Dr. Konselor", "role": "konselor"}
        })
        konselor_id = res.user.id
        supabase.table("users").upsert({
            "user_id": konselor_id,
            "email": counselor_email,
            "nama": "Dr. Konselor",
            "role": "konselor"
        }).execute()
        print(f"Konselor dibuat: {counselor_email}")
    except Exception as e:
        print("Konselor mungkin sudah ada:", e)
        # Ambil ID konselor kalau sudah ada
        user_res = supabase.table("users").select("user_id").eq("email", counselor_email).execute()
        if user_res.data:
            konselor_id = user_res.data[0]["user_id"]
        else:
            return

    # 2. Buat Mahasiswa
    mahasiswa_ids = []
    for i in range(1, 6):
        email = f"mhs{i}@student.com"
        try:
            res = supabase.auth.admin.create_user({
                "email": email,
                "password": "password123",
                "email_confirm": True,
                "user_metadata": {"nama": f"Mahasiswa {i}", "role": "mahasiswa"}
            })
            m_id = res.user.id
            supabase.table("users").upsert({
                "user_id": m_id,
                "email": email,
                "nama": f"Mahasiswa {i}",
                "nim": f"1011{i}000",
                "role": "mahasiswa"
            }).execute()
            mahasiswa_ids.append(m_id)
            print(f"Mahasiswa {i} dibuat.")
        except:
            user_res = supabase.table("users").select("user_id").eq("email", email).execute()
            if user_res.data:
                mahasiswa_ids.append(user_res.data[0]["user_id"])

    # 3. Seed Assessments (7 Hari terakhir)
    print("Menambahkan mock assessments...")
    severities = ["minimal", "mild", "moderate", "severe"]
    now = datetime.utcnow()
    
    # hapus data lama supaya bersih (opsional, tapi kita skip saja)
    
    assessments_data = []
    for i in range(30): # 30 asesmen
        m_id = random.choice(mahasiswa_ids)
        days_ago = random.randint(0, 6)
        taken_time = now - timedelta(days=days_ago)
        score = random.randint(0, 42)
        
        if score <= 9: sev = "minimal"
        elif score <= 13: sev = "mild"
        elif score <= 20: sev = "moderate"
        else: sev = "severe"
            
        assessments_data.append({
            "user_id": m_id,
            "instrument_type": "DASS-21",
            "answers": {"mock": True},
            "score": score,
            "severity": sev,
            "taken_at": taken_time.isoformat()
        })
        
    if assessments_data:
        supabase.table("assessments").insert(assessments_data).execute()

    # 4. Jadwal & Booking Konsultasi
    print("Menambahkan jadwal & booking konsultasi...")
    
    jadwal_tersedia = []
    for i in range(5):
        tgl = now if i < 3 else now + timedelta(days=1)
        jadwal_tersedia.append({
            "konselor_id": konselor_id,
            "tanggal": tgl.strftime("%Y-%m-%d"),
            "waktu_mulai": f"{10+i:02d}:00:00",
            "waktu_selesai": f"{11+i:02d}:00:00",
            "status": "tersedia"
        })
    supabase.table("jadwal_konsultasi").insert(jadwal_tersedia).execute()

    jadwal_res = supabase.table("jadwal_konsultasi").insert({
        "konselor_id": konselor_id,
        "tanggal": now.strftime("%Y-%m-%d"),
        "waktu_mulai": "09:00:00",
        "waktu_selesai": "10:00:00",
        "status": "dipesan"
    }).execute()
    
    if jadwal_res.data:
        j_id = jadwal_res.data[0]["jadwal_id"]
        supabase.table("booking_konsultasi").insert({
            "jadwal_id": j_id,
            "user_id": random.choice(mahasiswa_ids),
            "status": "menunggu",
            "catatan": "Butuh sesi urgent."
        }).execute()

    # 5. Guardrail Logs
    print("Menambahkan guardrail logs...")
    # Butuh chat_session dulu
    session_res = supabase.table("chat_sessions").insert({
        "user_id": random.choice(mahasiswa_ids),
        "title": "Sesi Konsultasi Darurat"
    }).execute()
    
    if session_res.data:
        s_id = session_res.data[0]["session_id"]
        supabase.table("guardrail_logs").insert([
            {
                "session_id": s_id,
                "triggered_input": "Saya merasa ingin menyerah dan mengakhiri semuanya.",
                "triggered_at": now.isoformat()
            },
            {
                "session_id": s_id,
                "triggered_input": "hidup ini tidak ada artinya.",
                "triggered_at": (now - timedelta(hours=2)).isoformat()
            }
        ]).execute()
        
    print("SELESAI! Semua mock data berhasil ditambahkan.")

if __name__ == "__main__":
    seed_data()
