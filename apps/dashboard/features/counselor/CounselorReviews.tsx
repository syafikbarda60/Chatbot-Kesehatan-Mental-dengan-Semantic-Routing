'use client';

import Link from 'next/link';
import {useCallback, useMemo, useState} from 'react';
import {useAuth} from '@/components/auth/AuthProvider';
import {useLanguage} from '@/components/providers/LanguageProvider';
import {Badge, EmptyState, ErrorState, LoadingState, PageShell} from '@/components/ui';
import {counselorMessages} from '@/lib/i18n/counselorMessages';
import {getReviewQueue} from './api';
import {formatDateTime, statusTone} from './format';
import {sortReviews} from './model';
import {useCounselorData} from './useCounselorData';

type Filter = 'assigned' | 'open' | 'pending' | 'revision_requested' | 'approved' | 'all';

export function CounselorReviewQueuePage() {
  const {language} = useLanguage();
  const copy = counselorMessages[language];
  const {user} = useAuth();
  const [filter, setFilter] = useState<Filter>('assigned');
  const load = useCallback((signal: AbortSignal) => getReviewQueue(undefined, signal), []);
  const {data, error, retry} = useCounselorData(load, {});
  const rows = useMemo(() => sortReviews(data?.reviews ?? [], user?.user_id).filter((row) => filter === 'all' || (filter === 'assigned' ? row.reviewer_user_id === user?.user_id && row.status === 'pending' : filter === 'open' ? !row.reviewer_user_id && row.status === 'pending' : row.status === filter)), [data, filter, user?.user_id]);
  if (error) return <ErrorState title={copy.reviews.title} message={copy.errors.load} retry={retry} retryLabel={copy.common.retry}/>;
  if (!data) return <LoadingState label={copy.common.loading} fullPage/>;

  const labels: Record<Filter, string> = {assigned: copy.reviews.assigned, open: copy.reviews.open, pending: copy.reviews.pending, revision_requested: copy.reviews.changes, approved: copy.reviews.approved, all: copy.common.all};
  return <PageShell title={copy.reviews.title} description={copy.reviews.subtitle}>
    <div className="review-queue-toolbar"><div className="segmented-control" role="group" aria-label={copy.reviews.status}>{(['assigned', 'open', 'pending', 'revision_requested', 'approved', 'all'] as Filter[]).map((item) => <button key={item} className={filter === item ? 'active' : ''} aria-pressed={filter === item} onClick={() => setFilter(item)}>{labels[item]}</button>)}</div><span>{rows.length} {language === 'id' ? 'review' : 'reviews'}</span></div>
    {rows.length === 0 ? <EmptyState title={copy.reviews.noComments}/> : <div className="table-shell"><div className="operations-table-wrap"><table className="operations-table counselor-review-table"><thead><tr><th>{copy.reviews.instrument}</th><th>{copy.reviews.version}</th><th>{copy.reviews.type}</th><th>{copy.reviews.submittedBy}</th><th>{copy.reviews.submitted}</th><th>{copy.reviews.reviewer}</th><th>{copy.reviews.status}</th><th>{copy.common.action}</th></tr></thead><tbody>{rows.map((row) => <tr className={row.status === 'approved' ? 'row-completed' : row.reviewer_user_id === user?.user_id ? 'row-assigned' : ''} key={row.assessment_version_review_id}><td className="identity-cell"><strong>{row.name}</strong><small>{row.code}</small></td><td>v{row.version_number} · r{row.definition_revision}</td><td>{row.instrument_kind === 'standard' ? copy.reviews.standard : copy.reviews.custom}</td><td>{row.submitted_by_name ?? '—'}</td><td>{formatDateTime(row.submitted_at, language)}</td><td>{row.reviewer_name ?? copy.reviews.open}</td><td><Badge tone={statusTone(row.status)}>{row.status.replace('_', ' ')}</Badge></td><td><Link className="button button-secondary button-compact" href={`/counselor/reviews/${row.assessment_version_review_id}`}>{copy.common.open}</Link></td></tr>)}</tbody></table></div></div>}
  </PageShell>;
}
