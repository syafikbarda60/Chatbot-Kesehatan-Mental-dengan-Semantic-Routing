'use client';

import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { ApiError } from '@/lib/api/client';
import { Badge, Button, Drawer, EmptyState, ErrorState, handleTabListKeyDown, Icon, InlineAlert, Input, PageShell, Skeleton, TimeField } from '@/components/ui';
import { useLiveRefresh } from '@/lib/realtime/useLiveRefresh';
import { assignCounselingRequest, deleteBlockedPeriod, getCounselingCalendar, getCounselingRequests, getCounselingResources, getCounselors, updateAppointment } from './api';
import { activeAvailability, addDays, deriveSessionStatus, filterAppointments, hasObviousConflict, isEffectiveException, jakartaDateKey, JAKARTA_TIME_ZONE, localSchedulePayload, normalizeRequests, resourceAvailability, resourceConflictIds, weekRange, type ResourceAvailabilityState, type SessionDisplayStatus } from './model';
import type { Appointment, AppointmentStatus, BlockedPeriod, CalendarResponse, Counselor, CounselingRequest, CounselingResource, RequestResponse } from './types';
import type { Messages } from '@/lib/i18n/messages';
import { isPreviewMode } from '@/lib/previewMode';
import { ExceptionDrawer } from './ExceptionDrawer';

const REQUEST_PAGE_SIZE = 20;
type Tab = 'calendar' | 'requests' | 'availability' | 'exceptions';
type View = 'week' | 'month' | 'list';
type CounselingCopy = Messages['counseling'];

