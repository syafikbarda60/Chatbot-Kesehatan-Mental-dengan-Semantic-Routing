'use client';

import Link from 'next/link';
import {useCallback} from 'react';
import {useAuth} from '@/components/auth/AuthProvider';
import {useLanguage} from '@/components/providers/LanguageProvider';
import {Badge, EmptyState, ErrorState, InlineAlert, LoadingState, PageShell} from '@/components/ui';
import {counselorMessages} from '@/lib/i18n/counselorMessages';
import {getCounselorCases, getCounselorWorkspace, getReviewQueue} from './api';
import {formatDateTime, jakartaDate, riskTone, statusTone, timeRange} from './format';
import {priorityScore, sortCases, sortReviews} from './model';
import {useCounselorData} from './useCounselorData';

export function CounselorDashboard() {
  const {language} = useLanguage();
  const copy = counselorMessages[language];
  const {user} = useAuth();
  const load = useCallback(async (signal: AbortSignal) => {
    const [cases, workspace, reviews] = await Promise.all([
      getCounselorCases(signal),
      getCounselorWorkspace(jakartaDate(-7), jakartaDate(14), signal),
      getReviewQueue(undefined, signal),
    ]);
    return {cases: sortCases(cases.cases), workspace, reviews: sortReviews(reviews.reviews, user?.user_id)};
  }, [user?.user_id]);
  const {data, error, retry} = useCounselorData(load, {topics: ['signals', 'schedule']});
  if (error) return <ErrorState title={copy.dashboard.title} message={copy.errors.load} retry={retry} retryLabel={copy.common.retry}/>;
  if (!data) return <LoadingState label={copy.common.loading} fullPage/>;

  const today = jakartaDate();
  const todaySessions = data.workspace.appointments.filter((row) => row.starts_at.slice(0, 10) === today);
  const urgent = data.cases.filter((row) => ['critical', 'high'].includes(row.risk));
  const pending = data.reviews.filter((row) => row.status === 'pending');
  const now = new Date();
  const actions = [
    ...urgent.map((row) => ({id: row.counselor_case_assignment_id, kind: 'case' as const, tone: riskTone(row.risk), urgency: row.risk, target: row.student_name, reason: row.assessment_summary ?? row.context, time: row.next_session_at ? formatDateTime(row.next_session_at, language) : '—', href: `/counselor/students/${row.student_id}`, score: priorityScore({kind: 'case', risk: row.risk}, now)})),
    ...data.workspace.appointments.filter((row) => new Date(row.ends_at) >= now && new Date(row.starts_at).getTime() - now.getTime() < 86400000).map((row) => ({id: row.counseling_appointment_id, kind: row.conflict ? 'conflict' as const : 'session' as const, tone: row.conflict ? 'danger' as const : 'info' as const, urgency: row.conflict ? copy.dashboard.conflict : copy.dashboard.session, target: row.student_name, reason: `${row.service_type} · ${row.resource_name ?? '—'}`, time: formatDateTime(row.starts_at, language), href: `/counselor/students/${row.student_id}`, score: priorityScore({kind: row.conflict ? 'conflict' : 'session', startsAt: row.starts_at}, now)})),
    ...pending.map((row) => ({id: row.assessment_version_review_id, kind: 'review' as const, tone: 'info' as const, urgency: copy.reviews.pending, target: row.name, reason: `${row.code} · v${row.version_number}`, time: formatDateTime(row.submitted_at, language), href: `/counselor/reviews/${row.assessment_version_review_id}`, score: priorityScore({kind: 'review', assigned: row.reviewer_user_id === user?.user_id}, now)})),
    ...data.cases.filter((row) => row.follow_up_status === 'action_required' && !['critical', 'high'].includes(row.risk)).map((row) => ({id: `follow-${row.counselor_case_assignment_id}`, kind: 'followup' as const, tone: 'warning' as const, urgency: copy.students.followUp, target: row.student_name, reason: row.context, time: row.next_session_at ? formatDateTime(row.next_session_at, language) : '—', href: `/counselor/students/${row.student_id}`, score: priorityScore({kind: 'followup'}, now)})),
    ...data.workspace.exceptions.filter((row) => row.status === 'pending').map((row) => ({id: row.counselor_exception_request_id, kind: 'exception' as const, tone: 'neutral' as const, urgency: copy.dashboard.exception, target: row.reason, reason: row.note ?? copy.availability.pending, time: row.date, href: '/counselor/availability', score: priorityScore({kind: 'exception'}, now)})),
  ].sort((a, b) => b.score - a.score || a.time.localeCompare(b.time));

  return <PageShell title={copy.dashboard.title} description={copy.dashboard.subtitle} actions={<Link className="button button-secondary" href="/counselor/schedule">{copy.schedule.title}</Link>}>
    <section className="operations-panel counselor-action-queue" aria-labelledby="attention-heading">
      <header className="operations-panel-header"><div><h2 id="attention-heading">{copy.dashboard.attention}</h2><p>{language === 'id' ? 'Urut berdasarkan dampak dan urgensi.' : 'Ordered by impact and urgency.'}</p></div></header>
      {actions.length === 0 ? <EmptyState title={copy.dashboard.empty}/> : <div className="operations-table-wrap"><table className="operations-table counselor-priority-table"><thead><tr><th>{copy.dashboard.urgency}</th><th>{copy.students.student}</th><th>{copy.dashboard.reason}</th><th>{copy.dashboard.time}</th><th>{copy.common.action}</th></tr></thead><tbody>{actions.map((item) => <tr className={`priority-row priority-${item.kind}`} key={`${item.kind}-${item.id}`}><td><Badge tone={item.tone}>{item.urgency}</Badge></td><td className="identity-cell"><strong>{item.target}</strong><small>{item.kind}</small></td><td>{item.reason}</td><td className="time-cell">{item.time}</td><td><Link className="button button-secondary button-compact" href={item.href}>{copy.common.open}</Link></td></tr>)}</tbody></table></div>}
    </section>
    <section className="operations-panel counselor-today-panel" aria-labelledby="today-heading">
      <header className="operations-panel-header"><h2 id="today-heading">{copy.dashboard.today}</h2><Link href="/counselor/schedule">{copy.common.view}</Link></header>
      {todaySessions.length ? <div className="counselor-agenda">{todaySessions.map((row) => <article key={row.counseling_appointment_id}><time>{timeRange(row.starts_at, row.ends_at, language)}</time><div><strong>{row.student_name}</strong><small>{row.service_type} · {row.resource_name ?? '—'}</small></div><Badge tone={statusTone(row.status)}>{row.status}</Badge><Link className="button button-secondary button-compact" href={`/counselor/students/${row.student_id}`}>{copy.common.open}</Link></article>)}</div> : <EmptyState title={copy.schedule.empty}/>}
    </section>
    <section className="counselor-secondary-block" aria-labelledby="next-heading">
      <header><h2 id="next-heading">{copy.dashboard.important}</h2></header>
      <div className="counselor-secondary-grid">
        <InlineAlert tone="info">{copy.schedule.authority}</InlineAlert>
        <dl className="counselor-summary-list"><div><dt>{copy.availability.routine}</dt><dd>{data.workspace.availability.length}</dd></div><div><dt>{copy.availability.exceptions}</dt><dd>{data.workspace.exceptions.length}</dd></div><div><dt>{copy.reviews.assigned}</dt><dd>{pending.filter((row) => row.reviewer_user_id === user?.user_id).length}</dd></div></dl>
      </div>
    </section>
  </PageShell>;
}
