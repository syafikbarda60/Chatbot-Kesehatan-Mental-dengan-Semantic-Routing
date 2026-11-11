"""Admin DASS-21 editor: one current batch whose status and version the server decides.

A batch is a version of the standard DASS-21 seen through its latest counselor review
(core/dass21_batch.py). Saving a published version opens the next one; a counselor's
approval publishes it through publish_approved_dass21_version() (migration 012), called
from the existing review route in routes/backend_enablement.py.
"""
from datetime import datetime
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from auth import require_role
from core.db import db
from core.dass21 import validate_dass21_definition
from core.dass21_batch import TEXT_MAX, batch_status, validate_dass21_questions

admin_router = APIRouter(prefix="/admin/dass21", tags=["DASS-21 Batch"])
admin_access = require_role("admin")
STALE = "Data sudah diubah oleh pengguna lain, muat ulang halaman."


class BatchQuestion(BaseModel):
    orderNumber: int = Field(ge=1, le=21)
    text: str = Field(max_length=TEXT_MAX)
    # Checked, never written: the category of each number is fixed by the DASS-21 blueprint
    # that scoring depends on (core/dass21.py).
    category: Literal["DEPRESSION", "ANXIETY", "STRESS"]


class DraftSave(BaseModel):
    # Unknown fields (id, status, version) are dropped: the server owns them.
    questions: List[BatchQuestion] = Field(min_length=21, max_length=21)
    updatedAt: Optional[datetime] = None


def _instrument_id(conn, lock: bool = False) -> str:
    # The row lock serialises every batch write, so two admins cannot open two drafts at once;
    # uq_one_draft_instrument_version (migration 012) holds the same rule in the schema.
    row = conn.execute(
        "select instrument_id from assessment_instruments where lower(code)='dass-21' and instrument_kind='standard'"
        + (" for update" if lock else ""),
    ).fetchone()
    if not row:
        raise HTTPException(404, "Instrumen DASS-21 belum tersedia")
    return str(row["instrument_id"])


def _current(conn, instrument_id: str):
    """The open draft if there is one, else the published version."""
    version = conn.execute(
        "select instrument_version_id,version_number,status,definition_revision,updated_at "
        "from assessment_instrument_versions where instrument_id=%s and status in ('draft','published') "
        "order by status='draft' desc,version_number desc limit 1",
        (instrument_id,),
    ).fetchone()
    if not version:
        raise HTTPException(404, "Belum ada versi DASS-21")
    review = conn.execute(
        "select status,definition_revision,decision_comment from assessment_version_reviews "
        "where instrument_version_id=%s order by submitted_at desc limit 1",
        (str(version["instrument_version_id"]),),
    ).fetchone()
    return version, review, batch_status(version["status"], version["definition_revision"], review)


def _questions(conn, version_id: str):
    return conn.execute(
        "select q.assessment_question_id,q.position,q.wording,q.category,"
        "array_remove(array_agg(o.score order by o.score),null) option_scores from assessment_questions q "
        "left join assessment_answer_options o on o.assessment_question_id=q.assessment_question_id "
        "where q.instrument_version_id=%s and q.active group by q.assessment_question_id order by q.position",
        (version_id,),
    ).fetchall()


def _published_id(conn, instrument_id: str) -> Optional[str]:
    row = conn.execute(
        "select instrument_version_id from assessment_instrument_versions where instrument_id=%s and status='published'",
        (instrument_id,),
    ).fetchone()
    return str(row["instrument_version_id"]) if row else None


def _fill_empty_draft(conn, instrument_id: str, version_id: str) -> None:
    """A draft opened by the generic POST .../drafts route starts empty: copy the published items in."""
    if _questions(conn, version_id):
        return
    published = _published_id(conn, instrument_id)
    if not published:
        raise HTTPException(409, "Belum ada versi DASS-21 terbit untuk disalin")
    # That route also leaves the scoring configuration empty; without it the published version
    # is invisible to students and cannot be scored.
    conn.execute(
        "update assessment_instrument_versions v set expected_question_count=p.expected_question_count,"
        "authoritative_config=p.authoritative_config,scoring_config=p.scoring_config "
        "from assessment_instrument_versions p where p.instrument_version_id=%s and v.instrument_version_id=%s",
        (published, version_id),
    )
    _copy_definition(conn, published, version_id)


def _batch(conn, instrument_id: str) -> dict:
    version, review, status = _current(conn, instrument_id)
    version_id = str(version["instrument_version_id"])
    rows = _questions(conn, version_id)
    if not rows and status == "DRAFT":
        # Read-only view of an empty draft: the items it will receive on its first save/submit.
        rows = _questions(conn, _published_id(conn, instrument_id) or version_id)
    return {
        "id": version_id,
        "version": version["version_number"],
        "status": status,
        "questions": [
            {"id": str(q["assessment_question_id"]), "orderNumber": q["position"], "text": q["wording"],
             "category": q["category"].upper()}
            for q in rows
        ],
        "reviewNote": review["decision_comment"] if status == "REJECTED" else None,
        "updatedAt": version["updated_at"],
    }


