"""Iteration 4 additive admin APIs for comparison, scheduling, and versioned instruments."""
from datetime import date
from typing import List, Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field
from psycopg.errors import UniqueViolation
from psycopg.types.json import Jsonb

from auth import get_current_user, require_role
from core.db import db, query
from core.dass21 import CATEGORY_ITEMS, normalize_subscales, score_dass21, validate_dass21_definition

admin_router = APIRouter(prefix="/admin", tags=["Admin Iteration 4"])
assessment_router = APIRouter(prefix="/assessment", tags=["Assessment Instruments"])
admin_access = require_role("admin")
student_access = require_role("mahasiswa")


class AnswerOptionDraft(BaseModel):
    position: int = Field(ge=0, le=20)
    label: str = Field(min_length=1, max_length=500)
    score: int = Field(ge=0, le=100)


class QuestionDraft(BaseModel):
    item_key: str = Field(min_length=1, max_length=60, pattern=r"^[A-Za-z0-9_-]+$")
    category: str = Field(min_length=1, max_length=60, pattern=r"^[a-z][a-z0-9_-]*$")
    position: int = Field(ge=1, le=100)
    wording: str = Field(min_length=1, max_length=2000)
    active: bool = True
    options: List[AnswerOptionDraft] = Field(default_factory=list, max_length=10)


class DraftDefinition(BaseModel):
    questions: List[QuestionDraft] = Field(default_factory=list, max_length=100)
    expected_revision: Optional[int] = Field(default=None, ge=1)


class DerivedInstrumentRequest(BaseModel):
    name: str = Field(min_length=3, max_length=160)
    code: str = Field(min_length=3, max_length=40, pattern=r"^[A-Za-z0-9_-]+$")
    description: Optional[str] = Field(default=None, max_length=2000)


class Dass21VariantRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=3, max_length=160)
    code: str = Field(min_length=3, max_length=40, pattern=r"^[A-Za-z0-9_-]+$")
    description: Optional[str] = Field(default=None, max_length=2000)
    subscales: List[Literal["depression", "anxiety", "stress"]] = Field(min_length=1, max_length=3)


class InstrumentAnswer(BaseModel):
    model_config = ConfigDict(extra="forbid")
    question_id: UUID
    option_id: UUID


class InstrumentSubmission(BaseModel):
    model_config = ConfigDict(extra="forbid")
    instrument_version_id: UUID
    answers: List[InstrumentAnswer] = Field(min_length=1, max_length=100)


def _ids(values: List[UUID], maximum: int = 20) -> List[str]:
    if len(values) > maximum:
        raise HTTPException(422, f"Maksimal {maximum} pilihan dapat dibandingkan")
    return [str(value) for value in dict.fromkeys(values)]


def _version_detail(version_id: str, admin_id: str):
    versions = query(
        "select v.instrument_version_id,v.instrument_id,i.code,i.name,i.language,i.instrument_kind,i.norms_enabled,i.provenance,"
        "i.derived_from_instrument_id,v.version_number,v.status,"
        "v.expected_question_count,v.authoritative_config,v.scoring_config,v.definition_revision,v.created_at,v.updated_at,"
        "v.published_at,cu.name created_by_name,uu.name updated_by_name,pu.name published_by_name "
        "from assessment_instrument_versions v join assessment_instruments i on i.instrument_id=v.instrument_id "
        "left join users cu on cu.user_id=v.created_by left join users uu on uu.user_id=v.updated_by "
        "left join users pu on pu.user_id=v.published_by where v.instrument_version_id=%s",
        (version_id,), user_id=admin_id,
    )
    if not versions:
        raise HTTPException(404, "Versi instrumen tidak ditemukan")
    questions = query(
        "select q.assessment_question_id,q.item_key,q.category,q.position,q.wording,q.active,"
        "coalesce(jsonb_agg(jsonb_build_object('assessment_answer_option_id',o.assessment_answer_option_id,"
        "'position',o.position,'label',o.label,'score',o.score) order by o.position) "
        "filter(where o.assessment_answer_option_id is not null),'[]'::jsonb) options "
        "from assessment_questions q left join assessment_answer_options o on o.assessment_question_id=q.assessment_question_id "
        "where q.instrument_version_id=%s group by q.assessment_question_id order by q.position",
        (version_id,), user_id=admin_id,
    )
    dimensions = query(
        "select assessment_dimension_id,code,name,description,position,multiplier,interpretation_bands "
        "from assessment_dimensions where instrument_version_id=%s order by position",
        (version_id,), user_id=admin_id,
    )
    reviews = query(
        "select assessment_version_review_id,definition_revision,status,submitted_at,reviewer_user_id,decided_at,decision_comment "
        "from assessment_version_reviews where instrument_version_id=%s order by submitted_at desc",
        (version_id,), user_id=admin_id,
    )
    return {"version": versions[0], "questions": questions, "dimensions": dimensions, "reviews": reviews}


