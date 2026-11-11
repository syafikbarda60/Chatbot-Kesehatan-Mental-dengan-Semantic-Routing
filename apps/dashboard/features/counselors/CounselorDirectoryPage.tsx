'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { Badge, Button, ConfirmationDialog, Drawer, EmptyState, ErrorState, Icon, InlineAlert, Input, PageShell, Skeleton, TimeInput } from '@/components/ui';
import { useLiveRefresh } from '@/lib/realtime/useLiveRefresh';
import { addDays, jakartaDateKey } from '@/features/counseling/model';
import { createAvailability, deactivateAvailability, getAvailability, getCounselorOperations, getCounselors, updateCounselorProfile } from './api';
import { addScheduleWindow, buildSchedulePlan, counselorInitials, filterCounselors, normalizeCounselors, normalizeSchedule, removeScheduleWindow, scheduleSignature, upcomingAppointments, validateSchedule, WEEKDAY_ORDER, windowsForDay, type ScheduleValidation } from './model';
import type { Appointment, AvailabilityRule, CalendarResponse, Counselor, CounselorStatusFilter, ScheduleWindow } from './types';
import type { Messages } from '@/lib/i18n/messages';
import { ExceptionDrawer } from '@/features/counseling/ExceptionDrawer';
import { deleteBlockedPeriod } from '@/features/counseling/api';

const PAGE_SIZE = 20;
type Copy = Messages['counselors'];

