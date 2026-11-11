"""Additive Iteration 3C APIs; private source content is never selected."""
from datetime import date, datetime, time, timedelta, timezone
from typing import List, Literal, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from psycopg.errors import ExclusionViolation, ForeignKeyViolation, UniqueViolation
from psycopg.types.json import Jsonb
from auth import get_current_user, require_role
from core.db import db, query

admin_router=APIRouter(prefix="/admin",tags=["Admin Iteration 3C"])
student_router=APIRouter(prefix="/counseling",tags=["Counseling Requests"])
admin_access=require_role("admin")

class FacultyBody(BaseModel):
    name:str=Field(min_length=1,max_length=150); code:Optional[str]=Field(default=None,max_length=20); active:bool=True
class UnitBody(BaseModel):
    faculty_id:UUID; name:str=Field(min_length=1,max_length=150); code:Optional[str]=Field(default=None,max_length=30)
    unit_type:Literal["department","study_program"]; degree_level:Optional[str]=Field(default=None,max_length=20); active:bool=True
class ProfileBody(BaseModel):
    faculty_id:Optional[UUID]=None; academic_unit_id:Optional[UUID]=None
class RequestBody(BaseModel):
    preferred_context:Optional[str]=Field(default=None,max_length=250)
    # The slot picked on the mobile calendar; all three or none. The admin still assigns.
    preferred_counselor_id:Optional[UUID]=None; preferred_starts_at:Optional[datetime]=None; preferred_ends_at:Optional[datetime]=None

# Length of one counseling session, the step the mobile calendar offers slots in.
SESSION_MINUTES=60
class CounselorBody(BaseModel):
    title:Optional[str]=Field(default=None,max_length=100); specialization:Optional[str]=Field(default=None,max_length=250); active:bool=True
class AvailabilityBody(BaseModel):
    counselor_id:UUID; day_of_week:int=Field(ge=0,le=6); start_time:time; end_time:time
    timezone:str=Field(default="Asia/Jakarta",max_length=50); effective_from:Optional[date]=None; effective_to:Optional[date]=None; active:bool=True
class AppointmentBody(BaseModel):
    counselor_id:UUID; starts_at:datetime; ends_at:datetime; counseling_resource_id:Optional[UUID]=None
class AppointmentPatch(BaseModel):
    counselor_id:Optional[UUID]=None; starts_at:Optional[datetime]=None; ends_at:Optional[datetime]=None
    counseling_resource_id:Optional[UUID]=None
    status:Optional[Literal["confirmed","completed","cancelled","rescheduled","no_show"]]=None
class BlockBody(BaseModel):
    counselor_id:UUID; starts_at:datetime; ends_at:datetime; reason:Optional[str]=Field(default=None,max_length=250)
class NoteBody(BaseModel):
    note_text:str=Field(min_length=1,max_length=4000); counseling_request_id:Optional[UUID]=None; counseling_appointment_id:Optional[UUID]=None
class AuditBody(BaseModel):
    report_mode:Literal["aggregate","confidential"]; faculty_id:Optional[UUID]=None; academic_unit_id:Optional[UUID]=None
    faculty_ids:List[UUID]=Field(default_factory=list,max_length=20); academic_unit_ids:List[UUID]=Field(default_factory=list,max_length=50)
    date_from:date; date_to:date

def clean(v): return (v.strip() or None) if v else None
def utc(v):
    if v.tzinfo is None: raise HTTPException(422,"Tanggal dan waktu harus menyertakan zona waktu")
    return v.astimezone(timezone.utc)

@admin_router.get("/academic/faculties")
def faculties(include_inactive:bool=False,admin=Depends(admin_access)):
    rows=query("select f.faculty_id,f.code,f.name,f.active,f.source_url,count(distinct au.academic_unit_id) unit_count,"
               "count(distinct sap.user_id) student_count from faculties f left join academic_units au on au.faculty_id=f.faculty_id "
               "left join student_academic_profiles sap on sap.faculty_id=f.faculty_id where (%s or f.active) "
               "group by f.faculty_id order by f.name",(include_inactive,),user_id=admin.id)
    return {"faculties":rows,"total":len(rows)}

@admin_router.post("/academic/faculties",status_code=201)
def faculty_create(b:FacultyBody,admin=Depends(admin_access)):
    try: row=query("insert into faculties(name,code,active) values(%s,%s,%s) returning faculty_id,code,name,active,source_url",
                  (b.name.strip(),clean(b.code),b.active),user_id=admin.id)[0]
    except UniqueViolation: raise HTTPException(409,"Fakultas dengan nama atau kode tersebut sudah ada")
    return {"faculty":row}

@admin_router.put("/academic/faculties/{faculty_id}")
def faculty_update(faculty_id:UUID,b:FacultyBody,admin=Depends(admin_access)):
    rows=query("update faculties set name=%s,code=%s,active=%s where faculty_id=%s returning faculty_id,code,name,active,source_url",
               (b.name.strip(),clean(b.code),b.active,str(faculty_id)),user_id=admin.id)
    if not rows: raise HTTPException(404,"Fakultas tidak ditemukan")
    return {"faculty":rows[0]}

