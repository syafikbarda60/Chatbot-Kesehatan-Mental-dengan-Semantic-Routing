"""B1 contracts that close approved M0-M8 backend gaps."""
from datetime import date, datetime, time, timezone
from decimal import Decimal
from typing import List, Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field, model_validator
from psycopg.errors import ForeignKeyViolation, UniqueViolation
from psycopg.types.json import Jsonb

from auth import require_role
from core.db import db, query

admin_router = APIRouter(prefix="/admin", tags=["Backend Enablement B1"])
counselor_router = APIRouter(prefix="/counselor", tags=["Counselor Instrument Review"])
admin_access = require_role("admin")
counselor_access = require_role("konselor")


class Band(BaseModel):
    label: str = Field(min_length=1, max_length=80)
    minimum: Decimal
    maximum: Optional[Decimal] = None

    @model_validator(mode="after")
    def valid_range(self):
        if self.maximum is not None and self.maximum < self.minimum:
            raise ValueError("Batas maksimum harus sama atau lebih besar dari batas minimum")
        return self


class Dimension(BaseModel):
    code: str = Field(pattern=r"^[a-z][a-z0-9_-]{0,59}$")
    name: str = Field(min_length=1, max_length=160)
    description: Optional[str] = Field(default=None, max_length=1000)
    position: int = Field(ge=1, le=100)
    multiplier: Decimal = Field(default=Decimal("1"), gt=0, le=100)
    interpretation_bands: List[Band] = Field(default_factory=list, max_length=20)


class Option(BaseModel):
    position: int = Field(ge=0, le=20)
    label: str = Field(min_length=1, max_length=500)
    score: int = Field(ge=0, le=100)


class Question(BaseModel):
    item_key: str = Field(pattern=r"^[A-Za-z0-9_-]+$", max_length=60)
    dimension_code: str = Field(pattern=r"^[a-z][a-z0-9_-]{0,59}$")
    position: int = Field(ge=1, le=100)
    wording: str = Field(min_length=1, max_length=2000)
    active: bool = True
    options: List[Option] = Field(min_length=2, max_length=10)


class Scoring(BaseModel):
    model_config = ConfigDict(extra="forbid")
    strategy: Literal["sum_by_dimension"] = "sum_by_dimension"


class InstrumentCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    code: str = Field(pattern=r"^[A-Za-z0-9_-]+$", min_length=3, max_length=40)
    name: str = Field(min_length=3, max_length=160)
    description: Optional[str] = Field(default=None, max_length=2000)
    language: str = Field(default="id", min_length=2, max_length=12)
    dimensions: List[Dimension] = Field(min_length=1, max_length=20)
    questions: List[Question] = Field(min_length=1, max_length=100)
    scoring: Scoring = Field(default_factory=Scoring)


def _validate_definition(dimensions, questions):
    codes = [d.code for d in dimensions]
    if len(codes) != len(set(codes)) or len({d.position for d in dimensions}) != len(dimensions):
        raise HTTPException(422, "Kode dan urutan dimensi harus unik")
    keys = [q.item_key.lower() for q in questions]
    if len(keys) != len(set(keys)) or len({q.position for q in questions}) != len(questions):
        raise HTTPException(422, "Kunci dan urutan pertanyaan harus unik")
    unknown = sorted({q.dimension_code for q in questions} - set(codes))
    if unknown:
        raise HTTPException(422, f"Dimensi pertanyaan tidak dikenal: {', '.join(unknown)}")
    for question in questions:
        positions = [o.position for o in question.options]
        if len(positions) != len(set(positions)):
            raise HTTPException(422, f"Urutan pilihan untuk {question.item_key} harus unik")
    for dimension in dimensions:
        bands = dimension.interpretation_bands
        for previous, current in zip(bands, bands[1:]):
            if previous.maximum is None or current.minimum <= previous.maximum:
                raise HTTPException(422, f"Ambang dimensi {dimension.code} bertumpang tindih atau tidak berurutan")


def _serialize_scoring(body: InstrumentCreate):
    return {"strategy": body.scoring.strategy, "dimensions": [{"code": d.code, "multiplier": float(d.multiplier), "interpretation_bands": [b.model_dump(mode="json") for b in d.interpretation_bands]} for d in body.dimensions]}