@admin_router.get("/assessment-instruments")
def list_instruments(admin=Depends(admin_access)):
    rows = query(
        "select i.instrument_id,i.code,i.name,i.description,i.active,i.language,i.instrument_kind,"
        "i.derived_from_instrument_id,i.norms_enabled,i.provenance,i.shown_in_app,i.dass21_subscales,"
        "coalesce(jsonb_agg(jsonb_build_object('instrument_version_id',v.instrument_version_id,"
        "'version_number',v.version_number,'status',v.status,'authoritative_config',v.authoritative_config,"
        "'updated_at',v.updated_at,'published_at',v.published_at) order by v.version_number desc) "
        "filter(where v.instrument_version_id is not null),'[]'::jsonb) versions "
        "from assessment_instruments i left join assessment_instrument_versions v on v.instrument_id=i.instrument_id "
        "group by i.instrument_id order by i.name",
        user_id=admin.id,
    )
    return {"instruments": rows, "total": len(rows)}


@admin_router.get("/assessment-instruments/versions/{version_id}")
def get_instrument_version(version_id: UUID, admin=Depends(admin_access)):
    return _version_detail(str(version_id), admin.id)


@admin_router.post("/assessment-instruments/{instrument_id}/drafts", status_code=201)
def create_instrument_draft(instrument_id: UUID, admin=Depends(admin_access)):
    with db(admin.id) as conn:
        instrument = conn.execute(
            "select instrument_id from assessment_instruments where instrument_id=%s for update",
            (str(instrument_id),),
        ).fetchone()
        if not instrument:
            raise HTTPException(404, "Instrumen tidak ditemukan")
        existing = conn.execute(
            "select instrument_version_id from assessment_instrument_versions where instrument_id=%s and status='draft'",
            (str(instrument_id),),
        ).fetchone()
        if existing:
            return _version_detail(str(existing["instrument_version_id"]), admin.id)
        row = conn.execute(
            "insert into assessment_instrument_versions(instrument_id,version_number,status,created_by,updated_by) "
            "select %s,coalesce(max(version_number),0)+1,'draft',%s,%s from assessment_instrument_versions where instrument_id=%s "
            "returning instrument_version_id",
            (str(instrument_id), admin.id, admin.id, str(instrument_id)),
        ).fetchone()
    return _version_detail(str(row["instrument_version_id"]), admin.id)


@admin_router.post("/assessment-instruments/{instrument_id}/derived", status_code=201)
def create_derived_instrument(instrument_id: UUID, body: DerivedInstrumentRequest, admin=Depends(admin_access)):
    """Create an editable custom instrument without inheriting standard DASS norms."""
    try:
        with db(admin.id) as conn:
            source = conn.execute(
                "select instrument_id,language,provenance from assessment_instruments where instrument_id=%s for share",
                (str(instrument_id),),
            ).fetchone()
            if not source:
                raise HTTPException(404, "Instrumen sumber tidak ditemukan")
            created = conn.execute(
                "insert into assessment_instruments(code,name,description,language,instrument_kind,derived_from_instrument_id,"
                "norms_enabled,provenance,created_by,updated_by) values(%s,%s,%s,%s,'custom',%s,false,%s,%s,%s) "
                "returning instrument_id",
                (body.code, body.name.strip(), body.description, source["language"], str(instrument_id),
                 Jsonb({"derived_from": str(instrument_id), "notice": "DASS norms are not inherited"}), admin.id, admin.id),
            ).fetchone()
            version = conn.execute(
                "insert into assessment_instrument_versions(instrument_id,version_number,status,expected_question_count,"
                "authoritative_config,created_by,updated_by) values(%s,1,'draft',21,false,%s,%s) returning instrument_version_id",
                (str(created["instrument_id"]), admin.id, admin.id),
            ).fetchone()
            source_version = conn.execute(
                "select instrument_version_id from assessment_instrument_versions where instrument_id=%s "
                "order by case status when 'published' then 0 when 'draft' then 1 else 2 end,version_number desc limit 1",
                (str(instrument_id),),
            ).fetchone()
            if source_version:
                questions = conn.execute(
                    "select assessment_question_id,item_key,category,position,wording,active from assessment_questions "
                    "where instrument_version_id=%s order by position",
                    (str(source_version["instrument_version_id"]),),
                ).fetchall()
                for question in questions:
                    new_question = conn.execute(
                        "insert into assessment_questions(instrument_version_id,item_key,category,position,wording,active) "
                        "values(%s,%s,%s,%s,%s,%s) returning assessment_question_id",
                        (str(version["instrument_version_id"]), question["item_key"], question["category"],
                         question["position"], question["wording"], question["active"]),
                    ).fetchone()
                    conn.execute(
                        "insert into assessment_answer_options(assessment_question_id,position,label,score) "
                        "select %s,position,label,score from assessment_answer_options where assessment_question_id=%s",
                        (str(new_question["assessment_question_id"]), str(question["assessment_question_id"])),
                    )
        return _version_detail(str(version["instrument_version_id"]), admin.id)
    except UniqueViolation:
        raise HTTPException(409, "Kode instrumen sudah digunakan")


