from fastapi import APIRouter, Depends, HTTPException

from auth import require_role
from core.db import query

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/data")
def get_dashboard_data(operator=Depends(require_role("konselor", "admin", "pemangku_jabatan"))):
    try:
        uid = operator.id

        distribution = {"minimal": 0, "mild": 0, "moderate": 0, "severe": 0}
        for row in query("select severity, count(*) as c from assessments group by severity", user_id=uid):
            if row["severity"] in distribution:
                distribution[row["severity"]] = row["c"]
        total = sum(distribution.values())

        weekly = query(
            "select taken_at::date as date, count(*) as count from assessments "
            "where taken_at >= now() - interval '7 days' group by 1 order by 1",
            user_id=uid,
        )

        recent_severe = query(
            "select assessment_id, user_id, score, taken_at from assessments "
            "where severity = 'severe' order by taken_at desc limit 10",
            user_id=uid,
        )

        guardrail_count = query("select count(*) as c from guardrail_logs", user_id=uid)[0]["c"]

        pending_bookings = query(
            "select booking_id, user_id, created_at from booking_konsultasi "
            "where status = 'menunggu' order by created_at desc limit 10",
            user_id=uid,
        )

        return {
            "total_assessments": total,
            "severity_distribution": distribution,
            "weekly_trend": [{"date": r["date"], "count": r["count"]} for r in weekly],
            "recent_severe": recent_severe,
            "guardrail_trigger_count": guardrail_count,
            "pending_bookings": pending_bookings,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal mengambil data dashboard: {e}")
