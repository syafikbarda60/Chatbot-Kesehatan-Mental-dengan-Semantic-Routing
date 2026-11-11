'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { useTheme } from '@/components/providers/ThemeProvider';
import { Badge, Button, ConfirmationDialog, Drawer, EmptyState, ErrorState, handleTabListKeyDown, InlineAlert, Input, PageShell, Skeleton } from '@/components/ui';
import type { Language } from '@/lib/i18n/messages';
import type { ThemeMode } from '@/lib/theme/theme';
import { createFaculty, createUnit, getAcademicStructure, updateFaculty, updateUnit } from './api';
import { toFacultyPayload, toUnitPayload, validateFacultyDraft, validateUnitDraft, withFacultyActive, withUnitActive } from './model';
import type { AcademicUnit, Faculty, FacultyDraft, UnitDraft } from './types';

type Editor = { kind: 'faculty'; item: Faculty | null } | { kind: 'unit'; item: AcademicUnit | null } | null;
type Pending = { kind: 'faculty'; item: Faculty } | { kind: 'unit'; item: AcademicUnit } | null;
const facultyBlank: FacultyDraft = { name: '', code: '', active: true };
const unitBlank: UnitDraft = { facultyId: '', name: '', code: '', unitType: 'department', degreeLevel: '', active: true };

