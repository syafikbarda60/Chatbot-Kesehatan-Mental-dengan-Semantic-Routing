'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { Badge, Button, ConfirmationDialog, Drawer, DropdownMenu, EmptyState, ErrorState, Icon, InlineAlert, Input, PageShell, Skeleton } from '@/components/ui';
import { createHotline, deactivateHotline, getHotlines, updateHotline } from './api';
import { filterHotlines, hotlineActionPayload, normalizeHotlineStatus, toHotlinePayload, validateHotlineDraft } from './model';
import type { HotlineDraft, HotlineRecord, HotlineStatus } from './types';
import { isPreviewMode } from '@/lib/previewMode';

const blankDraft: HotlineDraft = { name: '', phone: '', description: '', verificationNote: '', serviceType: '', operationalHours: '', coverage: '' };
type PendingAction = { kind: 'verify' | 'deactivate' | 'reactivate'; row: HotlineRecord } | null;

export function HotlinePage() {
  const { language, text } = useLanguage();
  const copy = text.hotline;
  const [rows, setRows] = useState<HotlineRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [mutationError, setMutationError] = useState(false);
  const [saved, setSaved] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | HotlineStatus>('all');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<HotlineRecord | null>(null);
  const [draft, setDraft] = useState<HotlineDraft>(blankDraft);
  const [errors, setErrors] = useState<Partial<Record<keyof HotlineDraft, string>>>({});
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState<PendingAction>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setLoadError(false);
    try { setRows(await getHotlines(signal)); }
    catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) setLoadError(true); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, []);
  useEffect(() => { const controller = new AbortController(); const timer = window.setTimeout(() => void load(controller.signal), 0); return () => { window.clearTimeout(timer); controller.abort(); }; }, [load]);
  const filtered = useMemo(() => filterHotlines(rows, search, status), [rows, search, status]);

  function openCreate() { setEditing(null); setDraft(blankDraft); setErrors({}); setMutationError(false); setSaved(false); setEditorOpen(true); }
  function openEdit(row: HotlineRecord) {
    setEditing(row); setDraft({ name: row.name, phone: row.phone, description: row.description ?? '', verificationNote: row.verification_note ?? '', serviceType: row.service_type ?? '', operationalHours: row.operational_hours ?? '', coverage: row.coverage ?? '' }); setErrors({}); setMutationError(false); setSaved(false); setEditorOpen(true);
  }
  async function save() {
    const nextErrors = validateHotlineDraft(draft); setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setSaving(true); setMutationError(false);
    try {
      if (editing) await updateHotline(editing.hotline_id, toHotlinePayload(draft, false, isPreviewMode())); else await createHotline(toHotlinePayload(draft, true, isPreviewMode()));
      setEditorOpen(false); await load(); setSaved(true);
    } catch { setMutationError(true); } finally { setSaving(false); }
  }
  async function runAction() {
    if (!pending) return;
    setMutationError(false);
    try {
      if (pending.kind === 'deactivate') await deactivateHotline(pending.row.hotline_id);
      else await updateHotline(pending.row.hotline_id, hotlineActionPayload(pending.kind));
      await load(); setSaved(true);
    } catch { setMutationError(true); }
  }
  const formatDate = (value?: string | null) => value ? new Intl.DateTimeFormat(language === 'id' ? 'id-ID' : 'en-GB', { dateStyle: 'medium' }).format(new Date(value)) : copy.never;
  const statusLabel = (value: unknown) => copy.status[normalizeHotlineStatus(value)];
  const statusTone = (value: unknown) => normalizeHotlineStatus(value) === 'active' ? 'success' : normalizeHotlineStatus(value) === 'inactive' ? 'neutral' : 'warning';

  return <PageShell title={copy.title} actions={<><Button variant="secondary" icon="refresh" onClick={() => void load()}>{copy.refresh}</Button><Button icon="phone" onClick={openCreate}>{copy.add}</Button></>}>
    <div className="m09-stack">
      <p className="page-lead">{copy.subtitle}</p>
      <InlineAlert tone="danger" title={copy.warningTitle}>{copy.warningBody}</InlineAlert>
      {saved && <InlineAlert tone="success">{copy.saved}</InlineAlert>}
      {mutationError && <InlineAlert tone="danger">{copy.errors.mutation}</InlineAlert>}
      <section className="m09-panel">
        <div className="m09-filters" aria-label={copy.filters.label}>
          <Input label={copy.filters.search} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={copy.filters.placeholder} />
          <label>{copy.filters.status}<select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="all">{copy.filters.all}</option><option value="active">{copy.status.active}</option><option value="verification_required">{copy.status.verification_required}</option><option value="inactive">{copy.status.inactive}</option></select></label>
        </div>
        {loading ? <div className="m09-loading"><Skeleton lines={7} /></div> : loadError ? <ErrorState title={copy.errors.title} message={copy.errors.load} retry={() => void load()} retryLabel={text.common.retry} /> : filtered.length === 0 ? <EmptyState title={copy.empty} message={copy.emptyBody} /> : <div className="table-wrap"><table className="data-table hotline-table"><thead><tr><th>{copy.fields.service}</th><th>{copy.fields.phone}</th>{isPreviewMode() && <><th>{copy.fields.type}</th><th>{copy.fields.hours}</th></>}<th>{copy.fields.status}</th><th>{copy.fields.verified}</th><th>{copy.fields.action}</th></tr></thead><tbody>{filtered.map((row) => {
          const rowStatus = normalizeHotlineStatus(row.verification_status);
          const items = [{ label: copy.actions.edit, onSelect: () => openEdit(row) }, ...(rowStatus !== 'active' ? [{ label: rowStatus === 'inactive' ? copy.actions.reactivate : copy.actions.verify, onSelect: () => setPending({ kind: rowStatus === 'inactive' ? 'reactivate' : 'verify', row }) }] : []), ...(rowStatus !== 'inactive' ? [{ label: copy.actions.deactivate, danger: true, onSelect: () => setPending({ kind: 'deactivate', row }) }] : [])];
          return <tr key={row.hotline_id}><td><strong>{row.name}</strong><small>{row.description || copy.noDescription}</small></td><td><a href={`tel:${row.phone}`}>{row.phone}</a></td>{isPreviewMode() && <><td>{row.service_type || '—'}</td><td>{row.operational_hours || '—'}<small>{row.coverage || ''}</small></td></>}<td><Badge tone={statusTone(rowStatus)}>{statusLabel(rowStatus)}</Badge></td><td>{formatDate(row.verified_at)}{row.verified_by && <small>{copy.verifiedActor}</small>}</td><td><DropdownMenu label={copy.actions.menu} trigger={<Icon name="more" />} items={items} /></td></tr>;
        })}</tbody></table></div>}
        {!loading && !loadError && <footer className="m09-table-footer">{copy.showing.replace('{shown}', String(filtered.length)).replace('{total}', String(rows.length))}</footer>}
      </section>
    </div>

    <Drawer open={editorOpen} onOpenChange={setEditorOpen} title={editing ? copy.editor.editTitle : copy.editor.addTitle} description={copy.editor.description} closeLabel={text.common.close} footer={<div className="drawer-actions"><Button variant="ghost" onClick={() => setEditorOpen(false)}>{text.common.cancel}</Button><Button loading={saving} onClick={() => void save()}>{copy.editor.save}</Button></div>}>
      <div className="m09-form">
        {mutationError && <InlineAlert tone="danger">{copy.errors.mutation}</InlineAlert>}
        <Input label={copy.fields.service} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} error={errors.name ? copy.validation.required : undefined} required />
        <Input label={copy.fields.phone} value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} error={errors.phone === 'invalid' ? copy.validation.phone : errors.phone ? copy.validation.required : undefined} hint={copy.editor.phoneHint} required />
        {isPreviewMode() && <><Input label={copy.fields.type} value={draft.serviceType ?? ''} onChange={(event) => setDraft({ ...draft, serviceType: event.target.value })} /><Input label={copy.fields.hours} value={draft.operationalHours ?? ''} onChange={(event) => setDraft({ ...draft, operationalHours: event.target.value })} /><Input label={copy.fields.coverage} value={draft.coverage ?? ''} onChange={(event) => setDraft({ ...draft, coverage: event.target.value })} /><InlineAlert tone="info">{copy.editor.previewFields}</InlineAlert></>}
        <label>{copy.fields.description}<textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} rows={4} /></label>
        <label>{copy.fields.note}<textarea value={draft.verificationNote} onChange={(event) => setDraft({ ...draft, verificationNote: event.target.value })} rows={3} /></label>
        <InlineAlert>{editing ? copy.editor.editPolicy : copy.editor.createPolicy}</InlineAlert>
      </div>
    </Drawer>
    <ConfirmationDialog open={!!pending} onOpenChange={(open) => { if (!open) setPending(null); }} title={pending ? copy.confirm[pending.kind].title : ''} consequence={pending ? copy.confirm[pending.kind].body.replace('{name}', pending.row.name) : ''} cancelLabel={text.common.cancel} confirmLabel={pending ? copy.confirm[pending.kind].action : text.common.confirm} danger={pending?.kind === 'deactivate'} onConfirm={() => void runAction()} />
  </PageShell>;
}