@admin_router.post("/assessment-instruments/dass21-variants", status_code=201)
def create_dass21_variant(body: Dass21VariantRequest, admin=Depends(admin_access)):
    """Publish a DASS-21 that offers only the chosen subscales, each whole, with its official norm.

    Wording, options and scores are copied from the published DASS-21 rather than sent by the
    client, so a variant can never drift from the validated instrument.
    """
    try:
        subscales = normalize_subscales(body.subscales)
    except ValueError as exc:
        raise HTTPException(422, str(exc))
    try:
        with db(admin.id) as conn:
            source = conn.execute(
                "select i.instrument_id,i.language,i.provenance,v.instrument_version_id,v.scoring_config "
                "from assessment_instruments i join assessment_instrument_versions v on v.instrument_id=i.instrument_id "
                "where lower(i.code)='dass-21' and i.norms_enabled and v.status='published' and v.authoritative_config",
            ).fetchone()
            if not source:
                raise HTTPException(409, "DASS-21 resmi belum dipublikasikan")
            scoring = dict(source["scoring_config"] or {})
            scoring["category_items"] = {category: list(CATEGORY_ITEMS[category]) for category in subscales}
            created = conn.execute(
                "insert into assessment_instruments(code,name,description,language,instrument_kind,derived_from_instrument_id,"
                "norms_enabled,provenance,dass21_subscales,created_by,updated_by) "
                "values(%s,%s,%s,%s,'standard',%s,true,%s,%s,%s,%s) returning instrument_id",
                (body.code, body.name.strip(), body.description, source["language"], str(source["instrument_id"]),
                 Jsonb({**(source["provenance"] or {}), "dass21_subscales": list(subscales),
                        "notice": "Whole DASS-21 subscales with the official per-subscale norms"}),
                 list(subscales), admin.id, admin.id),
            ).fetchone()
            version = conn.execute(
                "insert into assessment_instrument_versions(instrument_id,version_number,status,expected_question_count,"
                "authoritative_config,scoring_config,created_by,updated_by) values(%s,1,'draft',%s,false,%s,%s,%s) "
                "returning instrument_version_id",
                (str(created["instrument_id"]), 7 * len(subscales), Jsonb(scoring), admin.id, admin.id),
            ).fetchone()
            questions = conn.execute(
                "select assessment_question_id,item_key,category,position,wording from assessment_questions "
                "where instrument_version_id=%s and active and category=any(%s) order by position",
                (str(source["instrument_version_id"]), list(subscales)),
            ).fetchall()
            for question in questions:
                copy = conn.execute(
                    "insert into assessment_questions(instrument_version_id,item_key,category,position,wording,active) "
                    "values(%s,%s,%s,%s,%s,true) returning assessment_question_id",
                    (str(version["instrument_version_id"]), question["item_key"], question["category"],
                     question["position"], question["wording"]),
                ).fetchone()
                conn.execute(
                    "insert into assessment_answer_options(assessment_question_id,position,label,score) "
                    "select %s,position,label,score from assessment_answer_options where assessment_question_id=%s",
                    (str(copy["assessment_question_id"]), str(question["assessment_question_id"])),
                )
            # Copied verbatim from the authoritative version, so it is published as it stands.
            conn.execute(
                "update assessment_instrument_versions set status='published',authoritative_config=true,"
                "published_by=%s,published_at=now(),updated_by=%s,updated_at=now() where instrument_version_id=%s",
                (admin.id, admin.id, str(version["instrument_version_id"])),
            )
        return _version_detail(str(version["instrument_version_id"]), admin.id)
    except UniqueViolation:
        raise HTTPException(409, "Kode instrumen sudah digunakan")


@admin_router.put("/assessment-instruments/{instrument_id}/shown-in-app")
def show_instrument_in_app(instrument_id: UUID, admin=Depends(admin_access)):
    """Make this the instrument the mobile app asks students to fill in."""
    with db(admin.id) as conn:
        ready = conn.execute(
            "select 1 from assessment_instruments i join assessment_instrument_versions v on v.instrument_id=i.instrument_id "
            "where i.instrument_id=%s and i.active and i.norms_enabled and i.instrument_kind='standard' "
            "and v.status='published' and v.authoritative_config",
            (str(instrument_id),),
        ).fetchone()
        if not ready:
            raise HTTPException(422, "Hanya DASS-21 atau varian DASS-21 yang sudah dipublikasikan yang dapat ditampilkan di aplikasi")
        conn.execute(
            "update assessment_instruments set shown_in_app=false,updated_by=%s,updated_at=now() "
            "where shown_in_app and instrument_id<>%s",
            (admin.id, str(instrument_id)),
        )
        conn.execute(
            "update assessment_instruments set shown_in_app=true,updated_by=%s,updated_at=now() where instrument_id=%s",
            (admin.id, str(instrument_id)),
        )
    return {"instrument_id": str(instrument_id), "shown_in_app": True}