export function SettingsPage() {
  const { user, logout } = useAuth(); const { mode, resolved, setMode } = useTheme(); const { language, text, setLanguage } = useLanguage(); const copy = text.settingsPage;
  const [faculties, setFaculties] = useState<Faculty[]>([]); const [units, setUnits] = useState<AcademicUnit[]>([]);
  const [loading, setLoading] = useState(true); const [loadError, setLoadError] = useState(false); const [mutationError, setMutationError] = useState(false);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<'faculties' | 'units'>('faculties'); const [search, setSearch] = useState('');
  const [editor, setEditor] = useState<Editor>(null); const [facultyDraft, setFacultyDraft] = useState(facultyBlank); const [unitDraft, setUnitDraft] = useState(unitBlank);
  const [errors, setErrors] = useState<Record<string, string>>({}); const [saving, setSaving] = useState(false); const [pending, setPending] = useState<Pending>(null);
  const load = useCallback(async (signal?: AbortSignal) => { setLoading(true); setLoadError(false); try { const data = await getAcademicStructure(signal); setFaculties(data.faculties); setUnits(data.units); } catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) setLoadError(true); } finally { if (!signal?.aborted) setLoading(false); } }, []);
  useEffect(() => { const controller = new AbortController(); const timer = window.setTimeout(() => void load(controller.signal), 0); return () => { window.clearTimeout(timer); controller.abort(); }; }, [load]);
  const needle = search.trim().toLocaleLowerCase();
  const filteredFaculties = useMemo(() => faculties.filter((item) => !needle || `${item.name} ${item.code ?? ''}`.toLocaleLowerCase().includes(needle)), [faculties, needle]);
  const filteredUnits = useMemo(() => units.filter((item) => !needle || `${item.name} ${item.code ?? ''} ${item.faculty_name}`.toLocaleLowerCase().includes(needle)), [units, needle]);
  function openFaculty(item: Faculty | null) { setEditor({ kind: 'faculty', item }); setFacultyDraft(item ? { name: item.name, code: item.code ?? '', active: item.active } : facultyBlank); setErrors({}); setMutationError(false); setSaved(false); }
  function openUnit(item: AcademicUnit | null) { setEditor({ kind: 'unit', item }); setUnitDraft(item ? { facultyId: item.faculty_id, name: item.name, code: item.code ?? '', unitType: item.unit_type, degreeLevel: item.degree_level ?? '', active: item.active } : { ...unitBlank, facultyId: faculties.find((faculty) => faculty.active)?.faculty_id ?? '' }); setErrors({}); setMutationError(false); setSaved(false); }
  async function saveEditor() {
    if (!editor) return;
    const nextErrors = editor.kind === 'faculty' ? validateFacultyDraft(facultyDraft) : validateUnitDraft(unitDraft); setErrors(nextErrors); if (Object.keys(nextErrors).length) return;
    setSaving(true); setMutationError(false);
    try {
      if (editor.kind === 'faculty') { if (editor.item) await updateFaculty(editor.item.faculty_id, toFacultyPayload(facultyDraft)); else await createFaculty(toFacultyPayload(facultyDraft)); }
      else if (editor.item) await updateUnit(editor.item.academic_unit_id, toUnitPayload(unitDraft)); else await createUnit(toUnitPayload(unitDraft));
      setEditor(null); await load(); setSaved(true);
    } catch { setMutationError(true); } finally { setSaving(false); }
  }
  async function toggleActive() {
    if (!pending) return; setMutationError(false);
    try {
      if (pending.kind === 'faculty') await updateFaculty(pending.item.faculty_id, withFacultyActive({ name: pending.item.name, code: pending.item.code ?? '', active: pending.item.active }, !pending.item.active));
      else await updateUnit(pending.item.academic_unit_id, withUnitActive({ facultyId: pending.item.faculty_id, name: pending.item.name, code: pending.item.code ?? '', unitType: pending.item.unit_type, degreeLevel: pending.item.degree_level ?? '', active: pending.item.active }, !pending.item.active));
      await load(); setSaved(true);
    } catch { setMutationError(true); }
  }
  const initials = user?.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'AD';
  const selectedActive = pending?.item.active ?? false;

  return <PageShell title={copy.title}>
    <div className="m09-stack"><p className="page-lead">{copy.subtitle}</p>
      <div className="settings-grid">
        <section className="settings-card"><header><h2>{copy.appearance.title}</h2><p>{copy.appearance.body}</p></header><div className="setting-options">{(['light', 'dark', 'system'] as ThemeMode[]).map((value) => <button key={value} aria-pressed={mode === value} onClick={() => setMode(value)}>{text.theme[value]}{value === 'system' && <small>{copy.appearance.resolved}: {text.theme[resolved]}</small>}</button>)}</div></section>
        <section className="settings-card"><header><h2>{copy.language.title}</h2><p>{copy.language.body}</p></header><div className="setting-options">{(['id', 'en'] as Language[]).map((value) => <button key={value} aria-pressed={language === value} onClick={() => setLanguage(value)}>{value === 'id' ? 'Bahasa Indonesia' : 'English'}</button>)}</div></section>
        <section className="settings-card"><header><h2>{copy.profile.title}</h2><p>{copy.profile.body}</p></header><div className="admin-profile"><span className="avatar">{initials}</span><div><Badge tone="success">{copy.profile.role}</Badge><h3>{user?.name ?? copy.unavailable}</h3><p>{user?.email ?? copy.unavailable}</p></div></div><dl className="settings-definitions"><div><dt>{copy.profile.userId}</dt><dd>{user?.user_id ?? copy.unavailable}</dd></div><div><dt>{copy.profile.access}</dt><dd>{copy.profile.adminAccess}</dd></div></dl><InlineAlert>{copy.profile.readOnly}</InlineAlert></section>
        <section className="settings-card"><header><h2>{copy.security.title}</h2><p>{copy.security.body}</p></header><div className="session-row"><div><strong>{copy.security.current}</strong><span>{copy.security.browser}</span></div><Badge tone="success">{copy.security.active}</Badge></div><Button variant="secondary" icon="logout" onClick={logout}>{copy.security.logout}</Button><InlineAlert>{copy.security.limited}</InlineAlert></section>
      </div>
      <section className="settings-card settings-system"><header><h2>{copy.system.title}</h2><p>{copy.system.body}</p></header><dl className="system-grid"><div><dt>{copy.system.platform}</dt><dd>Sajiwa</dd></div><div><dt>{copy.system.application}</dt><dd>{text.brandDescriptor}</dd></div><div><dt>{copy.system.role}</dt><dd>{copy.profile.role}</dd></div><div><dt>{copy.system.theme}</dt><dd>{text.theme[resolved]}</dd></div><div><dt>{copy.system.language}</dt><dd>{language.toUpperCase()}</dd></div></dl></section>
      <section className="settings-card academic-settings"><header className="academic-header"><div><h2>{copy.academic.title}</h2><p>{copy.academic.body}</p></div><Button icon="user" onClick={() => tab === 'faculties' ? openFaculty(null) : openUnit(null)}>{tab === 'faculties' ? copy.academic.addFaculty : copy.academic.addUnit}</Button></header>
        {mutationError && <InlineAlert tone="danger">{copy.errors.mutation}</InlineAlert>}{saved && <InlineAlert tone="success">{copy.saved}</InlineAlert>}
        <div className="detail-tabs" role="tablist" aria-label={copy.academic.title} onKeyDown={handleTabListKeyDown}><button className={tab === 'faculties' ? 'active' : ''} role="tab" aria-selected={tab === 'faculties'} tabIndex={tab === 'faculties' ? 0 : -1} onClick={() => { setTab('faculties'); setSearch(''); }}>{copy.academic.faculties}</button><button className={tab === 'units' ? 'active' : ''} role="tab" aria-selected={tab === 'units'} tabIndex={tab === 'units' ? 0 : -1} onClick={() => { setTab('units'); setSearch(''); }}>{copy.academic.units}</button></div>
        <Input label={copy.academic.search} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={copy.academic.searchPlaceholder} />
        {loading ? <Skeleton lines={5} /> : loadError ? <ErrorState title={copy.errors.title} message={copy.errors.load} retry={() => void load()} retryLabel={text.common.retry} /> : tab === 'faculties' ? <AcademicTable empty={filteredFaculties.length === 0} emptyText={copy.academic.empty} headers={[copy.fields.name, copy.fields.code, copy.fields.units, copy.fields.students, copy.fields.status, copy.fields.action]}>{filteredFaculties.map((item) => <tr key={item.faculty_id}><td><strong>{item.name}</strong></td><td>{item.code || '—'}</td><td>{item.unit_count}</td><td>{item.student_count}</td><td><Badge tone={item.active ? 'success' : 'neutral'}>{item.active ? copy.status.active : copy.status.inactive}</Badge></td><td><div className="row-actions"><Button variant="secondary" onClick={() => openFaculty(item)}>{copy.actions.edit}</Button><Button variant="ghost" className={item.active ? 'button-text-danger' : ''} onClick={() => setPending({ kind: 'faculty', item })}>{item.active ? copy.actions.deactivate : copy.actions.activate}</Button></div></td></tr>)}</AcademicTable> : <AcademicTable empty={filteredUnits.length === 0} emptyText={copy.academic.empty} headers={[copy.fields.name, copy.fields.code, copy.fields.faculty, copy.fields.type, copy.fields.students, copy.fields.status, copy.fields.action]}>{filteredUnits.map((item) => <tr key={item.academic_unit_id}><td><strong>{item.name}</strong><small>{item.degree_level || ''}</small></td><td>{item.code || '—'}</td><td>{item.faculty_name}</td><td>{copy.unitType[item.unit_type]}</td><td>{item.student_count}</td><td><Badge tone={item.active ? 'success' : 'neutral'}>{item.active ? copy.status.active : copy.status.inactive}</Badge></td><td><div className="row-actions"><Button variant="secondary" onClick={() => openUnit(item)}>{copy.actions.edit}</Button><Button variant="ghost" className={item.active ? 'button-text-danger' : ''} onClick={() => setPending({ kind: 'unit', item })}>{item.active ? copy.actions.deactivate : copy.actions.activate}</Button></div></td></tr>)}</AcademicTable>}
      </section>
    </div>
    <Drawer open={!!editor} onOpenChange={(open) => { if (!open) setEditor(null); }} title={editor?.kind === 'unit' ? (editor.item ? copy.editor.editUnit : copy.editor.addUnit) : (editor?.item ? copy.editor.editFaculty : copy.editor.addFaculty)} description={copy.editor.description} closeLabel={text.common.close} footer={<div className="drawer-actions"><Button variant="ghost" onClick={() => setEditor(null)}>{text.common.cancel}</Button><Button loading={saving} onClick={() => void saveEditor()}>{copy.actions.save}</Button></div>}><div className="m09-form">{mutationError && <InlineAlert tone="danger">{copy.errors.mutation}</InlineAlert>}{editor?.kind === 'faculty' ? <><Input label={copy.fields.name} value={facultyDraft.name} onChange={(event) => setFacultyDraft({ ...facultyDraft, name: event.target.value })} error={errors.name ? copy.validation.required : undefined} required /><Input label={copy.fields.code} value={facultyDraft.code} onChange={(event) => setFacultyDraft({ ...facultyDraft, code: event.target.value })} /></> : <><label>{copy.fields.faculty}<select value={unitDraft.facultyId} onChange={(event) => setUnitDraft({ ...unitDraft, facultyId: event.target.value })} aria-invalid={!!errors.facultyId}><option value="">{copy.editor.selectFaculty}</option>{faculties.filter((faculty) => faculty.active || faculty.faculty_id === unitDraft.facultyId).map((faculty) => <option key={faculty.faculty_id} value={faculty.faculty_id}>{faculty.name}</option>)}</select>{errors.facultyId && <span className="field-error">{copy.validation.required}</span>}</label><Input label={copy.fields.name} value={unitDraft.name} onChange={(event) => setUnitDraft({ ...unitDraft, name: event.target.value })} error={errors.name ? copy.validation.required : undefined} required /><Input label={copy.fields.code} value={unitDraft.code} onChange={(event) => setUnitDraft({ ...unitDraft, code: event.target.value })} /><label>{copy.fields.type}<select value={unitDraft.unitType} onChange={(event) => setUnitDraft({ ...unitDraft, unitType: event.target.value as UnitDraft['unitType'] })}><option value="department">{copy.unitType.department}</option><option value="study_program">{copy.unitType.study_program}</option></select></label><Input label={copy.fields.degree} value={unitDraft.degreeLevel} onChange={(event) => setUnitDraft({ ...unitDraft, degreeLevel: event.target.value })} /></>}</div></Drawer>
    <ConfirmationDialog open={!!pending} onOpenChange={(open) => { if (!open) setPending(null); }} title={selectedActive ? copy.confirm.deactivateTitle : copy.confirm.activateTitle} consequence={(selectedActive ? copy.confirm.deactivateBody : copy.confirm.activateBody).replace('{name}', pending?.item.name ?? '')} cancelLabel={text.common.cancel} confirmLabel={selectedActive ? copy.actions.deactivate : copy.actions.activate} danger={selectedActive} onConfirm={() => void toggleActive()} />
  </PageShell>;
}

function AcademicTable({ headers, children, empty, emptyText }: { headers: string[]; children: ReactNode; empty: boolean; emptyText: string }) {
  if (empty) return <EmptyState title={emptyText} />;
  return <div className="table-wrap"><table className="data-table academic-table"><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{children}</tbody></table></div>;
}
