'use client';

import type { ReactNode } from 'react';
import { EmptyState } from '@/components/ui';
import { SEVERITY_ORDER } from './model';

export const severityLabels: Record<string, string> = { minimal:'Minimal',normal:'Normal',mild:'Ringan',moderate:'Sedang',severe:'Berat',extremely_severe:'Sangat berat' };

export function Panel({ title, description, children, className='' }: { title:string; description:string; children:ReactNode; className?:string }) {
  return <section className={`analytics-panel ${className}`}><header><h2>{title}</h2><p>{description}</p></header>{children}</section>;
}
export function BarChart({ rows, empty, valueSuffix='', labelFormatter=(label)=>label }: { rows:{label:string;value:number}[]; empty:string; valueSuffix?:string; labelFormatter?:(label:string)=>string }) {
  if (!rows.length || rows.every((row)=>row.value===0)) return <EmptyState title={empty}/>;
  const max=Math.max(...rows.map((row)=>row.value),1);
  return <div className="bar-chart" role="img" aria-label={rows.map((row)=>`${labelFormatter(row.label)}: ${row.value}${valueSuffix}`).join('; ')}>{rows.map((row)=><div className="bar-row" key={row.label} title={`${labelFormatter(row.label)}: ${row.value}${valueSuffix}`}><span>{labelFormatter(row.label)}</span><div className="bar-track"><i style={{width:`${row.value/max*100}%`}}/></div><strong>{row.value}{valueSuffix}</strong></div>)}</div>;
}
export function StackedBars({ rows, empty, labels=severityLabels, resultLabel='hasil', legendLabel='Legenda tingkat keparahan' }: { rows:{label:string;values:{severity:string;value:number}[]}[]; empty:string; labels?:Record<string,string>; resultLabel?:string; legendLabel?:string }) {
  const available=rows.filter((row)=>row.values.some((item)=>item.value>0)); if(!available.length) return <EmptyState title={empty}/>;
  return <div className="stacked-chart">{available.map((row)=>{const total=row.values.reduce((n,item)=>n+item.value,0);return <div className="stacked-row" key={row.label}><div><strong>{row.label}</strong><span>{total} {resultLabel}</span></div><div className="stacked-track" role="img" aria-label={`${row.label}: ${row.values.map((item)=>`${labels[item.severity]??item.severity} ${item.value}`).join(', ')}`}>{row.values.map((item)=><i className={`severity-${item.severity}`} style={{width:`${item.value/total*100}%`}} key={item.severity} title={`${labels[item.severity]??item.severity}: ${item.value} (${Math.round(item.value/total*100)}%)`}><span>{Math.round(item.value/total*100)}%</span></i>)}</div></div>})}<SeverityLegend labels={labels} ariaLabel={legendLabel}/></div>;
}
export function SeverityLegend({labels=severityLabels,ariaLabel='Legenda tingkat keparahan'}:{labels?:Record<string,string>;ariaLabel?:string}){return <ul className="chart-legend" aria-label={ariaLabel}>{SEVERITY_ORDER.map((severity)=><li key={severity}><i className={`severity-${severity}`}/>{labels[severity]}</li>)}</ul>}
export function StatusBars({rows,empty,shareLabel='dari janji temu'}:{rows:{label:string;value:number}[];empty:string;shareLabel?:string}){const total=rows.reduce((n,row)=>n+row.value,0);if(!total)return <EmptyState title={empty}/>;return <div className="status-bars">{rows.map((row)=><div className="status-row" key={row.label}><span><strong>{statusLabel(row.label)}</strong><small>{Math.round(row.value/total*100)}% {shareLabel}</small></span><div className="status-track"><i style={{width:`${row.value/total*100}%`}}/></div><b>{row.value}</b></div>)}</div>}
export function statusLabel(status:string){return ({confirmed:'Terjadwal',completed:'Selesai',cancelled:'Dibatalkan',rescheduled:'Dijadwalkan ulang',no_show:'Tidak hadir'} as Record<string,string>)[status]??status.replaceAll('_',' ')}
export function severityRows(values:{severity:string;value:number}[]){return SEVERITY_ORDER.map((severity)=>values.find((item)=>item.severity===severity)??{severity,value:0})}