@admin_router.put("/assessment-instruments/versions/{version_id}/draft")
def save_instrument_draft(version_id: UUID, body: DraftDefinition, admin=Depends(admin_access)):
    positions = [question.position for question in body.questions]
    keys = [question.item_key.lower() for question in body.questions]
    if len(positions) != len(set(positions)) or len(keys) != len(set(keys)):
        raise HTTPException(422, "Urutan dan kunci pertanyaan harus unik")
    for question in body.questions:
        option_positions = [option.position for option in question.options]
        if len(option_positions) != len(set(option_positions)):
            raise HTTPException(422, f"Urutan pilihan untuk {question.item_key} harus unik")
    with db(admin.id) as conn:
        version = conn.execute(
            "select v.status,v.definition_revision,i.instrument_kind from assessment_instrument_versions v "
            "join assessment_instruments i on i.instrument_id=v.instrument_id "
            "where v.instrument_version_id=%s for update of v",
            (str(version_id),),
        ).fetchone()
        if not version:
            raise HTTPException(404, "Versi instrumen tidak ditemukan")
        if version["status"] != "draft":
            raise HTTPException(409, "Versi yang sudah dipublikasikan tidak dapat diubah")
        if version["instrument_kind"] == "standard":
            raise HTTPException(409, "Konten instrumen standar dikunci; buat instrumen kustom/derived untuk perubahan")
        if body.expected_revision is not None and version["definition_revision"] != body.expected_revision:
            raise HTTPException(409, "Draft telah berubah; muat ulang sebelum menyimpan")
        conn.execute("delete from assessment_questions where instrument_version_id=%s", (str(version_id),))
        for question in sorted(body.questions, key=lambda item: item.position):
            created = conn.execute(
                "insert into assessment_questions(instrument_version_id,item_key,category,assessment_dimension_id,position,wording,active) "
                "values(%s,%s,%s,(select assessment_dimension_id from assessment_dimensions where instrument_version_id=%s and code=%s),%s,%s,%s) returning assessment_question_id",
                (str(version_id), question.item_key, question.category, str(version_id), question.category, question.position, question.wording.strip(), question.active),
            ).fetchone()
            for option in sorted(question.options, key=lambda item: item.position):
                conn.execute(
                    "insert into assessment_answer_options(assessment_question_id,position,label,score) values(%s,%s,%s,%s)",
                    (str(created["assessment_question_id"]), option.position, option.label.strip(), option.score),
                )
        conn.execute(
            "update assessment_instrument_versions set updated_by=%s,updated_at=now(),definition_revision=definition_revision+1,expected_question_count=%s where instrument_version_id=%s",
            (admin.id, len([question for question in body.questions if question.active]), str(version_id)),
        )
    return _version_detail(str(version_id), admin.id)


def _publish_issues(conn, version_id: str) -> List[str]:
    version = conn.execute(
        "select v.status,v.expected_question_count,v.authoritative_config,v.scoring_config,v.definition_revision,"
        "i.instrument_kind,i.norms_enabled from assessment_instrument_versions v "
        "join assessment_instruments i on i.instrument_id=v.instrument_id "
        "where v.instrument_version_id=%s for update of v",
        (version_id,),
    ).fetchone()
    if not version:
        raise HTTPException(404, "Versi instrumen tidak ditemukan")
    if version["status"] != "draft":
        return ["Hanya versi draft yang dapat dipublikasikan"]
    issues: List[str] = []
    counts = conn.execute(
        "select count(*) total,count(*) filter(where active) active_total,"
        "count(*) filter(where category='depression' and active) depression,"
        "count(*) filter(where category='anxiety' and active) anxiety,"
        "count(*) filter(where category='stress' and active) stress from assessment_questions where instrument_version_id=%s",
        (version_id,),
    ).fetchone()
    if counts["active_total"] != version["expected_question_count"]:
        issues.append(f"Jumlah item aktif harus {version['expected_question_count']}")
    if version["instrument_kind"] == "standard" and any(counts[name] == 0 for name in ("depression", "anxiety", "stress")):
        issues.append("Ketiga kategori Depression, Anxiety, dan Stress wajib memiliki item")
    incomplete = conn.execute(
        "select count(*) total from assessment_questions q where q.instrument_version_id=%s and q.active "
        "and (select count(*) from assessment_answer_options o where o.assessment_question_id=q.assessment_question_id)<2",
        (version_id,),
    ).fetchone()["total"]
    if incomplete:
        issues.append("Setiap item aktif wajib memiliki sedikitnya dua pilihan jawaban")
    if version["scoring_config"] is None:
        issues.append("Konfigurasi penilaian belum tersedia")
    if version["instrument_kind"] == "standard":
        definition = conn.execute(
            "select q.position,q.category,array_agg(o.score order by o.score) option_scores "
            "from assessment_questions q left join assessment_answer_options o "
            "on o.assessment_question_id=q.assessment_question_id "
            "where q.instrument_version_id=%s and q.active group by q.assessment_question_id,q.position,q.category "
            "order by q.position",
            (version_id,),
        ).fetchall()
        issues.extend(validate_dass21_definition(definition))
        if not version["norms_enabled"]:
            issues.append("Norma DASS-21 belum diaktifkan untuk instrumen standar")
    else:
        if version["scoring_config"].get("model") == "DASS-21":
            issues.append("Instrumen kustom tidak otomatis mewarisi norma DASS-21")
        dimensions = conn.execute("select code from assessment_dimensions where instrument_version_id=%s", (version_id,)).fetchall()
        if not dimensions:
            issues.append("Instrumen kustom wajib memiliki sedikitnya satu dimensi")
        if conn.execute("select 1 from assessment_questions q left join assessment_dimensions d on d.assessment_dimension_id=q.assessment_dimension_id where q.instrument_version_id=%s and q.active and d.assessment_dimension_id is null limit 1", (version_id,)).fetchone():
            issues.append("Setiap pertanyaan aktif wajib terhubung ke dimensi")
        approved = conn.execute("select 1 from assessment_version_reviews where instrument_version_id=%s and definition_revision=%s and status='approved' limit 1", (version_id, version["definition_revision"])).fetchone()
        if not approved:
            issues.append("Persetujuan konselor untuk revisi draft saat ini belum tersedia")
    return issues


