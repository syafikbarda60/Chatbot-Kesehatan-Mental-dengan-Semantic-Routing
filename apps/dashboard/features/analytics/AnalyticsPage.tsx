'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { Badge, Button, Drawer, ErrorState, Icon, InlineAlert, PageShell, Skeleton } from '@/components/ui';
import { useLiveRefresh } from '@/lib/realtime/useLiveRefresh';
import { getAcademicStructure } from '@/features/monitoring/api';
import type { AcademicStructure } from '@/features/monitoring/types';
import { getAnalytics } from './api';
import { academicComparison, aggregate, ANALYTICS_STORAGE_KEY, applyPreset, counselingComposition, defaultFilters, groupTrend, insights, makeReportConfiguration, REPORT_SECTIONS, REPORT_STORAGE_KEY, sanitizeFilters, sanitizeForStructure, severityByCategory, validateDates } from './model';
import type { AnalyticsFilters, AnalyticsResponse, ReportSection } from './types';
import { BarChart, Panel, StackedBars, StatusBars } from './Charts';

export function AnalyticsPage(){
  const router=useRouter(); const {language,text}=useLanguage(); const copy=text.analytics; const filterRef=useRef<HTMLElement>(null);
  const [filters,setFilters]=useState<AnalyticsFilters>(()=>defaultFilters()); const [hydrated,setHydrated]=useState(false);
  const [structure,setStructure]=useState<AcademicStructure|null>(null); const [structureError,setStructureError]=useState(false);
  const [data,setData]=useState<AnalyticsResponse|null>(null); const [loading,setLoading]=useState(true); const [error,setError]=useState(false); const [refresh,setRefresh]=useState(0);
  const [drawer,setDrawer]=useState(false); const [sections,setSections]=useState<ReportSection[]>(REPORT_SECTIONS);
  useEffect(()=>{const timer=window.setTimeout(()=>{try{setFilters(sanitizeFilters(JSON.parse(sessionStorage.getItem(ANALYTICS_STORAGE_KEY)??'null')))}catch{}setHydrated(true)},0);return()=>window.clearTimeout(timer)},[]);
  useEffect(()=>{if(hydrated)sessionStorage.setItem(ANALYTICS_STORAGE_KEY,JSON.stringify(filters))},[filters,hydrated]);
  useEffect(()=>{const c=new AbortController();getAcademicStructure(c.signal).then((value)=>{setStructure(value);setFilters((current)=>{const next=sanitizeForStructure(current,value);if(JSON.stringify(next)!==JSON.stringify(current)){setLoading(true);setError(false)}return next});setStructureError(false)}).catch((caught)=>{if(!(caught instanceof DOMException&&caught.name==='AbortError'))setStructureError(true)});return()=>c.abort()},[refresh]);
  useEffect(()=>{if(!hydrated||!validateDates(filters.dateFrom,filters.dateTo))return;const c=new AbortController();getAnalytics(filters,c.signal).then((value)=>{setData(value);setError(false);setLoading(false)}).catch((caught)=>{if(!(caught instanceof DOMException&&caught.name==='AbortError')){setError(true);setLoading(false)}});return()=>c.abort()},[filters,hydrated,refresh]);
  useLiveRefresh(useCallback(()=>setRefresh((x)=>x+1),[]),{pollMs:300_000});
  const update=useCallback((patch:Partial<AnalyticsFilters>)=>{const next={...filters,...patch};setLoading(validateDates(next.dateFrom,next.dateTo));setError(false);setFilters(next)},[filters]);
  const metrics=useMemo(()=>data?aggregate(data):null,[data]); const trend=useMemo(()=>data?groupTrend(data):[],[data]); const dimensions=useMemo(()=>data?severityByCategory(data):[],[data]); const comparison=useMemo(()=>data?academicComparison(data):[],[data]); const counseling=useMemo(()=>data?counselingComposition(data):[],[data]); const insightRows=useMemo(()=>data?insights(data,language):[],[data,language]);
  const selectedFaculties=structure?.faculties.filter((item)=>filters.facultyIds.includes(item.faculty_id))??[]; const availableUnits=structure?.academicUnits.filter((item)=>filters.facultyIds.length===1&&item.faculty_id===filters.facultyIds[0]&&item.active)??[]; const selectedUnits=availableUnits.filter((item)=>filters.academicUnitIds.includes(item.academic_unit_id));
  const setFaculty=(id:string,checked:boolean)=>{setLoading(true);setError(false);setFilters((current)=>{const facultyIds=checked?[...current.facultyIds,id]:current.facultyIds.filter((value)=>value!==id);return{...current,facultyIds,academicUnitIds:facultyIds.length===1&&facultyIds[0]===current.facultyIds[0]?current.academicUnitIds:[]}})};
  const dateError=!validateDates(filters.dateFrom,filters.dateTo);
  const preview=()=>{sessionStorage.setItem(REPORT_STORAGE_KEY,JSON.stringify(makeReportConfiguration(filters,sections)));setDrawer(false);router.push('/reports/preview')};
  const scopeSummary=selectedUnits.length?selectedUnits.map((item)=>item.name).join(', '):selectedFaculties.length?selectedFaculties.map((item)=>item.name).join(', '):copy.wholeUniversity;
  const period=`${filters.dateFrom}–${filters.dateTo}`; const severeLabels=text.overview.priority as Record<string,string>;
  return <PageShell title={copy.title} actions={<Button icon="analytics" onClick={()=>setDrawer(true)}>{copy.export}</Button>}>
    <div className="analytics-stack">
      <section ref={filterRef} className="analytics-filters" aria-label={copy.filtersLabel} tabIndex={-1}>
        <label className="filter-field"><span>{copy.period}</span><select value={filters.preset} onChange={(e)=>{setLoading(true);setError(false);setFilters((current)=>applyPreset(current,e.target.value as AnalyticsFilters['preset']))}}><option value="7days">{copy.seven}</option><option value="30days">{copy.thirty}</option><option value="custom">{copy.custom}</option></select></label>
        <label className="filter-field"><span>{copy.compare}</span><select value={filters.compareBy} onChange={(e)=>update({compareBy:e.target.value as AnalyticsFilters['compareBy'],academicUnitIds:[]})}><option value="faculty">{copy.faculty}</option><option value="academic_unit">{copy.unit}</option></select></label>
        <CheckSelect label={copy.faculty} summary={selectedFaculties.length?`${selectedFaculties.length} ${copy.selected}`:copy.wholeUniversity} maximum={copy.maximum} disabled={!structure||structureError} options={(structure?.faculties??[]).filter((x)=>x.active).map((x)=>({id:x.faculty_id,label:x.name}))} selected={filters.facultyIds} onChange={setFaculty}/>
        <CheckSelect label={copy.unit} summary={selectedUnits.length?`${selectedUnits.length} ${copy.selected}`:copy.allUnits} maximum={copy.maximum} disabled={!structure||structureError||filters.facultyIds.length!==1||filters.compareBy!=='academic_unit'} options={availableUnits.map((x)=>({id:x.academic_unit_id,label:x.name}))} selected={filters.academicUnitIds} onChange={(id,checked)=>update({academicUnitIds:checked?[...filters.academicUnitIds,id]:filters.academicUnitIds.filter((x)=>x!==id)})}/>
        <details className="advanced-filter"><summary>{copy.advanced} <Badge>0</Badge></summary><p>{copy.noAdvanced}</p></details>
        {filters.preset==='custom'&&<div className="analytics-custom-dates"><label><span>{copy.start}</span><input type="date" value={filters.dateFrom} onChange={(e)=>update({dateFrom:e.target.value})}/></label><label><span>{copy.end}</span><input type="date" value={filters.dateTo} onChange={(e)=>update({dateTo:e.target.value})}/></label></div>}
        <p className="filter-context">{copy.timezone} · {period} · {scopeSummary}</p>
      </section>
      {dateError&&<InlineAlert tone="danger">{copy.errors.date}</InlineAlert>}
      {structureError&&<InlineAlert tone="warning">{copy.errors.academic}</InlineAlert>}
      {error&&data&&<InlineAlert tone="warning">{text.common.staleData}</InlineAlert>}
      {loading&&!data?<AnalyticsLoading/>:!data?<ErrorState title={copy.errors.title} message={copy.errors.load} retry={()=>{setLoading(true);setError(false);setRefresh((x)=>x+1)}} retryLabel={text.common.retry}/>:<>
        <section className="analytics-kpis" aria-label={copy.title}><Kpi value={metrics?.assessmentTotal??0} label={copy.metrics.assessments} note={copy.metrics.assessmentNote}/><Kpi value={`${metrics?.highRiskPercent??0}%`} label={copy.metrics.severe} note={copy.metrics.severeNote.replace('{high}',String(metrics?.severe??0)).replace('{total}',String(metrics?.assessmentTotal??0))}/><Kpi value={metrics?.counselingTotal??0} label={copy.metrics.appointments} note={copy.metrics.appointmentNote}/><Kpi value={metrics?.completed??0} label={copy.metrics.completed} note={copy.metrics.completedNote}/></section>
        <div className="analytics-grid analytics-grid-wide">
          <Panel title={copy.charts.activity} description={copy.charts.activityBody.replace('{period}',period)}><BarChart rows={trend} empty={copy.empty.assessments} labelFormatter={(value)=>formatShortDate(value,language)}/></Panel>
          <Panel title={copy.charts.dimensions} description={copy.charts.dimensionsBody}><StackedBars rows={dimensions.map((row)=>({label:dimensionLabel(row.category,language),values:row.values}))} empty={copy.empty.dimensions} labels={severeLabels} resultLabel={copy.report.results} legendLabel={copy.report.severityLegend}/></Panel>
        </div>
        <div className="analytics-grid">
          <Panel title={copy.charts.comparison.replace('{scope}',data.mode==='academic_unit'?copy.charts.unitScope:data.mode==='faculty'?copy.charts.facultyScope:copy.charts.universityScope)} description={copy.charts.comparisonBody}><BarChart rows={comparison.map((row)=>({label:row.label,value:row.percent}))} valueSuffix="%" empty={copy.empty.comparison}/></Panel>
          <Panel title={copy.charts.counseling} description={copy.charts.counselingBody.replace('{period}',period)}><StatusBars rows={counseling.map((row)=>({...row,label:statusLocalized(row.label,language)}))} empty={copy.empty.counseling} shareLabel={copy.report.appointmentShare}/></Panel>
        </div>
        <section className="insights-panel" aria-labelledby="insights-title"><header><span><Icon name="info"/></span><div><h2 id="insights-title">{copy.insights.title}</h2><p>{copy.insights.body}</p></div></header><div className="insight-grid">{insightRows.map((item)=>{const [title,...body]=item.split(':');return <article key={title}><strong>{title}</strong><p>{body.join(':').trim()}</p></article>})}</div></section>
      </>}
    </div>
    <Drawer open={drawer} onOpenChange={setDrawer} title={copy.drawer.title} description={copy.drawer.body} className="report-drawer" footer={<div className="drawer-actions"><Button variant="secondary" onClick={()=>setDrawer(false)}>{text.common.cancel}</Button><Button disabled={sections.length===0||!data} onClick={preview}>{copy.drawer.preview}</Button></div>}>
      <div className="report-config"><section><h3>{copy.drawer.filters}</h3><div className="report-filter-summary"><strong>{copy.drawer.active}</strong><span>{period}</span><span>{scopeSummary}</span></div><Button variant="secondary" onClick={()=>{setDrawer(false);filterRef.current?.scrollIntoView({behavior:'smooth',block:'start'});filterRef.current?.focus()}}>{copy.drawer.change}</Button></section><section><h3>{copy.drawer.content}</h3><div className="report-checks">{REPORT_SECTIONS.map((section)=><label key={section}><input type="checkbox" checked={sections.includes(section)} onChange={(e)=>setSections((current)=>e.target.checked?[...current,section]:current.filter((x)=>x!==section))}/><span><strong>{copy.sections[section]}</strong></span></label>)}</div></section><section><h3>{copy.drawer.format}</h3><p className="report-format"><strong>{copy.drawer.web}</strong><span>{copy.drawer.noPdf}</span></p></section></div>
    </Drawer>
  </PageShell>
}