export function CounselingWorkspace() {
  const { language, text } = useLanguage();
  const copy = text.counseling;
  const locale = language === 'id' ? 'id-ID' : 'en-GB';
  const [now, setNow] = useState(() => new Date());
  const [anchor, setAnchor] = useState(() => jakartaDateKey(new Date()));
  const [tab, setTab] = useState<Tab>('calendar');
  const [view, setView] = useState<View>('week');
  const [counselorId, setCounselorId] = useState('');
  const [status, setStatus] = useState<'' | AppointmentStatus>('');
  const [resourceId, setResourceId] = useState('');
  const [resources, setResources] = useState<CounselingResource[]>([]);
  const [resourceError, setResourceError] = useState(false);
  const [calendar, setCalendar] = useState<CalendarResponse | null>(null);
  const [counselors, setCounselors] = useState<Counselor[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [calendarError, setCalendarError] = useState(false);
  const [counselorError, setCounselorError] = useState(false);
  const [calendarVersion, setCalendarVersion] = useState(0);
  const [requests, setRequests] = useState<RequestResponse | null>(null);
  const [requestPage, setRequestPage] = useState(1);
  const [requestLoading, setRequestLoading] = useState(true);
  const [requestError, setRequestError] = useState(false);
  const [requestVersion, setRequestVersion] = useState(0);
  const [selectedRequest, setSelectedRequest] = useState<CounselingRequest | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [exceptionOpen, setExceptionOpen] = useState(false);
  const [exceptionFrom, setExceptionFrom] = useState(() => weekRange(jakartaDateKey(new Date())).start);
  const [exceptionTo, setExceptionTo] = useState(() => weekRange(jakartaDateKey(new Date())).end);
  const range = useMemo(() => view === 'month' ? monthRange(anchor) : weekRange(anchor), [anchor, view]);
  const loadedRange = tab === 'exceptions' ? { start: exceptionFrom, end: exceptionTo } : range;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void getCounselingCalendar(loadedRange.start, loadedRange.end, counselorId || undefined, controller.signal)
      .then((value) => { setCalendar(value); setCalendarError(false); })
      .catch((error: unknown) => { if (!(error instanceof DOMException && error.name === 'AbortError')) setCalendarError(true); })
      .finally(() => { if (!controller.signal.aborted) setCalendarLoading(false); });
    return () => controller.abort();
  }, [loadedRange.start, loadedRange.end, counselorId, calendarVersion]);

  useEffect(() => {
    const controller = new AbortController();
    void getCounselors(controller.signal)
      .then((value) => { setCounselors(value.counselors); setCounselorError(false); })
      .catch((error: unknown) => { if (!(error instanceof DOMException && error.name === 'AbortError')) setCounselorError(true); });
    return () => controller.abort();
  }, [calendarVersion]);

  useEffect(() => {
    const controller = new AbortController();
    void getCounselingResources(controller.signal).then((value) => { setResources(value.resources); setResourceError(false); }).catch((error: unknown) => { if (!(error instanceof DOMException && error.name === 'AbortError')) setResourceError(true); });
    return () => controller.abort();
  }, [calendarVersion]);

  useEffect(() => {
    const controller = new AbortController();
    void getCounselingRequests(requestPage, REQUEST_PAGE_SIZE, controller.signal)
      .then((value) => { setRequests({ ...value, requests: normalizeRequests(value) }); setRequestError(false); })
      .catch((error: unknown) => { if (!(error instanceof DOMException && error.name === 'AbortError')) setRequestError(true); })
      .finally(() => { if (!controller.signal.aborted) setRequestLoading(false); });
    return () => controller.abort();
  }, [requestPage, requestVersion]);

  const refresh = useCallback(() => {
    setNow(new Date());
    setCalendarLoading(true);
    setRequestLoading(true);
    setCalendarVersion((value) => value + 1);
    setRequestVersion((value) => value + 1);
  }, []);
  const liveRefresh = useCallback(() => {
    setNow(new Date());
    setCalendarVersion((value) => value + 1);
    setRequestVersion((value) => value + 1);
  }, []);
  useLiveRefresh(liveRefresh, { topics: ['requests', 'schedule'] });
  const afterMutation = useCallback(() => {
    setSelectedRequest(null);
    setSelectedAppointment(null);
    setExceptionOpen(false);
    refresh();
  }, [refresh]);
  const appointments = useMemo(() => filterAppointments(calendar?.appointments ?? [], counselorId, status, resourceId), [calendar, counselorId, status, resourceId]);
  const today = jakartaDateKey(now);
  const todaySessions = range.days.includes(today) ? appointments.filter((item) => jakartaDateKey(new Date(item.starts_at)) === today && !['cancelled', 'no_show'].includes(item.status)).length : null;
  const activeCounselors = counselors.filter((item) => item.active).length;
  const activeRules = activeAvailability(calendar?.availability ?? []);
  const availableSlots = Math.max(0, activeRules.length - (calendar?.blocked_periods.length ?? 0));
  const resourceConflicts = useMemo(() => resourceConflictIds(appointments, resources), [appointments, resources]);
  const conflicts = useMemo(() => appointments.filter((item, index) => resourceConflicts.has(item.counseling_appointment_id) || appointments.some((other, otherIndex) => otherIndex !== index && item.counselor_id === other.counselor_id && item.starts_at < other.ends_at && item.ends_at > other.starts_at)).length, [appointments, resourceConflicts]);

  return <PageShell title={copy.title} actions={<Button variant="secondary" icon="refresh" onClick={refresh}>{copy.refresh}</Button>}>
    <div className="counseling-stack">
      <section className="counseling-metrics" aria-label={copy.metrics.label}>
        <ScheduleMetric icon="calendar" value={requestError ? '—' : requests?.total ?? '—'} label={copy.metrics.pending} />
        <ScheduleMetric icon="check" value={calendarError ? '—' : todaySessions ?? '—'} label={todaySessions === null ? copy.metrics.todayOutsideRange : copy.metrics.today} />
        <ScheduleMetric icon="counselor" value={counselorError ? '—' : activeCounselors} label={copy.metrics.counselors} />
        <ScheduleMetric icon="calendar" value={calendarError ? '—' : availableSlots} label={copy.metrics.slots} />
        <ScheduleMetric icon="alert" value={calendarError ? '—' : conflicts} label={copy.metrics.conflicts} />
      </section>

      <div className="workspace-tabs" role="tablist" aria-label={copy.tabs.label} onKeyDown={handleTabListKeyDown}>
        {(['calendar', 'requests', 'availability', 'exceptions'] as Tab[]).map((key) => <button key={key} role="tab" aria-selected={tab === key} tabIndex={tab === key ? 0 : -1} aria-controls={`counseling-${key}`} id={`counseling-tab-${key}`} onClick={() => setTab(key)}>{copy.tabs[key]}</button>)}
      </div>

      <div className={tab === 'calendar' ? 'counseling-layout' : undefined}><section id={`counseling-${tab}`} role="tabpanel" aria-labelledby={`counseling-tab-${tab}`} className="counseling-workspace">
        {tab === 'calendar' && <CalendarTab copy={copy} locale={locale} now={now} range={range} anchor={anchor} setAnchor={(value) => { setCalendarLoading(true); setAnchor(value); }} view={view} setView={setView} counselorId={counselorId} setCounselorId={(value) => { setCalendarLoading(true); setCounselorId(value); }} resourceId={resourceId} setResourceId={setResourceId} status={status} setStatus={setStatus} counselors={counselors} resources={resources} resourceConflicts={resourceConflicts} appointments={appointments} loading={calendarLoading} error={calendarError} retry={refresh} onOpen={setSelectedAppointment} />}
        {tab === 'requests' && <RequestsTab copy={copy} locale={locale} response={requests} loading={requestLoading} error={requestError} page={requestPage} setPage={(value) => { setRequestLoading(true); setRequestPage(value); }} retry={refresh} onAssign={setSelectedRequest} />}
        {tab === 'availability' && <AvailabilityTab copy={copy} locale={locale} calendar={calendar} counselors={counselors} loading={calendarLoading} error={calendarError} retry={refresh} />}
        {tab === 'exceptions' && <ExceptionsTab copy={copy} locale={locale} blocks={calendar?.blocked_periods ?? []} counselors={counselors} counselorId={counselorId} setCounselorId={(value) => { setCalendarLoading(true); setCounselorId(value); }} dateFrom={exceptionFrom} dateTo={exceptionTo} setDateFrom={(value) => { setCalendarLoading(true); setExceptionFrom(value); }} setDateTo={(value) => { setCalendarLoading(true); setExceptionTo(value); }} loading={calendarLoading} error={calendarError} retry={refresh} onCreate={() => setExceptionOpen(true)} onDeleted={afterMutation} />}
      </section>{tab === 'calendar' && <aside className="counseling-rail" aria-label={copy.rail.title}><RailSection title={copy.rail.requests} value={requestError ? '—' : requests?.total ?? 0}>{copy.rail.requestsBody}</RailSection><ResourceRail resources={resources} calendar={calendar} selectedDate={anchor} locale={locale} copy={copy} error={resourceError} /></aside>}</div>
    </div>
    <ScheduleDrawer key={selectedRequest?.counseling_request_id ?? selectedAppointment?.counseling_appointment_id ?? 'closed'} request={selectedRequest} appointment={selectedAppointment} counselors={counselors.filter((item) => item.active)} resources={resources.filter((item) => item.active)} calendar={calendar} copy={copy} onClose={() => { setSelectedRequest(null); setSelectedAppointment(null); }} onSaved={afterMutation} />
    <ExceptionDrawer key={`${exceptionOpen}-${counselorId}`} open={exceptionOpen} counselors={counselors.filter((item) => item.active)} appointments={calendar?.appointments ?? []} initialCounselorId={counselorId} copy={copy} locale={locale} onClose={() => setExceptionOpen(false)} onSaved={afterMutation} />
  </PageShell>;
}

