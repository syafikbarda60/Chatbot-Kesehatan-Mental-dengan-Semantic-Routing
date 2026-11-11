'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { Badge, Button, DropdownMenu, EmptyState, ErrorState, handleTabListKeyDown, Icon, InlineAlert, PageShell, Skeleton } from '@/components/ui';
import { useLiveRefresh } from '@/lib/realtime/useLiveRefresh';
import { markAttentionReviewed } from '@/features/overview/api';
import { getAcademicStructure, getMonitoringSources, type MonitoringSources } from '@/features/monitoring/api';
import {
  buildMonitoringCases,
  clearMonitoringSelection,
  compatibleAcademicUnits,
  filterMonitoringCases,
  paginateCases,
  reconcileAcademicUnits,
  safeTriggerParts,
} from '@/features/monitoring/model';
import type { AcademicStructure, CaseType, DatePreset, MonitoringCase, MonitoringFilters, ReviewFilter, RiskFilter, RiskLevel } from '@/features/monitoring/types';

const initialFilters: MonitoringFilters = {
  type: 'all', search: '', review: 'all', risk: 'all', preset: '30days', dateFrom: '', dateTo: '', facultyIds: [], academicUnitIds: [],
};

export function MonitoringPage() {
  const { text } = useLanguage();
  const router = useRouter();
  const [filters, setFilters] = useState<MonitoringFilters>(initialFilters);
  const [sources, setSources] = useState<MonitoringSources | null>(null);
  const [academic, setAcademic] = useState<AcademicStructure | null>(null);
  const [academicError, setAcademicError] = useState(false);
  const [academicOpen, setAcademicOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [actionError, setActionError] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    void getAcademicStructure(controller.signal)
      .then((value) => { if (active) { setAcademic(value); setAcademicError(false); } })
      .catch((caught: unknown) => { if (active && !(caught instanceof DOMException && caught.name === 'AbortError')) setAcademicError(true); });
    return () => { active = false; controller.abort(); };
  }, [refreshVersion]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    void getMonitoringSources(controller.signal, filters.facultyIds, filters.academicUnitIds)
      .then((value) => { if (active) { setSources(value); setError(false); setLoading(false); } })
      .catch((caught: unknown) => {
        if (active && !(caught instanceof DOMException && caught.name === 'AbortError')) { setError(true); setLoading(false); }
      });
    return () => { active = false; controller.abort(); };
  }, [filters.facultyIds, filters.academicUnitIds, refreshVersion]);

  const liveRefresh = useCallback(() => { setNow(new Date()); setRefreshVersion((value) => value + 1); }, []);
  useLiveRefresh(liveRefresh, { topics: ['signals', 'requests'] });
  const refresh = useCallback(() => {
    setLoading(true); setError(false); setActionError(false); setSelected(clearMonitoringSelection()); setNow(new Date()); setRefreshVersion((value) => value + 1);
  }, []);
  const updateFilter = <K extends keyof MonitoringFilters>(key: K, value: MonitoringFilters[K]) => {
    setFilters((current) => ({ ...current, [key]: value })); setPage(1); setSelected(clearMonitoringSelection());
  };
  const updateFaculties = (facultyIds: string[]) => {
    const academicUnitIds = reconcileAcademicUnits(facultyIds, filters.academicUnitIds, academic?.academicUnits ?? []);
    setLoading(true); setError(false); setFilters((current) => ({ ...current, facultyIds, academicUnitIds })); setPage(1); setSelected(clearMonitoringSelection());
  };
  const updateUnits = (academicUnitIds: string[]) => {
    setLoading(true); setError(false); setFilters((current) => ({ ...current, academicUnitIds })); setPage(1); setSelected(clearMonitoringSelection());
  };

  const allCases = useMemo(() => sources ? buildMonitoringCases(sources.attention, sources.requests, academic ?? undefined) : [], [sources, academic]);
  const filteredCases = useMemo(() => filterMonitoringCases(allCases, filters, now), [allCases, filters, now]);
  const pagination = useMemo(() => paginateCases(filteredCases, page, pageSize), [filteredCases, page, pageSize]);
  const compatibleUnits = useMemo(() => compatibleAcademicUnits(filters.facultyIds, academic?.academicUnits ?? []), [filters.facultyIds, academic]);
  const allVisibleSelected = pagination.rows.length > 0 && pagination.rows.every((item) => selected.has(item.id));
  const hasFilters = filters.type !== 'all' || filters.search !== '' || filters.review !== 'all' || filters.risk !== 'all' || filters.preset !== 'all' || filters.facultyIds.length > 0;
  const loadedBoundary = !!sources && (sources.attention.total > sources.attention.signals.length || sources.requests.total > sources.requests.requests.length);
  const summary = useMemo(() => ({
    active: filteredCases.length,
    high: filteredCases.filter((item) => item.risk === 'critical' || item.risk === 'high').length,
    medium: filteredCases.filter((item) => item.risk === 'medium').length,
    low: filteredCases.filter((item) => item.risk === 'low').length,
    unreviewed: filteredCases.filter((item) => item.reviewState === 'unreviewed').length,
    reviewed: filteredCases.filter((item) => item.reviewState === 'reviewed').length,
  }), [filteredCases]);

  const toggleSelected = (id: string) => setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const toggleVisible = () => setSelected((current) => { const next = new Set(current); pagination.rows.forEach((item) => { if (allVisibleSelected) next.delete(item.id); else next.add(item.id); }); return next; });
  const markReviewed = async (item: MonitoringCase) => {
    if (item.type === 'request' || item.reviewState === 'reviewed') return;
    setActionError(false);
    try { await markAttentionReviewed(item.sourceId); refresh(); } catch { setActionError(true); }
  };
  const markSelectedReviewed = async () => {
    const eligible = filteredCases.filter((item) => selected.has(item.id) && item.type !== 'request' && item.reviewState === 'unreviewed');
    if (eligible.length === 0) return;
    setActionError(false);
    try {
      for (const item of eligible) await markAttentionReviewed(item.sourceId);
      refresh();
    } catch { setActionError(true); }
  };

  return <PageShell title={text.monitoring.title} actions={<Button variant="secondary" icon="refresh" onClick={refresh}>{text.monitoring.refresh}</Button>}>
    <div className="monitoring-stack">
      <div className="case-tabs" role="tablist" aria-label={text.monitoring.title} onKeyDown={handleTabListKeyDown}>{(['all', 'assessment', 'safety', 'request'] as CaseType[]).map((type) => <button key={type} role="tab" aria-selected={filters.type === type} tabIndex={filters.type === type ? 0 : -1} className={filters.type === type ? 'active' : ''} onClick={() => updateFilter('type', type)}>{text.monitoring.tabs[type]}</button>)}</div>

      <section className="monitoring-filters" aria-label={text.monitoring.filters.search}>
        <label className="filter-field filter-search"><span>{text.monitoring.filters.search}</span><div className="filter-input"><Icon name="search" size={18} /><input value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder={text.monitoring.filters.searchPlaceholder} /></div></label>
        <label className="filter-field"><span>{text.monitoring.filters.review}</span><select value={filters.review} onChange={(event) => updateFilter('review', event.target.value as ReviewFilter)}><option value="all">{text.monitoring.review.all}</option><option value="unreviewed">{text.monitoring.review.unreviewed}</option><option value="reviewed">{text.monitoring.review.reviewed}</option></select></label>
        <label className="filter-field"><span>{text.monitoring.filters.risk}</span><select value={filters.risk} onChange={(event) => updateFilter('risk', event.target.value as RiskFilter)}><option value="all">{text.monitoring.risk.all}</option>{(['critical', 'high', 'medium', 'low', 'unknown'] as RiskLevel[]).map((risk) => <option key={risk} value={risk}>{text.monitoring.risk[risk]}</option>)}</select></label>
        <label className="filter-field"><span>{text.monitoring.filters.date}</span><select value={filters.preset} onChange={(event) => updateFilter('preset', event.target.value as DatePreset)}><option value="today">{text.monitoring.dates.today}</option><option value="7days">{text.monitoring.dates.seven}</option><option value="30days">{text.monitoring.dates.thirty}</option><option value="all">{text.monitoring.dates.all}</option><option value="custom">{text.monitoring.dates.custom}</option></select></label>
        <button className="academic-toggle" type="button" aria-expanded={academicOpen} disabled={academicError} onClick={() => setAcademicOpen((value) => !value)}><Icon name="instrument" size={18} /><span>{text.monitoring.filters.academic}{filters.facultyIds.length + filters.academicUnitIds.length > 0 ? ` (${filters.facultyIds.length + filters.academicUnitIds.length})` : ''}</span><Icon name="down" size={16} /></button>
        {filters.preset === 'custom' && <div className="custom-dates"><label className="filter-field"><span>{text.monitoring.dates.from}</span><input type="date" value={filters.dateFrom} max={filters.dateTo || undefined} onChange={(event) => updateFilter('dateFrom', event.target.value)} /></label><label className="filter-field"><span>{text.monitoring.dates.to}</span><input type="date" value={filters.dateTo} min={filters.dateFrom || undefined} onChange={(event) => updateFilter('dateTo', event.target.value)} /></label></div>}
        {academicOpen && !academicError && academic && <div className="academic-panel"><fieldset><legend>{text.monitoring.filters.faculty}</legend><div className="scope-options">{academic.faculties.map((faculty) => <label key={faculty.faculty_id}><input type="checkbox" checked={filters.facultyIds.includes(faculty.faculty_id)} onChange={() => updateFaculties(toggleValue(filters.facultyIds, faculty.faculty_id))} /> <span>{faculty.name}</span></label>)}</div></fieldset><fieldset disabled={filters.facultyIds.length !== 1}><legend>{text.monitoring.filters.unit}</legend>{filters.facultyIds.length !== 1 ? <p>{text.monitoring.filters.unitDisabled}</p> : <div className="scope-options">{compatibleUnits.map((unit) => <label key={unit.academic_unit_id}><input type="checkbox" checked={filters.academicUnitIds.includes(unit.academic_unit_id)} onChange={() => updateUnits(toggleValue(filters.academicUnitIds, unit.academic_unit_id))} /> <span>{unit.name}</span></label>)}</div>}</fieldset><Button variant="ghost" onClick={() => updateFaculties([])}>{text.monitoring.filters.reset}</Button></div>}
      </section>

      {academicError && <InlineAlert tone="warning">{text.monitoring.academicError}</InlineAlert>}
      {loadedBoundary && <InlineAlert tone="info">{text.monitoring.boundary}</InlineAlert>}
      <section className="monitoring-summary" aria-label={text.monitoring.title} aria-live="polite"><Summary value={summary.active} label={text.monitoring.summary.active} /><Summary value={summary.high} label={text.monitoring.summary.high} tone="danger" /><Summary value={summary.medium} label={text.monitoring.summary.medium} tone="warning" /><Summary value={summary.low} label={text.monitoring.summary.low} tone="info" /><Summary value={summary.unreviewed} label={text.monitoring.summary.unreviewed} /><Summary value={summary.reviewed} label={text.monitoring.summary.reviewed} /></section>

      {selected.size > 0 && <div className="bulk-selection monitoring-bulk" role="status"><strong>{selected.size} {text.monitoring.selected}</strong><div className="bulk-actions"><Button icon="check" onClick={() => { void markSelectedReviewed(); }}>{text.monitoring.bulkReview}</Button><Button variant="secondary" disabled title={text.monitoring.backendPending}>{text.monitoring.bulkDelegate}</Button><Button variant="secondary" disabled title={text.monitoring.exportUnavailable}>{text.monitoring.bulkExport}</Button><Button variant="ghost" onClick={() => setSelected(clearMonitoringSelection())}>{text.monitoring.cancelSelection}</Button></div></div>}
      {actionError && <InlineAlert tone="danger">{text.monitoring.actionError}</InlineAlert>}
      {error && sources && <InlineAlert tone="warning">{text.common.staleData}</InlineAlert>}
      {loading && !sources ? <MonitoringLoading /> : !sources ? <section className="operations-panel"><ErrorState title={text.errors.title} message={text.monitoring.loadError} retry={refresh} retryLabel={text.common.retry} /></section> : filteredCases.length === 0 ? <section className="operations-panel"><EmptyState title={hasFilters ? text.monitoring.empty : text.monitoring.emptyUnfiltered} /></section> : <section className="operations-panel" aria-label={text.monitoring.title}>
        <div className="operations-table-wrap"><table className="operations-table monitoring-table"><thead><tr><th className="selection-column"><input type="checkbox" checked={allVisibleSelected} onChange={toggleVisible} aria-label={text.monitoring.columns.selectPage} /></th><th>{text.monitoring.columns.student}</th><th>{text.monitoring.columns.type}</th><th>{text.monitoring.columns.detail}</th><th aria-sort="descending">{text.monitoring.columns.risk}</th><th>{text.monitoring.columns.time}</th><th>{text.monitoring.columns.status}</th><th>{text.monitoring.columns.action}</th></tr></thead><tbody>{pagination.rows.map((item) => <MonitoringRow key={item.id} item={item} selected={selected.has(item.id)} onToggle={() => toggleSelected(item.id)} onOpen={() => item.studentId && router.push(`/students/${item.studentId}`)} onMarkReviewed={() => { void markReviewed(item); }} />)}</tbody></table></div>
        <footer className="monitoring-footer"><span>{text.monitoring.pagination.showing} {(pagination.page - 1) * pageSize + 1}–{Math.min(pagination.page * pageSize, filteredCases.length)} {text.monitoring.pagination.ofLoaded} ({filteredCases.length})</span><label>{text.monitoring.pagination.perPage}<select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); setSelected(clearMonitoringSelection()); }}><option value="25">25</option><option value="50">50</option></select></label><div className="pagination"><Button variant="ghost" disabled={pagination.page === 1} onClick={() => setPage((value) => value - 1)}>{text.monitoring.pagination.previous}</Button><span>{text.monitoring.pagination.page} {pagination.page} / {pagination.pageCount}</span><Button variant="ghost" disabled={pagination.page === pagination.pageCount} onClick={() => setPage((value) => value + 1)}>{text.monitoring.pagination.next}</Button></div></footer>
      </section>}
    </div>
  </PageShell>;
}

