from fastapi import APIRouter, Depends, HTTPException
from supabase import create_client
from auth import require_role
from dotenv import load_dotenv
from datetime import datetime, timedelta
import os

load_dotenv()

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_ANON_KEY"))


# ── CB-10: getDashboardData ───────────────────────────────────────────────────

@router.get("/data")
def get_dashboard_data(operator=Depends(require_role("konselor", "admin", "pemangku_jabatan"))):
    """
    CB-10 — Query agregasi data hasil asesmen mahasiswa untuk ditampilkan
    pada dashboard pemantauan Operator/Konselor.
    """
    try:
        # Total asesmen & distribusi severity (sesuai ERD: severity bukan risk_level)
        all_assessments = supabase.table("assessments").select(
            "assessment_id, user_id, score, severity, taken_at"
        ).execute()

        assessments = all_assessments.data or []
        total = len(assessments)

        distribution = {"minimal": 0, "mild": 0, "moderate": 0, "severe": 0}
        for a in assessments:
            sev = a.get("severity", "minimal")
            if sev in distribution:
                distribution[sev] += 1

        # Trend 7 hari terakhir
        seven_days_ago = (datetime.utcnow() - timedelta(days=7)).isoformat()
        recent = supabase.table("assessments").select(
            "taken_at, severity"
        ).gte("taken_at", seven_days_ago).execute()

        trend: dict = {}
        for row in (recent.data or []):
            day = row["taken_at"][:10]  # YYYY-MM-DD
            trend[day] = trend.get(day, 0) + 1

        # Severe terbaru (max 10) — sesuai ERD: severity bukan risk_level
        severe_recent = supabase.table("assessments").select(
            "assessment_id, user_id, score, taken_at"
        ).eq("severity", "severe").order("taken_at", desc=True).limit(10).execute()

        # Guardrail logs count
        guardrail_result = supabase.table("guardrail_logs").select(
            "log_id", count="exact"
        ).execute()
        guardrail_count = guardrail_result.count or 0

        # Booking konsultasi pending
        pending_bookings = supabase.table("booking_konsultasi").select(
            "booking_id, user_id, created_at"
        ).eq("status", "menunggu").order("created_at", desc=True).limit(10).execute()

        return {
            "total_assessments": total,
            "severity_distribution": distribution,
            "weekly_trend": [
                {"date": k, "count": v}
                for k, v in sorted(trend.items())
            ],
            "recent_severe": severe_recent.data or [],
            "guardrail_trigger_count": guardrail_count,
            "pending_bookings": pending_bookings.data or [],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal mengambil data dashboard: {e}")