function ScheduleMetric({ icon, value, label }: { icon: 'calendar' | 'check' | 'counselor' | 'alert'; value: number | string; label: string }) {
  return <article className="schedule-metric"><span><Icon name={icon} /></span><div><strong>{value}</strong><p>{label}</p></div></article>;
}
function RailSection({ title, value, children }: { title: string; value: number | string; children: React.ReactNode }) { return <section className="rail-card"><header><h2>{title}</h2><strong>{value}</strong></header><p>{children}</p></section>; }

function ResourceRail({ resources, calendar, selectedDate, locale, copy, error }: { resources: CounselingResource[]; calendar: CalendarResponse | null; selectedDate: string; locale: string; copy: CounselingCopy; error: boolean }) {
  const now = new Date();
  const startsAt = selectedDate === jakartaDateKey(now) ? now.toISOString() : new Date(`${selectedDate}T00:00:00+07:00`).toISOString();
  const endsAt = new Date(Date.parse(startsAt) + 60_000).toISOString();
  return <section className="rail-card resource-rail"><header><h2>{copy.rail.resources}</h2>{isPreviewMode() && <Badge tone="info">{copy.rail.preview}</Badge>}</header>{error ? <p>{copy.errors.calendar}</p> : resources.length === 0 ? <p>{copy.unavailable}</p> : <ul className="resource-list">{resources.map((resource) => { const availability = resourceAvailability(resource, calendar?.appointments ?? [], calendar?.resource_blocks ?? [], startsAt, endsAt, calendar?.resource_authority_complete === true); return <li key={resource.counseling_resource_id}><span><strong>{resource.name}</strong><small>{resource.resource_type === 'virtual' ? 'Virtual' : `${resource.capacity}×`}</small></span><span><Badge tone={resourceTone(availability.state)}>{resourceStateLabel(availability.state, copy)}</Badge>{availability.nextInterval && <small>{formatTimeRange(availability.nextInterval.starts_at, availability.nextInterval.ends_at, locale)}</small>}</span></li>; })}</ul>}{calendar?.resource_authority_complete !== true && <p>{copy.rail.backendPending}</p>}</section>;
}

function resourceStateLabel(state: ResourceAvailabilityState, copy: CounselingCopy): string {
  return state === 'capacity_full' ? copy.rail.capacityFull : copy.rail[state];
}

function resourceTone(state: ResourceAvailabilityState): 'success' | 'danger' | 'warning' | 'neutral' | 'info' {
  if (state === 'available') return 'success';
  if (state === 'blocked' || state === 'capacity_full') return 'danger';
  if (state === 'occupied') return 'warning';
  return state === 'unknown' ? 'info' : 'neutral';
}

