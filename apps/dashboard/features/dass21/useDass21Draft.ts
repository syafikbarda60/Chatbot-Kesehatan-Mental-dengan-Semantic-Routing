'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import * as api from './api';
import { sameQuestions, validateDass21Questions } from './model';
import type { DASS21BatchDraft, DASS21Question } from './model';

/** The admin's DASS-21 batch. The last server response is the saved snapshot; everything the
 *  page gates on is derived from it and the local edits, never stored twice. */
export function useDass21Draft() {
  const [batch, setBatch] = useState<DASS21BatchDraft | null>(null);
  const [questions, setQuestions] = useState<DASS21Question[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [isSaving, setSaving] = useState(false);
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const accept = useCallback((next: DASS21BatchDraft) => { setBatch(next); setQuestions(next.questions); }, []);

  useEffect(() => {
    const controller = new AbortController();
    api.getCurrentBatch(controller.signal)
      .then((next) => { accept(next); setError(null); setLoading(false); })
      .catch((caught) => { if (!(caught instanceof DOMException && caught.name === 'AbortError')) { setError(caught); setLoading(false); } });
    return () => controller.abort();
  }, [reloadKey, accept]);

  const isDirty = useMemo(() => !!batch && !sameQuestions(questions, batch.questions), [batch, questions]);
  const validation = useMemo(() => validateDass21Questions(questions), [questions]);
  const isEditable = !!batch && batch.status !== 'PENDING_VALIDATION';

  const updateQuestion = useCallback((id: string, fields: Partial<Pick<DASS21Question, 'text' | 'category'>>) => {
    setQuestions((current) => current.map((q) => q.id === id ? { ...q, ...fields } : q));
  }, []);

  // On failure the local questions stay as typed; only `error` changes.
  const saveDraft = async () => {
    if (!batch) return;
    setSaving(true); setError(null);
    try { accept(await api.saveDraft(questions, batch.updatedAt)); }
    catch (caught) { setError(caught); }
    finally { setSaving(false); }
  };

  // One click: anything that is not already a saved DRAFT (edits, a rejection, an approved
  // version) is saved first — the server turns that save into the draft it then submits.
  const submitForValidation = async () => {
    if (!batch) return;
    setSubmitting(true); setError(null);
    try {
      let current = batch;
      if (isDirty || current.status !== 'DRAFT') { current = await api.saveDraft(questions, current.updatedAt); accept(current); }
      accept(await api.submitForValidation(current.id!));
    } catch (caught) { setError(caught); }
    finally { setSubmitting(false); }
  };

  return { batch, questions, isLoading, isSaving, isSubmitting, error, isDirty, validation, isEditable, updateQuestion, saveDraft, submitForValidation, reload: () => { setLoading(true); setReloadKey((x) => x + 1); } };
}
