'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Button, ErrorState, InlineAlert, Skeleton } from '@/components/ui';
import { getAcademicStructure } from '@/features/monitoring/api';
import type { AcademicStructure } from '@/features/monitoring/types';
import { useLanguage } from '@/components/providers/LanguageProvider';
import type { Language, Messages } from '@/lib/i18n/messages';
import { getAnalytics } from './api';
import { academicComparison, aggregate, counselingComposition, groupTrend, insights, parseReportConfiguration, REPORT_STORAGE_KEY, severityByCategory } from './model';
import type { AnalyticsResponse, ReportConfiguration, ReportSection } from './types';
import { BarChart, Panel, StackedBars, StatusBars } from './Charts';

export function ReportPreview(){
  const {language,text}=useLanguage();
  const copy=text.analytics; const report=copy.report;
  const [config,setConfig]=useState<ReportConfiguration|null>(null); const [missing,setMissing]=useState(false); const [data,setData]=useState<AnalyticsResponse|null>(null); const [structure,setStructure]=useState<AcademicStructure|null>(null); const [loading,setLoading]=useState(true); const [error,setError]=useState(false); const [refresh,setRefresh]=useState(0);
  useEffect(()=>{const timer=window.setTimeout(()=>{const parsed=parseReportConfiguration(sessionStorage.getItem(REPORT_STORAGE_KEY));setConfig(parsed);setMissing(!parsed)},0);return()=>window.clearTimeout(timer)},[]);
  useEffect(()=>{if(!config)return;const c=new AbortController();Promise.allSettled([getAnalytics(config.filters,c.signal),getAcademicStructure(c.signal)]).then(([analytics,academic])=>{if(analytics.status==='fulfilled'){setData(analytics.value);setError(false)}else if(!(analytics.reason instanceof DOMException&&analytics.reason.name==='AbortError'))setError(true);if(academic.status==='fulfilled')setStructure(academic.value);setLoading(false)});return()=>c.abort()},[config,refresh]);
  const metrics=useMemo(()=>data?aggregate(data):null,[data]); const trend=useMemo(()=>data?groupTrend(data):[],[data]); const dimensions=useMemo(()=>data?severityByCategory(data):[],[data]); const comparison=useMemo(()=>data?academicComparison(data):[],[data]); const counseling=useMemo(()=>data?counselingComposition(data):[],[data]); const insightRows=useMemo(()=>data?insights(data,language):[],[data,language]);
  if(missing)return <main className="report-preview-shell"><ErrorState title={report.missingTitle} message={report.missingBody}/><Link className="button button-secondary" href="/analytics"><span>{report.back}</span></Link></main>;
  if(!config)return <main className="report-preview-shell"><Skeleton lines={8}/></main>;
  const selected=(section:ReportSection)=>config.sections.includes(section); const scope=scopeLabel(config,structure,data,copy.wholeUniversity); const generated=new Intl.DateTimeFormat(language==='id'?'id-ID':'en-US',{timeZone:'Asia/Jakarta',dateStyle:'long',timeStyle:'short'}).format(new Date(config.createdAt)); const statusLabels=text.counseling.status.backend;
  return <main className="report-preview-shell"><nav className="report-preview-nav" aria-label={report.navLabel}><Link className="button button-secondary" href="/analytics"><span>{report.back}</span></Link><span>{report.previewNote}</span><Button className="report-print-action" onClick={()=>window.print()}>{language==='id'?'Cetak / Simpan PDF':'Print / Save as PDF'}</Button></nav>
    <article className="stakeholder-report">
      <header className="report-header"><div className="report-brand"><span>SA</span><div><strong>SAJIWA</strong><small>{report.organization}</small></div></div><div className="report-label">{report.label}</div><h1>{report.title}</h1><dl><div><dt>{report.period}</dt><dd>{formatDate(config.filters.dateFrom,language)}–{formatDate(config.filters.dateTo,language)}</dd></div><div><dt>{report.scope}</dt><dd>{scope}</dd></div><div><dt>{report.generated}</dt><dd>{generated} {report.timezone}</dd></div></dl></header>
      {loading?<div className="report-loading"><Skeleton lines={12}/></div>:error||!data?<ErrorState title={report.errorTitle} message={report.errorBody} retry={()=>{setLoading(true);setError(false);setRefresh((x)=>x+1)}} retryLabel={text.common.retry}/>:<>
        <InlineAlert tone="info">{report.privacy}</InlineAlert>
        {selected('summary')&&<ReportSectionBlock title={copy.sections.summary}><div className="report-kpis"><ReportKpi value={metrics?.assessmentTotal??0} label={report.submissions}/><ReportKpi value={`${metrics?.highRiskPercent??0}%`} label={report.severe}/><ReportKpi value={metrics?.counselingTotal??0} label={report.appointments}/><ReportKpi value={metrics?.completed??0} label={report.completed}/></div></ReportSectionBlock>}
        {selected('assessmentTrend')&&<ReportSectionBlock title={copy.sections.assessmentTrend}><Panel title={report.trendTitle} description={`${formatDate(config.filters.dateFrom,language)}–${formatDate(config.filters.dateTo,language)}; ${report.trendDescription}`}><BarChart rows={trend} empty={copy.empty.assessments} labelFormatter={(value)=>formatShortDate(value,language)}/></Panel></ReportSectionBlock>}
        {selected('dimensions')&&<ReportSectionBlock title={copy.sections.dimensions}><Panel title={report.dimensionTitle} description={report.dimensionDescription}><StackedBars rows={dimensions.map((row)=>({label:text.instruments.dimensions[row.category]??row.category,values:row.values}))} labels={text.overview.priority} resultLabel={report.results} legendLabel={report.severityLegend} empty={copy.empty.dimensions}/></Panel></ReportSectionBlock>}
        {selected('academic')&&<ReportSectionBlock title={copy.sections.academic}><Panel title={report.academicTitle} description={report.academicDescription}><BarChart rows={comparison.map((row)=>({label:row.label,value:row.percent}))} valueSuffix="%" empty={copy.empty.comparison}/></Panel></ReportSectionBlock>}
        {selected('counseling')&&<ReportSectionBlock title={copy.sections.counseling}><Panel title={report.counselingTitle} description={report.counselingDescription}><StatusBars rows={counseling.map((row)=>({...row,label:statusLabels[row.label as keyof typeof statusLabels]??row.label}))} empty={copy.empty.counseling} shareLabel={report.appointmentShare}/></Panel></ReportSectionBlock>}
        {selected('insights')&&<ReportSectionBlock title={copy.sections.insights}><div className="report-insights">{insightRows.map((item)=><p key={item}>{item}</p>)}</div></ReportSectionBlock>}
        {selected('appendix')&&<ReportSectionBlock title={copy.sections.appendix}><AggregateTables data={data} text={text}/></ReportSectionBlock>}
      </>}
      <footer className="report-footer"><span>Sajiwa · {text.brandDescriptor}</span><span>{report.internal}</span></footer>
    </article>
  </main>
}
function ReportSectionBlock({title,children}:{title:string;children:React.ReactNode}){return <section className="report-section"><h2>{title}</h2>{children}</section>}
function ReportKpi({value,label}:{value:number|string;label:string}){return <div><strong>{value}</strong><span>{label}</span></div>}
function AggregateTables({data,text}:{data:AnalyticsResponse;text:Messages}){const report=text.analytics.report;const statuses=text.counseling.status.backend;return <div className="aggregate-tables"><table><caption>{report.severityCaption}</caption><thead><tr><th>{report.scopeColumn}</th><th>{report.severityColumn}</th><th>{report.countColumn}</th></tr></thead><tbody>{data.severity_distribution.map((row,index)=><tr key={`${row.scope_label}-${row.severity}-${index}`}><td>{row.scope_label}</td><td>{text.overview.priority[row.severity as keyof typeof text.overview.priority]??row.severity}</td><td>{row.count}</td></tr>)}</tbody></table><table><caption>{report.counselingCaption}</caption><thead><tr><th>{report.scopeColumn}</th><th>{report.statusColumn}</th><th>{report.countColumn}</th></tr></thead><tbody>{data.counseling_utilization.map((row,index)=><tr key={`${row.scope_label}-${row.status}-${index}`}><td>{row.scope_label}</td><td>{statuses[row.status as keyof typeof statuses]??row.status.replaceAll('_',' ')}</td><td>{row.count}</td></tr>)}</tbody></table></div>}
function scopeLabel(config:ReportConfiguration,structure:AcademicStructure|null,data:AnalyticsResponse|null,fallback:string){if(structure){const units=structure.academicUnits.filter((x)=>config.filters.academicUnitIds.includes(x.academic_unit_id)).map((x)=>x.name);if(units.length)return units.join(', ');const faculties=structure.faculties.filter((x)=>config.filters.facultyIds.includes(x.faculty_id)).map((x)=>x.name);if(faculties.length)return faculties.join(', ')}return data?.selected_scopes.map((item)=>item.scope_label).join(', ')||fallback}
function formatDate(value:string,language:Language){return new Intl.DateTimeFormat(language==='id'?'id-ID':'en-US',{timeZone:'UTC',day:'numeric',month:'long',year:'numeric'}).format(new Date(`${value}T00:00:00Z`))}
function formatShortDate(value:string,language:Language){return new Intl.DateTimeFormat(language==='id'?'id-ID':'en-US',{timeZone:'UTC',day:'numeric',month:'short'}).format(new Date(`${value}T00:00:00Z`))}