@admin_router.get("/academic/units")
def units(faculty_id:Optional[UUID]=None,include_inactive:bool=False,admin=Depends(admin_access)):
    fid=str(faculty_id) if faculty_id else None
    rows=query("select au.academic_unit_id,au.faculty_id,f.name faculty_name,au.code,au.name,au.unit_type,au.degree_level,au.active,"
               "au.source_url,count(sap.user_id) student_count from academic_units au join faculties f on f.faculty_id=au.faculty_id "
               "left join student_academic_profiles sap on sap.academic_unit_id=au.academic_unit_id "
               "where (%s::uuid is null or au.faculty_id=%s::uuid) and (%s or au.active) group by au.academic_unit_id,f.name order by f.name,au.name",
               (fid,fid,include_inactive),user_id=admin.id)
    return {"academic_units":rows,"total":len(rows)}

def save_unit(unit_id,b,admin_id):
    params=(str(b.faculty_id),b.name.strip(),clean(b.code),b.unit_type,clean(b.degree_level),b.active)
    if unit_id:
        rows=query("update academic_units set faculty_id=%s,name=%s,code=%s,unit_type=%s,degree_level=%s,active=%s where academic_unit_id=%s "
                   "returning academic_unit_id,faculty_id,name,code,unit_type,degree_level,active",params+(str(unit_id),),user_id=admin_id)
    else:
        rows=query("insert into academic_units(faculty_id,name,code,unit_type,degree_level,active) values(%s,%s,%s,%s,%s,%s) "
                   "returning academic_unit_id,faculty_id,name,code,unit_type,degree_level,active",params,user_id=admin_id)
    if not rows: raise HTTPException(404,"Unit akademik tidak ditemukan")
    return rows[0]

@admin_router.post("/academic/units",status_code=201)
def unit_create(b:UnitBody,admin=Depends(admin_access)):
    try: return {"academic_unit":save_unit(None,b,admin.id)}
    except ForeignKeyViolation: raise HTTPException(422,"Fakultas tidak valid")
    except UniqueViolation: raise HTTPException(409,"Unit akademik tersebut sudah ada")

@admin_router.put("/academic/units/{unit_id}")
def unit_update(unit_id:UUID,b:UnitBody,admin=Depends(admin_access)):
    return {"academic_unit":save_unit(unit_id,b,admin.id)}

@admin_router.put("/students/{student_id}/academic-profile")
def profile_update(student_id:UUID,b:ProfileBody,admin=Depends(admin_access)):
    fid=str(b.faculty_id) if b.faculty_id else None; uid=str(b.academic_unit_id) if b.academic_unit_id else None
    if uid and not fid: raise HTTPException(422,"Fakultas wajib dipilih bersama unit akademik")
    try: row=query("insert into student_academic_profiles(user_id,faculty_id,academic_unit_id) values(%s,%s,%s) "
                  "on conflict(user_id) do update set faculty_id=excluded.faculty_id,academic_unit_id=excluded.academic_unit_id "
                  "returning user_id,faculty_id,academic_unit_id",(str(student_id),fid,uid),user_id=admin.id)[0]
    except ForeignKeyViolation: raise HTTPException(422,"Mahasiswa, fakultas, atau unit akademik tidak valid")
    return {"academic_profile":row}

@admin_router.get("/notifications")
def notifications(category:Optional[str]=None,unread_only:bool=False,page:int=Query(1,ge=1),page_size:int=Query(30,ge=1,le=100),admin=Depends(admin_access)):
    p=(admin.id,category,category,unread_only); w="where admin_user_id=%s and (%s::text is null or category=%s) and (%s=false or read_at is null)"
    total=query("select count(*) total from admin_notifications "+w,p,user_id=admin.id)[0]["total"]
    rows=query("select admin_notification_id,category,title,context,entity_type,entity_id,target_path,read_at,created_at from admin_notifications "+w+
               " order by created_at desc limit %s offset %s",p+(page_size,(page-1)*page_size),user_id=admin.id)
    unread=query("select count(*) total from admin_notifications where admin_user_id=%s and read_at is null",(admin.id,),user_id=admin.id)[0]["total"]
    return {"notifications":rows,"total":total,"unread":unread,"page":page,"page_size":page_size}

@admin_router.patch("/notifications/{admin_notification_id}/read")
def notification_read(admin_notification_id:UUID,admin=Depends(admin_access)):
    rows=query("update admin_notifications set read_at=coalesce(read_at,now()) where admin_notification_id=%s and admin_user_id=%s "
               "returning admin_notification_id,read_at",(str(admin_notification_id),admin.id),user_id=admin.id)
    if not rows: raise HTTPException(404,"Notifikasi tidak ditemukan")
    return {"notification":rows[0]}