function MonitoringRow({ item, selected, onToggle, onOpen, onMarkReviewed }: { item: MonitoringCase; selected: boolean; onToggle: () => void; onOpen: () => void; onMarkReviewed: () => void }) {
  const { language, text } = useLanguage();
  const triggerParts = safeTriggerParts(item);
  return <tr className={selected ? 'row-selected' : ''}><td className="selection-column"><input type="checkbox" checked={selected} onChange={onToggle} aria-label={`${text.monitoring.columns.student}: ${item.studentName ?? text.monitoring.identityUnavailable}`} /></td><td><strong>{item.studentName ?? text.monitoring.identityUnavailable}</strong><small>{item.nim ?? text.monitoring.noNim}</small>{item.facultyName && <small>{item.facultyName}</small>}</td><td><Badge tone={item.type === 'safety' ? 'danger' : item.type === 'assessment' ? 'info' : 'neutral'}>{text.monitoring.types[item.type]}</Badge></td><td className="detail-cell">{triggerParts.length ? triggerParts.map((part) => <span key={part.category}>{text.overview.categories[part.category as keyof typeof text.overview.categories]}: {severityLabel(part.severity, text.overview.priority)}{part.score !== null ? ` (${part.score})` : ''}</span>) : <span>{text.monitoring.detail[item.type]}</span>}</td><td><Badge tone={riskTone(item.risk)}>{text.monitoring.risk[item.risk]}</Badge></td><td><time dateTime={item.createdAt ?? undefined}>{formatMonitoringTime(item.createdAt, language)}</time></td><td><Badge tone={item.reviewState === 'unreviewed' ? 'warning' : 'success'}>{text.monitoring.review[item.reviewState]}</Badge></td><td className="action-cell"><Button variant={item.reviewState === 'unreviewed' ? 'primary' : 'secondary'} disabled={!item.studentId} onClick={onOpen}>{item.reviewState === 'unreviewed' ? text.monitoring.reviewAction : text.monitoring.detailAction}</Button>{item.type !== 'request' && item.reviewState === 'unreviewed' && <DropdownMenu label={text.monitoring.moreActions} trigger={<Icon name="more" />} items={[{ label: text.monitoring.markReviewed, icon: <Icon name="check" />, onSelect: onMarkReviewed }]} />}</td></tr>;
}

