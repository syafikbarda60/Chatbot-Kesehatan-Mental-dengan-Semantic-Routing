'use client';

import Link from 'next/link';
import {useCallback, useState} from 'react';
import {useLanguage} from '@/components/providers/LanguageProvider';
import {Badge, Button, ConfirmationDialog, EmptyState, ErrorState, InlineAlert, LoadingState, PageShell} from '@/components/ui';
import {counselorMessages} from '@/lib/i18n/counselorMessages';
import {addReviewComment, decideReview, getReview} from './api';
import {formatDateTime, statusTone} from './format';
import {useCounselorData} from './useCounselorData';

const displayValue = (value: unknown) => {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return '—';
};

export function CounselorReviewDetailPage({reviewId}: {reviewId: string}) {
  const {language} = useLanguage();
  const copy = counselorMessages[language];
  const load = useCallback((signal: AbortSignal) => getReview(reviewId, signal), [reviewId]);
  const {data, error, retry} = useCounselorData(load);
  const [comment, setComment] = useState('');
  const [questionId, setQuestionId] = useState('');
  const [feedback, setFeedback] = useState('');
  const [decision, setDecision] = useState<'approve' | 'request-revision' | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  if (error) return <ErrorState title={copy.reviews.detail} message={copy.errors.load} retry={retry} retryLabel={copy.common.retry}/>;
  if (!data) return <LoadingState label={copy.common.loading} fullPage/>;

  const detail = data;
  const stale = detail.review.definition_revision !== detail.review.current_revision;
  const provenance = detail.review.provenance ?? {};
  const source = displayValue(provenance.source);
  const sourceType = displayValue(provenance.workflow);
  const preview = provenance.synthetic_preview === true;

  async function addComment() {
    if (!comment.trim()) return;
    setSaving(true);
    try {
      await addReviewComment(reviewId, comment, questionId || null);
      setComment('');
      setQuestionId('');
      retry();
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : copy.errors.mutation);
    } finally {
      setSaving(false);
    }
  }
  async function submitDecision() {
    if (!decision || (decision === 'request-revision' && !feedback.trim())) return;
    setSaving(true);
    try {
      await decideReview(reviewId, decision, detail.review.definition_revision, feedback);
      setNotice(language === 'id' ? 'Keputusan tersimpan.' : 'Decision saved.');
      setFeedback('');
      retry();
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : copy.errors.mutation);
    } finally {
      setSaving(false);
    }
  }

  return <PageShell title={data.review.name} description={`${data.review.code} · v${data.review.version_number} · revision ${data.review.definition_revision}`} actions={<Link className="button button-secondary" href="/counselor/reviews">{copy.common.back}</Link>}>
    <section className="review-summary" aria-label={copy.reviews.reviewStatus}><div><span className="eyebrow">{copy.reviews.current}</span><p>{copy.reviews.submitted}: {formatDateTime(data.review.submitted_at, language)}</p></div><Badge tone={statusTone(data.review.status)}>{data.review.status.replace('_', ' ')}</Badge></section>
    {stale && <InlineAlert tone="danger">{copy.reviews.stale}</InlineAlert>}
    {notice && <InlineAlert tone={notice.includes('tersimpan') || notice.includes('saved') ? 'success' : 'danger'}>{notice}</InlineAlert>}

    <div className="counselor-review-layout">
      <main className="review-main">
        <section className="review-section" aria-labelledby="metadata-heading"><h2 id="metadata-heading">{copy.reviews.metadata}</h2><dl className="definition-grid review-metadata"><div><dt>{copy.reviews.instrument}</dt><dd>{data.review.name}<small>{data.review.code}</small></dd></div><div><dt>{copy.reviews.version}</dt><dd>v{data.review.version_number} · r{data.review.definition_revision}</dd></div><div><dt>{copy.reviews.type}</dt><dd>{data.review.instrument_kind === 'standard' ? copy.reviews.standard : copy.reviews.custom}</dd></div><div><dt>{copy.reviews.submittedBy}</dt><dd>{data.review.submitted_by_name ?? '—'}</dd></div><div><dt>{copy.reviews.reviewer}</dt><dd>{data.review.reviewer_name ?? copy.reviews.open}</dd></div><div><dt>{copy.reviews.source}</dt><dd>{source}</dd></div><div><dt>{copy.reviews.sourceType}</dt><dd>{sourceType}</dd></div><div><dt>{copy.reviews.preview}</dt><dd>{preview ? copy.reviews.yes : copy.reviews.no}</dd></div></dl></section>

        <section className="review-section previous-version" aria-labelledby="previous-heading"><h2 id="previous-heading">{copy.reviews.previous}</h2>{data.previous ? <div className="previous-version-summary"><strong>v{data.previous.version_number}</strong><span>{data.previous.dimensions.length} {copy.reviews.dimensions.toLowerCase()} · {data.previous.questions.length} {copy.reviews.questions.toLowerCase()}</span></div> : <p className="muted-copy">{copy.reviews.noPrevious}</p>}</section>

        <section className="review-section" aria-labelledby="dimensions-heading"><h2 id="dimensions-heading">{copy.reviews.dimensions}</h2><div className="dimension-review-list">{data.dimensions.map((dimension) => <article key={dimension.code}><header><div><strong>{dimension.name}</strong><small>{dimension.code}</small></div><Badge>×{dimension.multiplier}</Badge></header><div className="threshold-list">{dimension.interpretation_bands.length ? dimension.interpretation_bands.map((band) => <span key={`${dimension.code}-${band.label}`}><b>{band.label}</b>{band.minimum}–{band.maximum ?? '∞'}</span>) : <span className="muted-copy">—</span>}</div></article>)}</div></section>

        <section className="review-section" aria-labelledby="questions-heading"><h2 id="questions-heading">{copy.reviews.questions}</h2><div className="review-questions">{data.questions.map((question) => <article id={`question-${question.assessment_question_id ?? question.item_key}`} key={question.assessment_question_id ?? question.item_key}><header><span className="question-number">{question.position}</span><strong>{question.wording}</strong><Badge>{question.category}</Badge></header><ol>{question.options.map((option) => <li key={`${question.item_key}-${option.position}`}><span>{option.label}</span><strong>{option.score}</strong></li>)}</ol></article>)}</div></section>
      </main>

      <aside className="review-panel">
        <section aria-labelledby="review-status-heading"><h2 id="review-status-heading">{copy.reviews.reviewStatus}</h2><div className="review-status-row"><Badge tone={statusTone(data.review.status)}>{data.review.status.replace('_', ' ')}</Badge><span>r{data.review.definition_revision}</span></div></section>
        <section aria-labelledby="comments-heading"><h2 id="comments-heading">{copy.reviews.comments}</h2>{data.comments.length ? <div className="review-comments">{data.comments.map((item) => <article className="review-comment" key={item.review_comment_id}><header><strong>{item.author_name}</strong><time>{formatDateTime(item.created_at, language)}</time></header>{item.assessment_question_id && <a href={`#question-${item.assessment_question_id}`}>#{item.assessment_question_id}</a>}<p>{item.comment_text}</p></article>)}</div> : <EmptyState title={copy.reviews.noComments}/>}</section>
        <section className="comment-composer" aria-labelledby="add-comment-heading"><h2 id="add-comment-heading">{copy.reviews.addComment}</h2><p>{copy.reviews.addCommentHelp}</p><label className="field"><span>{copy.reviews.question}</span><select value={questionId} onChange={(event) => setQuestionId(event.target.value)}><option value="">{copy.reviews.general}</option>{data.questions.map((question) => <option key={question.item_key} value={question.assessment_question_id ?? question.item_key}>{question.position}. {question.item_key}</option>)}</select></label><label className="field"><span>{copy.reviews.general}</span><textarea value={comment} onChange={(event) => setComment(event.target.value)}/></label><Button variant="secondary" loading={saving} disabled={!comment.trim()} onClick={() => void addComment()}>{copy.reviews.addComment}</Button></section>
        <section className="review-decisions" aria-labelledby="decision-heading"><h2 id="decision-heading">{copy.reviews.decision}</h2><label className="field"><span>{copy.reviews.feedback}</span><textarea value={feedback} onChange={(event) => setFeedback(event.target.value)}/></label><div className="decision-actions"><Button disabled={stale || data.review.status !== 'pending'} onClick={() => setDecision('approve')}>{copy.reviews.approve}</Button><Button variant="secondary" className="request-changes-button" disabled={stale || data.review.status !== 'pending' || !feedback.trim()} onClick={() => setDecision('request-revision')}>{copy.reviews.requestChanges}</Button></div></section>
      </aside>
    </div>
    <ConfirmationDialog open={decision !== null} onOpenChange={(open) => {if (!open) setDecision(null)}} title={decision === 'approve' ? copy.reviews.confirmApprove : copy.reviews.confirmChanges} consequence={decision === 'request-revision' ? feedback : copy.reviews.current} confirmLabel={copy.common.confirm} onConfirm={() => void submitDecision()} danger={decision === 'request-revision'}/>
  </PageShell>;
}