interface CalendarTabProps { copy: CounselingCopy; locale: string; now: Date; range: ReturnType<typeof weekRange>; anchor: string; setAnchor: (value: string) => void; view: View; setView: Dispatch<SetStateAction<View>>; counselorId: string; setCounselorId: (value: string) => void; resourceId: string; setResourceId: (value: string) => void; status: '' | AppointmentStatus; setStatus: Dispatch<SetStateAction<'' | AppointmentStatus>>; counselors: Counselor[]; resources: CounselingResource[]; resourceConflicts: Set<string>; appointments: Appointment[]; loading: boolean; error: boolean; retry: () => void; onOpen: (item: Appointment) => void }
function CalendarTab({ copy, locale, now, range, anchor, setAnchor, view, setView, counselorId, setCounselorId, resourceId, setResourceId, status, setStatus, counselors, resources, resourceConflicts, appointments, loading, error, retry, onOpen }: CalendarTabProps) {
  return <>
    <div className="calendar-toolbar">
      <div className="calendar-navigation"><Button variant="ghost" className="calendar-step" aria-label={copy.calendar.previous} title={copy.calendar.previous} onClick={() => setAnchor(view === 'month' ? addMonths(anchor, -1) : addDays(anchor, -7))}><Icon name="chevron" className="icon-flip" /></Button><Button variant="secondary" onClick={() => setAnchor(jakartaDateKey(new Date()))}>{copy.calendar.today}</Button><Button variant="ghost" className="calendar-step" aria-label={copy.calendar.next} title={copy.calendar.next} onClick={() => setAnchor(view === 'month' ? addMonths(anchor, 1) : addDays(anchor, 7))}><Icon name="chevron" /></Button><strong aria-live="polite">{view === 'month' ? formatMonth(anchor, locale) : formatDateRange(range.start, range.end, locale)}</strong></div>
      <div className="segmented-control" aria-label={copy.calendar.view}><button aria-pressed={view === 'week'} onClick={() => setView('week')}>{copy.calendar.week}</button><button aria-pressed={view === 'month'} onClick={() => setView('month')}>{copy.calendar.month}</button><button aria-pressed={view === 'list'} onClick={() => setView('list')}>{copy.calendar.list}</button></div>
      <div className="calendar-controls">
        <label><span className="sr-only">{copy.filters.counselor}</span><select value={counselorId} onChange={(event) => setCounselorId(event.target.value)}><option value="">{copy.filters.allCounselors}</option>{counselors.filter((item: Counselor) => item.active).map((item: Counselor) => <option key={item.user_id} value={item.user_id}>{item.name}</option>)}</select></label>
        <label><span className="sr-only">{copy.filters.resource}</span><select value={resourceId} onChange={(event) => setResourceId(event.target.value)}><option value="">{copy.filters.allResources}</option>{resources.map((item) => <option key={item.counseling_resource_id} value={item.counseling_resource_id}>{item.name}</option>)}</select></label>
        <label><span className="sr-only">{copy.filters.status}</span><select value={status} onChange={(event) => setStatus(event.target.value as '' | AppointmentStatus)}><option value="">{copy.filters.allStatuses}</option>{(['confirmed', 'rescheduled', 'completed', 'cancelled', 'no_show'] as AppointmentStatus[]).map((item) => <option value={item} key={item}>{copy.status.backend[item]}</option>)}</select></label>
      </div>
    </div>
    {loading ? <CalendarSkeleton /> : error ? <ErrorState title={copy.errors.calendarTitle} message={copy.errors.calendar} retry={retry} /> : view === 'list' ? (appointments.length === 0 ? <EmptyState title={copy.empty.calendar} /> : <AppointmentList appointments={appointments} resources={resources} resourceConflicts={resourceConflicts} now={now} locale={locale} copy={copy} onOpen={onOpen} />) : view === 'month' ? <MonthCalendar days={range.days} anchor={anchor} appointments={appointments} now={now} locale={locale} copy={copy} onOpen={onOpen} onOpenWeek={(day) => { setAnchor(day); setView('week'); }} /> : <WeekCalendar days={range.days} appointments={appointments} resources={resources} resourceConflicts={resourceConflicts} now={now} locale={locale} copy={copy} onOpen={onOpen} />}
  </>;
}

function WeekCalendar({ days, appointments, resources, resourceConflicts, now, locale, copy, onOpen }: { days: string[]; appointments: Appointment[]; resources: CounselingResource[]; resourceConflicts: Set<string>; now: Date; locale: string; copy: CounselingCopy; onOpen: (item: Appointment) => void }) {
  const today = jakartaDateKey(now);
  return <div className="week-calendar" aria-label={copy.calendar.week} tabIndex={0}>{days.map((day) => {
    const rows = appointments.filter((item) => jakartaDateKey(new Date(item.starts_at)) === day);
    return <section className={`calendar-day ${day === today ? 'calendar-day-today' : ''}`} key={day}><header><span>{formatWeekday(day, locale)}</span> <strong>{formatDay(day, locale)}</strong>{day === today && <small className="now-marker">{copy.calendar.now} {formatTime(now.toISOString(), locale)}</small>}</header><div className="calendar-day-events">{rows.length === 0 ? <span className="calendar-day-empty">—</span> : rows.map((item) => <AppointmentButton key={item.counseling_appointment_id} item={item} resource={resources.find((resource) => resource.counseling_resource_id === item.counseling_resource_id)} conflict={resourceConflicts.has(item.counseling_appointment_id)} now={now} locale={locale} copy={copy} onOpen={onOpen} />)}</div></section>;
  })}</div>;
}

