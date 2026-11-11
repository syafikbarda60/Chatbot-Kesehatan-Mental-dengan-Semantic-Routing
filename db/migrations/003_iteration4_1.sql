-- Iteration 4.1: additive provenance, standard/custom identity, and the canonical
-- owner-provided Indonesian DASS-21 Source A definition.
begin;
select pg_advisory_xact_lock(hashtext('sajiwa_schema_migrations'));

alter table assessment_instruments
  add column if not exists language varchar(40),
  add column if not exists instrument_kind varchar(20) not null default 'custom',
  add column if not exists derived_from_instrument_id uuid references assessment_instruments(instrument_id) on delete restrict,
  add column if not exists norms_enabled boolean not null default false,
  add column if not exists provenance jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='assessment_instruments_kind_check') then
    alter table assessment_instruments add constraint assessment_instruments_kind_check
      check (instrument_kind in ('standard','custom'));
  end if;
end $$;

update assessment_instruments
set name='DASS-21 Bahasa Indonesia',
    language='Bahasa Indonesia',
    instrument_kind='standard',
    norms_enabled=true,
    description='Depression Anxiety Stress Scales — 21 item, Bahasa Indonesia',
    provenance=jsonb_build_object(
      'source_adaptation','project-supplied Indonesian DASS-21 version',
      'original_reference','Lovibond, S. H. & Lovibond, P. F. (1995), Manual for the Depression Anxiety Stress Scales, 2nd Ed.',
      'indonesian_reference','Muttaqin, D. & Ripa, S. (2021)',
      'supporting_psychometric_reference','Hakim & Aristawati (2023), Measuring Depression, Anxiety, and Stress in Early Adults in Indonesia: Construct Validity and Reliability Test of DASS-21',
      'canonical_source_file','Depression Anxiety Stress Scales versi Indonesia (1).docx',
      'wording_status','verified owner-provided Source A',
      'wording_sha256','f75551c120d96236564bb704263a3eed3e647eb8a41a6a8cface95920419e7b2'
    ),
    updated_at=now()
where lower(code)='dass-21';

update assessment_instrument_versions v
set expected_question_count=21,
    authoritative_config=false,
    scoring_config=jsonb_build_object(
      'model','DASS-21',
      'response_scores',jsonb_build_array(0,1,2,3),
      'standardization_multiplier',2,
      'category_items',jsonb_build_object(
        'depression',jsonb_build_array(3,5,10,13,16,17,21),
        'anxiety',jsonb_build_array(2,4,7,9,15,19,20),
        'stress',jsonb_build_array(1,6,8,11,12,14,18)
      ),
      'severity_bands',jsonb_build_object(
        'depression',jsonb_build_array(
          jsonb_build_object('label','normal','min',0,'max',9),
          jsonb_build_object('label','mild','min',10,'max',13),
          jsonb_build_object('label','moderate','min',14,'max',20),
          jsonb_build_object('label','severe','min',21,'max',27),
          jsonb_build_object('label','extremely_severe','min',28,'max',42)
        ),
        'anxiety',jsonb_build_array(
          jsonb_build_object('label','normal','min',0,'max',7),
          jsonb_build_object('label','mild','min',8,'max',9),
          jsonb_build_object('label','moderate','min',10,'max',14),
          jsonb_build_object('label','severe','min',15,'max',19),
          jsonb_build_object('label','extremely_severe','min',20,'max',42)
        ),
        'stress',jsonb_build_array(
          jsonb_build_object('label','normal','min',0,'max',14),
          jsonb_build_object('label','mild','min',15,'max',18),
          jsonb_build_object('label','moderate','min',19,'max',25),
          jsonb_build_object('label','severe','min',26,'max',33),
          jsonb_build_object('label','extremely_severe','min',34,'max',42)
        )
      ),
      'interpretation','Dimensional symptom severity categories; not a diagnosis',
      'wording_status','verified_owner_provided_source_a',
      'wording_sha256','f75551c120d96236564bb704263a3eed3e647eb8a41a6a8cface95920419e7b2'
    ),
    updated_at=now()
from assessment_instruments i
where v.instrument_id=i.instrument_id and lower(i.code)='dass-21' and v.status='draft';

do $$
declare
  canonical_version_id uuid;
  existing_count integer;
