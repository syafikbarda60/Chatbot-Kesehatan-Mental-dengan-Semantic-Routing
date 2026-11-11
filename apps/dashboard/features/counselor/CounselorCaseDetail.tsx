'use client';

import Link from 'next/link';
import {useCallback, useState} from 'react';
import {useLanguage} from '@/components/providers/LanguageProvider';
import {Badge, EmptyState, ErrorState, handleTabListKeyDown, InlineAlert, LoadingState, PageShell} from '@/components/ui';
import {counselorMessages} from '@/lib/i18n/counselorMessages';
import {getCounselorCase} from './api';
import {formatDateTime, riskTone, statusTone, timeRange} from './format';
import {useCounselorData} from './useCounselorData';

type Tab = 'overview' | 'assessment' | 'counseling';

export function CounselorCaseDetailPage({studentId}: {studentId: string}) {
  const {language} = useLanguage();
  const copy = counselorMessages[language];
  const [tab, setTab] = useState<Tab>('overview');
  const load = useCallback((signal: AbortSignal) => getCounselorCase(studentId, signal), [studentId]);
  const {data, error, retry} = useCounselorData(load);
  if (error) return <ErrorState title={copy.students.detail} message={copy.errors.load} retry={retry} retryLabel={copy.common.retry}/>;
  if (!data) return <LoadingState label={copy.common.loading} fullPage/>;

  const latestAssessment = data.assessments[0];
  const nextSession = data.sessions.find((session) => new Date(session.starts_at) >= new Date());
  const elevatedRisk = ['critical', 'high'].includes(data.case.risk);

  return <PageShell title={data.case.student_name} description={copy.students.detail} actions={<Link className="button button-secondary" href="/counselor/students">{copy.common.back}</Link>}>
    <section className="case-identity" aria-label={copy.students.information}>
      <div><span className="eyebrow">{copy.students.student}</span><p>{data.case.nim ?? '—'} · {data.case.faculty_name ?? '—'} · {data.case.academic_unit_name ?? '—'}</p></div>
      <div className="case-statuses"><Badge tone={riskTone(data.case.risk)}>{data.case.risk}</Badge><Badge tone={statusTone(data.case.follow_up_status)}>{data.case.follow_up_status.replace('_', ' ')}</Badge></div>
    </section>
    {elevatedRisk && <InlineAlert tone={data.case.risk === 'critical' ? 'danger' : 'warning'}><strong>{copy.students.risk}: {data.case.risk}</strong><br/>{data.case.assessment_summary ?? data.case.context}</InlineAlert>}
    <InlineAlert tone="info">{copy.students.privacy}</InlineAlert>
    <div className="detail-tabs" role="tablist" aria-label={copy.students.detail} onKeyDown={handleTabListKeyDown}>{(['overview', 'assessment', 'counseling'] as Tab[]).map((item) => <button key={item} role="tab" aria-selected={tab === item} tabIndex={tab === item ? 0 : -1} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>{copy.students.tabs[item]}</button>)}</div>

    {tab === 'overview' && <div className="case-overview">
      <section aria-labelledby="student-info-heading"><h2 id="student-info-heading">{copy.students.information}</h2><dl className="definition-grid"><div><dt>NIM</dt><dd>{data.case.nim ?? '—'}</dd></div><div><dt>{copy.students.faculty}</dt><dd>{data.case.faculty_name ?? '—'}<small>{data.case.academic_unit_name ?? '—'}</small></dd></div></dl></section>
      <section aria-labelledby="service-context-heading"><h2 id="service-context-heading">{copy.students.serviceContext}</h2><dl className="definition-grid"><div><dt>{copy.students.caseContext}</dt><dd>{data.case.context}</dd></div><div><dt>{copy.students.supportStatus}</dt><dd><Badge tone={statusTone(data.case.follow_up_status)}>{data.case.follow_up_status.replace('_', ' ')}</Badge></dd></div><div><dt>{copy.students.followUp}</dt><dd>{data.support_summary ?? copy.common.unavailable}</dd></div><div><dt>{copy.students.nextSession}</dt><dd>{nextSession ? formatDateTime(nextSession.starts_at, language) : '—'}</dd></div></dl></section>
      <section aria-labelledby="latest-assessment-heading"><h2 id="latest-assessment-heading">{copy.students.latestAssessment}</h2>{latestAssessment ? <div className="assessment-summary"><div><strong>{latestAssessment.instrument}</strong><span>{formatDateTime(latestAssessment.taken_at, language)}</span></div><Badge tone={riskTone(latestAssessment.severity)}>{latestAssessment.severity}</Badge><div className="dimension-summary">{latestAssessment.dimensions.map((dimension) => <span key={dimension.name}><b>{dimension.name}</b> {dimension.score ?? '—'} · {dimension.severity}</span>)}</div></div> : <p className="muted-copy">{copy.students.noAssessment}</p>}</section>
    </div>}

    {tab === 'assessment' && (data.assessments.length ? <section className="records-section" aria-labelledby="assessment-history-heading"><h2 id="assessment-history-heading">{copy.students.assessment}</h2>{data.assessments.map((assessment) => <article className="counselor-record" key={assessment.assessment_id}><header><div><strong>{assessment.instrument}</strong><time>{formatDateTime(assessment.taken_at, language)}</time></div><Badge tone={riskTone(assessment.severity)}>{assessment.severity}</Badge></header><div className="dimension-summary">{assessment.dimensions.map((dimension) => <span key={dimension.name}><b>{dimension.name}</b> {dimension.score ?? '—'} · {dimension.severity}</span>)}</div></article>)}</section> : <EmptyState title={copy.students.empty}/>)}

    {tab === 'counseling' && (data.sessions.length ? <section className="records-section" aria-labelledby="session-history-heading"><h2 id="session-history-heading">{copy.students.counseling}</h2><ol className="session-timeline">{data.sessions.map((session) => <li key={session.counseling_appointment_id}><time>{formatDateTime(session.starts_at, language)}</time><div><strong>{session.service_type}</strong><span>{timeRange(session.starts_at, session.ends_at, language)} · {session.resource_name ?? '—'}</span></div><Badge tone={statusTone(session.status)}>{session.status}</Badge></li>)}</ol></section> : <EmptyState title={copy.schedule.empty}/>)}
  </PageShell>;
}
