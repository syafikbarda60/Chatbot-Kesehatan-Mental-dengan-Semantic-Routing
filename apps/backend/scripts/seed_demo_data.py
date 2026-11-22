"""Fill the local database with varied demo data so every dashboard page has something to show.

    cd apps/backend
    venv\\Scripts\\python scripts\\seed_demo_data.py

Needs the backend running on 127.0.0.1:8000: assessments, journals and counseling requests go
through the real API (same path as the mobile app), so triggers, notifications and encryption
behave exactly as in production. Timestamps are then spread over the last 45 days with SQL.
Demo accounts use @demo.example.com, password demo1234. Re-running adds nothing for students
that already have data. Undo: restore the pg_dump taken before seeding.
"""

import os
import random
import sys
import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
import psycopg
import requests
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv()
from core.security import encrypt_text  # noqa: E402

API = "http://127.0.0.1:8000"
DB = os.environ["SEED_DB_URL"]
PASSWORD = "demo1234"
WIB = timezone(timedelta(hours=7))
NOW = datetime.now(timezone.utc)
random.seed(20261120)

STUDENTS = [
    "Aditya Pratama", "Bunga Lestari", "Cahyo Nugroho", "Dinda Ayu Safitri", "Eko Saputra", "Fitri Handayani",
    "Galih Wicaksono", "Hana Salsabila", "Ilham Maulana", "Intan Permatasari", "Joko Susilo", "Kirana Putri",
    "Lukman Hakim", "Maya Anggraeni", "Nanda Rizky", "Oktaviani Rahma", "Putra Ramadhan", "Qonita Zahra",
    "Rizal Firmansyah", "Sekar Ayuningtyas", "Taufik Hidayat", "Ulfa Nurjanah", "Vino Aditama", "Wulan Sari",
    "Yoga Pamungkas", "Zahra Aulia", "Bagas Setiawan", "Citra Kusuma", "Dimas Anggara", "Elisa Marpaung",
]
COUNSELORS = [
    ("siti.rahmawati@demo.example.com", "Dr. Siti Rahmawati, M.Psi., Psikolog", "Psikolog Klinis", "Kecemasan dan stres akademik"),
    ("andi.prasetyo@demo.example.com", "Andi Prasetyo, M.Psi., Psikolog", "Psikolog Klinis", "Depresi dan manajemen emosi"),
    ("nurul.hidayah@demo.example.com", "Nurul Hidayah, M.Psi., Psikolog", "Konselor Pendidikan", "Adaptasi kampus dan relasi"),
]
JOURNALS = [
    ("calm", "Hari ini lebih tenang. Sempat jalan sore di sekitar kampus dan rasanya kepala lebih ringan."),
    ("anxious", "Besok presentasi tugas akhir, dari tadi deg-degan terus dan susah fokus belajar."),
    ("focused", "Berhasil menyelesaikan laporan praktikum lebih cepat dari rencana. Senang bisa konsisten."),
    ("tired", "Capek banget, seharian kuliah lalu rapat organisasi sampai malam. Butuh istirahat."),
    ("anxious", "Nilai UTS keluar dan tidak sesuai harapan. Takut mengecewakan orang tua."),
    ("calm", "Ngobrol lama dengan teman kos, ternyata banyak yang merasakan hal yang sama."),
    ("focused", "Mulai pakai teknik pomodoro, lumayan membantu mengerjakan tugas yang menumpuk."),
    ("tired", "Kurang tidur karena begadang mengerjakan tugas kelompok. Badan rasanya lemas."),
]
CHATS = [
    ("Aku lagi stres banget sama tugas yang numpuk minggu ini", "Kedengarannya minggu ini berat sekali. Tugas mana yang paling membebani pikiranmu sekarang?"),
    ("Aku susah tidur beberapa hari ini", "Susah tidur bisa sangat melelahkan. Apa yang biasanya ada di pikiranmu saat mencoba tidur?"),
    ("Aku merasa nggak punya teman di kampus", "Merasa sendirian di lingkungan baru itu wajar dan tetap tidak enak. Sudah berapa lama kamu merasakannya?"),
    ("Gimana cara mengatur waktu antara kuliah dan organisasi?", "Coba mulai dengan menuliskan semua kegiatan minggu ini, lalu tandai mana yang benar-benar wajib."),
]
CRISIS = ["Aku capek hidup, rasanya pengen menghilang aja", "Kadang kepikiran buat nyakitin diri sendiri",
          "Aku merasa nggak ada gunanya lagi hidup"]
