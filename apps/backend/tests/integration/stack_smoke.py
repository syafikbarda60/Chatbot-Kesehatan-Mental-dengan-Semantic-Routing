"""Integration tier — the API against the real stack (Postgres, Ollama, uvicorn).

Starts nothing: expects `docker compose up -d` and uvicorn to already be running.
Exercises auth, accounts, assessments, journals, jadwal/booking, dashboard, chat
(real Ollama), and RLS isolation between two students, then deletes everything it
created. It is a script rather than unittest cases because the checks share one
seeded student and must run in order; it reports every failure instead of stopping
at the first one.

    cd apps/backend
    venv/bin/python tests/integration/stack_smoke.py

Env overrides: `API_BASE`, `SMOKE_DB_URL` (superuser URL, used only to seed the
first admin and to verify DB state — the API itself always uses sajiwa_app).
Exits 0 with a SKIP line when the stack is not up, so a unit run is never blocked
by it, and 1 when any check fails.
"""

import json, os, urllib.request, urllib.error, uuid, sys, time
import bcrypt, psycopg
from websockets.sync.client import connect as ws_connect

BASE = os.getenv("API_BASE", "http://localhost:8000")
DB = os.getenv("SMOKE_DB_URL", "postgresql://sajiwa:sajiwa@localhost:5432/sajiwa")
FAILS = []
SFX = uuid.uuid4().hex[:8]

def skip_without_stack():
    """Integration tier: skip loudly, never silently pass."""
    try:
        urllib.request.urlopen(BASE + "/health", timeout=3).close()
        psycopg.connect(DB, connect_timeout=3).close()
    except Exception as error:
        print(f"SKIP integration: stack not reachable ({error})")
        print("     start it: docker compose up -d, then venv/bin/uvicorn main:app --reload")
        sys.exit(0)