function AppointmentButton({ item, resource, conflict, now, locale, copy, onOpen }: { item: Appointment; resource?: CounselingResource; conflict: boolean; now: Date; locale: string; copy: CounselingCopy; onOpen: (item: Appointment) => void }) {
  const status = deriveSessionStatus(item, now);
  return <button className={`calendar-event event-${status} ${conflict ? 'event-resource-conflict' : ''}`} onClick={() => onOpen(item)} aria-label={`${item.student_name}, ${formatTimeRange(item.starts_at, item.ends_at, locale)}, ${copy.status.display[status]}`}><span className="event-time">{formatTimeRange(item.starts_at, item.ends_at, locale)}</span><strong>{item.student_name}</strong><small>{item.counselor_name}{(resource?.name || item.resource_name) && <> · <span className="event-resource">{resource?.name ?? item.resource_name}</span></>}</small><span className="event-badges">{conflict && <Badge tone="danger">{copy.rail.capacityFull}</Badge>}<Badge tone={statusTone(status)}>{copy.status.display[status]}</Badge></span></button>;
}

const MONTH_DAY_LIMIT = 3;
function MonthCalendar({ days, anchor, appointments, now, locale, copy, onOpen, onOpenWeek }: { days: string[]; anchor: string; appointments: Appointment[]; now: Date; locale: string; copy: CounselingCopy; onOpen: (item: Appointment) => void; onOpenWeek: (day: string) => void }) {
  const today = jakartaDateKey(now); const month = anchor.slice(0, 7);
  return <div className="month-calendar" aria-label={copy.calendar.month}>{days.slice(0, 7).map((day) => <div className="month-weekday" key={`head-${day}`}>{formatWeekday(day, locale)}</div>)}{days.map((day) => {
    const rows = appointments.filter((item) => jakartaDateKey(new Date(item.starts_at)) === day).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    return <section className={`month-day ${day.slice(0, 7) === month ? '' : 'month-day-outside'} ${day === today ? 'month-day-today' : ''}`} key={day}><button className="month-day-number" onClick={() => onOpenWeek(day)} aria-label={`${copy.calendar.openWeek} ${formatDay(day, locale)}`}>{Number(day.slice(8))}</button>{rows.length > 0 && <span className="month-count" aria-hidden="true">{rows.length}</span>}{rows.slice(0, MONTH_DAY_LIMIT).map((item) => { const status = deriveSessionStatus(item, now); return <button key={item.counseling_appointment_id} className={`month-event event-${status}`} onClick={() => onOpen(item)} aria-label={`${item.student_name}, ${formatTimeRange(item.starts_at, item.ends_at, locale)}, ${copy.status.display[status]}`}><time>{formatTime(item.starts_at, locale)}</time> {item.student_name}</button>; })}{rows.length > MONTH_DAY_LIMIT && <button className="month-more" onClick={() => onOpenWeek(day)}>+{rows.length - MONTH_DAY_LIMIT} {copy.calendar.more}</button>}</section>;
  })}</div>;
}

function AppointmentList({ appointments, resources, resourceConflicts, now, locale, copy, onOpen }: { appointments: Appointment[]; resources: CounselingResource[]; resourceConflicts: Set<string>; now: Date; locale: string; copy: CounselingCopy; onOpen: (item: Appointment) => void }) {
  return <div className="operations-table-wrap"><table className="operations-table counseling-list"><thead><tr><th>{copy.fields.date}</th><th>{copy.fields.time}</th><th>{copy.fields.student}</th><th>{copy.fields.counselor}</th><th>{copy.fields.resource}</th><th>{copy.fields.status}</th><th>{copy.fields.action}</th></tr></thead><tbody>{appointments.map((item) => { const status = deriveSessionStatus(item, now); const resource = resources.find((row) => row.counseling_resource_id === item.counseling_resource_id); return <tr className={resourceConflicts.has(item.counseling_appointment_id) ? 'row-resource-conflict' : ''} key={item.counseling_appointment_id}><td>{formatDate(item.starts_at, locale)}</td><td>{formatTimeRange(item.starts_at, item.ends_at, locale)}</td><td><strong>{item.student_name}</strong><small>{item.nim ?? copy.unavailable}</small></td><td>{item.counselor_name}</td><td>{resource?.name ?? item.resource_name ?? copy.unavailable}</td><td>{resourceConflicts.has(item.counseling_appointment_id) ? <Badge tone="danger">{copy.rail.capacityFull}</Badge> : <Badge tone={statusTone(status)}>{copy.status.display[status]}</Badge>}</td><td><Button variant="secondary" onClick={() => onOpen(item)}>{copy.actions.view}</Button></td></tr>; })}</tbody></table></div>;
}