@admin_router.post("/assessment-instruments", status_code=201)
def create_custom_instrument(body: InstrumentCreate, admin=Depends(admin_access)):
    _validate_definition(body.dimensions, body.questions)
    try:
        with db(admin.id) as conn:
            instrument = conn.execute(
                "insert into assessment_instruments(code,name,description,language,instrument_kind,norms_enabled,provenance,created_by,updated_by) values(%s,%s,%s,%s,'custom',false,%s,%s,%s) returning instrument_id",
                (body.code, body.name.strip(), body.description, body.language, Jsonb({"creation": "from_scratch"}), admin.id, admin.id),
            ).fetchone()
            version = conn.execute(
                "insert into assessment_instrument_versions(instrument_id,version_number,status,expected_question_count,authoritative_config,scoring_config,created_by,updated_by) values(%s,1,'draft',%s,false,%s,%s,%s) returning instrument_version_id,definition_revision",
                (instrument["instrument_id"], len([q for q in body.questions if q.active]), Jsonb(_serialize_scoring(body)), admin.id, admin.id),
            ).fetchone()
            dimension_ids = {}
            for item in sorted(body.dimensions, key=lambda d: d.position):
                row = conn.execute("insert into assessment_dimensions(instrument_version_id,code,name,description,position,multiplier,interpretation_bands) values(%s,%s,%s,%s,%s,%s,%s) returning assessment_dimension_id", (version["instrument_version_id"], item.code, item.name.strip(), item.description, item.position, item.multiplier, Jsonb([b.model_dump(mode="json") for b in item.interpretation_bands]))).fetchone()
                dimension_ids[item.code] = row["assessment_dimension_id"]
            for item in sorted(body.questions, key=lambda q: q.position):
                row = conn.execute("insert into assessment_questions(instrument_version_id,item_key,category,assessment_dimension_id,position,wording,active) values(%s,%s,%s,%s,%s,%s,%s) returning assessment_question_id", (version["instrument_version_id"], item.item_key, item.dimension_code, dimension_ids[item.dimension_code], item.position, item.wording.strip(), item.active)).fetchone()
                for option in sorted(item.options, key=lambda o: o.position):
                    conn.execute("insert into assessment_answer_options(assessment_question_id,position,label,score) values(%s,%s,%s,%s)", (row["assessment_question_id"], option.position, option.label.strip(), option.score))
        return {"instrument_id": instrument["instrument_id"], "instrument_version_id": version["instrument_version_id"], "definition_revision": version["definition_revision"], "status": "draft"}
    except UniqueViolation:
        raise HTTPException(409, "Kode instrumen sudah digunakan")


@admin_router.post("/assessment-instruments/versions/{version_id}/submit-review", status_code=201)
def submit_review(version_id: UUID, expected_revision: int = Query(ge=1), admin=Depends(admin_access)):
    with db(admin.id) as conn:
        version = conn.execute("select v.definition_revision,v.status,i.instrument_kind from assessment_instrument_versions v join assessment_instruments i on i.instrument_id=v.instrument_id where v.instrument_version_id=%s for update", (str(version_id),)).fetchone()
        if not version:
            raise HTTPException(404, "Versi instrumen tidak ditemukan")
        if version["status"] != "draft" or version["instrument_kind"] != "custom":
            raise HTTPException(409, "Hanya draft instrumen kustom yang dapat diajukan")
        if version["definition_revision"] != expected_revision:
            raise HTTPException(409, "Draft telah berubah; muat ulang sebelum mengajukan validasi")
        existing = conn.execute("select assessment_version_review_id from assessment_version_reviews where instrument_version_id=%s and status='pending'", (str(version_id),)).fetchone()
        if existing:
            raise HTTPException(409, "Versi ini sedang menunggu validasi konselor")
        review = conn.execute("insert into assessment_version_reviews(instrument_version_id,definition_revision,status,submitted_by) values(%s,%s,'pending',%s) returning assessment_version_review_id,instrument_version_id,definition_revision,status,submitted_at", (str(version_id), expected_revision, admin.id)).fetchone()
    return {"review": review}


