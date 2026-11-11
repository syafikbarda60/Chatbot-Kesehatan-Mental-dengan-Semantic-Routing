'use client';

import Link from 'next/link';
import {useCallback, useMemo, useState} from 'react';
import {useLanguage} from '@/components/providers/LanguageProvider';
import {Badge, EmptyState, ErrorState, Input, LoadingState, PageShell} from '@/components/ui';
import {counselorMessages} from '@/lib/i18n/counselorMessages';
import {getCounselorCases} from './api';
import {formatDateTime, riskTone, statusTone} from './format';
import {sortCases} from './model';
import {useCounselorData} from './useCounselorData';

export function CounselorStudentsPage() {
  const {language} = useLanguage();
  const copy = counselorMessages[language];
  const [search, setSearch] = useState('');
  const load = useCallback((signal: AbortSignal) => getCounselorCases(signal), []);
  const {data, error, retry} = useCounselorData(load, {topics: ['signals', 'schedule']});
  const rows = useMemo(() => sortCases(data?.cases ?? []).filter((row) => `${row.student_name} ${row.nim ?? ''} ${row.context}`.toLowerCase().includes(search.toLowerCase())), [data, search]);
  if (error) return <ErrorState title={copy.students.title} message={copy.errors.load} retry={retry} retryLabel={copy.common.retry}/>;
  if (!data) return <LoadingState label={copy.common.loading} fullPage/>;
  return <PageShell title={copy.students.title} description={copy.students.subtitle}>
    <div className="counselor-toolbar"><Input label={language === 'id' ? 'Cari mahasiswa' : 'Search students'} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={language === 'id' ? 'Nama atau NIM' : 'Name or student ID'}/><span aria-live="polite">{rows.length} {language === 'id' ? 'kasus' : 'cases'}</span></div>
    {rows.length === 0 ? <EmptyState title={copy.students.empty}/> : <div className="table-shell"><div className="operations-table-wrap"><table className="operations-table counselor-cases-table"><thead><tr><th>{copy.students.student}</th><th>{copy.students.academic}</th><th>{copy.students.context}</th><th>{copy.students.risk}</th><th>{copy.students.assessment}</th><th>{copy.students.counseling}</th><th>{copy.students.followUp}</th><th>{copy.common.action}</th></tr></thead><tbody>{rows.map((row) => <tr className={row.risk === 'critical' ? 'row-critical' : ''} key={row.counselor_case_assignment_id}><td className="identity-cell"><strong>{row.student_name}</strong><small>{row.nim ?? '—'}</small></td><td className="metadata-cell">{row.faculty_name ?? '—'}<small>{row.academic_unit_name ?? '—'}</small></td><td className="case-context-cell">{row.context}</td><td><Badge tone={riskTone(row.risk)}>{row.risk}</Badge></td><td className="assessment-cell">{row.assessment_summary ?? '—'}{row.assessment_at && <small>{formatDateTime(row.assessment_at, language)}</small>}</td><td className="time-cell">{row.next_session_at ? formatDateTime(row.next_session_at, language) : '—'}</td><td><Badge tone={statusTone(row.follow_up_status)}>{row.follow_up_status.replace('_', ' ')}</Badge></td><td><Link className="button button-secondary button-compact" href={`/counselor/students/${row.student_id}`}>{copy.common.view}</Link></td></tr>)}</tbody></table></div></div>}
  </PageShell>;
}