interface RequestsTabProps { copy: CounselingCopy; locale: string; response: RequestResponse | null; loading: boolean; error: boolean; page: number; setPage: (value: number) => void; retry: () => void; onAssign: (item: CounselingRequest) => void }
function RequestsTab({ copy, locale, response, loading, error, page, setPage, retry, onAssign }: RequestsTabProps) {
  const pages = Math.max(1, Math.ceil((response?.total ?? 0) / REQUEST_PAGE_SIZE));
  if (loading && !response) return <ListSkeleton />;
  if (error) return <ErrorState title={copy.errors.requestsTitle} message={copy.errors.requests} retry={retry} />;
  if (!response?.requests.length) return <EmptyState title={copy.empty.requests} />;
  return <><div className="operations-table-wrap"><table className="operations-table request-table"><thead><tr><th>{copy.fields.student}</th><th>{copy.fields.academic}</th><th>{copy.fields.submitted}</th><th>{copy.fields.status}</th><th>{copy.fields.action}</th></tr></thead><tbody>{response.requests.map((item) => <tr key={item.counseling_request_id}><td><strong>{item.name}</strong><small>{item.nim ?? copy.unavailable}</small></td><td><span>{item.faculty_name ?? copy.unavailable}</span><small>{item.academic_unit_name ?? copy.unavailable}</small></td><td>{formatDateTime(item.created_at, locale)}</td><td><Badge tone="warning">{copy.status.requested}</Badge></td><td><Button onClick={() => onAssign(item)}>{copy.actions.schedule}</Button></td></tr>)}</tbody></table></div><footer className="table-footer"><p>{copy.pagination.showing} {(page - 1) * REQUEST_PAGE_SIZE + 1}–{Math.min(page * REQUEST_PAGE_SIZE, response.total)} {copy.pagination.of} {response.total}</p><div className="pagination"><Button variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>{copy.calendar.previous}</Button><span>{copy.pagination.page} {page} / {pages}</span><Button variant="ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}>{copy.calendar.next}</Button></div></footer></>;
}

interface AvailabilityTabProps { copy: CounselingCopy; locale: string; calendar: CalendarResponse | null; counselors: Counselor[]; loading: boolean; error: boolean; retry: () => void }
function AvailabilityTab({ copy, locale, calendar, counselors, loading, error, retry }: AvailabilityTabProps) {
  if (loading && !calendar) return <ListSkeleton />;
  if (error) return <ErrorState title={copy.errors.availabilityTitle} message={copy.errors.availability} retry={retry} />;
  const rules = activeAvailability(calendar?.availability ?? []);
  if (!rules.length) return <EmptyState title={copy.empty.availability} />;
  return <div className="availability-grid">{counselors.filter((person: Counselor) => rules.some((rule) => rule.counselor_id === person.user_id)).map((person: Counselor) => <article className="availability-card" key={person.user_id}><header><span className="avatar-small">{initials(person.name)}</span><div><h2>{person.name}</h2>{person.title && <p>{person.title}</p>}</div></header><ul>{rules.filter((rule) => rule.counselor_id === person.user_id).map((rule) => <li key={rule.counselor_availability_rule_id}><strong>{weekdayName(rule.day_of_week, locale)}</strong><span>{shortTime(rule.start_time)}–{shortTime(rule.end_time)}</span><small>{rule.timezone}</small></li>)}</ul></article>)}</div>;
}

interface ExceptionsTabProps { copy: CounselingCopy; locale: string; blocks: BlockedPeriod[]; counselors: Counselor[]; counselorId: string; setCounselorId: (value: string) => void; dateFrom: string; dateTo: string; setDateFrom: (value: string) => void; setDateTo: (value: string) => void; loading: boolean; error: boolean; retry: () => void; onCreate: () => void; onDeleted: () => void }
function ExceptionsTab({ copy, locale, blocks, counselors, counselorId, setCounselorId, dateFrom, dateTo, setDateFrom, setDateTo, loading, error, retry, onCreate, onDeleted }: ExceptionsTabProps) {
  const [deleting, setDeleting] = useState('');
  const [actionError, setActionError] = useState(false);
  const remove = async (item: BlockedPeriod) => { if (!window.confirm(copy.exceptions.confirmDelete)) return; setDeleting(item.counselor_blocked_period_id); setActionError(false); try { await deleteBlockedPeriod(item.counselor_blocked_period_id); onDeleted(); } catch { setActionError(true); } finally { setDeleting(''); } };
  if (loading && !blocks.length) return <ListSkeleton />;
  if (error) return <ErrorState title={copy.errors.exceptionsTitle} message={copy.errors.exceptions} retry={retry} />;
  return <><div className="exception-toolbar"><label>{copy.filters.counselor}<select value={counselorId} onChange={(event) => setCounselorId(event.target.value)}><option value="">{copy.filters.allCounselors}</option>{counselors.filter((item) => item.active).map((item) => <option key={item.user_id} value={item.user_id}>{item.name}</option>)}</select></label><Input label={copy.filters.dateFrom} type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /><Input label={copy.filters.dateTo} type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /><Button onClick={onCreate}>{copy.actions.addException}</Button></div><p className="section-note">{copy.exceptions.scope}</p>{actionError && <InlineAlert tone="danger">{copy.errors.mutation}</InlineAlert>}{blocks.length === 0 ? <EmptyState title={copy.empty.exceptions} action={<Button onClick={onCreate}>{copy.actions.addException}</Button>} /> : <div className="operations-table-wrap"><table className="operations-table exception-table"><thead><tr><th>{copy.fields.counselor}</th><th>{copy.fields.date}</th><th>{copy.fields.time}</th><th>{copy.fields.reason}</th><th>{copy.fields.source}</th><th>{copy.fields.reviewStatus}</th><th>{copy.fields.action}</th></tr></thead><tbody>{blocks.map((item: BlockedPeriod) => <tr key={item.counselor_blocked_period_id}><td>{item.counselor_name}</td><td>{formatDate(item.starts_at, locale)}</td><td>{formatExceptionTime(item, locale, copy)}</td><td>{item.reason ?? copy.unavailable}</td><td>{item.source ? item.source === 'counselor' ? copy.exceptions.counselorSource : copy.exceptions.adminSource : copy.unavailable}</td><td>{item.review_status ? <Badge tone={item.review_status === 'approved' ? 'success' : item.review_status === 'rejected' ? 'danger' : 'warning'}>{copy.exceptions[item.review_status]}</Badge> : copy.unavailable}</td><td>{isEffectiveException(item) && item.source !== 'counselor' ? <Button variant="danger" loading={deleting === item.counselor_blocked_period_id} onClick={() => { void remove(item); }}>{copy.actions.removeException}</Button> : '—'}</td></tr>)}</tbody></table></div>}{blocks.some((item) => item.source === 'counselor') && <InlineAlert tone="warning">{copy.exceptions.approvalPending}</InlineAlert>}</>;
}