begin
  select v.instrument_version_id into canonical_version_id
  from assessment_instrument_versions v
  join assessment_instruments i on i.instrument_id=v.instrument_id
  where lower(i.code)='dass-21' and i.instrument_kind='standard' and v.status='draft'
  order by v.version_number limit 1 for update of v;
  if canonical_version_id is null then
    raise exception 'Canonical DASS-21 standard draft was not found';
  end if;
  select count(*) into existing_count from assessment_questions where instrument_version_id=canonical_version_id;
  if existing_count<>0 then
    raise exception 'Canonical DASS-21 draft is not empty; refusing to overwrite existing content';
  end if;

  -- Source A wording SHA-256 (trimmed items joined by LF):
  -- f75551c120d96236564bb704263a3eed3e647eb8a41a6a8cface95920419e7b2
  insert into assessment_questions(instrument_version_id,item_key,position,category,wording,active)
  select canonical_version_id,item_key,position,category,wording,true from (values
    ('DASS21-01',1,'stress','Saya merasa sulit untuk beristirahat'),
    ('DASS21-02',2,'anxiety','Saya merasa bibir saya sering kering'),
    ('DASS21-03',3,'depression','Saya sama sekali tidak dapat merasakan perasaan positif'),
    ('DASS21-04',4,'anxiety','Saya mengalami kesulitan bernafas (misalnya: seringkali terengah-engah atau tidak dapat bernafas padahal tidak melakukan aktivitas fisik sebelumnya)'),
    ('DASS21-05',5,'depression','Saya merasa sulit untuk meningkatkan inisiatif dalam melakukan sesuatu'),
    ('DASS21-06',6,'stress','Saya cenderung bereaksi berlebihan terhadap suatu situasi'),
    ('DASS21-07',7,'anxiety','Saya merasa gemetar (misalnya: pada tangan)'),
    ('DASS21-08',8,'stress','Saya merasa telah menghabiskan banyak energi untuk merasa cemas'),
    ('DASS21-09',9,'anxiety','Saya merasa khawatir dengan situasi dimana saya mungkin menjadi panik dan mempermalukan diri sendiri'),
    ('DASS21-10',10,'depression','Saya merasa tidak ada hal yang dapat diharapkan di masa depan'),
    ('DASS21-11',11,'stress','Saya menemukan diri saya mudah gelisah'),
    ('DASS21-12',12,'stress','Saya merasa sulit untuk bersantai'),
    ('DASS21-13',13,'depression','Saya merasa putus asa dan sedih'),
    ('DASS21-14',14,'stress','Saya tidak dapat memaklumi hal apapun yang menghalangi saya untuk menyelesaikan hal yang sedang saya lakukan'),
    ('DASS21-15',15,'anxiety','Saya merasa saya hampir panik'),
    ('DASS21-16',16,'depression','Saya tidak merasa antusias dalam hal apapun'),
    ('DASS21-17',17,'depression','Saya merasa bahwa saya tidak berharga sebagai seorang manusia'),
    ('DASS21-18',18,'stress','Saya merasa bahwa saya mudah tersinggung'),
    ('DASS21-19',19,'anxiety','Saya menyadari kegiatan jantung, walaupun saya tidak sehabis melakukan aktivitas fisik (misalnya: merasa detak jantung meningkat atau melemah)'),
    ('DASS21-20',20,'anxiety','Saya merasa takut tanpa alasan yang jelas'),
    ('DASS21-21',21,'depression','Saya merasa bahwa hidup tidak berarti')
  ) source(item_key,position,category,wording);

  insert into assessment_answer_options(assessment_question_id,position,label,score)
  select q.assessment_question_id,o.position,o.label,o.score
  from assessment_questions q cross join (values
    (0,'Tidak sesuai sama sekali, atau tidak pernah',0),
    (1,'Sesuai sampai tingkat tertentu, atau kadang-kadang',1),
    (2,'Sesuai sampai batas yang dapat dipertimbangkan, atau lumayan sering',2),
    (3,'Sangat sesuai, atau sering sekali',3)
  ) o(position,label,score)
  where q.instrument_version_id=canonical_version_id;

  if (select count(*) from assessment_questions where instrument_version_id=canonical_version_id and active)<>21
    or (select count(distinct position) from assessment_questions where instrument_version_id=canonical_version_id and active)<>21
    or (select count(*) from assessment_questions where instrument_version_id=canonical_version_id and category='depression')<>7
    or (select count(*) from assessment_questions where instrument_version_id=canonical_version_id and category='anxiety')<>7
    or (select count(*) from assessment_questions where instrument_version_id=canonical_version_id and category='stress')<>7
    or exists (
      select 1 from assessment_questions q where q.instrument_version_id=canonical_version_id
      and ((q.category='depression' and q.position<>all(array[3,5,10,13,16,17,21]))
        or (q.category='anxiety' and q.position<>all(array[2,4,7,9,15,19,20]))
        or (q.category='stress' and q.position<>all(array[1,6,8,11,12,14,18])))
    )
    or exists (
      select 1 from assessment_questions q where q.instrument_version_id=canonical_version_id
      and (select array_agg(o.score order by o.score) from assessment_answer_options o where o.assessment_question_id=q.assessment_question_id)<>array[0,1,2,3]
    ) then
    raise exception 'Canonical DASS-21 Source A validation failed';
  end if;

  update assessment_instrument_versions
  set authoritative_config=true,updated_at=now()
  where instrument_version_id=canonical_version_id;
end $$;

-- One concise admin notification per elevated DASS submission. This function
-- never reads or includes individual answers, question wording, or guardrail text.
create or replace function notify_dass21_admins(target_assessment_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare
  owner_id uuid;
  elevated_summary text;
begin
  select a.user_id into owner_id from assessments a
  where a.assessment_id=target_assessment_id and a.instrument_version_id is not null;
  if owner_id is null or owner_id<>app_user_id() then
    raise exception 'Assessment ownership check failed';
  end if;
  select string_agg(initcap(replace(r.category,'_',' ')) || ': ' || initcap(replace(r.severity,'_',' ')), ', ' order by r.category)
  into elevated_summary
  from assessment_category_results r
  where r.assessment_id=target_assessment_id
    and r.severity in ('moderate','severe','extremely_severe');
  if elevated_summary is null then return; end if;
  insert into admin_notifications(admin_user_id,category,title,context,entity_type,entity_id,target_path,dedupe_key)
  select u.user_id,'assessment','Hasil DASS-21 memerlukan perhatian',
    elevated_summary || '. Kategori gejala dimensional, bukan diagnosis.',
    'assessment',target_assessment_id,'/attention','dass21:'||target_assessment_id
  from users u where u.role='admin'
  on conflict(admin_user_id,dedupe_key) where dedupe_key is not null do nothing;
end;
$$;

grant execute on function notify_dass21_admins(uuid) to sajiwa_app;

insert into schema_migrations(version) values ('003_iteration4_1') on conflict(version) do nothing;
commit;
