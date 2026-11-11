'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { Badge, Button, DropdownMenu, EmptyState, ErrorState, Icon, InlineAlert, PageShell, Skeleton } from '@/components/ui';
import { getOverviewSources, markAttentionReviewed } from '@/features/overview/api';
import {
  buildPriorityCases,
  clearPrioritySelection,
  deriveMetrics,
  deriveSessionStatus,
  jakartaDateKey,
  type SessionDisplayStatus,
} from '@/features/overview/model';
import type { OverviewSources, PriorityCase } from '@/features/overview/types';
import { useLiveRefresh } from '@/lib/realtime/useLiveRefresh';

const PAGE_SIZE = 10;
const JAKARTA_TIME_ZONE = 'Asia/Jakarta';

export function OverviewPage() {
  const { language, text } = useLanguage();
  const router = useRouter();
  const [now, setNow] = useState(() => new Date());
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [sources, setSources] = useState<OverviewSources | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [actionError, setActionError] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const today = jakartaDateKey(now);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    void getOverviewSources(today, controller.signal)
      .then((data) => { if (active) { setSources(data); setError(false); setLoading(false); } })
      .catch((caught: unknown) => {
        if (active && !(caught instanceof DOMException && caught.name === 'AbortError')) {
          setError(true);
          setLoading(false);
        }
      });
    return () => { active = false; controller.abort(); };
  }, [today, refreshVersion]);

  const refresh = useCallback(() => {
    setSelected(clearPrioritySelection());
    setPage(1);
    setActionError(false);
    setLoading(true);
    setError(false);
    setNow(new Date());
    setRefreshVersion((value) => value + 1);
  }, []);

  // Background refresh keeps filters, page and selection; only the data underneath changes.
  const liveRefresh = useCallback(() => { setNow(new Date()); setRefreshVersion((value) => value + 1); }, []);
  useLiveRefresh(liveRefresh, { topics: ['signals', 'requests', 'schedule'] });

  const cases = useMemo(() => sources ? buildPriorityCases(sources) : [], [sources]);
  const filteredCases = useMemo(() => cases.filter((item) => {
    const needle = search.trim().toLocaleLowerCase();
    const matchesSearch = !needle || `${item.studentName ?? ''} ${item.nim ?? ''} ${item.facultyName ?? ''}`.toLocaleLowerCase().includes(needle);
    const severity = normalizeSeverity(item.backendSeverity);
    const matchesRisk = riskFilter === 'all' || (riskFilter === 'critical' ? item.source === 'safety' || severity === 'extremely_severe' : riskFilter === 'high' ? severity === 'severe' : riskFilter === 'medium' ? severity === 'moderate' : riskFilter === 'low' ? ['normal', 'minimal', 'mild'].includes(severity ?? '') : false);
    return matchesSearch && matchesRisk && (sourceFilter === 'all' || item.source === sourceFilter);
  }), [cases, search, riskFilter, sourceFilter]);
  const metrics = useMemo(() => sources ? deriveMetrics(sources) : null, [sources]);
  const pageCount = Math.max(1, Math.ceil(filteredCases.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleCases = filteredCases.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const allVisibleSelected = visibleCases.length > 0 && visibleCases.every((item) => selected.has(item.id));

  const toggle = (id: string) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleVisible = () => setSelected((current) => {
    const next = new Set(current);
    visibleCases.forEach((item) => { if (allVisibleSelected) next.delete(item.id); else next.add(item.id); });
    return next;
  });

  const markReviewed = async (item: PriorityCase) => {
    if (item.source === 'request') return;
    setActionError(false);
    try {
      await markAttentionReviewed(item.sourceId);
      refresh();
    } catch {
      setActionError(true);
    }
  };
  const markSelectedReviewed = async () => {
    const eligible = filteredCases.filter((item) => selected.has(item.id) && item.source !== 'request');
    if (eligible.length === 0) return;
    setActionError(false);
    try {
      for (const item of eligible) await markAttentionReviewed(item.sourceId);
      refresh();
    } catch { setActionError(true); }
  };

  const locale = language === 'id' ? 'id-ID' : 'en-GB';
  const dateContext = new Intl.DateTimeFormat(locale, { timeZone: JAKARTA_TIME_ZONE, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(now);

  return (
    <PageShell
      title={text.overview.title}
      actions={<div className="overview-header-actions"><span className="today-context">{text.overview.today}: {dateContext}</span><Button variant="secondary" icon="refresh" onClick={refresh}>{text.overview.refresh}</Button></div>}
    >
      {loading && !sources ? <OverviewLoading /> : !sources ? (
        <ErrorState title={text.errors.title} message={text.overview.loadError} retry={refresh} retryLabel={text.common.retry} />
      ) : (
        <div className="overview-stack">
          {error && <InlineAlert tone="warning">{text.common.staleData}</InlineAlert>}
          <section className="overview-kpis" aria-label={text.overview.title}>
            <MetricCard tone="danger" icon="alert" value={metrics?.criticalCases ?? 0} label={text.overview.metrics.critical} note={text.overview.metricNotes.critical} />
            <MetricCard tone="warning" icon="monitoring" value={metrics?.activeHighRisk ?? 0} label={text.overview.metrics.highRisk} note={text.overview.metricNotes.highRisk} />
            <MetricCard tone="warning" icon="check" value={metrics?.awaitingFollowUp ?? 0} label={text.overview.metrics.followUp} note={text.overview.metricNotes.followUp} />
            <MetricCard tone="info" icon="counselor" value={metrics?.pendingCounseling ?? 0} label={text.overview.metrics.requests} note={text.overview.metricNotes.requests} />
            <MetricCard tone="info" icon="calendar" value={metrics?.sessionsToday ?? 0} label={text.overview.metrics.sessions} note={text.overview.metricNotes.sessions} />
            <MetricCard tone="success" icon="user" value={metrics?.availableSlots ?? 0} label={text.overview.metrics.slots} note={text.overview.metricNotes.slots} />
          </section>

          <section className="operations-panel" aria-labelledby="priority-queue-title">
            <header className="operations-panel-header"><div><h2 id="priority-queue-title">{text.overview.queueTitle}</h2><p>{cases.length} {text.overview.queueCount}</p></div></header>
            <div className="overview-filters"><label className="filter-field"><span>{text.overview.filters.search}</span><div className="filter-input"><Icon name="search" size={18} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder={text.overview.filters.searchPlaceholder} /></div></label><label className="filter-field"><span>{text.overview.filters.risk}</span><select value={riskFilter} onChange={(event) => { setRiskFilter(event.target.value); setPage(1); }}><option value="all">{text.overview.filters.allRisks}</option><option value="critical">{text.monitoring.risk.critical}</option><option value="high">{text.monitoring.risk.high}</option><option value="medium">{text.monitoring.risk.medium}</option><option value="low">{text.monitoring.risk.low}</option></select></label><label className="filter-field"><span>{text.overview.filters.source}</span><select value={sourceFilter} onChange={(event) => { setSourceFilter(event.target.value); setPage(1); }}><option value="all">{text.overview.filters.allSources}</option><option value="safety">{text.monitoring.types.safety}</option><option value="assessment">{text.monitoring.types.assessment}</option><option value="request">{text.monitoring.types.request}</option></select></label></div>
            {selected.size > 0 && <div className="bulk-selection" role="status"><strong>{selected.size} {text.overview.selected}</strong><div className="bulk-actions"><Button icon="check" onClick={() => { void markSelectedReviewed(); }}>{text.overview.markReviewed}</Button><Button variant="secondary" disabled title={text.monitoring.backendPending}>{text.monitoring.bulkDelegate}</Button><Button variant="ghost" onClick={() => setSelected(clearPrioritySelection())}>{text.overview.cancelSelection}</Button></div></div>}
            {actionError && <div className="panel-alert"><InlineAlert tone="danger">{text.overview.actionError}</InlineAlert></div>}
            {filteredCases.length === 0 ? <EmptyState title={text.overview.emptyQueue} message={text.overview.emptyQueueBody} /> : <>
              <div className="operations-table-wrap">
                <table className="operations-table priority-table">
                  <thead><tr>
                    <th className="selection-column"><input type="checkbox" checked={allVisibleSelected} onChange={toggleVisible} aria-label={text.overview.columns.select} /></th>
                    <th>{text.overview.columns.priority}</th><th>{text.overview.columns.student}</th><th>{text.overview.columns.trigger}</th><th>{text.overview.columns.arrived}</th><th>{text.overview.columns.status}</th><th>{text.overview.columns.action}</th>
                  </tr></thead>
                  <tbody>{visibleCases.map((item) => <PriorityRow key={item.id} item={item} selected={selected.has(item.id)} onToggle={() => toggle(item.id)} onReview={() => item.studentId && router.push(`/students/${item.studentId}`)} onMarkReviewed={() => { void markReviewed(item); }} />)}</tbody>
                </table>
              </div>
              <footer className="table-footer"><p>{text.overview.limited}</p>{pageCount > 1 && <div className="pagination"><Button variant="ghost" disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>{text.overview.previous}</Button><span>{text.overview.page} {currentPage} / {pageCount}</span><Button variant="ghost" disabled={currentPage === pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>{text.overview.next}</Button></div>}</footer>
            </>}
          </section>

          <section className="operations-panel" aria-labelledby="today-schedule-title">
            <header className="operations-panel-header"><div><h2 id="today-schedule-title">{text.overview.scheduleTitle}</h2><p>{sources.calendar.appointments.length} {text.overview.scheduleCount}</p></div></header>
            {sources.calendar.appointments.length === 0 ? <EmptyState title={text.overview.emptySchedule} /> : <div className="operations-table-wrap"><table className="operations-table schedule-table"><thead><tr><th>{text.overview.scheduleColumns.time}</th><th>{text.overview.scheduleColumns.student}</th><th>{text.overview.scheduleColumns.counselor}</th><th>{text.overview.scheduleColumns.status}</th><th>{text.overview.scheduleColumns.action}</th></tr></thead><tbody>{sources.calendar.appointments.map((appointment) => {
              const status = deriveSessionStatus(appointment, now);
              return <tr key={appointment.counseling_appointment_id}><td className="time-cell">{formatTimeRange(appointment.starts_at, appointment.ends_at, locale)}</td><td><strong>{appointment.student_name}</strong><small>{appointment.nim ?? text.overview.noNim}</small></td><td className="counselor-cell">{appointment.counselor_name}</td><td><SessionBadge status={status} /></td><td><Button variant="secondary" disabled={!appointment.student_id} onClick={() => router.push(`/students/${appointment.student_id}`)}>{text.overview.viewDetail}</Button></td></tr>;
            })}</tbody></table></div>}
          </section>
        </div>
      )}
    </PageShell>
  );
}

function MetricCard({ tone, icon, value, label, note }: { tone: 'danger' | 'warning' | 'info' | 'success'; icon: 'alert' | 'monitoring' | 'check' | 'counselor' | 'calendar' | 'user'; value: number; label: string; note: string }) {
  return <article className={`metric-card ${value > 0 ? `metric-${tone}` : 'metric-calm'}`}><span className="metric-icon"><Icon name={icon} size={22} /></span><div><strong className="metric-value">{value}</strong><h2>{label}</h2><p>{note}</p></div></article>;
}

function PriorityRow({ item, selected, onToggle, onReview, onMarkReviewed }: { item: PriorityCase; selected: boolean; onToggle: () => void; onReview: () => void; onMarkReviewed: () => void }) {
  const { language, text } = useLanguage();
  const locale = language === 'id' ? 'id-ID' : 'en-GB';
  const severity = normalizeSeverity(item.backendSeverity);
  const priorityLabel = item.source === 'safety' ? text.overview.priority.safety : item.source === 'request' ? text.overview.priority.request : severity ? text.overview.priority[severity] : text.overview.priority.assessment;
  const priorityTone = item.source === 'safety' || severity === 'extremely_severe' ? 'danger' : severity === 'severe' || severity === 'moderate' ? 'warning' : item.source === 'request' ? 'info' : 'neutral';
  return <tr className={selected ? 'row-selected' : ''}>
    <td className="selection-column"><input type="checkbox" checked={selected} onChange={onToggle} aria-label={`${text.overview.columns.select}: ${item.studentName ?? text.overview.unavailableIdentity}`} /></td>
    <td><Badge tone={priorityTone}>{priorityLabel}</Badge></td>
    <td><strong>{item.studentName ?? text.overview.unavailableIdentity}</strong><small>{item.nim ?? text.overview.noNim}</small>{item.facultyName && <small>{item.facultyName}</small>}</td>
    <td className="detail-cell">{item.source === 'assessment' && item.categoryResults.length > 0 ? item.categoryResults.map((result) => <span key={result.category}>{text.overview.categories[result.category]}: {severityText(result.severity, text.overview.priority)}{result.scaled_score !== null ? ` (${result.scaled_score})` : ''}</span>) : <span>{text.overview.detail[item.source]}</span>}</td>
    <td><time dateTime={item.createdAt ?? undefined}>{formatReceived(item.createdAt, locale, text.overview.today)}</time></td>
    <td><Badge tone={item.source === 'request' ? 'neutral' : 'warning'}>{item.source === 'request' ? text.overview.state.waiting : text.overview.state.unread}</Badge></td>
    <td className="action-cell"><Button variant="primary" disabled={!item.studentId} onClick={onReview}>{text.overview.review}</Button>{item.source !== 'request' && <DropdownMenu label={text.overview.rowMenu} trigger={<Icon name="more" />} items={[{ label: text.overview.markReviewed, icon: <Icon name="check" />, onSelect: onMarkReviewed }]} />}</td>
  </tr>;
}

function SessionBadge({ status }: { status: SessionDisplayStatus }) {
  const { text } = useLanguage();
  const tone = status === 'cancelled' || status === 'no_show' ? 'danger' : status === 'ongoing' ? 'success' : status === 'scheduled' ? 'info' : 'neutral';
  return <Badge tone={tone}>{text.overview.sessionStatus[status]}</Badge>;
}

function normalizeSeverity(value: string | null): 'normal' | 'minimal' | 'mild' | 'moderate' | 'severe' | 'extremely_severe' | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase().replaceAll(' ', '_');
  if (normalized === 'ringan') return 'mild';
  if (normalized === 'sedang') return 'moderate';
  if (normalized === 'berat') return 'severe';
  if (normalized === 'sangat_berat') return 'extremely_severe';
  return ['normal', 'minimal', 'mild', 'moderate', 'severe', 'extremely_severe'].includes(normalized) ? normalized as ReturnType<typeof normalizeSeverity> : null;
}

function severityText(value: string | null, labels: Record<string, string>): string {
  const normalized = normalizeSeverity(value);
  return normalized ? labels[normalized] : value || labels.unknown;
}

function formatReceived(value: string | null, locale: string, todayLabel: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const isToday = jakartaDateKey(date) === jakartaDateKey(new Date());
  const time = new Intl.DateTimeFormat(locale, { timeZone: JAKARTA_TIME_ZONE, hour: '2-digit', minute: '2-digit' }).format(date);
  return isToday ? `${todayLabel}, ${time}` : new Intl.DateTimeFormat(locale, { timeZone: JAKARTA_TIME_ZONE, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date);
}

function formatTimeRange(start: string, end: string, locale: string): string {
  const formatter = new Intl.DateTimeFormat(locale, { timeZone: JAKARTA_TIME_ZONE, hour: '2-digit', minute: '2-digit' });
  return `${formatter.format(new Date(start))}–${formatter.format(new Date(end))}`;
}

function OverviewLoading() {
  return <div className="overview-stack" aria-busy="true"><section className="overview-kpis">{Array.from({ length: 6 }, (_, index) => <article className="metric-card" key={index}><Skeleton lines={2} /></article>)}</section><section className="operations-panel loading-panel"><Skeleton lines={6} /></section><section className="operations-panel loading-panel"><Skeleton lines={4} /></section></div>;
}