@admin_router.post("/assessment-instruments/versions/{version_id}/validate")
def validate_instrument_version(version_id: UUID, admin=Depends(admin_access)):
    with db(admin.id) as conn:
        issues = _publish_issues(conn, str(version_id))
    return {"publishable": not issues, "issues": issues}


@admin_router.post("/assessment-instruments/versions/{version_id}/publish")
def publish_instrument_version(version_id: UUID, admin=Depends(admin_access)):
    try:
        with db(admin.id) as conn:
            issues = _publish_issues(conn, str(version_id))
            if issues:
                raise HTTPException(422, {"message": "Versi belum dapat dipublikasikan", "issues": issues})
            instrument_id = conn.execute(
                "select instrument_id from assessment_instrument_versions where instrument_version_id=%s",
                (str(version_id),),
            ).fetchone()["instrument_id"]
            conn.execute(
                "update assessment_instrument_versions set status='archived',updated_by=%s,updated_at=now() "
                "where instrument_id=%s and status='published'",
                (admin.id, str(instrument_id)),
            )
            conn.execute(
                "update assessment_instrument_versions set status='published',published_by=%s,published_at=now(),"
                "updated_by=%s,updated_at=now() where instrument_version_id=%s",
                (admin.id, admin.id, str(version_id)),
            )
    except UniqueViolation:
        raise HTTPException(409, "Versi aktif berubah; muat ulang sebelum mempublikasikan")
    return _version_detail(str(version_id), admin.id)


@assessment_router.get("/instrument/active")
def active_instrument(code: Optional[str] = Query(None, max_length=40), user=Depends(get_current_user)):
    """The instrument the app shows (no `code`), or a specific one by code."""
    rows = query(
        "select v.instrument_version_id,i.instrument_id,i.code,i.name,i.language,i.instrument_kind,i.provenance,"
        "i.dass21_subscales,v.version_number,v.scoring_config from assessment_instruments i "
        "join assessment_instrument_versions v on v.instrument_id=i.instrument_id "
        "where (case when %s::text is null then i.shown_in_app else lower(i.code)=lower(%s) end) "
        "and i.active and i.norms_enabled and v.status='published' and v.authoritative_config",
        (code, code), user_id=user.id,
    )
    if not rows:
        raise HTTPException(404, "Belum ada versi instrumen aktif yang disetujui")
    detail = query(
        "select q.assessment_question_id,q.item_key,q.category,q.position,q.wording,"
        "jsonb_agg(jsonb_build_object('assessment_answer_option_id',o.assessment_answer_option_id,'position',o.position,'label',o.label,'score',o.score) order by o.position) options "
        "from assessment_questions q join assessment_answer_options o on o.assessment_question_id=q.assessment_question_id "
        "where q.instrument_version_id=%s and q.active group by q.assessment_question_id order by q.position",
        (str(rows[0]["instrument_version_id"]),), user_id=user.id,
    )
    return {"version": rows[0], "questions": detail}


def _legacy_severity(category_results: dict) -> str:
    """Compatibility-only maximum used by legacy aggregate columns and screens."""
    rank = {"normal": 0, "mild": 1, "moderate": 2, "severe": 3, "extremely_severe": 4}
    highest = max((str(value["severity"]) for value in category_results.values()), key=lambda value: rank[value])
    return "minimal" if highest == "normal" else "severe" if highest == "extremely_severe" else highest


