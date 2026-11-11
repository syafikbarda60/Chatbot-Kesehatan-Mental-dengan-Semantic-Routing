'use client';
import Link from 'next/link';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { Badge, Button, ErrorState, InlineAlert, LoadingState, PageShell } from '@/components/ui';
import { ApiError } from '@/lib/api/client';
import type { DASS21Status } from './model';
import { useDass21Draft } from './useDass21Draft';

const TONE: Record<DASS21Status, 'info' | 'warning' | 'success' | 'danger'> = { DRAFT: 'info', PENDING_VALIDATION: 'warning', APPROVED: 'success', REJECTED: 'danger' };

export function Dass21Editor() {
  const { text } = useLanguage();
  const copy = text.dass21;
  const draft = useDass21Draft();
  const { batch, error } = draft;

  if (draft.isLoading) return <LoadingState fullPage label={text.common.loading} />;
  if (!batch) return <ErrorState title={copy.title} message={error instanceof ApiError ? error.message : copy.loadError} retry={draft.reload} retryLabel={text.common.retry} />;

  const busy = draft.isSaving || draft.isSubmitting;
  const apiError = error ? (error instanceof ApiError ? [error.message, error.errors[0]].filter(Boolean).join(': ') : copy.genericError) : '';

  return <PageShell
    title={copy.title}
    description={<span className="dass21-status"><Badge tone={TONE[batch.status]}>{copy.status[batch.status]}</Badge> {copy.version} {batch.version}{batch.status === 'REJECTED' && batch.reviewNote && <span className="dass21-note">{copy.reviewNote}: {batch.reviewNote}</span>}</span>}
    actions={<>
      <Link className="button button-secondary" href="/instruments">{text.instruments.actions.back}</Link>
      <Button variant="secondary" disabled={!draft.isEditable || !draft.isDirty || busy} loading={draft.isSaving} onClick={() => void draft.saveDraft()}>{copy.save}</Button>
      {batch.status !== 'PENDING_VALIDATION' && <Button disabled={!draft.isEditable || !draft.validation.valid || busy} loading={draft.isSubmitting} onClick={() => void draft.submitForValidation()}>{batch.status === 'APPROVED' ? copy.submitNewVersion : copy.submit}</Button>}
    </>}>
    {!draft.validation.valid && <InlineAlert tone="warning">{draft.validation.errors[0]}</InlineAlert>}
    {apiError && <InlineAlert tone="danger">{apiError}</InlineAlert>}
    <div className="table-shell"><div className="operations-table-wrap"><table className="operations-table dass21-table">
      <thead><tr><th>{copy.columns.number}</th><th>{copy.columns.text}</th><th>{copy.columns.category}</th></tr></thead>
      <tbody>{draft.questions.map((q) => <tr key={q.id}>
        <td className="numeric-cell">{q.orderNumber}</td>
        <td><input aria-label={`${copy.columns.text} ${q.orderNumber}`} value={q.text} maxLength={500} disabled={!draft.isEditable} onChange={(e) => draft.updateQuestion(q.id, { text: e.target.value })} /></td>
        <td>{copy.categories[q.category]}</td>
      </tr>)}</tbody>
    </table></div></div>
  </PageShell>;
}