@admin_router.post("/notifications/mark-all-read")
def notifications_read(admin=Depends(admin_access)):
    rows=query("update admin_notifications set read_at=now() where admin_user_id=%s and read_at is null returning admin_notification_id",(admin.id,),user_id=admin.id)
    return {"updated":len(rows)}

@student_router.get("/slots")
def open_slots(counselor_id:UUID,date_from:date,date_to:date,user=Depends(get_current_user)):
    """Free sessions of one counselor, for the mobile calendar. Only start/end pairs: never
    who holds a taken slot. counseling_open_slots() applies the same rules as assign."""
    if date_from>date_to or (date_to-date_from).days>62: raise HTTPException(422,"Rentang tanggal tidak valid atau melebihi 62 hari")
    rows=query("select starts_at,ends_at from counseling_open_slots(%s,%s,%s,%s)",(str(counselor_id),date_from,date_to,SESSION_MINUTES),user_id=user.id)
    return {"slots":rows,"session_minutes":SESSION_MINUTES}

@student_router.get("/requests")
def own_requests(student=Depends(get_current_user)):
    """The student's own requests, each with the slot they picked and, once an admin has
    assigned it, the appointment actually booked (which may differ from the pick)."""
    rows=query("select cr.counseling_request_id,cr.status,cr.preferred_context,cr.created_at,"
               "cr.preferred_counselor_id,cr.preferred_starts_at,cr.preferred_ends_at,pk.name preferred_counselor_name,"
               "a.counseling_appointment_id,a.counselor_id,ak.name counselor_name,a.starts_at,a.ends_at,a.status appointment_status "
               "from counseling_requests cr left join counseling_appointments a on a.counseling_request_id=cr.counseling_request_id "
               # users RLS hides counselor rows from a student; list_konselor() exposes just their names.
               "left join list_konselor() pk on pk.user_id=cr.preferred_counselor_id left join list_konselor() ak on ak.user_id=a.counselor_id "
               "where cr.student_id=%s order by cr.created_at desc limit 20",(student.id,),user_id=student.id)
    return {"requests":rows,"total":len(rows)}

@student_router.post("/requests",status_code=201)
def request_create(b:RequestBody,student=Depends(get_current_user)):
    slot=(b.preferred_counselor_id,b.preferred_starts_at,b.preferred_ends_at)
    if any(v is not None for v in slot) and not all(v is not None for v in slot): raise HTTPException(422,"Pilih konselor dan waktu sekaligus, atau kosongkan keduanya")
    counselor=start=end=None
    with db(student.id) as conn:
        role=conn.execute("select role from users where user_id=%s",(student.id,)).fetchone()
        if not role or role["role"]!="mahasiswa": raise HTTPException(403,"Hanya mahasiswa yang dapat mengirim permintaan konseling")
        if b.preferred_counselor_id:
            counselor,start,end=str(b.preferred_counselor_id),utc(b.preferred_starts_at),utc(b.preferred_ends_at)
            # The lock assign takes for this counselor: two students cannot both claim one slot,
            # and an admin assignment cannot land on it between this check and the insert.
            conn.execute("select pg_advisory_xact_lock(hashtext(%s))",("appointment:"+counselor,))
            # Only a slot the calendar would offer right now; a crafted body cannot pick an
            # arbitrary time. The ±1 day margin covers a session whose local date differs from UTC's.
            if not conn.execute("select 1 from counseling_open_slots(%s,%s,%s,%s) where starts_at=%s and ends_at=%s",
                                (counselor,(start-timedelta(days=1)).date(),(start+timedelta(days=1)).date(),SESSION_MINUTES,start,end)).fetchone():
                raise HTTPException(409,"Waktu itu sudah tidak tersedia. Pilih waktu lain.")
        row=conn.execute("insert into counseling_requests(student_id,preferred_context,preferred_counselor_id,preferred_starts_at,preferred_ends_at) values(%s,%s,%s,%s,%s) "
                         "returning counseling_request_id,student_id,status,preferred_context,preferred_counselor_id,preferred_starts_at,preferred_ends_at,created_at",
                         (student.id,clean(b.preferred_context),counselor,start,end)).fetchone()
    return {"request":row}

@admin_router.get("/counseling/requests")
def requests(state:Optional[str]=Query(None,alias="status"),page:int=Query(1,ge=1),page_size:int=Query(30,ge=1,le=100),admin=Depends(admin_access)):
    p=(state,state); src=("from counseling_requests cr join users u on u.user_id=cr.student_id left join student_academic_profiles sap on sap.user_id=u.user_id "
       "left join faculties f on f.faculty_id=sap.faculty_id left join academic_units au on au.academic_unit_id=sap.academic_unit_id "
       "left join users pc on pc.user_id=cr.preferred_counselor_id where (%s::text is null or cr.status=%s)")
    total=query("select count(*) total "+src,p,user_id=admin.id)[0]["total"]
    rows=query("select cr.counseling_request_id,cr.student_id,cr.status,cr.preferred_context,cr.created_at,u.name,u.nim,"
               "cr.preferred_counselor_id,pc.name preferred_counselor_name,cr.preferred_starts_at,cr.preferred_ends_at,"
               "f.name faculty_name,au.name academic_unit_name "+src+" order by cr.created_at desc limit %s offset %s",
               p+(page_size,(page-1)*page_size),user_id=admin.id)
    return {"requests":rows,"total":total,"page":page,"page_size":page_size}

