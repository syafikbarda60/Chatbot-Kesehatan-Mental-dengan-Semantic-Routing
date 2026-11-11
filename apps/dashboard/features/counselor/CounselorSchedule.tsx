'use client';

import Link from 'next/link';
import {useCallback, useMemo, useState} from 'react';
import {useLanguage} from '@/components/providers/LanguageProvider';
import {Badge, EmptyState, ErrorState, handleTabListKeyDown, InlineAlert, LoadingState, PageShell} from '@/components/ui';
import {counselorMessages} from '@/lib/i18n/counselorMessages';
import {getCounselorWorkspace} from './api';
import {formatDate, formatDateTime, jakartaDate, statusTone, timeRange} from './format';
import {useCounselorData} from './useCounselorData';
import type {CounselorAppointment} from './types';

type View = 'week' | 'month' | 'list';
const eventClass = (row: CounselorAppointment) => `schedule-block status-${row.status} resource-${row.resource_type ?? 'unknown'}`;

export function CounselorSchedulePage() {
  const {language} = useLanguage();
  const copy = counselorMessages[language];
  const [view, setView] = useState<View>('week');
  const load = useCallback((signal: AbortSignal) => getCounselorWorkspace(jakartaDate(-30), jakartaDate(45), signal), []);
  const {data, error, retry} = useCounselorData(load, {topics: ['schedule']});
  const grouped = useMemo(() => (data?.appointments ?? []).reduce<Record<string, CounselorAppointment[]>>((result, row) => {
    const date = row.starts_at.slice(0, 10);
    (result[date] ??= []).push(row);
    return result;
  }, {}), [data]);
  if (error) return <ErrorState title={copy.schedule.title} message={copy.errors.load} retry={retry} retryLabel={copy.common.retry}/>;
  if (!data) return <LoadingState label={copy.common.loading} fullPage/>;

  return <PageShell title={copy.schedule.title} description={copy.schedule.subtitle}>
    <div className="schedule-toolbar"><div className="detail-tabs compact-tabs" role="tablist" aria-label={copy.schedule.title} onKeyDown={handleTabListKeyDown}>{(['week', 'month', 'list'] as View[]).map((item) => <button key={item} role="tab" aria-selected={view === item} tabIndex={view === item ? 0 : -1} className={view === item ? 'active' : ''} onClick={() => setView(item)}>{copy.schedule[item]}</button>)}</div><InlineAlert tone="info">{copy.schedule.authority}</InlineAlert></div>
    {data.appointments.length === 0 ? <EmptyState title={copy.schedule.empty}/> : view === 'month' ? <section className="counselor-month-grid" aria-label={copy.schedule.month}>{Array.from({length: 35}, (_, index) => {const date = jakartaDate(index - 7); const rows = grouped[date] ?? []; return <article key={date} className={date === jakartaDate() ? 'is-today' : ''}><time>{formatDate(`${date}T12:00:00+07:00`, language)}</time>{rows.map((row) => <Link className={eventClass(row)} key={row.counseling_appointment_id} href={`/counselor/students/${row.student_id}`}><strong>{timeRange(row.starts_at, row.ends_at, language)}</strong><span>{row.student_name}</span><small>{row.resource_type === 'virtual' ? 'Online' : row.resource_name ?? '—'}</small></Link>)}</article>})}</section> : view === 'week' ? <section className="counselor-week-grid" aria-label={copy.schedule.week}>{Array.from({length: 7}, (_, index) => {const date = jakartaDate(index); const rows = grouped[date] ?? []; return <article key={date}><header><strong>{formatDate(`${date}T12:00:00+07:00`, language)}</strong></header>{rows.length ? rows.map((row) => <Link className={eventClass(row)} key={row.counseling_appointment_id} href={`/counselor/students/${row.student_id}`}><time>{timeRange(row.starts_at, row.ends_at, language)}</time><strong>{row.student_name}</strong><small>{row.resource_type === 'virtual' ? 'Online' : row.resource_name ?? '—'} · {row.status}</small></Link>) : <small className="empty-day">—</small>}</article>})}</section> : <div className="table-shell"><div className="operations-table-wrap"><table className="operations-table counselor-schedule-table"><thead><tr><th>{copy.schedule.date}</th><th>{copy.schedule.time}</th><th>{copy.schedule.student}</th><th>{copy.schedule.service}</th><th>{copy.schedule.resource}</th><th>{copy.schedule.status}</th><th>{copy.common.action}</th></tr></thead><tbody>{data.appointments.map((row) => <tr key={row.counseling_appointment_id}><td>{formatDateTime(row.starts_at, language).split(',')[0]}</td><td className="time-cell">{timeRange(row.starts_at, row.ends_at, language)}</td><td className="identity-cell"><strong>{row.student_name}</strong><small>{row.nim}</small></td><td>{row.service_type}</td><td>{row.resource_name ?? '—'}<small>{row.resource_type === 'virtual' ? 'Online' : row.resource_type ?? ''}</small></td><td><Badge tone={statusTone(row.status)}>{row.status}</Badge></td><td><Link className="button button-secondary button-compact" href={`/counselor/students/${row.student_id}`}>{copy.common.view}</Link></td></tr>)}</tbody></table></div></div>}
  </PageShell>;
}