def call(method, path, body=None, token=None):
    req = urllib.request.Request(BASE + path, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    data = json.dumps(body).encode() if body is not None else None
    try:
        with urllib.request.urlopen(req, data, timeout=180) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")

def check(name, cond, detail=""):
    print(("  PASS  " if cond else "  FAIL  ") + name + ("" if cond else f"   -> {detail}"))
    if not cond:
        FAILS.append(name)

def call_stream(path, body, token=None, timeout=180):
    """POST and consume SSE frame by frame.

    Returns (status, frames, first_token_ms, total_ms). The timings are what distinguish real
    streaming from a finished response chopped up after the fact.
    """
    req = urllib.request.Request(BASE + path, method="POST")
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")

    start = time.monotonic()
    frames, first_token_ms = [], None
    try:
        with urllib.request.urlopen(req, json.dumps(body).encode(), timeout=timeout) as r:
            status = r.status
            for raw in r:
                line = raw.decode().strip()
                if not line.startswith("data:"):
                    continue
                payload = line[5:].strip()
                if payload == "[DONE]":
                    frames.append("[DONE]")
                    break
                frame = json.loads(payload)
                frames.append(frame)
                if first_token_ms is None and frame.get("token"):
                    first_token_ms = (time.monotonic() - start) * 1000
    except urllib.error.HTTPError as e:
        return e.code, [], None, None

    return status, frames, first_token_ms, (time.monotonic() - start) * 1000

def sql(q, p=None):
    with psycopg.connect(DB, autocommit=True) as c:
        cur = c.execute(q, p)
        return cur.fetchall() if cur.description else []

print("== health ==")
skip_without_stack()
s, h = call("GET", "/health")
check("GET /health", s == 200 and h.get("status") == "ok", (s, h))

print("== auth ==")
stu_email, stu_pw = f"stu{SFX}@example.com", "pass1234"
s, r = call("POST", "/auth/register", {"email": stu_email, "password": stu_pw, "name": "Stu"})
check("register", s == 201 and r["session"]["access_token"], (s, r))
stu_id = r.get("user_id")

s, r = call("POST", "/auth/register", {"email": stu_email, "password": stu_pw, "name": "Stu"})
check("duplicate email rejected", s == 400, (s, r))

s, r = call("POST", "/auth/login", {"email": stu_email, "password": stu_pw})
check("login", s == 200 and r["user"]["role"] == "mahasiswa", (s, r))
stu_tok = r.get("access_token")

s, r = call("POST", "/auth/login", {"email": stu_email, "password": "nope"})
check("wrong password -> 401", s == 401, (s, r))

s, r = call("GET", "/auth/me")
check("no token -> 401/403", s in (401, 403), (s, r))

s, r = call("GET", "/auth/me", token=stu_tok)
check("GET /auth/me", s == 200 and r["email"] == stu_email, (s, r))
check("password_hash never returned", "password_hash" not in r, r.keys())

print("== bootstrap admin (direct DB, no API exists for the first admin) ==")
admin_email, admin_pw = f"adm{SFX}@example.com", "pass1234"
admin_id = str(uuid.uuid4())
sql("insert into users (user_id,email,name,role,password_hash) values (%s,%s,%s,'admin',%s)",
    (admin_id, admin_email, "Admin", bcrypt.hashpw(admin_pw.encode(), bcrypt.gensalt()).decode()))
s, r = call("POST", "/auth/login", {"email": admin_email, "password": admin_pw})
check("admin login", s == 200 and r["user"]["role"] == "admin", (s, r))
admin_tok = r.get("access_token")

print("== accounts (admin CRUD) ==")
kon_email, kon_pw = f"kon{SFX}@example.com", "pass1234"
s, r = call("POST", "/accounts", {"email": kon_email, "password": kon_pw, "name": "Kon", "role": "konselor"}, admin_tok)
check("admin creates konselor", s == 201 and r["role"] == "konselor", (s, r))
kon_id = r.get("user_id")

s, r = call("GET", "/accounts", token=stu_tok)
check("mahasiswa blocked from /accounts", s == 403, (s, r))

s, r = call("GET", "/accounts", token=admin_tok)
check("admin lists accounts", s == 200 and r["total"] >= 3, (s, r))

s, r = call("POST", "/auth/login", {"email": kon_email, "password": kon_pw})
kon_tok = r.get("access_token")
check("konselor login", s == 200 and r["user"]["role"] == "konselor", (s, r))

print("== assessments ==")
# The admin watches /realtime while the student submits: migration 009's trigger on
# guardrail_logs must reach the socket as an area notice that carries no student data.
live = ws_connect(BASE.replace("http", "ws", 1) + "/realtime", open_timeout=5)
live.send(json.dumps({"type": "auth", "token": admin_tok}))
check("realtime accepts an admin token sent in the first message", json.loads(live.recv(timeout=5)) == {"type": "ready"})
s, r = call("POST", "/assessment/submit",
            {"answers": [{"question_id": i, "score": 3} for i in range(9)],
             "instrument_type": "PHQ-9", "session_id": f"s-{SFX}"}, stu_tok)
check("submit severe PHQ-9", s == 200 and r["score"] == 27 and r["severity"] == "severe", (s, r))
assess_id = r.get("assessment_id")

n = sql("select count(*) from guardrail_logs where user_id = %s", (stu_id,))[0][0]
check("severe assessment logged to guardrail_logs", n >= 1, n)
notices = set()
try:
    while True:
        notices.add(live.recv(timeout=3))
except TimeoutError:
    pass
live.close()
check("realtime announces the new safety signal by area only",
      json.dumps({"type": "changed", "topic": "signals"}, separators=(",", ":")) in notices
      and all(set(json.loads(n)) == {"type", "topic"} for n in notices), notices)

row = sql("select source, triggered_input from guardrail_logs "
          "where assessment_id = %s", (assess_id,))
check("assessment log carries source + assessment_id",
      bool(row) and row[0][0] == "assessment", row)
check("assessment log stores no clinical detail in plaintext",
      bool(row) and row[0][1] is None, row)

s, r = call("GET", "/assessment/history", token=stu_tok)
check("assessment history", s == 200 and len(r["assessments"]) == 1, (s, r))

s, r = call("POST", "/assessment/submit", {"answers": [{"question_id": 0, "score": 0}]}, None)
check("assessment without token blocked", s in (401, 403), (s, r))

print("== DASS-21 variants ==")
variant_code = f"DASS-S-{SFX}"
s, r = call("POST", "/admin/assessment-instruments/dass21-variants",
            {"name": f"DASS-21 Stres {SFX}", "code": variant_code, "subscales": ["stress"]}, admin_tok)
check("admin publishes a stress-only DASS-21 variant",
      s == 201 and r["version"]["status"] == "published" and len(r["questions"]) == 7
      and {q["category"] for q in r["questions"]} == {"stress"}, (s, r.get("version") if s == 201 else r))
variant_id = r["version"]["instrument_id"] if s == 201 else None
s, r = call("POST", "/admin/assessment-instruments/dass21-variants",
            {"name": "Tanpa subskala", "code": f"DASS-X-{SFX}", "subscales": []}, admin_tok)
check("a variant without a subscale is refused", s == 422, (s, r))
s, r = call("PUT", f"/admin/assessment-instruments/{variant_id}/shown-in-app", token=stu_tok)
check("mahasiswa cannot choose the app's instrument", s == 403, (s, r))
shown_before = sql("select instrument_id, updated_by, updated_at from assessment_instruments where shown_in_app")
s, r = call("PUT", f"/admin/assessment-instruments/{variant_id}/shown-in-app", token=admin_tok)
check("admin shows the variant in the app", s == 200, (s, r))
s, active = call("GET", "/assessment/instrument/active", token=stu_tok)
check("the app now serves the variant's 7 stress items",
      s == 200 and active["version"]["code"] == variant_code and len(active["questions"]) == 7, (s, active))
if s == 200:
    lowest = [{"question_id": q["assessment_question_id"], "option_id": q["options"][0]["assessment_answer_option_id"]}
              for q in active["questions"]]
    s, r = call("POST", "/assessment/instrument/submit",
                {"instrument_version_id": active["version"]["instrument_version_id"], "answers": lowest}, stu_tok)
    check("student submits the variant", s == 201, (s, r))
    scored = sql("select category, severity from assessment_category_results where assessment_id = %s",
                 (r.get("assessment_id"),))
    check("only the offered subscale is scored, on its own norm", scored == [("stress", "normal")], scored)
# Leave the stack showing what it showed before this run
if shown_before:
    s, r = call("PUT", f"/admin/assessment-instruments/{shown_before[0][0]}/shown-in-app", token=admin_tok)
    check("the app's previous instrument is restored", s == 200, (s, r))
    # The restore stamped the run's admin as updated_by, which would also block deleting that admin
    sql("update assessment_instruments set updated_by = %s, updated_at = %s where instrument_id = %s",
        (shown_before[0][1], shown_before[0][2], shown_before[0][0]))

print("== notifications ==")
# Migration 011's triggers tell the people a change concerns, never the person who made it.
from datetime import date as _date, timedelta as _timedelta
day = _date.today() + _timedelta(days=21)
wib = lambda hour: f"{day.isoformat()}T{hour:02d}:00:00+07:00"
s, r = call("POST", "/admin/counseling/availability",
            {"counselor_id": kon_id, "day_of_week": day.isoweekday() % 7, "start_time": "08:00", "end_time": "16:00"}, admin_tok)
check("admin opens the konselor's hours", s == 201, (s, r))
s, r = call("POST", "/counseling/requests", {"preferred_context": f"notif {SFX}"}, stu_tok)
req_id = r.get("request", {}).get("counseling_request_id")
s, r = call("GET", "/notifications", token=stu_tok)
check("asking for counseling notifies nobody back (own action)", s == 200 and r["unread"] == 0, (s, r))
s, r = call("POST", f"/admin/counseling/requests/{req_id}/assign",
            {"counselor_id": kon_id, "starts_at": wib(9), "ends_at": wib(10)}, admin_tok)
appt_id = r.get("appointment", {}).get("counseling_appointment_id")
check("admin schedules the session", s == 201 and appt_id, (s, r))
titles = lambda tok: [n["title"] for n in call("GET", "/notifications", token=tok)[1]["notifications"]]
s, r = call("GET", "/notifications", token=stu_tok)
check("student hears the session is scheduled, with the time in WIB",
      s == 200 and r["unread"] == 1 and r["notifications"][0]["title"] == "Sesi konseling dijadwalkan"
      and "09.00 WIB" in r["notifications"][0]["body"] and "Kon" in r["notifications"][0]["body"], (s, r))
student_notice = r["notifications"][0]["notification_id"] if s == 200 and r["notifications"] else None
check("konselor hears about the new session", "Sesi konseling baru" in titles(kon_tok), titles(kon_tok))
s, r = call("PATCH", f"/admin/counseling/appointments/{appt_id}", {"starts_at": wib(11), "ends_at": wib(12)}, admin_tok)
s, r = call("GET", "/notifications", token=stu_tok)
check("moving the session tells the student the new time",
      s == 200 and r["notifications"][0]["title"] == "Jadwal sesi konseling diubah"
      and r["notifications"][0]["body"].startswith("Sekarang") and "11.00 WIB" in r["notifications"][0]["body"], (s, r))
call("PATCH", f"/admin/counseling/appointments/{appt_id}", {"status": "cancelled"}, admin_tok)
check("cancelling tells both sides", "Sesi konseling dibatalkan" in titles(stu_tok) and "Sesi konseling dibatalkan" in titles(kon_tok),
      (titles(stu_tok), titles(kon_tok)))
s, r = call("PATCH", f"/notifications/{student_notice}/read", token=kon_tok)
check("nobody can touch someone else's notification", s == 404, (s, r))
s, r = call("POST", "/counselor/exception-requests",
            {"date": (day + _timedelta(days=1)).isoformat(), "full_day": True, "reason": f"Seminar {SFX}"}, kon_tok)
exc_id = r.get("exception", {}).get("counselor_exception_request_id")
check("konselor asks for an exception", s == 201 and exc_id, (s, r))
s, r = call("GET", "/admin/notifications?category=schedule", token=admin_tok)
check("admins are told about the exception request",
      s == 200 and "unread" in r and any(n["entity_id"] == exc_id and n["title"] == "Pengajuan izin konselor" for n in r["notifications"]), (s, r))
call("POST", f"/admin/counseling/exception-requests/{exc_id}/reject", {"decision_note": "Bentrok dengan jadwal kampus"}, admin_tok)
s, r = call("GET", "/notifications", token=kon_tok)
check("konselor hears the decision with its reason",
      s == 200 and r["notifications"][0]["title"] == "Pengajuan izinmu ditolak" and "Bentrok" in r["notifications"][0]["body"], (s, r))
s, r = call("POST", "/notifications/mark-all-read", token=stu_tok)
s, r = call("GET", "/notifications", token=stu_tok)
check("mark all read empties the student's badge", s == 200 and r["unread"] == 0 and len(r["notifications"]) == 3, (s, r))

print("== journals ==")
s, r = call("POST", "/journal", {"content": "hari ini berat", "mood": "anxious"}, stu_tok)
check("create journal", s == 201 and r["journal"]["content"] == "hari ini berat", (s, r))
jid = r.get("journal", {}).get("journal_id")

s, r = call("GET", "/journal", token=stu_tok)
check("list journals", s == 200 and len(r["journals"]) == 1, (s, r))

s, r = call("GET", "/journal/today", token=stu_tok)
check("today journal", s == 200 and r["journal"] is not None, (s, r))

s, r = call("PATCH", f"/journal/{jid}", {"mood": "calm"}, stu_tok)
check("update journal", s == 200 and r["journal"]["mood"] == "calm", (s, r))

print("== jadwal + booking ==")
s, r = call("POST", "/jadwal", {"date": "2026-10-01", "start_time": "09:00", "end_time": "10:00"}, kon_tok)
check("konselor creates slot", s == 201 and r["jadwal"]["status"] == "available", (s, r))
counseling_slot_id = r.get("jadwal", {}).get("counseling_slot_id")

s, r = call("POST", "/jadwal", {"date": "2026-10-01", "start_time": "09:00", "end_time": "10:00"}, stu_tok)
check("mahasiswa cannot create slot", s == 403, (s, r))

s, r = call("GET", "/jadwal", token=stu_tok)
check("mahasiswa sees available slot", s == 200 and any(j["counseling_slot_id"] == counseling_slot_id for j in r["jadwal"]), (s, r))

s, r = call("POST", "/booking", {"counseling_slot_id": counseling_slot_id, "notes": "butuh bantuan"}, stu_tok)
check("book slot", s == 201 and r["booking"]["status"] == "pending", (s, r))
counseling_booking_id = r.get("booking", {}).get("counseling_booking_id")

st = sql("select status from counseling_slots where counseling_slot_id = %s", (counseling_slot_id,))[0][0]
check("trigger flipped slot to dipesan", st == "booked", st)

s, r = call("POST", "/booking", {"counseling_slot_id": counseling_slot_id}, stu_tok)
check("double booking rejected", s == 409, (s, r))

s, r = call("GET", "/booking/saya", token=stu_tok)
check("my bookings (nested jadwal shape)",
      s == 200 and r["bookings"][0]["counseling_slots"]["date"] is not None, (s, r))

s, r = call("GET", "/booking/masuk", token=kon_tok)
check("konselor sees incoming booking", s == 200 and len(r["bookings"]) == 1, (s, r))

s, r = call("PATCH", f"/booking/{counseling_booking_id}", {"status": "cancelled"}, stu_tok)
check("cancel booking", s == 200, (s, r))
st = sql("select status from counseling_slots where counseling_slot_id = %s", (counseling_slot_id,))[0][0]
check("trigger restored slot to tersedia", st == "available", st)

print("== dashboard ==")
s, r = call("GET", "/dashboard/data", token=kon_tok)
ok = (s == 200 and r["total_assessments"] >= 1 and set(r["severity_distribution"]) == {"minimal","mild","moderate","severe"}
      and isinstance(r["weekly_trend"], list) and r["guardrail_trigger_count"] >= 1)
check("dashboard data shape", ok, (s, r))

s, r = call("GET", "/dashboard/data", token=stu_tok)
check("mahasiswa blocked from dashboard", s == 403, (s, r))

print("== chat (Ollama) ==")
s, r = call("POST", "/chat", {"message": "saya mau bunuh diri", "session_id": f"chat-{SFX}"}, stu_tok)
check("guardrail returns crisis response", s == 200 and r["is_high_risk"] and "119" in r["response"], (s, r))

s, r = call("POST", "/chat", {"message": "halo aku lagi sedih hari ini", "session_id": f"chat-{SFX}"}, stu_tok)
check("conversational reply", s == 200 and len(r["response"]) > 10 and not r["is_high_risk"], (s, r))

s, r = call("POST", "/rag/context", {"message": "apa itu depresi?"}, stu_tok)
check("RAG endpoint responds", s == 200 and "context" in r, (s, r))

rows = sql("select content, route_used from messages where session_id = %s", (f"chat-{SFX}",))
check("chat persisted to messages", len(rows) >= 4, len(rows))
check("chat stored encrypted, not plaintext",
      all(not c.startswith("saya mau bunuh diri") and c.startswith("gAAAAA") for c, _ in rows),
      [c[:12] for c, _ in rows])

sess = sql("select user_id from sessions where session_id = %s", (f"chat-{SFX}",))
check("chat session row created and owned by the student",
      len(sess) == 1 and str(sess[0][0]) == stu_id, sess)

s, r = call("GET", f"/chat/history?session_id=chat-{SFX}", token=stu_tok)
msgs = r.get("messages", [])
check("history endpoint returns the decrypted transcript",
      s == 200 and len(msgs) >= 4 and msgs[0]["role"] == "user"
      and any(m["text"] == "saya mau bunuh diri" for m in msgs), (s, msgs[:2]))
check("history is oldest-first",
      all(msgs[i]["created_at"] <= msgs[i + 1]["created_at"] for i in range(len(msgs) - 1)),
      [m["created_at"] for m in msgs])

# A long conversation must reopen with its newest messages, not its first 50. Reuses an
# encrypted content from above so every row decrypts; the route marks the insertion order.
long_sid = f"chat-long-{SFX}"
sql("insert into sessions (session_id, user_id) values (%s, %s) on conflict do nothing",
    (long_sid, stu_id))
sql("insert into messages (session_id, user_id, role, content, route_used, created_at) "
    "select %s, %s, 'user', %s, 'r' || i, now() + (i || ' milliseconds')::interval "
    "from generate_series(1, 60) as i",
    (long_sid, stu_id, rows[0][0]))
s, r = call("GET", f"/chat/history?session_id={long_sid}&limit=50", token=stu_tok)
routed = [m["route"] for m in r.get("messages", [])]
check("history keeps the newest 50, oldest-first",
      s == 200 and routed == [f"r{i}" for i in range(11, 61)],
      (s, routed[:3], routed[-3:]))

s, r = call("GET", f"/chat/history?session_id=chat-{SFX}", token=None)
check("history requires auth", s in (401, 403), (s, r))

guard = sql("select triggered_input from guardrail_logs where session_id = %s", (f"chat-{SFX}",))
check("crisis log stored encrypted, not plaintext",
      bool(guard) and guard[0][0].startswith("gAAAAA")
      and "bunuh diri" not in guard[0][0], guard)

print("== chat streaming ==")
s, frames, first_ms, total_ms = call_stream(
    "/chat/stream",
    {"message": "jelaskan singkat apa itu depresi dan gejalanya", "session_id": f"stream-{SFX}"},
    stu_tok,
)
tokens = [f["token"] for f in frames if isinstance(f, dict) and f.get("token")]
meta = frames[0] if frames and isinstance(frames[0], dict) else {}
check("stream opens with a metadata frame",
      s == 200 and "is_high_risk" in meta and meta.get("route"), (s, meta))
check("stream sends many token frames, not one blob", len(tokens) > 5, len(tokens))
check("stream terminates with [DONE]", bool(frames) and frames[-1] == "[DONE]",
      frames[-1] if frames else None)
check("tokens keep arriving after the first",
      first_ms is not None and total_ms and (total_ms - first_ms) > 1000,
      f"first={first_ms:.0f}ms total={total_ms:.0f}ms")
rows = sql("select count(*) from messages where session_id = %s", (f"stream-{SFX}",))
check("streamed turn persisted after completion", rows[0][0] >= 2, rows)

s, frames, _, _ = call_stream(
    "/chat/stream", {"message": "saya mau bunuh diri", "session_id": f"sg-{SFX}"}, stu_tok)
streamed = "".join(f["token"] for f in frames if isinstance(f, dict) and f.get("token"))
check("crisis streams the fixed text, never LLM prose",
      bool(frames) and frames[0].get("is_high_risk") is True and "119" in streamed,
      (frames[0] if frames else None, streamed[:60]))

print("== guardrail must never miss a crisis message ==")
CRISIS = [
    "saya ingin mengakhiri hidup saya",
    "saya mau bunuh diri",
    "saya tidak mau hidup lagi",
    "saya ingin menyakiti diri sendiri",
    "saya sedang memegang pisau",
    "saya sudah minum obat banyak",
    "aku udah minum obat banyak",
    "aku pegang pisau sekarang",
    "aku mau loncat dari gedung",
    "aku pengen mati aja",
    "gue udah gak kuat hidup",
    "mending aku mati",
    "aku mau membunuh diriku",
    "aku pengen nyakitin diri sendiri",
    "saya berencana mengakhiri semuanya",
    "aku gak mau hidup lagi",
    "pengin bunuh diri",
]
for msg in CRISIS:
    s, r = call("POST", "/guardrail/check", {"message": msg}, stu_tok)
    check(f"flag crisis: {msg[:40]}", s == 200 and r.get("is_high_risk") is True, (s, r))

# the reply must be the fixed hotline text, never LLM prose
s, r = call("POST", "/chat", {"message": "aku udah minum obat banyak", "session_id": f"cr-{SFX}"}, stu_tok)
check("crisis reply is the fixed hotline text",
      s == 200 and r.get("is_high_risk") is True and "119" in r.get("response", ""), (s, r))

# ordinary distress must still reach the normal path
for msg in ("halo apa kabar", "aku capek banget sama tugas kuliah"):
    s, r = call("POST", "/guardrail/check", {"message": msg}, stu_tok)
    check(f"no false positive: {msg[:34]}", s == 200 and r.get("is_high_risk") is False, (s, r))

print("== RLS isolation between two students ==")
other_email = f"stu2{SFX}@example.com"
s, r = call("POST", "/auth/register", {"email": other_email, "password": stu_pw, "name": "Stu2"})
other_tok = r["session"]["access_token"]
s, r = call("GET", "/journal", token=other_tok)
check("student B sees zero of A's journals", s == 200 and len(r["journals"]) == 0, (s, r))
s, r = call("GET", f"/chat/history?session_id=chat-{SFX}", token=other_tok)
check("student B sees zero of A's chat messages",
      s == 200 and len(r["messages"]) == 0, (s, r))
s, r = call("GET", "/assessment/history", token=other_tok)
check("student B sees zero of A's assessments", s == 200 and len(r["assessments"]) == 0, (s, r))
s, r = call("GET", "/booking/saya", token=other_tok)
check("student B sees zero of A's bookings", s == 200 and len(r["bookings"]) == 0, (s, r))
s, r = call("GET", "/notifications", token=other_tok)
check("student B sees zero of A's notifications", s == 200 and r["notifications"] == [] and r["unread"] == 0, (s, r))

print("== cleanup ==")
TEST_USERS = "(select user_id from users where email like %s)"
PATTERN = f"%{SFX}@example.com"
# Before the users go, while the rows they made can still be traced to them:
# - triggers announce test assessments, bookings and crisis logs to admins; deleting a row
#   does not delete its notification, which was left pointing at nothing on the dashboard
# - guardrail_logs.user_id is ON DELETE SET NULL, so the logs outlived their users and
#   showed up under "Perlu Perhatian" as crisis signals from a deleted account
sql("delete from admin_notifications where entity_id in ("
    "select assessment_id from assessments where user_id in " + TEST_USERS +
    " union select guardrail_log_id from guardrail_logs where user_id in " + TEST_USERS +
    " union select counseling_booking_id from counseling_bookings where student_id in " + TEST_USERS +
    " union select counseling_request_id from counseling_requests where student_id in " + TEST_USERS +
    " union select counselor_exception_request_id from counselor_exception_requests where counselor_id in " + TEST_USERS + ")",
    (PATTERN, PATTERN, PATTERN, PATTERN, PATTERN))
# Counseling rows name their people ON DELETE RESTRICT, so they go before the users do
sql("delete from counselor_case_assignments where counselor_id in " + TEST_USERS, (PATTERN,))
sql("delete from counseling_appointments where student_id in " + TEST_USERS + " or counselor_id in " + TEST_USERS, (PATTERN, PATTERN))
sql("delete from counselor_exception_requests where counselor_id in " + TEST_USERS, (PATTERN,))
sql("delete from guardrail_logs where user_id in " + TEST_USERS, (PATTERN,))
sql("delete from counseling_bookings where student_id in " + TEST_USERS +
    " or counseling_slot_id in (select counseling_slot_id from counseling_slots where counselor_id in " + TEST_USERS + ")",
    (PATTERN, PATTERN))
# Before the users, whom it names as created_by (ON DELETE RESTRICT): a published instrument
# is immutable by trigger, which is right for real data, so the run's own variant and the
# answers given to it go with triggers paused for this one transaction (FK cascades pause
# too, hence bottom-up). SFX is hex, so inlining it is safe.
VARIANT = f"(select instrument_id from assessment_instruments where code like '%{SFX}')"
VERSIONS = f"(select instrument_version_id from assessment_instrument_versions where instrument_id in {VARIANT})"
sql("begin; set local session_replication_role = replica;"
    f" delete from assessment_category_results where instrument_version_id in {VERSIONS};"
    f" delete from assessments where instrument_version_id in {VERSIONS};"
    f" delete from assessment_answer_options where assessment_question_id in"
    f"  (select assessment_question_id from assessment_questions where instrument_version_id in {VERSIONS});"
    f" delete from assessment_questions where instrument_version_id in {VERSIONS};"
    f" delete from assessment_instrument_versions where instrument_id in {VARIANT};"
    f" delete from assessment_instruments where code like '%{SFX}'; commit;")
left = sql("select count(*) from assessment_instruments where code like %s", (f"%{SFX}",))[0][0]
check("test instrument cleaned up", left == 0, left)
sql("delete from users where email like %s", (PATTERN,))
left = sql("select count(*) from users where email like %s", (PATTERN,))[0][0]
check("test data cleaned up", left == 0, left)
# Nothing the run caused may outlive it: no ownerless crisis logs from this run's sessions,
# and no notification left pointing at a row that no longer exists.
orphans = sql(
    "select (select count(*) from guardrail_logs where user_id is null and session_id like %s)"
    " + (select count(*) from admin_notifications n where n.entity_type in ('assessment','guardrail_log','legacy_booking')"
    "    and not exists (select 1 from assessments where assessment_id = n.entity_id)"
    "    and not exists (select 1 from guardrail_logs where guardrail_log_id = n.entity_id)"
    "    and not exists (select 1 from counseling_bookings where counseling_booking_id = n.entity_id))",
    (f"%{SFX}",))[0][0]
check("no orphaned crisis logs or notifications", orphans == 0, orphans)

print()
print(f"{'ALL PASSED' if not FAILS else str(len(FAILS)) + ' FAILED: ' + ', '.join(FAILS)}")
sys.exit(1 if FAILS else 0)