def validate_slot(conn,student,counselor,start_value,end_value,exclude=None,resource=None):
    start,end=utc(start_value),utc(end_value)
    if end<=start: raise HTTPException(422,"Waktu selesai harus setelah waktu mulai")
    if start<=datetime.now(timezone.utc): raise HTTPException(422,"Janji temu tidak boleh pada waktu lampau")
    if not conn.execute("select u.user_id from users u left join counselor_profiles cp on cp.user_id=u.user_id "
                        "where u.user_id=%s and u.role='konselor' and coalesce(cp.active,true)",(counselor,)).fetchone():
        raise HTTPException(422,"Konselor tidak aktif atau tidak ditemukan")
    if conn.execute("select 1 from counselor_blocked_periods where counselor_id=%s and tstzrange(starts_at,ends_at,'[)') && tstzrange(%s,%s,'[)') limit 1",(counselor,start,end)).fetchone():
        raise HTTPException(409,"Waktu konselor sedang diblokir")
    if not conn.execute("select 1 from counselor_availability_rules where counselor_id=%s and active "
                        "and day_of_week=extract(dow from %s::timestamptz at time zone timezone)::int "
                        "and (%s::timestamptz at time zone timezone)::time>=start_time and (%s::timestamptz at time zone timezone)::time<=end_time "
                        "and (%s::timestamptz at time zone timezone)::date between coalesce(effective_from,'-infinity'::date) and coalesce(effective_to,'infinity'::date) limit 1",
                        (counselor,start,start,end,start)).fetchone(): raise HTTPException(409,"Waktu di luar ketersediaan konselor")
    if conn.execute("select 1 from counseling_appointments where status in ('confirmed','rescheduled') and (counselor_id=%s or student_id=%s) "
                    "and (%s::uuid is null or counseling_appointment_id<>%s::uuid) and tstzrange(starts_at,ends_at,'[)') && tstzrange(%s,%s,'[)') limit 1",
                    (counselor,student,exclude,exclude,start,end)).fetchone(): raise HTTPException(409,"Jadwal bertumpang tindih")
    if resource:
        conn.execute("select pg_advisory_xact_lock(hashtext(%s))",("resource:"+resource,))
        item=conn.execute("select capacity from counseling_resources where counseling_resource_id=%s and active",(resource,)).fetchone()
        if not item: raise HTTPException(422,"Resource tidak aktif atau tidak ditemukan")
        if conn.execute("select 1 from counseling_resource_blocks where counseling_resource_id=%s and tstzrange(starts_at,ends_at,'[)') && tstzrange(%s,%s,'[)') limit 1",(resource,start,end)).fetchone(): raise HTTPException(409,"Resource sedang diblokir")
        used=conn.execute("select count(*) total from counseling_appointments where counseling_resource_id=%s and status in ('confirmed','rescheduled') and (%s::uuid is null or counseling_appointment_id<>%s::uuid) and tstzrange(starts_at,ends_at,'[)') && tstzrange(%s,%s,'[)')",(resource,exclude,exclude,start,end)).fetchone()["total"]
        if used>=item["capacity"]: raise HTTPException(409,"Kapasitas resource sudah penuh")
    return start,end

@admin_router.post("/counseling/requests/{request_id}/assign",status_code=201)
def assign(request_id:UUID,b:AppointmentBody,admin=Depends(admin_access)):
    try:
        with db(admin.id) as conn:
            req=conn.execute("select student_id,status from counseling_requests where counseling_request_id=%s for update",(str(request_id),)).fetchone()
            if not req: raise HTTPException(404,"Permintaan konseling tidak ditemukan")
            if req["status"] in ("completed","cancelled","no_show"): raise HTTPException(409,"Permintaan sudah ditutup")
            student,counselor=str(req["student_id"]),str(b.counselor_id)
            for key in sorted((student,counselor)): conn.execute("select pg_advisory_xact_lock(hashtext(%s))",("appointment:"+key,))
            resource=str(b.counseling_resource_id) if b.counseling_resource_id else None
            start,end=validate_slot(conn,student,counselor,b.starts_at,b.ends_at,resource=resource)
            row=conn.execute("insert into counseling_appointments(counseling_request_id,student_id,counselor_id,starts_at,ends_at,created_by,counseling_resource_id) "
                             "values(%s,%s,%s,%s,%s,%s,%s) returning counseling_appointment_id,counseling_request_id,student_id,counselor_id,starts_at,ends_at,status,counseling_resource_id",
                             (str(request_id),student,counselor,start,end,admin.id,resource)).fetchone()
            conn.execute("update counseling_requests set status='confirmed' where counseling_request_id=%s",(str(request_id),))
    except ExclusionViolation: raise HTTPException(409,"Jadwal bertumpang tindih dengan janji aktif")
    return {"appointment":row}