function Summary({ value, label, tone }: { value: number; label: string; tone?: 'danger' | 'warning' | 'info' }) { return <div className={`summary-item ${tone ? `summary-${tone}` : ''}`}><strong>{value}</strong><span>{label}</span></div>; }
function toggleValue(values: string[], value: string) { return values.includes(value) ? values.filter((item) => item !== value) : [...values, value]; }
function riskTone(risk: RiskLevel): 'danger' | 'warning' | 'info' | 'neutral' { return risk === 'critical' || risk === 'high' ? 'danger' : risk === 'medium' ? 'warning' : risk === 'low' ? 'info' : 'neutral'; }
function severityLabel(value: string | null, labels: Record<string, string>) { if (!value) return labels.unknown; const key = value.trim().toLowerCase().replaceAll(' ', '_'); return labels[key] ?? value; }
function formatMonitoringTime(value: string | null, language: 'id' | 'en') { if (!value) return '—'; const date = new Date(value); if (Number.isNaN(date.getTime())) return '—'; const locale = language === 'id' ? 'id-ID' : 'en-GB'; const today = dateKey(new Date()); const key = dateKey(date); const yesterday = dateKey(new Date(Date.now() - 86_400_000)); const time = new Intl.DateTimeFormat(locale, { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' }).format(date); if (key === today) return `${language === 'id' ? 'Hari ini' : 'Today'} ${time}`; if (key === yesterday) return `${language === 'id' ? 'Kemarin' : 'Yesterday'} ${time}`; return new Intl.DateTimeFormat(locale, { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date); }
function dateKey(date: Date) { const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date); const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? ''; return `${part('year')}-${part('month')}-${part('day')}`; }
function MonitoringLoading() { return <section className="operations-panel monitoring-loading" aria-busy="true"><Skeleton lines={9} /></section>; }