def _review_detail(assessment_version_review_id: str, user_id: str):
    reviews = query("select r.*,i.code,i.name,v.version_number,v.status version_status,v.definition_revision current_revision from assessment_version_reviews r join assessment_instrument_versions v on v.instrument_version_id=r.instrument_version_id join assessment_instruments i on i.instrument_id=v.instrument_id where r.assessment_version_review_id=%s", (assessment_version_review_id,), user_id=user_id)
    if not reviews:
        raise HTTPException(404, "Review instrumen tidak ditemukan")
    comments = query("select c.review_comment_id,c.assessment_question_id,c.author_user_id,u.name author_name,c.comment_text,c.created_at from assessment_review_comments c join users u on u.user_id=c.author_user_id where c.assessment_version_review_id=%s order by c.created_at", (assessment_version_review_id,), user_id=user_id)
    version_id = str(reviews[0]["instrument_version_id"])
    dimensions = query("select assessment_dimension_id,code,name,description,position,multiplier,interpretation_bands from assessment_dimensions where instrument_version_id=%s order by position", (version_id,), user_id=user_id)
    questions = query("select q.assessment_question_id,q.item_key,q.category,q.assessment_dimension_id,q.position,q.wording,q.active,coalesce(jsonb_agg(jsonb_build_object('assessment_answer_option_id',o.assessment_answer_option_id,'position',o.position,'label',o.label,'score',o.score) order by o.position) filter(where o.assessment_answer_option_id is not null),'[]'::jsonb) options from assessment_questions q left join assessment_answer_options o on o.assessment_question_id=q.assessment_question_id where q.instrument_version_id=%s group by q.assessment_question_id order by q.position", (version_id,), user_id=user_id)
    return {"review": reviews[0], "dimensions": dimensions, "questions": questions, "comments": comments}


@counselor_router.get("/instrument-reviews")
def review_queue(status: Optional[Literal["pending","revision_requested","approved"]] = None, counselor=Depends(counselor_access)):
    # Reviewer names through list_konselor(): users RLS hides other counselors' rows
    rows = query("select r.assessment_version_review_id,r.instrument_version_id,r.definition_revision,r.status,r.submitted_at,r.reviewer_user_id,k.name reviewer_name,i.code,i.name,i.instrument_kind,v.version_number,v.definition_revision current_revision from assessment_version_reviews r join assessment_instrument_versions v on v.instrument_version_id=r.instrument_version_id join assessment_instruments i on i.instrument_id=v.instrument_id left join list_konselor() k on k.user_id=r.reviewer_user_id where (%s::text is null or r.status=%s) order by case when r.status='pending' then 0 else 1 end,r.submitted_at", (status, status), user_id=counselor.id)
    return {"reviews": rows, "total": len(rows)}


@counselor_router.get("/instrument-reviews/{assessment_version_review_id}")
def review_detail(assessment_version_review_id: UUID, counselor=Depends(counselor_access)):
    return _review_detail(str(assessment_version_review_id), counselor.id)


class ReviewComment(BaseModel):
    assessment_question_id: Optional[UUID] = None
    comment: str = Field(min_length=1, max_length=4000)


@counselor_router.post("/instrument-reviews/{assessment_version_review_id}/comments", status_code=201)
def add_review_comment(assessment_version_review_id: UUID, body: ReviewComment, counselor=Depends(counselor_access)):
    with db(counselor.id) as conn:
        review = conn.execute("select instrument_version_id,status from assessment_version_reviews where assessment_version_review_id=%s", (str(assessment_version_review_id),)).fetchone()
        if not review:
            raise HTTPException(404, "Review instrumen tidak ditemukan")
        if review["status"] != "pending":
            raise HTTPException(409, "Komentar hanya dapat ditambahkan pada review yang masih menunggu")
        if body.assessment_question_id and not conn.execute("select 1 from assessment_questions where assessment_question_id=%s and instrument_version_id=%s", (str(body.assessment_question_id), review["instrument_version_id"])).fetchone():
            raise HTTPException(422, "Pertanyaan tidak termasuk dalam versi yang direview")
        row = conn.execute("insert into assessment_review_comments(assessment_version_review_id,assessment_question_id,author_user_id,comment_text) values(%s,%s,%s,%s) returning review_comment_id,assessment_version_review_id,assessment_question_id,comment_text,created_at", (str(assessment_version_review_id), str(body.assessment_question_id) if body.assessment_question_id else None, counselor.id, body.comment.strip())).fetchone()
    return {"comment": row}


class Decision(BaseModel):
    expected_revision: int = Field(ge=1)
    comment: Optional[str] = Field(default=None, max_length=4000)