@admin_router.get("/counseling/calendar")
def calendar(date_from:date,date_to:date,counselor_id:Optional[UUID]=None,state:Optional[str]=Query(None,alias="status"),admin=Depends(admin_access)):
    if date_from>date_to or (date_to-date_from).days>93: raise HTTPException(422,"Rentang kalender tidak valid")
    cid=str(counselor_id) if counselor_id else None
    rows=query("select a.counseling_appointment_id,a.counseling_request_id,a.student_id,s.name student_name,s.nim,f.name faculty_name,au.name academic_unit_name,"
               "cr.preferred_context request_origin,a.counselor_id,c.name counselor_name,a.starts_at,a.ends_at,a.status,"
               "coalesce((select jsonb_agg(jsonb_build_object('appointment_event_id',e.appointment_event_id,'event_type',e.event_type,'created_at',e.created_at) order by e.created_at desc) from counseling_appointment_events e where e.counseling_appointment_id=a.counseling_appointment_id),'[]'::jsonb) history,"
               "coalesce((select jsonb_agg(jsonb_build_object('counseling_admin_note_id',n.counseling_admin_note_id,'note_text',n.note_text,'created_at',n.created_at,'author_name',author.name) order by n.created_at desc) from counseling_admin_notes n join users author on author.user_id=n.author_user_id where n.counseling_appointment_id=a.counseling_appointment_id),'[]'::jsonb) admin_notes "
               "from counseling_appointments a join users s on s.user_id=a.student_id join users c on c.user_id=a.counselor_id "
               "left join counseling_requests cr on cr.counseling_request_id=a.counseling_request_id left join student_academic_profiles sap on sap.user_id=a.student_id "
               "left join faculties f on f.faculty_id=sap.faculty_id left join academic_units au on au.academic_unit_id=sap.academic_unit_id "
               "where a.starts_at>=%s::date and a.starts_at<%s::date+interval '1 day' and (%s::uuid is null or a.counselor_id=%s::uuid) "
               "and (%s::text is null or a.status=%s) order by a.starts_at",(date_from,date_to,cid,cid,state,state),user_id=admin.id)
    blocks=query("select b.counselor_blocked_period_id,b.counselor_id,c.name counselor_name,b.starts_at,b.ends_at,b.reason "
                 "from counselor_blocked_periods b join users c on c.user_id=b.counselor_id "
                 "where b.starts_at<%s::date+interval '1 day' and b.ends_at>%s::date and (%s::uuid is null or b.counselor_id=%s::uuid) order by b.starts_at",
                 (date_to,date_from,cid,cid),user_id=admin.id)
    return {"appointments":rows,"blocked_periods":blocks}

@admin_router.get("/counselors")
def counselors(admin=Depends(admin_access)):
    rows=query("select u.user_id,u.name,u.email,cp.title,cp.specialization,coalesce(cp.active,true) active from users u "
               "left join counselor_profiles cp on cp.user_id=u.user_id where u.role='konselor' order by u.name",user_id=admin.id)
    return {"counselors":rows,"total":len(rows)}

@admin_router.put("/counselors/{counselor_id}/profile")
def counselor_update(counselor_id:UUID,b:CounselorBody,admin=Depends(admin_access)):
    if not b.active and query("select 1 from counseling_appointments where counselor_id=%s and status in ('confirmed','rescheduled') and starts_at>now() limit 1",(str(counselor_id),),user_id=admin.id):
        raise HTTPException(409,"Konselor masih memiliki janji aktif di masa mendatang")
    rows=query("insert into counselor_profiles(user_id,title,specialization,active) select user_id,%s,%s,%s from users where user_id=%s and role='konselor' "
               "on conflict(user_id) do update set title=excluded.title,specialization=excluded.specialization,active=excluded.active returning user_id,title,specialization,active",
               (clean(b.title),clean(b.specialization),b.active,str(counselor_id)),user_id=admin.id)
    if not rows: raise HTTPException(404,"Konselor tidak ditemukan")
    return {"counselor":rows[0]}

@admin_router.get("/counseling/availability")
def availability(counselor_id:Optional[UUID]=None,admin=Depends(admin_access)):
    cid=str(counselor_id) if counselor_id else None
    rows=query("select counselor_availability_rule_id,counselor_id,day_of_week,start_time,end_time,timezone,effective_from,effective_to,active "
               "from counselor_availability_rules where (%s::uuid is null or counselor_id=%s::uuid) order by counselor_id,day_of_week,start_time",
               (cid,cid),user_id=admin.id)
    return {"availability":rows,"total":len(rows)}