export function CounselorDirectoryPage({ initialCounselorId = null }: { initialCounselorId?: string | null }) {
  const { language, text } = useLanguage();
  const router = useRouter();
  const copy = text.counselors;
  const [counselors, setCounselors] = useState<Counselor[]>([]);
  const [availability, setAvailability] = useState<AvailabilityRule[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(true);
  const [directoryError, setDirectoryError] = useState(false);
  const [availabilityLoading, setAvailabilityLoading] = useState(true);
  const [availabilityError, setAvailabilityError] = useState(false);
  const [version, setVersion] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(initialCounselorId);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<CounselorStatusFilter>('all');
  const [specialization, setSpecialization] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const controller = new AbortController(); let active = true;
    void getCounselors(controller.signal).then((value) => { if (active) { setCounselors(normalizeCounselors(value)); setDirectoryError(false); } }).catch(() => { if (active) setDirectoryError(true); }).finally(() => { if (active) setDirectoryLoading(false); });
    void getAvailability(undefined, controller.signal).then((value) => { if (active) { setAvailability(value.availability); setAvailabilityError(false); } }).catch(() => { if (active) setAvailabilityError(true); }).finally(() => { if (active) setAvailabilityLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [version]);

  useLiveRefresh(useCallback(() => setVersion((value) => value + 1), []));
  const refresh = useCallback(() => { setDirectoryLoading(true); setAvailabilityLoading(true); setDirectoryError(false); setAvailabilityError(false); setVersion((value) => value + 1); }, []);
  const specializations = useMemo(() => Array.from(new Set(counselors.map((item) => item.specialization).filter((value): value is string => !!value))).sort((a, b) => a.localeCompare(b)), [counselors]);
  const filtered = useMemo(() => filterCounselors(counselors, search, status, specialization), [counselors, search, status, specialization]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const selected = counselors.find((item) => item.user_id === selectedId) ?? null;
  const locale = language === 'id' ? 'id-ID' : 'en-GB';
  const changeFilter = (action: () => void) => { setPage(1); action(); };
  const closeSelected = () => { setSelectedId(null); if (initialCounselorId) router.push('/counselors'); };
  const activeCount = counselors.filter((item) => item.active).length;
  const routineCount = availability.filter((item) => item.active).length;
  const counselorsWithCapacity = new Set(availability.filter((item) => item.active).map((item) => item.counselor_id)).size;

  return <PageShell title={copy.title} actions={<Button variant="secondary" icon="refresh" onClick={refresh}>{copy.refresh}</Button>}>
    <div className="counselor-stack">
      <section className="counselor-metrics" aria-label={copy.metrics.label}><article><Icon name="counselor" /><strong>{directoryError ? '—' : activeCount}</strong><span>{copy.metrics.active}</span></article><article><Icon name="calendar" /><strong>{availabilityError ? '—' : routineCount}</strong><span>{copy.metrics.windows}</span></article><article><Icon name="check" /><strong>{availabilityError ? '—' : counselorsWithCapacity}</strong><span>{copy.metrics.capacity}</span></article></section>
      <section className="counselor-filters" aria-label={copy.filters.label}>
        <label className="filter-field counselor-search"><span>{copy.filters.search}</span><div className="filter-input"><Icon name="search" size={18} /><input value={search} onChange={(event) => changeFilter(() => setSearch(event.target.value))} placeholder={copy.filters.searchPlaceholder} /></div></label>
        <label className="filter-field"><span>{copy.filters.status}</span><select value={status} onChange={(event) => changeFilter(() => setStatus(event.target.value as CounselorStatusFilter))}><option value="all">{copy.filters.allStatuses}</option><option value="active">{copy.status.active}</option><option value="inactive">{copy.status.inactive}</option></select></label>
        <label className="filter-field"><span>{copy.filters.specialization}</span><select value={specialization} onChange={(event) => changeFilter(() => setSpecialization(event.target.value))}><option value="">{copy.filters.allSpecializations}</option>{specializations.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
      </section>
      {availabilityError && <InlineAlert tone="warning">{copy.errors.availability}</InlineAlert>}
      {directoryLoading && counselors.length === 0 ? <section className="operations-panel counselor-directory-loading" aria-busy="true"><Skeleton lines={8} /></section> : directoryError ? <section className="operations-panel"><ErrorState title={text.errors.title} message={copy.errors.directory} retry={refresh} retryLabel={text.common.retry} /></section> : <section className="operations-panel" aria-label={copy.title}>
        <header className="counselor-table-header"><strong>{filtered.length} {copy.count}</strong></header>
        {rows.length === 0 ? <EmptyState title={copy.empty.directory} /> : <div className="operations-table-wrap"><table className="operations-table counselor-table"><thead><tr><th>{copy.fields.name}</th><th>{copy.fields.title}</th><th>{copy.fields.specialization}</th><th>{copy.fields.status}</th><th>{copy.fields.routine}</th><th>{copy.fields.action}</th></tr></thead><tbody>{rows.map((counselor) => { const routineCount = availability.filter((rule) => rule.counselor_id === counselor.user_id && rule.active).length; return <tr key={counselor.user_id}><td><span className="counselor-name-cell"><span className="avatar avatar-small">{counselorInitials(counselor.name)}</span><span><strong>{counselor.name}</strong><small>{counselor.email ?? copy.unavailable}</small></span></span></td><td>{counselor.title ?? copy.unavailable}</td><td>{counselor.specialization ?? copy.unavailable}</td><td><Badge tone={counselor.active ? 'success' : 'neutral'}>{counselor.active ? copy.status.active : copy.status.inactive}</Badge></td><td>{availabilityLoading ? '…' : availabilityError ? '—' : `${routineCount} ${copy.directory.routineWindows}`}</td><td><Button variant="secondary" onClick={() => setSelectedId(counselor.user_id)}>{copy.actions.profile}</Button></td></tr>; })}</tbody></table></div>}
        <footer className="monitoring-footer"><span>{copy.directory.showing} {filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} {copy.directory.of} {filtered.length}</span><div className="pagination"><Button variant="ghost" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>{copy.directory.previous}</Button><span>{copy.directory.page} {safePage} / {pageCount}</span><Button variant="ghost" disabled={safePage >= pageCount} onClick={() => setPage(safePage + 1)}>{copy.directory.next}</Button></div></footer>
      </section>}
    </div>
    <CounselorProfileDrawer key={selectedId ?? 'closed'} counselorId={selectedId} counselor={selected} directoryReady={!directoryLoading && !directoryError} availability={availability} availabilityLoading={availabilityLoading} availabilityError={availabilityError} locale={locale} copy={copy} onClose={closeSelected} onRefresh={refresh} />
  </PageShell>;
}

function CounselorProfileDrawer({ counselorId, counselor, directoryReady, availability, availabilityLoading, availabilityError, locale, copy, onClose, onRefresh }: { counselorId: string | null; counselor: Counselor | null; directoryReady: boolean; availability: AvailabilityRule[]; availabilityLoading: boolean; availabilityError: boolean; locale: string; copy: Copy; onClose: () => void; onRefresh: () => void }) {
  const { text } = useLanguage();
  const [operations, setOperations] = useState<CalendarResponse | null>(null);
  const [operationsLoading, setOperationsLoading] = useState(!!counselorId);
  const [operationsError, setOperationsError] = useState(false);
  const [operationsVersion, setOperationsVersion] = useState(0);
  const [editor, setEditor] = useState<'none' | 'profile' | 'schedule'>('none');
  const [title, setTitle] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [scheduleBase, setScheduleBase] = useState<ScheduleWindow[]>([]);
  const [scheduleDraft, setScheduleDraft] = useState<ScheduleWindow[]>([]);
  const [validation, setValidation] = useState<ScheduleValidation>(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState('');
  const [confirmStatus, setConfirmStatus] = useState(false);
  const [exceptionOpen, setExceptionOpen] = useState(false);

  useEffect(() => {
    if (!counselorId) return;
    const controller = new AbortController(); let active = true;
    const start = jakartaDateKey(new Date()); const end = addDays(start, 62);
    void getCounselorOperations(counselorId, start, end, controller.signal).then((value) => { if (active) { setOperations(value); setOperationsError(false); } }).catch(() => { if (active) setOperationsError(true); }).finally(() => { if (active) setOperationsLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [counselorId, operationsVersion]);

  const originalSchedule = useMemo(() => counselorId ? normalizeSchedule(availability, counselorId) : [], [availability, counselorId]);
  const allUpcoming = useMemo(() => upcomingAppointments(operations?.appointments ?? [], new Date(), Number.MAX_SAFE_INTEGER), [operations]);
  const upcoming = allUpcoming.slice(0, 5);
  const scheduleDirty = editor === 'schedule' && scheduleSignature(scheduleBase) !== scheduleSignature(scheduleDraft);
  const profileDirty = editor === 'profile' && !!counselor && (title !== (counselor.title ?? '') || specialization !== (counselor.specialization ?? ''));
  const requestClose = () => { if ((scheduleDirty || profileDirty) && !window.confirm(copy.editor.discardConfirm)) return; onClose(); };
  const closeEditor = () => { if ((scheduleDirty || profileDirty) && !window.confirm(copy.editor.discardConfirm)) return; setEditor('none'); setActionError(''); setValidation(null); };
  const startProfileEdit = () => { if (!counselor) return; setTitle(counselor.title ?? ''); setSpecialization(counselor.specialization ?? ''); setActionError(''); setEditor('profile'); };
  const startScheduleEdit = () => { setScheduleBase(originalSchedule); setScheduleDraft(originalSchedule); setValidation(null); setActionError(''); setEditor('schedule'); };
  const reloadOperations = () => { setOperationsLoading(true); setOperationsError(false); setOperationsVersion((value) => value + 1); };

  const saveProfile = async () => {
    if (!counselor) return; setSaving(true); setActionError('');
    try { await updateCounselorProfile(counselor.user_id, { title: title.trim() || null, specialization: specialization.trim() || null, active: counselor.active }); setEditor('none'); onRefresh(); }
    catch { setActionError(copy.editor.profileError); }
    finally { setSaving(false); }
  };
  const saveSchedule = async () => {
    if (!counselor) return; const issue = validateSchedule(scheduleDraft); setValidation(issue); if (issue) return;
    const plan = buildSchedulePlan(counselor.user_id, scheduleBase, scheduleDraft); if (plan.deactivateRuleIds.length === 0 && plan.create.length === 0) { setEditor('none'); return; }
    setSaving(true); setActionError('');
    try {
      for (const ruleId of plan.deactivateRuleIds) await deactivateAvailability(ruleId);
      for (const payload of plan.create) await createAvailability(payload);
      setEditor('none'); onRefresh(); reloadOperations();
    } catch { setEditor('none'); setActionError(copy.editor.partial); onRefresh(); reloadOperations(); }
    finally { setSaving(false); }
  };
  const toggleStatus = async () => {
    if (!counselor) return; setSaving(true); setActionError('');
    try { await updateCounselorProfile(counselor.user_id, { title: counselor.title, specialization: counselor.specialization, active: !counselor.active }); onRefresh(); }
    catch { setActionError(copy.drawer.activeMutationError); }
    finally { setSaving(false); }
  };

  const footer = counselor && editor === 'profile' ? <div className="drawer-actions"><Button variant="secondary" onClick={closeEditor}>{text.common.cancel}</Button><Button loading={saving} onClick={() => { void saveProfile(); }}>{copy.actions.saveProfile}</Button></div>
    : counselor && editor === 'schedule' ? <div className="drawer-actions"><Button variant="secondary" onClick={closeEditor}>{text.common.cancel}</Button><Button loading={saving} onClick={() => { void saveSchedule(); }}>{copy.actions.saveRoutine}</Button></div> : undefined;

  return <><Drawer open={!!counselorId} onOpenChange={(open) => { if (!open) requestClose(); }} title={counselor?.name ?? copy.sections.profile} description={counselor?.email ?? copy.drawer.loading} closeLabel={text.common.close} className="counselor-profile-drawer" footer={footer}>
    {!directoryReady ? <div className="drawer-skeleton"><Skeleton lines={9} /></div> : !counselor ? <ErrorState title={text.errors.notFound} message={copy.errors.notFound} /> : editor === 'profile' ? <ProfileEditor copy={copy} title={title} specialization={specialization} setTitle={setTitle} setSpecialization={setSpecialization} error={actionError} /> : editor === 'schedule' ? <ScheduleEditor copy={copy} windows={scheduleDraft} setWindows={setScheduleDraft} validation={validation} setValidation={setValidation} warning={copy.editor.saveWarning} error={actionError} /> : <div className="counselor-profile-content">
      <section className="counselor-identity"><span className="avatar counselor-avatar">{counselorInitials(counselor.name)}</span><div><Badge tone={counselor.active ? 'success' : 'neutral'}>{counselor.active ? copy.status.active : copy.status.inactive}</Badge><h3>{counselor.name}</h3><p>{counselor.email ?? copy.unavailable}</p></div></section>
      {actionError && <InlineAlert tone="danger">{actionError}</InlineAlert>}
      <div className="quick-actions counselor-actions"><Button variant="secondary" onClick={startProfileEdit}>{copy.actions.editProfile}</Button><Button variant="secondary" disabled={availabilityLoading || availabilityError} onClick={startScheduleEdit}>{copy.actions.editRoutine}</Button><Button variant="secondary" onClick={() => setExceptionOpen(true)}>{text.counseling.actions.addException}</Button><Button variant={counselor.active ? 'danger' : 'primary'} loading={saving} onClick={() => setConfirmStatus(true)}>{counselor.active ? copy.actions.deactivate : copy.actions.activate}</Button></div>
      <ProfileSection title={copy.sections.profile}><dl><Definition label={copy.fields.name} value={counselor.name} /><Definition label={copy.fields.email} value={counselor.email ?? copy.unavailable} /><Definition label={copy.fields.title} value={counselor.title ?? copy.unavailable} /><Definition label={copy.fields.specialization} value={counselor.specialization ?? copy.unavailable} /><Definition label={copy.fields.status} value={counselor.active ? copy.status.active : copy.status.inactive} /></dl><p className="section-note">{copy.drawer.profileNote}</p></ProfileSection>
      <ProfileSection title={copy.sections.routine}>{availabilityLoading ? <Skeleton lines={5} /> : availabilityError ? <InlineAlert tone="warning">{copy.errors.availability}</InlineAlert> : originalSchedule.length === 0 ? <p className="section-empty">{copy.empty.routine}</p> : <RoutineSchedule windows={originalSchedule} copy={copy} locale={locale} />}</ProfileSection>
      <ProfileSection title={copy.sections.exceptions}>{operationsLoading ? <Skeleton lines={3} /> : operationsError ? <InlineAlert tone="warning">{copy.errors.operations}</InlineAlert> : !operations?.blocked_periods.length ? <p className="section-empty">{copy.empty.exceptions}</p> : <ExceptionList blocks={operations.blocked_periods} locale={locale} copy={copy} onDeleted={reloadOperations} />}<p className="section-note"><Link href="/counseling">{copy.drawer.exceptionLink}</Link></p></ProfileSection>
      <ProfileSection title={copy.sections.upcoming}>{operationsLoading ? <Skeleton lines={4} /> : operationsError ? <InlineAlert tone="warning">{copy.errors.operations}</InlineAlert> : upcoming.length === 0 ? <p className="section-empty">{copy.empty.upcoming}</p> : <UpcomingList appointments={upcoming} locale={locale} labels={text.counseling.status.backend} />}<p className="section-note">{copy.drawer.rangeNote}</p></ProfileSection>
    </div>}
    <ConfirmationDialog open={confirmStatus} onOpenChange={setConfirmStatus} title={counselor?.active ? copy.actions.deactivate : copy.actions.activate} consequence={<><p>{copy.drawer.activeWarning}</p><p>{counselor?.active ? allUpcoming.length > 0 ? copy.drawer.deactivateWithAppointments.replace('{count}', String(allUpcoming.length)) : copy.drawer.deactivateWithoutAppointments : copy.drawer.activateConfirm}</p></>} confirmLabel={counselor?.active ? copy.actions.deactivate : copy.actions.activate} danger={!!counselor?.active} onConfirm={() => { void toggleStatus(); }} />
  </Drawer>{counselor && <ExceptionDrawer key={`${exceptionOpen}-${counselor.user_id}`} open={exceptionOpen} counselors={[counselor]} appointments={operations?.appointments ?? []} initialCounselorId={counselor.user_id} copy={text.counseling} locale={locale} onClose={() => setExceptionOpen(false)} onSaved={() => { setExceptionOpen(false); reloadOperations(); }} />}</>;
}

function ProfileEditor({ copy, title, specialization, setTitle, setSpecialization, error }: { copy: Copy; title: string; specialization: string; setTitle: (value: string) => void; setSpecialization: (value: string) => void; error: string }) {
  return <div className="counselor-editor"><h3>{copy.editor.title}</h3>{error && <InlineAlert tone="danger">{error}</InlineAlert>}<Input label={copy.fields.title} value={title} maxLength={100} hint={copy.editor.titleHint} onChange={(event) => setTitle(event.target.value)} /><Input label={copy.fields.specialization} value={specialization} maxLength={250} hint={copy.editor.specializationHint} onChange={(event) => setSpecialization(event.target.value)} /></div>;
}

function ScheduleEditor({ copy, windows, setWindows, validation, setValidation, warning, error }: { copy: Copy; windows: ScheduleWindow[]; setWindows: (windows: ScheduleWindow[]) => void; validation: ScheduleValidation; setValidation: (value: ScheduleValidation) => void; warning: string; error: string }) {
  const keySequence = useRef(0);
  const update = (key: string, field: keyof Pick<ScheduleWindow, 'startTime' | 'endTime' | 'effectiveFrom' | 'effectiveTo'>, value: string) => { setValidation(null); setWindows(windows.map((window) => window.key === key ? { ...window, [field]: value } : window)); };
  const nextKey = () => { keySequence.current += 1; return `new-${keySequence.current}`; };
  return <div className="schedule-editor"><h3>{copy.editor.routineTitle}</h3><InlineAlert tone="warning">{warning}</InlineAlert>{error && <InlineAlert tone="danger">{error}</InlineAlert>}{validation && <InlineAlert tone="danger">{copy.editor[validation]}</InlineAlert>}{WEEKDAY_ORDER.map((day) => { const rows = windowsForDay(windows, day); return <section className="schedule-day-editor" key={day}><header><strong>{copy.weekdays[day]}</strong><label><input type="checkbox" checked={rows.length > 0} onChange={(event) => { setValidation(null); setWindows(event.target.checked ? addScheduleWindow(windows, day, nextKey()) : windows.filter((window) => window.dayOfWeek !== day)); }} /> {copy.editor.dayEnabled}</label></header>{rows.map((window) => <div className="schedule-window-editor" key={window.key}><label><span>{copy.editor.startTime}</span><TimeInput label={copy.editor.startTime} value={window.startTime} onChange={(value) => update(window.key, 'startTime', value)} /></label><label><span>{copy.editor.endTime}</span><TimeInput label={copy.editor.endTime} value={window.endTime} onChange={(value) => update(window.key, 'endTime', value)} /></label><label><span>{copy.editor.from}</span><input type="date" value={window.effectiveFrom} onChange={(event) => update(window.key, 'effectiveFrom', event.target.value)} /></label><label><span>{copy.editor.until}</span><input type="date" value={window.effectiveTo} onChange={(event) => update(window.key, 'effectiveTo', event.target.value)} /></label><Button variant="ghost" onClick={() => { setValidation(null); setWindows(removeScheduleWindow(windows, window.key)); }}>{copy.actions.removeWindow}</Button></div>)}{rows.length > 0 && <Button className="add-window" variant="secondary" onClick={() => setWindows(addScheduleWindow(windows, day, nextKey()))}>{copy.actions.addWindow}</Button>}</section>; })}</div>;
}

function ProfileSection({ title, children }: { title: string; children: React.ReactNode }) { return <section className="profile-card counselor-profile-section"><h3>{title}</h3><div className="profile-card-body">{children}</div></section>; }
function Definition({ label, value }: { label: string; value: string }) { return <div className="definition-row"><dt>{label}</dt><dd>{value}</dd></div>; }

function RoutineSchedule({ windows, copy, locale }: { windows: ScheduleWindow[]; copy: Copy; locale: string }) {
  return <div className="routine-week">{WEEKDAY_ORDER.map((day) => { const rows = windowsForDay(windows, day); return <div className="routine-day" key={day}><strong>{copy.weekdays[day]}</strong><div>{rows.length === 0 ? <span>{copy.unavailable}</span> : rows.map((window) => <span key={window.key}><b>{window.startTime}–{window.endTime}</b><small>{formatEffective(window, locale, copy)}</small></span>)}</div></div>; })}</div>;
}

function ExceptionList({ blocks, locale, copy, onDeleted }: { blocks: CalendarResponse['blocked_periods']; locale: string; copy: Copy; onDeleted: () => void }) {
  const { text } = useLanguage();
  const [deleting, setDeleting] = useState('');
  const [error, setError] = useState(false);
  const remove = async (id: string) => { if (!window.confirm(text.counseling.exceptions.confirmDelete)) return; setDeleting(id); setError(false); try { await deleteBlockedPeriod(id); onDeleted(); } catch { setError(true); } finally { setDeleting(''); } };
  return <>{error && <InlineAlert tone="danger">{text.counseling.errors.mutation}</InlineAlert>}<ul className="profile-list">{blocks.slice(0, 5).map((block) => <li key={block.counselor_blocked_period_id}><strong>{formatDate(block.starts_at, locale)} · {isFullDayBlock(block.starts_at, block.ends_at) ? text.counseling.exceptions.fullDay : formatTimeRange(block.starts_at, block.ends_at, locale)}</strong>{block.review_status && <Badge tone={block.review_status === 'approved' ? 'success' : block.review_status === 'rejected' ? 'danger' : 'warning'}>{text.counseling.exceptions[block.review_status]}</Badge>}<span>{block.reason ?? copy.unavailable}</span>{block.source !== 'counselor' && <Button variant="ghost" loading={deleting === block.counselor_blocked_period_id} onClick={() => { void remove(block.counselor_blocked_period_id); }}>{text.counseling.actions.removeException}</Button>}</li>)}</ul></>;
}

function UpcomingList({ appointments, locale, labels }: { appointments: Appointment[]; locale: string; labels: Record<Appointment['status'], string> }) {
  return <ul className="profile-list">{appointments.map((appointment) => <li key={appointment.counseling_appointment_id}><strong>{formatDate(appointment.starts_at, locale)} · {formatTimeRange(appointment.starts_at, appointment.ends_at, locale)}</strong><span>{appointment.student_name}{appointment.nim ? ` · ${appointment.nim}` : ''}</span><Badge tone="info">{labels[appointment.status]}</Badge></li>)}</ul>;
}

function formatDate(value: string, locale: string): string { return new Intl.DateTimeFormat(locale, { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)); }
function formatTimeRange(start: string, end: string, locale: string): string { const formatter = new Intl.DateTimeFormat(locale, { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false }); return `${formatter.format(new Date(start))}–${formatter.format(new Date(end))}`; }
function isFullDayBlock(start: string, end: string): boolean {
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const startDate = new Date(start);
  const endDate = new Date(end);
  return time.format(startDate) === '00:00' && time.format(endDate) === '00:00' && endDate.getTime() - startDate.getTime() === 86_400_000;
}
function formatEffective(window: ScheduleWindow, locale: string, copy: Copy): string { if (!window.effectiveFrom && !window.effectiveTo) return copy.editor.noEnd; const format = (value: string) => value ? new Intl.DateTimeFormat(locale, { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00Z`)) : copy.editor.noEnd; return `${format(window.effectiveFrom)} – ${format(window.effectiveTo)}`; }