def _decide(assessment_version_review_id, body, counselor, decision):
    if decision == "revision_requested" and not body.comment:
        raise HTTPException(422, "Alasan revisi wajib diisi")
    with db(counselor.id) as conn:
        review = conn.execute("select r.status,r.definition_revision,v.definition_revision current_revision from assessment_version_reviews r join assessment_instrument_versions v on v.instrument_version_id=r.instrument_version_id where r.assessment_version_review_id=%s for update of r", (str(assessment_version_review_id),)).fetchone()
        if not review:
            raise HTTPException(404, "Review instrumen tidak ditemukan")
        if review["status"] != "pending":
            raise HTTPException(409, "Review ini sudah diputuskan")
        if review["definition_revision"] != body.expected_revision or review["current_revision"] != body.expected_revision:
            raise HTTPException(409, "Definisi instrumen telah berubah; keputusan tidak dapat diterapkan")
        row = conn.execute("update assessment_version_reviews set status=%s,reviewer_user_id=%s,decided_at=now(),decision_comment=%s,updated_at=now() where assessment_version_review_id=%s returning *", (decision, counselor.id, body.comment, str(assessment_version_review_id))).fetchone()
        if decision == "approved":
            # For the standard DASS-21 the approval is the publication (migration 012); the
            # function does nothing for custom instruments, which keep the admin publish step.
            conn.execute("select publish_approved_dass21_version(%s)", (str(row["instrument_version_id"]),))
    return {"review": row}


@counselor_router.post("/instrument-reviews/{assessment_version_review_id}/request-revision")
def request_revision(assessment_version_review_id: UUID, body: Decision, counselor=Depends(counselor_access)):
    return _decide(assessment_version_review_id, body, counselor, "revision_requested")


@counselor_router.post("/instrument-reviews/{assessment_version_review_id}/approve")
def approve(assessment_version_review_id: UUID, body: Decision, counselor=Depends(counselor_access)):
    return _decide(assessment_version_review_id, body, counselor, "approved")


SupportState = Literal["none","present","unknown","prefer_not_to_say"]
class StudentProfileUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    nim: Optional[str] = Field(default=None, max_length=30)
    faculty_id: Optional[UUID] = None
    academic_unit_id: Optional[UUID] = None
    mental_health_condition_state: SupportState = "unknown"
    disability_state: SupportState = "unknown"
    condition_details: Optional[str] = Field(default=None, max_length=1000)
    disability_details: Optional[str] = Field(default=None, max_length=1000)


@admin_router.put("/students/{student_id}/profile")
def update_student_profile(student_id: UUID, body: StudentProfileUpdate, admin=Depends(admin_access)):
    if body.academic_unit_id and not body.faculty_id:
        raise HTTPException(422, "Fakultas wajib dipilih bersama unit akademik")
    if body.mental_health_condition_state != "present" and body.condition_details:
        raise HTTPException(422, "Detail kondisi hanya boleh diisi bila status present")
    if body.disability_state != "present" and body.disability_details:
        raise HTTPException(422, "Detail disabilitas hanya boleh diisi bila status present")
    try:
        with db(admin.id) as conn:
            user = conn.execute("update users set name=%s,nim=%s where user_id=%s and role='mahasiswa' returning user_id,name,nim,email", (body.name.strip(), body.nim, str(student_id))).fetchone()
            if not user:
                raise HTTPException(404, "Mahasiswa tidak ditemukan")
            academic = conn.execute("insert into student_academic_profiles(user_id,faculty_id,academic_unit_id) values(%s,%s,%s) on conflict(user_id) do update set faculty_id=excluded.faculty_id,academic_unit_id=excluded.academic_unit_id,updated_at=now() returning *", (str(student_id), str(body.faculty_id) if body.faculty_id else None, str(body.academic_unit_id) if body.academic_unit_id else None)).fetchone()
            support = conn.execute("insert into student_support_profiles(user_id,mental_health_condition_state,disability_state,condition_details,disability_details,updated_by) values(%s,%s,%s,%s,%s,%s) on conflict(user_id) do update set mental_health_condition_state=excluded.mental_health_condition_state,disability_state=excluded.disability_state,condition_details=excluded.condition_details,disability_details=excluded.disability_details,updated_by=excluded.updated_by,updated_at=now() returning *", (str(student_id), body.mental_health_condition_state, body.disability_state, body.condition_details, body.disability_details, admin.id)).fetchone()
        return {"student": user, "academic_profile": academic, "support_profile": support}
    except ForeignKeyViolation:
        raise HTTPException(422, "Fakultas atau unit akademik tidak valid")