@admin_router.post("/counseling/availability",status_code=201)
def availability_create(b:AvailabilityBody,admin=Depends(admin_access)):
    if b.end_time<=b.start_time: raise HTTPException(422,"Jam selesai harus setelah jam mulai")
    if not query("select 1 from users where user_id=%s and role='konselor'",(str(b.counselor_id),),user_id=admin.id):
        raise HTTPException(422,"Konselor tidak ditemukan")
    if query("select 1 from counselor_availability_rules where counselor_id=%s and active and day_of_week=%s "
             "and start_time < %s and end_time > %s limit 1",
             (str(b.counselor_id),b.day_of_week,b.start_time,b.end_time),user_id=admin.id): raise HTTPException(409,"Ketersediaan bertumpang tindih")
    try:
        row=query("insert into counselor_availability_rules(counselor_id,day_of_week,start_time,end_time,timezone,effective_from,effective_to,active) "
              "values(%s,%s,%s,%s,%s,%s,%s,%s) returning counselor_availability_rule_id,counselor_id,day_of_week,start_time,end_time,timezone,effective_from,effective_to,active",
              (str(b.counselor_id),b.day_of_week,b.start_time,b.end_time,b.timezone,b.effective_from,b.effective_to,b.active),user_id=admin.id)[0]
    except ExclusionViolation: raise HTTPException(409,"Ketersediaan bertumpang tindih")
    return {"availability":row}

@admin_router.post("/counseling/blocked-periods",status_code=201)
def block_create(b:BlockBody,admin=Depends(admin_access)):
    start,end=utc(b.starts_at),utc(b.ends_at)
    if end<=start: raise HTTPException(422,"Waktu selesai harus setelah waktu mulai")
    with db(admin.id) as conn:
        counselor=str(b.counselor_id)
        if not conn.execute("select 1 from users where user_id=%s and role='konselor'",(counselor,)).fetchone():
            raise HTTPException(422,"Konselor tidak ditemukan")
        conn.execute("select pg_advisory_xact_lock(hashtext(%s))",("appointment:"+counselor,))
        if conn.execute("select 1 from counseling_appointments where counselor_id=%s and status in ('confirmed','rescheduled') "
                        "and tstzrange(starts_at,ends_at,'[)') && tstzrange(%s,%s,'[)') limit 1",
                        (counselor,start,end)).fetchone():
            raise HTTPException(409,"Waktu memiliki janji temu aktif")
        row=conn.execute("insert into counselor_blocked_periods(counselor_id,starts_at,ends_at,reason,created_by) values(%s,%s,%s,%s,%s) "
                         "returning counselor_blocked_period_id,counselor_id,starts_at,ends_at,reason",
                         (counselor,start,end,clean(b.reason),admin.id)).fetchone()
    return {"blocked_period":row}

@admin_router.post("/counseling/notes",status_code=201)
def note_create(b:NoteBody,admin=Depends(admin_access)):
    if (b.counseling_request_id is None)==(b.counseling_appointment_id is None): raise HTTPException(422,"Pilih tepat satu permintaan atau janji temu")
    row=query("insert into counseling_admin_notes(counseling_request_id,counseling_appointment_id,author_user_id,note_text) values(%s,%s,%s,%s) "
              "returning counseling_admin_note_id,counseling_request_id,counseling_appointment_id,author_user_id,note_text,created_at",
              (str(b.counseling_request_id) if b.counseling_request_id else None,str(b.counseling_appointment_id) if b.counseling_appointment_id else None,admin.id,b.note_text.strip()),user_id=admin.id)[0]
    return {"note":row}

@admin_router.post("/reports/audits",status_code=201)
def audit_create(b:AuditBody,admin=Depends(admin_access)):
    if b.date_from>b.date_to: raise HTTPException(422,"Tanggal awal harus sebelum tanggal akhir")
    scope={"faculty_ids":[str(value) for value in b.faculty_ids],"academic_unit_ids":[str(value) for value in b.academic_unit_ids]}
    row=query("insert into report_export_audits(admin_user_id,report_mode,faculty_id,academic_unit_id,date_from,date_to,scope) values(%s,%s,%s,%s,%s,%s,%s) "
              "returning report_export_audit_id,admin_user_id,report_mode,faculty_id,academic_unit_id,date_from,date_to,scope,exported_at",
              (admin.id,b.report_mode,str(b.faculty_id) if b.faculty_id else None,str(b.academic_unit_id) if b.academic_unit_id else None,b.date_from,b.date_to,Jsonb(scope)),user_id=admin.id)[0]
    return {"audit":row}