@assessment_router.post("/instrument/submit", status_code=201)
def submit_instrument_assessment(body: InstrumentSubmission, student=Depends(student_access)):
    """Submit immutable identifiers; all option scores are resolved on the server."""
    if len({str(answer.question_id) for answer in body.answers}) != len(body.answers):
        raise HTTPException(422, "Setiap pertanyaan hanya boleh dijawab satu kali")
    with db(student.id) as conn:
        version = conn.execute(
            "select v.instrument_version_id,v.expected_question_count,v.authoritative_config,v.scoring_config,"
            "i.instrument_id,i.code,i.name,i.instrument_kind,i.norms_enabled,i.dass21_subscales "
            "from assessment_instrument_versions v join assessment_instruments i on i.instrument_id=v.instrument_id "
            # No FOR SHARE: a locking read also has to satisfy the UPDATE policy, which students
            # do not match, so the published version came back empty and every submit failed with 409.
            # A published version is immutable, so the lock bought nothing here.
            "where v.instrument_version_id=%s and v.status='published' and i.active",
            (str(body.instrument_version_id),),
        ).fetchone()
        if not version or not version["authoritative_config"]:
            raise HTTPException(409, "Versi instrumen tidak aktif atau belum disetujui")
        is_dass21 = version["code"].lower() == "dass-21" or version["dass21_subscales"]
        if version["instrument_kind"] != "standard" or not version["norms_enabled"] or not is_dass21:
            raise HTTPException(422, "Model skoring instrumen ini belum didukung")
        subscales = normalize_subscales(version["dass21_subscales"] or CATEGORY_ITEMS)
        if len(body.answers) != version["expected_question_count"]:
            raise HTTPException(422, f"Wajib menjawab tepat {version['expected_question_count']} pertanyaan")
        definitions = conn.execute(
            "select q.assessment_question_id,q.position,q.category,o.assessment_answer_option_id,o.score "
            "from assessment_questions q join assessment_answer_options o "
            "on o.assessment_question_id=q.assessment_question_id "
            "where q.instrument_version_id=%s and q.active order by q.position,o.position",
            (str(body.instrument_version_id),),
        ).fetchall()
        selected = {(str(answer.question_id), str(answer.option_id)) for answer in body.answers}
        resolved = [row for row in definitions if (str(row["assessment_question_id"]), str(row["assessment_answer_option_id"])) in selected]
        if len(resolved) != len(body.answers):
            raise HTTPException(422, "Pertanyaan atau pilihan jawaban tidak valid untuk versi ini")
        if len({str(row["assessment_question_id"]) for row in resolved}) != version["expected_question_count"]:
            raise HTTPException(422, "Jawaban tidak mencakup semua pertanyaan aktif")
        try:
            results = score_dass21(resolved, subscales=subscales)
        except ValueError as exc:
            raise HTTPException(422, str(exc))
        answer_references = [
            {"question_id": str(answer.question_id), "option_id": str(answer.option_id)} for answer in body.answers
        ]
        total_raw = sum(int(value["raw_score"]) for value in results.values())
        assessment = conn.execute(
            "insert into assessments(user_id,instrument_type,answers,score,severity,instrument_version_id) "
            "values(%s,%s,%s,%s,'minimal',%s) returning assessment_id,taken_at",
            (student.id, "DASS-21", Jsonb(answer_references), total_raw, str(body.instrument_version_id)),
        ).fetchone()
        for category, result in results.items():
            conn.execute(
                "insert into assessment_category_results(assessment_id,instrument_version_id,category,raw_score,scaled_score,severity) "
                "values(%s,%s,%s,%s,%s,%s)",
                (str(assessment["assessment_id"]), str(body.instrument_version_id), category,
                 result["raw_score"], result["scaled_score"], result["severity"]),
            )
        conn.execute(
            "update assessments set severity=%s where assessment_id=%s",
            (_legacy_severity(results), str(assessment["assessment_id"])),
        )
        elevated = [
            f"{category}:{result['severity']}" for category, result in results.items()
            if result["severity"] in ("moderate", "severe", "extremely_severe")
        ]
        if elevated:
            conn.execute(
                "insert into guardrail_logs(user_id,source,assessment_id,triggered_input) values(%s,'assessment',%s,%s)",
                (student.id, str(assessment["assessment_id"]), "[ASSESSMENT] DASS-21 categories=" + ",".join(elevated)),
            )
            conn.execute("select notify_dass21_admins(%s)", (str(assessment["assessment_id"]),))
    return {
        "assessment_id": assessment["assessment_id"],
        "submitted_at": assessment["taken_at"],
        "message": "Asesmen berhasil disimpan.",
        "support_message": "Jika kamu sedang mengalami tekanan emosional yang kuat atau membutuhkan dukungan, kamu dapat menggunakan layanan konseling yang tersedia.",
    }