class ResourceBody(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    resource_type: Literal["physical","virtual"]
    capacity: int = Field(default=1, ge=1, le=100)
    location_or_url: Optional[str] = Field(default=None, max_length=500)
    active: bool = True


@admin_router.get("/counseling/resources")
def resources(admin=Depends(admin_access)):
    rows = query("select counseling_resource_id,name,resource_type,capacity,location_or_url,active,created_at,updated_at from counseling_resources order by name", user_id=admin.id)
    return {"resources": rows, "total": len(rows)}


@admin_router.post("/counseling/resources", status_code=201)
def create_resource(body: ResourceBody, admin=Depends(admin_access)):
    try:
        row = query("insert into counseling_resources(name,resource_type,capacity,location_or_url,active,created_by) values(%s,%s,%s,%s,%s,%s) returning *", (body.name.strip(), body.resource_type, body.capacity, body.location_or_url, body.active, admin.id), user_id=admin.id)[0]
        return {"resource": row}
    except UniqueViolation:
        raise HTTPException(409, "Nama resource sudah digunakan")


class ResourceBlock(BaseModel):
    starts_at: datetime
    ends_at: datetime
    reason: Optional[str] = Field(default=None, max_length=250)


def _utc(value):
    if value.tzinfo is None:
        raise HTTPException(422, "Tanggal dan waktu harus menyertakan zona waktu")
    return value.astimezone(timezone.utc)


@admin_router.post("/counseling/resources/{counseling_resource_id}/blocks", status_code=201)
def block_resource(counseling_resource_id: UUID, body: ResourceBlock, admin=Depends(admin_access)):
    start, end = _utc(body.starts_at), _utc(body.ends_at)
    if end <= start:
        raise HTTPException(422, "Waktu selesai harus setelah waktu mulai")
    with db(admin.id) as conn:
        conn.execute("select pg_advisory_xact_lock(hashtext(%s))", ("resource:" + str(counseling_resource_id),))
        if not conn.execute("select 1 from counseling_resources where counseling_resource_id=%s and active", (str(counseling_resource_id),)).fetchone():
            raise HTTPException(404, "Resource aktif tidak ditemukan")
        if conn.execute("select 1 from counseling_appointments where counseling_resource_id=%s and status in ('confirmed','rescheduled') and tstzrange(starts_at,ends_at,'[)') && tstzrange(%s,%s,'[)') limit 1", (str(counseling_resource_id), start, end)).fetchone():
            raise HTTPException(409, "Resource sedang digunakan pada rentang tersebut")
        row = conn.execute("insert into counseling_resource_blocks(counseling_resource_id,starts_at,ends_at,reason,created_by) values(%s,%s,%s,%s,%s) returning *", (str(counseling_resource_id), start, end, body.reason, admin.id)).fetchone()
    return {"block": row}


class AvailabilityWindow(BaseModel):
    day_of_week: int = Field(ge=0, le=6)
    start_time: time
    end_time: time
    timezone: str = Field(default="Asia/Jakarta", max_length=50)
    effective_from: Optional[date] = None
    effective_to: Optional[date] = None


class ReplaceAvailability(BaseModel):
    windows: List[AvailabilityWindow] = Field(default_factory=list, max_length=40)


@admin_router.put("/counseling/counselors/{counselor_id}/availability")
def replace_availability(counselor_id: UUID, body: ReplaceAvailability, admin=Depends(admin_access)):
    for item in body.windows:
        if item.end_time <= item.start_time or (item.effective_from and item.effective_to and item.effective_to < item.effective_from):
            raise HTTPException(422, "Rentang ketersediaan tidak valid")
    with db(admin.id) as conn:
        counselor = conn.execute("select user_id from users where user_id=%s and role='konselor' for update", (str(counselor_id),)).fetchone()
        if not counselor:
            raise HTTPException(404, "Konselor tidak ditemukan")
        conn.execute("update counselor_availability_rules set active=false where counselor_id=%s and active", (str(counselor_id),))
        rows = []
        for item in body.windows:
            rows.append(conn.execute("insert into counselor_availability_rules(counselor_id,day_of_week,start_time,end_time,timezone,effective_from,effective_to,active) values(%s,%s,%s,%s,%s,%s,%s,true) returning *", (str(counselor_id), item.day_of_week, item.start_time, item.end_time, item.timezone, item.effective_from, item.effective_to)).fetchone())
    return {"availability": rows, "total": len(rows)}