@admin_router.patch("/counseling/appointments/{counseling_appointment_id}")
def appointment_update(counseling_appointment_id:UUID,b:AppointmentPatch,admin=Depends(admin_access)):
    try:
        with db(admin.id) as conn:
            old=conn.execute("select * from counseling_appointments where counseling_appointment_id=%s for update",(str(counseling_appointment_id),)).fetchone()
            if not old: raise HTTPException(404,"Janji temu tidak ditemukan")
            counselor=str(b.counselor_id or old["counselor_id"]); start=b.starts_at or old["starts_at"]; end=b.ends_at or old["ends_at"]
            resource=str(b.counseling_resource_id) if b.counseling_resource_id is not None else (str(old["counseling_resource_id"]) if old["counseling_resource_id"] else None)
            moved=b.counselor_id is not None or b.starts_at is not None or b.ends_at is not None or b.counseling_resource_id is not None
            next_state=b.status or ("rescheduled" if moved else old["status"])
            if moved:
                for key in sorted((str(old["student_id"]),counselor)): conn.execute("select pg_advisory_xact_lock(hashtext(%s))",("appointment:"+key,))
                start,end=validate_slot(conn,str(old["student_id"]),counselor,start,end,str(counseling_appointment_id),resource)
            row=conn.execute("update counseling_appointments set counselor_id=%s,starts_at=%s,ends_at=%s,status=%s,counseling_resource_id=%s where counseling_appointment_id=%s "
                             "returning counseling_appointment_id,counseling_request_id,student_id,counselor_id,starts_at,ends_at,status,counseling_resource_id",
                             (counselor,utc(start),utc(end),next_state,resource,str(counseling_appointment_id))).fetchone()
            conn.execute("insert into counseling_appointment_events(counseling_appointment_id,event_type,actor_user_id) values(%s,%s,%s)",
                         (str(counseling_appointment_id),"rescheduled" if moved else next_state,admin.id))
            conn.execute("update counseling_requests set status=%s where counseling_request_id=%s",(next_state,old["counseling_request_id"]))
    except ExclusionViolation: raise HTTPException(409,"Jadwal bertumpang tindih dengan janji aktif")
    return {"appointment":row}

@admin_router.delete("/counseling/availability/{rule_id}")
def availability_deactivate(rule_id:UUID,admin=Depends(admin_access)):
    rows=query("update counselor_availability_rules set active=false where counselor_availability_rule_id=%s returning counselor_availability_rule_id",(str(rule_id),),user_id=admin.id)
    if not rows: raise HTTPException(404,"Aturan ketersediaan tidak ditemukan")
    return {"message":"Aturan ketersediaan dinonaktifkan"}

@admin_router.delete("/counseling/blocked-periods/{block_id}")
def block_delete(block_id:UUID,admin=Depends(admin_access)):
    rows=query("delete from counselor_blocked_periods where counselor_blocked_period_id=%s returning counselor_blocked_period_id",(str(block_id),),user_id=admin.id)
    if not rows: raise HTTPException(404,"Waktu blokir tidak ditemukan")
    return {"message":"Waktu blokir dihapus"}


@admin_router.get("/students")
def students(search:str="",faculty_id:Optional[UUID]=None,academic_unit_id:Optional[UUID]=None,
             page:int=Query(1,ge=1),page_size:int=Query(30,ge=1,le=100),admin=Depends(admin_access)):
    fid=str(faculty_id) if faculty_id else None; uid=str(academic_unit_id) if academic_unit_id else None
    term="%"+search.replace("\\","\\\\").replace("%","\\%").replace("_","\\_")+"%"
    p=(search,term,term,fid,fid,uid,uid)
    src=("from users u left join student_academic_profiles sap on sap.user_id=u.user_id "
         "left join faculties f on f.faculty_id=sap.faculty_id left join academic_units au on au.academic_unit_id=sap.academic_unit_id "
         "where u.role='mahasiswa' and (%s='' or u.name ilike %s or u.nim ilike %s) "
         "and (%s::uuid is null or sap.faculty_id=%s::uuid) and (%s::uuid is null or sap.academic_unit_id=%s::uuid)")
    total=query("select count(*) total "+src,p,user_id=admin.id)[0]["total"]
    rows=query("select u.user_id,u.name,u.email,u.nim,u.role,u.created_at,sap.faculty_id,f.name faculty_name,"
               "sap.academic_unit_id,au.name academic_unit_name,au.unit_type "+src+
               " order by u.created_at desc limit %s offset %s",p+(page_size,(page-1)*page_size),user_id=admin.id)
    return {"students":rows,"total":total,"page":page,"page_size":page_size}