function ScheduleDrawer({ request, appointment, counselors, resources, calendar, copy, onClose, onSaved }: { request: CounselingRequest | null; appointment: Appointment | null; counselors: Counselor[]; resources: CounselingResource[]; calendar: CalendarResponse | null; copy: CounselingCopy; onClose: () => void; onSaved: () => void }) {
  const current = request ?? appointment;
  const canEdit = !!request || !!appointment && ['confirmed', 'rescheduled'].includes(appointment.status);
  const [counselor, setCounselor] = useState(appointment?.counselor_id ?? ''); const [resource, setResource] = useState(appointment?.counseling_resource_id ?? ''); const [date, setDate] = useState(appointment ? jakartaDateKey(new Date(appointment.starts_at)) : ''); const [start, setStart] = useState(appointment ? inputTime(appointment.starts_at) : ''); const [end, setEnd] = useState(appointment ? inputTime(appointment.ends_at) : ''); const [saving, setSaving] = useState(false); const [error, setError] = useState(''); const [confirmCancel, setConfirmCancel] = useState(false);
  const draftPayload = localSchedulePayload(counselor, date, start, end, resource);
  const resourceStates = resources.map((item) => ({ item, availability: draftPayload ? resourceAvailability(item, calendar?.appointments ?? [], calendar?.resource_blocks ?? [], draftPayload.starts_at, draftPayload.ends_at, calendar?.resource_authority_complete === true, appointment?.counseling_appointment_id) : null }));
  const selectedResourceState = resourceStates.find((item) => item.item.counseling_resource_id === resource)?.availability;
  const save = async () => { const payload = localSchedulePayload(counselor, date, start, end, resource); if (!payload) { setError(copy.drawer.invalid); return; } if (hasObviousConflict(payload, calendar?.appointments ?? [], (calendar?.blocked_periods ?? []).filter(isEffectiveException), appointment?.counseling_appointment_id, request?.student_id ?? appointment?.student_id)) { setError(copy.drawer.conflict); return; } if (selectedResourceState && ['blocked', 'capacity_full', 'inactive'].includes(selectedResourceState.state)) { setError(copy.drawer.resourceConflict); return; } setSaving(true); setError(''); try { if (request) await assignCounselingRequest(request.counseling_request_id, payload); else if (appointment) await updateAppointment(appointment.counseling_appointment_id, payload); onSaved(); } catch (caught) { setError(caught instanceof ApiError && caught.status === 409 ? copy.drawer.conflict : copy.errors.mutation); } finally { setSaving(false); } };
  const cancel = async () => { if (!appointment) return; setSaving(true); setError(''); try { await updateAppointment(appointment.counseling_appointment_id, { status: 'cancelled' }); onSaved(); } catch { setError(copy.errors.mutation); } finally { setSaving(false); } };
  return <Drawer open={!!current} onOpenChange={(open) => { if (!open) onClose(); }} title={request ? copy.drawer.assignTitle : copy.drawer.detailTitle} description={request?.name ?? appointment?.student_name} closeLabel={copy.actions.close} footer={<div className="drawer-actions"><Button variant="secondary" onClick={onClose}>{copy.actions.close}</Button>{canEdit && <Button loading={saving} onClick={() => { void save(); }}>{request ? copy.actions.assign : copy.actions.reschedule}</Button>}</div>}>
    {current && <div className="schedule-form"><div className="drawer-summary"><strong>{request?.name ?? appointment?.student_name}</strong><span>{request?.nim ?? appointment?.nim ?? copy.unavailable}</span>{appointment && <Badge tone={statusTone(deriveSessionStatus(appointment, new Date()))}>{copy.status.display[deriveSessionStatus(appointment, new Date())]}</Badge>}</div>{error && <InlineAlert tone="danger">{error}</InlineAlert>}<label>{copy.fields.counselor}<select value={counselor} disabled={!canEdit} onChange={(event) => setCounselor(event.target.value)}><option value="">{copy.drawer.chooseCounselor}</option>{counselors.map((item) => <option value={item.user_id} key={item.user_id}>{item.name}</option>)}</select></label><Input label={copy.fields.date} type="date" disabled={!canEdit} value={date} onChange={(event) => setDate(event.target.value)} /><div className="time-fields"><TimeField label={copy.drawer.start} disabled={!canEdit} value={start} onChange={setStart} /><TimeField label={copy.drawer.end} disabled={!canEdit} value={end} onChange={setEnd} /></div><label>{copy.fields.resource}<select value={resource} disabled={!canEdit} onChange={(event) => setResource(event.target.value)}><option value="">{copy.drawer.chooseResource}</option>{resourceStates.filter(({ item, availability }) => item.counseling_resource_id === resource || item.active && (availability === null || !['blocked', 'capacity_full'].includes(availability.state))).map(({ item, availability }) => <option value={item.counseling_resource_id} key={item.counseling_resource_id}>{item.name}{availability ? ` · ${resourceStateLabel(availability.state, copy)}` : ''}</option>)}</select></label>{canEdit && <InlineAlert>{copy.drawer.noSlots}</InlineAlert>}{appointment && canEdit && <div className="cancel-zone">{confirmCancel ? <><p>{copy.drawer.cancelConfirm}</p><Button variant="danger" loading={saving} onClick={() => { void cancel(); }}>{copy.actions.confirmCancel}</Button><Button variant="ghost" onClick={() => setConfirmCancel(false)}>{copy.actions.keep}</Button></> : <Button variant="danger" onClick={() => setConfirmCancel(true)}>{copy.actions.cancel}</Button>}</div>}</div>}
  </Drawer>;
}