CONTEXTS = [
    "Ingin konsultasi soal kecemasan menjelang sidang skripsi", "Sulit tidur dan sering merasa cemas berlebihan",
    "Masalah dengan teman satu kelompok dan merasa dikucilkan", "Butuh bantuan mengatur waktu dan motivasi kuliah",
    "Merasa sedih terus-menerus sejak awal semester", "Tekanan dari keluarga soal nilai akademik",
    "Ingin cerita tentang masalah keluarga yang mengganggu kuliah", "Kesulitan beradaptasi sebagai mahasiswa baru",
]


def ago(days, hour=None):
    t = NOW - timedelta(days=days)
    return t.replace(hour=hour, minute=random.choice([5, 17, 32, 48])) if hour is not None else t - timedelta(minutes=random.randint(0, 600))


def login(email, password=PASSWORD):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    r.raise_for_status()
    return {"Authorization": "Bearer " + r.json()["access_token"]}


def call(method, path, headers, **kw):
    r = requests.request(method, API + path, headers=headers, timeout=60, **kw)
    if r.status_code >= 400:
        raise RuntimeError(f"{method} {path} -> {r.status_code} {r.text[:200]}")
    return r.json()


with psycopg.connect(DB, autocommit=True) as conn:
    pw = bcrypt.hashpw(PASSWORD.encode(), bcrypt.gensalt()).decode()
    units = conn.execute(
        "select au.academic_unit_id, au.faculty_id from academic_units au join faculties f using(faculty_id) "
        "where au.unit_type='study_program' and au.active and f.active and f.name not like 'Fakultas QA%%'").fetchall()
    # Test leftovers that clutter the dashboard: QA faculties from automated runs, safety signals of deleted accounts
    conn.execute("update faculties set active=false where name like 'Fakultas QA%%'")
    conn.execute("update counseling_resources set active=false where name like 'Ruang QA%%'")
    for name, kind, cap, where in [("Ruang Konseling 1", "physical", 1, "Gedung SA-MWA Lt. 2"),
                                   ("Ruang Konseling 2", "physical", 1, "Gedung SA-MWA Lt. 2"),
                                   ("Konseling Daring", "virtual", 4, "Tautan video dikirim konselor")]:
        conn.execute("insert into counseling_resources(name,resource_type,capacity,location_or_url,active,created_by) "
                     "select %s,%s,%s,%s,true,(select user_id from users where email='admin@example.com') "
                     "where not exists (select 1 from counseling_resources where name=%s)", (name, kind, cap, where, name))
    orphan = [r[0] for r in conn.execute("select guardrail_log_id from guardrail_logs where user_id is null").fetchall()]
    conn.execute("delete from admin_notifications where entity_id = any(%s)", (orphan,))
    conn.execute("delete from guardrail_logs where guardrail_log_id = any(%s)", (orphan,))

    counselors = []
    for email, name, title, spec in COUNSELORS:
        uid = conn.execute("insert into users(email,name,role,password_hash) values(%s,%s,'konselor',%s) "
                           "on conflict(email) do update set name=excluded.name returning user_id", (email, name, pw)).fetchone()[0]
        conn.execute("insert into counselor_profiles(user_id,title,specialization,active) values(%s,%s,%s,true) "
                     "on conflict(user_id) do nothing", (uid, title, spec))
        counselors.append(uid)
    counselors.append(conn.execute("select user_id from users where email='konselor@example.com'").fetchone()[0])
    for uid in counselors:  # Mon-Fri 08:00-16:00 WIB
        for dow in range(1, 6):
            conn.execute("insert into counselor_availability_rules(counselor_id,day_of_week,start_time,end_time) "
                         "select %s,%s,'08:00','16:00' where not exists (select 1 from counselor_availability_rules "
                         "where counselor_id=%s and day_of_week=%s and active)", (uid, dow, uid, dow))

    admin = login("admin@example.com", "admin1234")
    inst = None
    students = []
    for i, name in enumerate(STUDENTS):
        email = name.lower().replace(" ", ".") + "@demo.example.com"
        nim = f"{random.choice(['21', '24', '26', '30', '40'])}0{random.randint(10, 99)}12{random.choice(['2', '3', '4'])}{random.randint(10000, 99999)}"
        uid = conn.execute("insert into users(email,name,nim,role,password_hash,created_at) values(%s,%s,%s,'mahasiswa',%s,%s) "
                           "on conflict(email) do update set name=excluded.name returning user_id, (xmax=0) as fresh",
                           (email, name, nim, pw, ago(random.randint(50, 80)))).fetchone()
        unit = random.choice(units)
        conn.execute("insert into student_academic_profiles(user_id,faculty_id,academic_unit_id) values(%s,%s,%s) "
                     "on conflict(user_id) do nothing", (uid[0], unit[1], unit[0]))
        if not uid[1] and conn.execute("select 1 from assessments where user_id=%s", (uid[0],)).fetchone():
            continue
        students.append((uid[0], email, name))

    risk = {}
    for idx, (uid, email, name) in enumerate(students):
        h = login(email)
        if inst is None:
            inst = call("GET", "/assessment/instrument/active?code=DASS-21", h)
        base = [0] * 13 + [1] * 9 + [2] * 5 + [3] * 3
        level = base[idx % len(base)]
        risk[uid] = level
        # 1-3 attempts; the most recent one reflects the student's current level
        for n, days in enumerate(sorted(random.sample(range(1, 44), random.randint(1, 3)), reverse=True)):
            lv = max(0, level - 1) if n == 0 and level > 1 and random.random() < 0.5 else level
            answers = []
            for q in inst["questions"]:
                opts = q["options"]
                # DASS-21 doubles raw scores, so a +1 on every item already lands in "severe": keep the noise mostly downward
                pick = min(len(opts) - 1, max(0, lv + random.choice([-1, -1, 0, 0, 0, 1] if lv < 3 else [-1, 0, 0])))
                answers.append({"question_id": q["assessment_question_id"], "option_id": opts[pick]["assessment_answer_option_id"]})
            call("POST", "/assessment/instrument/submit", h,
                 json={"instrument_version_id": inst["version"]["instrument_version_id"], "answers": answers})
            when = ago(days)
            aid = conn.execute("select assessment_id from assessments where user_id=%s order by taken_at desc limit 1", (uid,)).fetchone()[0]
            conn.execute("update assessments set taken_at=%s where assessment_id=%s", (when, aid))
            conn.execute("update assessment_category_results set created_at=%s where assessment_id=%s", (when, aid))
            conn.execute("update guardrail_logs set notified_at=%s where assessment_id=%s", (when, aid))
        for mood, text in random.sample(JOURNALS, random.randint(2, 5)):
            j = call("POST", "/journal", h, json={"content": text, "mood": mood})
            jid = j.get("journal_id") or j.get("journal", {}).get("journal_id")
            if jid:
                conn.execute("update journals set created_at=%s, updated_at=%s where journal_id=%s", (w := ago(random.randint(1, 40)), w, jid))
        # Chat history (written directly: the LLM takes ~30 s per reply), encrypted like the real route
        for _ in range(random.randint(1, 3)):
            sid, start = str(uuid.uuid4()), ago(random.randint(1, 40))
            conn.execute("insert into sessions(session_id,user_id,started_at) values(%s,%s,%s)", (sid, uid, start))
            q, a = random.choice(CHATS)
            conn.execute("insert into messages(session_id,user_id,role,content,route_used,created_at) values(%s,%s,'user',%s,'conversational',%s),"
                         "(%s,%s,'assistant',%s,'conversational',%s)",
                         (sid, uid, encrypt_text(q), start, sid, uid, encrypt_text(a), start + timedelta(seconds=25)))
            if level >= 2 and random.random() < 0.6:  # high-risk students also tripped the chat guardrail
                text = random.choice(CRISIS)
                t = start + timedelta(minutes=3)
                conn.execute("insert into messages(session_id,user_id,role,content,route_used,created_at) values(%s,%s,'user',%s,'guardrail',%s)",
                             (sid, uid, encrypt_text(text), t))
                conn.execute("insert into guardrail_logs(session_id,user_id,triggered_input,notified_at) values(%s,%s,%s,%s)",
                             (sid, uid, encrypt_text(text), t))
        print(f"{name:22} risiko={level}")

    # Counseling: requests from the mobile endpoint, then the admin assigns most of them
    queue = sorted(students, key=lambda s: -risk[s[0]])[:14]
    today = datetime.now(WIB).date()
    plan = (["today"] * 3 + ["soon"] * 3 + ["completed"] * 4 + ["no_show", "cancelled"] + ["open"] * 2)
    slot_day = {"today": today, "soon": today + timedelta(days=3 if today.weekday() < 4 else 5)}
    for i, ((uid, email, name), kind) in enumerate(zip(queue, plan)):
        req = call("POST", "/counseling/requests", login(email), json={"preferred_context": CONTEXTS[i % len(CONTEXTS)]})["request"]
        rid = req["counseling_request_id"]
        conn.execute("update counseling_requests set created_at=%s where counseling_request_id=%s",
                     (ago(random.randint(0, 2) if kind in ("open", "today") else random.randint(4, 30)), rid))
        if kind == "open":
            continue
        day = slot_day.get(kind, today + timedelta(days=7))
        while day.weekday() > 4:
            day += timedelta(days=1)
        start = datetime(day.year, day.month, day.day, 9 + (i % 3) * 2, tzinfo=WIB)
        appt = call("POST", f"/admin/counseling/requests/{rid}/assign", admin,
                    json={"counselor_id": str(counselors[i % len(counselors)]), "starts_at": start.isoformat(),
                          "ends_at": (start + timedelta(hours=1)).isoformat()})["appointment"]
        if kind in ("completed", "no_show", "cancelled"):
            aid = appt["counseling_appointment_id"]
            call("PATCH", f"/admin/counseling/appointments/{aid}", admin, json={"status": kind})
            past = ago(random.randint(3, 25), hour=2 + (i % 3) * 2)  # 09:00-13:00 WIB
            with conn.transaction():
                conn.execute("set local session_replication_role = replica")  # moving into the past is not a reschedule
                conn.execute("update counseling_appointments set starts_at=%s, ends_at=%s where counseling_appointment_id=%s",
                             (past, past + timedelta(hours=1), aid))
                conn.execute("update counseling_appointment_events set created_at=%s where counseling_appointment_id=%s",
                             (past + timedelta(hours=1), aid))
        print(f"konseling {name:22} {kind}")

    # Inbox timestamps follow their source; anything older than 3 days counts as already handled
    demo = "(select user_id from users where email like '%%@demo.example.com')"
    conn.execute(f"update admin_notifications n set created_at=a.taken_at from assessments a where n.entity_id=a.assessment_id and a.user_id in {demo}")
    conn.execute(f"update admin_notifications n set created_at=g.notified_at from guardrail_logs g where n.entity_id=g.guardrail_log_id and g.user_id in {demo}")
    conn.execute(f"update admin_notifications n set created_at=r.created_at from counseling_requests r where n.entity_id=r.counseling_request_id and r.student_id in {demo}")
    conn.execute("update admin_notifications set read_at=created_at+interval '1 day' where read_at is null and created_at < now()-interval '3 days'")
    conn.execute(f"update guardrail_logs set is_read=true where notified_at < now()-interval '5 days' and user_id in {demo}")
    for t, n in conn.execute("select 'mahasiswa demo', count(*) from users where email like '%%@demo.example.com' and role='mahasiswa' union all "
                             "select 'asesmen', count(*) from assessments union all select 'sinyal keselamatan', count(*) from guardrail_logs union all "
                             "select 'permintaan konseling', count(*) from counseling_requests union all select 'janji temu', count(*) from counseling_appointments union all "
                             "select 'jurnal', count(*) from journals").fetchall():
        print(f"{t:22} {n}")