def _copy_definition(conn, source_id: str, target_id: str) -> None:
    """Dimensions, questions and answer options of one version into an empty draft."""
    conn.execute(
        "insert into assessment_dimensions(instrument_version_id,code,name,description,position,multiplier,interpretation_bands) "
        "select %s,code,name,description,position,multiplier,interpretation_bands from assessment_dimensions where instrument_version_id=%s",
        (target_id, source_id),
    )
    conn.execute(
        "insert into assessment_questions(instrument_version_id,item_key,category,assessment_dimension_id,position,wording,active) "
        "select %s,q.item_key,q.category,(select d.assessment_dimension_id from assessment_dimensions d "
        "where d.instrument_version_id=%s and d.code=q.category),q.position,q.wording,q.active "
        "from assessment_questions q where q.instrument_version_id=%s",
        (target_id, target_id, source_id),
    )
    conn.execute(
        "insert into assessment_answer_options(assessment_question_id,position,label,score) "
        "select nq.assessment_question_id,o.position,o.label,o.score from assessment_answer_options o "
        "join assessment_questions oq on oq.assessment_question_id=o.assessment_question_id "
        "join assessment_questions nq on nq.instrument_version_id=%s and nq.position=oq.position "
        "where oq.instrument_version_id=%s",
        (target_id, source_id),
    )


@admin_router.get("/batch/current")
def current_batch(admin=Depends(admin_access)):
    with db(admin.id) as conn:
        return _batch(conn, _instrument_id(conn))


@admin_router.put("/batch/draft")
def save_draft(body: DraftSave, admin=Depends(admin_access)):
    """DRAFT/REJECTED: update in place (a new revision clears the rejection).
    APPROVED: open version+1 as a copy, leaving the published one untouched.
    PENDING_VALIDATION: refused."""
    if len({q.orderNumber for q in body.questions}) != 21:
        raise HTTPException(422, "Nomor soal harus 1–21 tanpa duplikat")
    # ponytail: assessment_questions.wording has a not-blank check, so a draft cannot hold an
    # empty item; relaxing that constraint is not an additive change.
    blank = sorted(q.orderNumber for q in body.questions if not q.text.strip())
    if blank:
        raise HTTPException(422, f"Soal {blank[0]} belum diisi")
    with db(admin.id) as conn:
        instrument_id = _instrument_id(conn, lock=True)
        version, _, status = _current(conn, instrument_id)
        if body.updatedAt is not None and body.updatedAt != version["updated_at"]:
            raise HTTPException(409, STALE)
        if status == "PENDING_VALIDATION":
            raise HTTPException(409, "Batch sedang menunggu validasi konselor dan tidak dapat diubah")
        version_id = str(version["instrument_version_id"])
        if status == "APPROVED":
            source_id = version_id
            version_id = str(conn.execute(
                "insert into assessment_instrument_versions(instrument_id,version_number,status,expected_question_count,"
                "authoritative_config,scoring_config,created_by,updated_by) "
                "select instrument_id,(select max(version_number)+1 from assessment_instrument_versions where instrument_id=%s),"
                "'draft',expected_question_count,authoritative_config,scoring_config,%s,%s "
                "from assessment_instrument_versions where instrument_version_id=%s returning instrument_version_id",
                (instrument_id, admin.id, admin.id, source_id),
            ).fetchone()["instrument_version_id"])
            _copy_definition(conn, source_id, version_id)
        else:
            _fill_empty_draft(conn, instrument_id, version_id)
        for question in body.questions:
            conn.execute(
                "update assessment_questions set wording=%s,updated_at=now() where instrument_version_id=%s and position=%s",
                (question.text.strip(), version_id, question.orderNumber),
            )
        conn.execute(
            "update assessment_instrument_versions set definition_revision=definition_revision+1,updated_by=%s,updated_at=now() "
            "where instrument_version_id=%s",
            (admin.id, version_id),
        )
        return _batch(conn, instrument_id)


@admin_router.post("/batch/{batch_id}/submit")
def submit_for_validation(batch_id: str, admin=Depends(admin_access)):
    """DRAFT -> PENDING_VALIDATION once the 21 items pass validation."""
    with db(admin.id) as conn:
        instrument_id = _instrument_id(conn, lock=True)
        version, _, status = _current(conn, instrument_id)
        if str(version["instrument_version_id"]) != batch_id:
            raise HTTPException(409, STALE)
        if status == "PENDING_VALIDATION":
            raise HTTPException(409, "Batch sudah menunggu validasi konselor")
        if status != "DRAFT":
            raise HTTPException(409, "Hanya draf yang dapat diajukan untuk validasi")
        _fill_empty_draft(conn, instrument_id, batch_id)
        rows = _questions(conn, batch_id)
        errors = validate_dass21_questions(
            {"position": q["position"], "text": q["wording"], "category": q["category"]} for q in rows
        )
        errors += [issue for issue in validate_dass21_definition(rows) if issue not in errors]
        if errors:
            raise HTTPException(422, {"message": "Draf belum dapat diajukan", "errors": errors})
        conn.execute(
            "insert into assessment_version_reviews(instrument_version_id,definition_revision,status,submitted_by) "
            "values(%s,%s,'pending',%s)",
            (batch_id, version["definition_revision"], admin.id),
        )
        return _batch(conn, instrument_id)