function CheckSelect({label,summary,maximum,disabled,options,selected,onChange}:{label:string;summary:string;maximum:string;disabled:boolean;options:{id:string;label:string}[];selected:string[];onChange:(id:string,checked:boolean)=>void}){return <div className="filter-field"><span>{label}</span><details className={`check-select ${disabled?'disabled':''}`}><summary aria-disabled={disabled}>{summary}</summary>{!disabled&&<fieldset><legend>{label} ({maximum})</legend>{options.map((option)=><label key={option.id}><input type="checkbox" checked={selected.includes(option.id)} disabled={!selected.includes(option.id)&&selected.length>=8} onChange={(e)=>onChange(option.id,e.target.checked)}/><span>{option.label}</span></label>)}</fieldset>}</details></div>}
function Kpi({value,label,note}:{value:number|string;label:string;note:string}){return <article className="analytics-kpi"><strong>{value}</strong><h2>{label}</h2><p>{note}</p></article>}
function AnalyticsLoading(){return <div className="analytics-loading" aria-busy="true"><section className="analytics-kpis">{[1,2,3,4].map((x)=><article className="analytics-kpi" key={x}><Skeleton lines={3}/></article>)}</section><div className="analytics-grid">{[1,2].map((x)=><section className="analytics-panel" key={x}><Skeleton lines={7}/></section>)}</div></div>}
function formatShortDate(value:string,language:'id'|'en'){return new Intl.DateTimeFormat(language==='id'?'id-ID':'en-GB',{timeZone:'UTC',day:'numeric',month:'short'}).format(new Date(`${value}T00:00:00Z`))}
function dimensionLabel(value:string,language:'id'|'en'){const labels=language==='id'?{depression:'Depresi',anxiety:'Kecemasan',stress:'Stres'}:{depression:'Depression',anxiety:'Anxiety',stress:'Stress'};return (labels as Record<string,string>)[value]??value}
function statusLocalized(value:string,language:'id'|'en'){if(language==='id')return ({confirmed:'Terjadwal',completed:'Selesai',cancelled:'Dibatalkan',rescheduled:'Dijadwalkan ulang',no_show:'Tidak hadir'} as Record<string,string>)[value]??value;return ({confirmed:'Scheduled',completed:'Completed',cancelled:'Cancelled',rescheduled:'Rescheduled',no_show:'No show'} as Record<string,string>)[value]??value}