@admin_router.get("/analytics/scoped")
def scoped_analytics(date_from:date,date_to:date,faculty_id:List[UUID]=Query(default=[]),academic_unit_id:List[UUID]=Query(default=[]),admin=Depends(admin_access)):
    if date_from>date_to: raise HTTPException(422,"Tanggal awal harus sebelum tanggal akhir")
    fid=[str(value) for value in dict.fromkeys(faculty_id)] or None; uid=[str(value) for value in dict.fromkeys(academic_unit_id)] or None
    p=(date_from,date_to,fid,fid,uid,uid)
    src=("from assessments a left join student_academic_profiles sap on sap.user_id=a.user_id "
         "where a.taken_at>=%s::date and a.taken_at<%s::date+interval '1 day' "
         "and (%s::uuid[] is null or sap.faculty_id=any(%s::uuid[])) and (%s::uuid[] is null or sap.academic_unit_id=any(%s::uuid[]))")
    severity=query("select a.severity,count(*) count "+src+" group by a.severity",p,user_id=admin.id)
    trend=query("select a.taken_at::date date,count(*) count "+src+" group by 1 order by 1",p,user_id=admin.id)
    student_count=query("select count(*) count from users u left join student_academic_profiles sap on sap.user_id=u.user_id "
                         "where u.role='mahasiswa' and (%s::uuid[] is null or sap.faculty_id=any(%s::uuid[])) "
                         "and (%s::uuid[] is null or sap.academic_unit_id=any(%s::uuid[]))",(fid,fid,uid,uid),user_id=admin.id)[0]["count"]
    bookings=query("select b.status,count(*) count from counseling_bookings b join counseling_slots j on j.counseling_slot_id=b.counseling_slot_id "
                   "left join student_academic_profiles sap on sap.user_id=b.student_id where j.date>=%s::date and j.date<=%s::date "
                   "and (%s::uuid[] is null or sap.faculty_id=any(%s::uuid[])) and (%s::uuid[] is null or sap.academic_unit_id=any(%s::uuid[])) group by b.status",
                   p,user_id=admin.id)
    academic=query("select f.name faculty_name,au.name academic_unit_name,count(*) assessment_count,"
                   "count(*) filter(where a.severity in ('moderate','severe')) attention_count "
                   "from assessments a left join student_academic_profiles sap on sap.user_id=a.user_id "
                   "join faculties f on f.faculty_id=sap.faculty_id left join academic_units au on au.academic_unit_id=sap.academic_unit_id "
                   "where a.taken_at>=%s::date and a.taken_at<%s::date+interval '1 day' "
                    "and (%s::uuid[] is null or sap.faculty_id=any(%s::uuid[])) and (%s::uuid[] is null or sap.academic_unit_id=any(%s::uuid[])) "
                   "group by f.name,au.name order by assessment_count desc",p,user_id=admin.id)
    return {"date_from":date_from,"date_to":date_to,"registered_students":student_count,
            "assessment_total":sum(x["count"] for x in severity),"severity_distribution":severity,
            "assessment_trend":trend,"academic_breakdown":academic,
            "booking_total":sum(x["count"] for x in bookings),"booking_status":bookings}

@admin_router.get("/reports/data")
def report_data(date_from:date,date_to:date,mode:Literal["aggregate","confidential"]="aggregate",
                 faculty_id:List[UUID]=Query(default=[]),academic_unit_id:List[UUID]=Query(default=[]),admin=Depends(admin_access)):
    aggregate=scoped_analytics(date_from,date_to,faculty_id,academic_unit_id,admin)
    aggregate["mode"]=mode; aggregate["attention_students"]=[]
    if mode=="confidential":
        fid=[str(value) for value in dict.fromkeys(faculty_id)] or None; uid=[str(value) for value in dict.fromkeys(academic_unit_id)] or None
        aggregate["attention_students"]=query(
            "select u.name,u.nim,f.name faculty_name,au.name academic_unit_name,('Asesmen: '||a.severity) signal_type,a.taken_at signal_date "
            "from assessments a join users u on u.user_id=a.user_id left join student_academic_profiles sap on sap.user_id=u.user_id "
            "left join faculties f on f.faculty_id=sap.faculty_id left join academic_units au on au.academic_unit_id=sap.academic_unit_id "
            "where a.severity in ('moderate','severe') and a.taken_at>=%s::date and a.taken_at<%s::date+interval '1 day' "
            "and (%s::uuid[] is null or sap.faculty_id=any(%s::uuid[])) and (%s::uuid[] is null or sap.academic_unit_id=any(%s::uuid[])) order by a.taken_at desc",
            (date_from,date_to,fid,fid,uid,uid),user_id=admin.id)
        aggregate["attention_students"] += query(
            "select u.name,u.nim,f.name faculty_name,au.name academic_unit_name,'Safety Guardrail' signal_type,g.notified_at signal_date "
            "from guardrail_logs g join users u on u.user_id=g.user_id left join student_academic_profiles sap on sap.user_id=u.user_id "
            "left join faculties f on f.faculty_id=sap.faculty_id left join academic_units au on au.academic_unit_id=sap.academic_unit_id "
            "where g.source='chat' and g.assessment_id is null and g.notified_at>=%s::date and g.notified_at<%s::date+interval '1 day' "
            "and (%s::uuid[] is null or sap.faculty_id=any(%s::uuid[])) and (%s::uuid[] is null or sap.academic_unit_id=any(%s::uuid[])) order by g.notified_at desc",
            (date_from,date_to,fid,fid,uid,uid),user_id=admin.id)
    return aggregate





@student_router.get("/appointments")
def own_appointments(student=Depends(get_current_user)):
    rows=query("select counseling_appointment_id,counseling_request_id,counselor_id,starts_at,ends_at,status "
               "from counseling_appointments where student_id=%s order by starts_at desc",
               (student.id,),user_id=student.id)
    return {"appointments":rows,"total":len(rows)}