@admin_router.get("/analytics/comparison")
def comparison_analytics(
    date_from: date,
    date_to: date,
    faculty_id: List[UUID] = Query(default=[]),
    academic_unit_id: List[UUID] = Query(default=[]),
    admin=Depends(admin_access),
):
    if date_from > date_to or (date_to - date_from).days > 366:
        raise HTTPException(422, "Rentang tanggal tidak valid atau melebihi 366 hari")
    faculty_ids, unit_ids = _ids(faculty_id), _ids(academic_unit_id)
    if unit_ids:
        units = query(
            "select academic_unit_id,faculty_id,name from academic_units where academic_unit_id=any(%s::uuid[]) and active "
            "order by name,academic_unit_id",
            (unit_ids,), user_id=admin.id,
        )
        if len(units) != len(unit_ids):
            raise HTTPException(422, "Satu atau lebih unit akademik tidak valid")
        if faculty_ids and any(str(unit["faculty_id"]) not in faculty_ids for unit in units):
            raise HTTPException(422, "Unit akademik harus berada dalam fakultas yang dipilih")
        mode, selected, id_column, label_column = "academic_unit", unit_ids, "au.academic_unit_id", "au.name"
        selected_scopes = [{"scope_id": str(unit["academic_unit_id"]), "scope_label": unit["name"]} for unit in units]
    elif faculty_ids:
        faculties = query(
            "select faculty_id,name from faculties where faculty_id=any(%s::uuid[]) and active order by name,faculty_id",
            (faculty_ids,), user_id=admin.id,
        )
        if len(faculties) != len(faculty_ids):
            raise HTTPException(422, "Satu atau lebih fakultas tidak valid")
        mode, selected, id_column, label_column = "faculty", faculty_ids, "f.faculty_id", "f.name"
        selected_scopes = [{"scope_id": str(faculty["faculty_id"]), "scope_label": faculty["name"]} for faculty in faculties]
    else:
        mode, selected, id_column, label_column = "university", [], "null::uuid", "'Universitas Diponegoro'::text"
        selected_scopes = [{"scope_id": None, "scope_label": "Universitas Diponegoro"}]

    selection = "" if mode == "university" else f" and {id_column}=any(%s::uuid[])"
    parameters = (date_from, date_to) if mode == "university" else (date_from, date_to, selected)
    base = (
        " from assessments a join users u on u.user_id=a.user_id "
        "left join student_academic_profiles sap on sap.user_id=u.user_id "
        "left join faculties f on f.faculty_id=sap.faculty_id "
        "left join academic_units au on au.academic_unit_id=sap.academic_unit_id "
        "where a.taken_at>=%s::date and a.taken_at<%s::date+interval '1 day'" + selection
    )
    trends = query(
        f"select {id_column} scope_id,{label_column} scope_label,a.taken_at::date date,count(*) assessment_count "
        + base + f" group by {id_column},{label_column},a.taken_at::date order by scope_label,date",
        parameters, user_id=admin.id,
    )
    severity = query(
        f"select {id_column} scope_id,{label_column} scope_label,a.severity,count(*) count "
        + base + f" group by {id_column},{label_column},a.severity order by scope_label,a.severity",
        parameters, user_id=admin.id,
    )
    assessed_students = query(
        f"select {id_column} scope_id,{label_column} scope_label,count(distinct a.user_id) unique_student_count "
        + base + f" group by {id_column},{label_column} order by scope_label",
        parameters, user_id=admin.id,
    )
    severity_trends = query(
        f"select {id_column} scope_id,{label_column} scope_label,a.taken_at::date date,a.severity,count(*) count "
        + base + f" group by {id_column},{label_column},a.taken_at::date,a.severity order by scope_label,date,a.severity",
        parameters, user_id=admin.id,
    )
    category = query(
        f"select {id_column} scope_id,{label_column} scope_label,r.category,a.taken_at::date date,"
        "avg(coalesce(r.scaled_score,r.raw_score)) score,count(*) submission_count "
        "from assessment_category_results r join assessments a on a.assessment_id=r.assessment_id "
        "join users u on u.user_id=a.user_id left join student_academic_profiles sap on sap.user_id=u.user_id "
        "left join faculties f on f.faculty_id=sap.faculty_id left join academic_units au on au.academic_unit_id=sap.academic_unit_id "
        "where a.taken_at>=%s::date and a.taken_at<%s::date+interval '1 day'" + selection +
        f" group by {id_column},{label_column},r.category,a.taken_at::date order by scope_label,r.category,date",
        parameters, user_id=admin.id,
    )
    category_severity = query(
        f"select {id_column} scope_id,{label_column} scope_label,r.category,r.severity,count(*) count "
        "from assessment_category_results r join assessments a on a.assessment_id=r.assessment_id "
        "join users u on u.user_id=a.user_id left join student_academic_profiles sap on sap.user_id=u.user_id "
        "left join faculties f on f.faculty_id=sap.faculty_id left join academic_units au on au.academic_unit_id=sap.academic_unit_id "
        "where a.taken_at>=%s::date and a.taken_at<%s::date+interval '1 day'" + selection +
        f" group by {id_column},{label_column},r.category,r.severity order by scope_label,r.category,r.severity",
        parameters, user_id=admin.id,
    )
    counseling = query(
        f"select {id_column} scope_id,{label_column} scope_label,a.status,count(*) count "
        "from counseling_appointments a join users u on u.user_id=a.student_id "
        "left join student_academic_profiles sap on sap.user_id=u.user_id "
        "left join faculties f on f.faculty_id=sap.faculty_id left join academic_units au on au.academic_unit_id=sap.academic_unit_id "
        "where a.starts_at>=%s::date and a.starts_at<%s::date+interval '1 day'" + selection +
        f" group by {id_column},{label_column},a.status order by scope_label,a.status",
        parameters, user_id=admin.id,
    )
    attention = query(
        f"select {id_column} scope_id,{label_column} scope_label,"
        "case when g.assessment_id is not null or g.triggered_input like '[ASSESSMENT]%%' then 'assessment' else 'safety' end signal_type,count(*) count "
        "from guardrail_logs g left join users u on u.user_id=g.user_id "
        "left join student_academic_profiles sap on sap.user_id=u.user_id "
        "left join faculties f on f.faculty_id=sap.faculty_id left join academic_units au on au.academic_unit_id=sap.academic_unit_id "
        "where g.notified_at>=%s::date and g.notified_at<%s::date+interval '1 day'" + selection +
        " group by 1,2,3 order by 2,3",
        parameters, user_id=admin.id,
    )
    return {"mode": mode, "date_from": date_from, "date_to": date_to, "selected_scopes": selected_scopes, "assessment_trend": trends, "unique_assessed_students": assessed_students, "severity_distribution": severity, "severity_trend": severity_trends, "category_trends": category, "category_severity_distribution": category_severity, "counseling_utilization": counseling, "attention_counts": attention}