function CalendarSkeleton() { return <div className="week-calendar" aria-busy="true">{Array.from({ length: 7 }, (_, index) => <section className="calendar-day" key={index}><Skeleton lines={4} /></section>)}</div>; }
function ListSkeleton() { return <div className="loading-panel" aria-busy="true"><Skeleton lines={7} /></div>; }
function statusTone(status: SessionDisplayStatus): 'success' | 'danger' | 'info' | 'neutral' { return status === 'ongoing' ? 'success' : status === 'cancelled' || status === 'no_show' ? 'danger' : status === 'scheduled' ? 'info' : 'neutral'; }
function formatDateRange(start: string, end: string, locale: string) { const f = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }); return `${f.format(new Date(`${start}T12:00:00Z`))} – ${f.format(new Date(`${end}T12:00:00Z`))}`; }
function formatWeekday(value: string, locale: string) { return new Intl.DateTimeFormat(locale, { timeZone: 'UTC', weekday: 'short' }).format(new Date(`${value}T12:00:00Z`)); }
function formatDay(value: string, locale: string) { return new Intl.DateTimeFormat(locale, { timeZone: 'UTC', day: 'numeric', month: 'short' }).format(new Date(`${value}T12:00:00Z`)); }
function formatDate(value: string, locale: string) { return new Intl.DateTimeFormat(locale, { timeZone: JAKARTA_TIME_ZONE, day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)); }
function formatDateTime(value: string, locale: string) { return new Intl.DateTimeFormat(locale, { timeZone: JAKARTA_TIME_ZONE, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value)); }
function formatTime(value: string, locale: string) { return new Intl.DateTimeFormat(locale, { timeZone: JAKARTA_TIME_ZONE, hour: '2-digit', minute: '2-digit' }).format(new Date(value)); }
function formatTimeRange(start: string, end: string, locale: string) { return `${formatTime(start, locale)}–${formatTime(end, locale)}`; }
function inputTime(value: string) { const parts = new Intl.DateTimeFormat('en-GB', { timeZone: JAKARTA_TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(value)); return `${parts.find((part) => part.type === 'hour')?.value ?? ''}:${parts.find((part) => part.type === 'minute')?.value ?? ''}`; }
function formatExceptionTime(item: BlockedPeriod, locale: string, copy: CounselingCopy) { const startDate = jakartaDateKey(new Date(item.starts_at)); return inputTime(item.starts_at) === '00:00' && inputTime(item.ends_at) === '00:00' && jakartaDateKey(new Date(item.ends_at)) === addDays(startDate, 1) ? copy.exceptions.fullDay : formatTimeRange(item.starts_at, item.ends_at, locale); }
function shortTime(value: string) { return value.slice(0, 5); }
function weekdayName(day: number, locale: string) { const base = new Date(Date.UTC(2026, 0, 4 + day)); return new Intl.DateTimeFormat(locale, { timeZone: 'UTC', weekday: 'long' }).format(base); }
function addMonths(value: string, amount: number) { const date = new Date(`${value}T12:00:00Z`); date.setUTCMonth(date.getUTCMonth() + amount); return date.toISOString().slice(0, 10); }
function monthRange(anchor: string) { const first = `${anchor.slice(0, 7)}-01`; const start = weekRange(first).start; const end = weekRange(addDays(addMonths(first, 1), -1)).end; const days: string[] = []; for (let day = start; day <= end; day = addDays(day, 1)) days.push(day); return { start, end, days }; }
function formatMonth(value: string, locale: string) { return new Intl.DateTimeFormat(locale, { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(new Date(`${value}T12:00:00Z`)); }
function initials(name: string) { return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase(); }