@admin_router.get("/counseling/calendar/multi")
def multi_counselor_calendar(
    date_from: date,
    date_to: date,
    counselor_id: List[UUID] = Query(default=[]),
    admin=Depends(admin_access),
):
    if date_from > date_to or (date_to - date_from).days > 62:
        raise HTTPException(422, "Rentang kalender tidak valid atau melebihi 62 hari")
    counselor_ids = _ids(counselor_id, 12)
    selected_clause = "" if not counselor_ids else " and u.user_id=any(%s::uuid[])"
    selected_params = () if not counselor_ids else (counselor_ids,)
    counselors = query(
        "select u.user_id,u.name,cp.title,cp.specialization,coalesce(cp.active,true) active from users u "
        "left join counselor_profiles cp on cp.user_id=u.user_id where u.role='konselor'" + selected_clause + " order by u.name",
        selected_params, user_id=admin.id,
    )
    resolved_ids = [str(row["user_id"]) for row in counselors]
    if counselor_ids and len(resolved_ids) != len(counselor_ids):
        raise HTTPException(422, "Satu atau lebih konselor tidak valid")
    if not resolved_ids:
        return {"counselors": [], "appointments": [], "availability": [], "blocked_periods": []}
    appointments = query(
        "select a.counseling_appointment_id,a.counseling_request_id,a.student_id,s.name student_name,s.nim,"
        "a.counselor_id,c.name counselor_name,a.starts_at,a.ends_at,a.status "
        "from counseling_appointments a join users s on s.user_id=a.student_id join users c on c.user_id=a.counselor_id "
        "where a.counselor_id=any(%s::uuid[]) and a.starts_at<%s::date+interval '1 day' and a.ends_at>%s::date order by a.starts_at",
        (resolved_ids, date_to, date_from), user_id=admin.id,
    )
    availability = query(
        "select counselor_availability_rule_id,counselor_id,day_of_week,start_time,end_time,timezone,effective_from,effective_to,active "
        "from counselor_availability_rules where counselor_id=any(%s::uuid[]) and active "
        "and coalesce(effective_from,'-infinity'::date)<=%s::date and coalesce(effective_to,'infinity'::date)>=%s::date "
        "order by counselor_id,day_of_week,start_time",
        (resolved_ids, date_to, date_from), user_id=admin.id,
    )
    blocked = query(
        "select b.counselor_blocked_period_id,b.counselor_id,u.name counselor_name,b.starts_at,b.ends_at,b.reason,"
        "case when e.counselor_exception_request_id is null then 'admin' else 'counselor' end source,'approved' review_status "
        "from counselor_blocked_periods b join users u on u.user_id=b.counselor_id "
        "left join counselor_exception_requests e on e.counselor_blocked_period_id=b.counselor_blocked_period_id "
        "where b.counselor_id=any(%s::uuid[]) and b.starts_at<%s::date+interval '1 day' and b.ends_at>%s::date "
        # Undecided and rejected requests are not blocks yet, but the admin needs to see them;
        # they carry the request id, and source='counselor' keeps the delete action off them.
        "union all select e.counselor_exception_request_id,e.counselor_id,u.name,e.starts_at,e.ends_at,e.reason,'counselor',e.status "
        "from counselor_exception_requests e join users u on u.user_id=e.counselor_id "
        "where e.status in ('pending','rejected') and e.counselor_id=any(%s::uuid[]) "
        "and e.starts_at<%s::date+interval '1 day' and e.ends_at>%s::date order by starts_at",
        (resolved_ids, date_to, date_from, resolved_ids, date_to, date_from), user_id=admin.id,
    )
    return {"counselors": counselors, "appointments": appointments, "availability": availability, "blocked_periods": blocked}
