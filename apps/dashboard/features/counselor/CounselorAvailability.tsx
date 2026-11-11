'use client';

import {useCallback, useMemo, useState} from 'react';
import {useLanguage} from '@/components/providers/LanguageProvider';
import {Badge, Button, Drawer, EmptyState, ErrorState, InlineAlert, Input, LoadingState, PageShell, TimeField} from '@/components/ui';
import {counselorMessages} from '@/lib/i18n/counselorMessages';
import {getCounselorWorkspace, requestException} from './api';
import {formatDateTime, jakartaDate, statusTone, timeRange} from './format';
import {overlappingAppointments} from './model';
import type {ExceptionDraft} from './types';
import {useCounselorData} from './useCounselorData';

const daysId = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
const daysEn = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const initial = (): ExceptionDraft => ({date: jakartaDate(1), full_day: false, start_time: '09:00', end_time: '12:00', reason: 'Cuti pribadi', note: ''});

export function CounselorAvailabilityPage() {
  const {language} = useLanguage();
  const copy = counselorMessages[language];
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const load = useCallback((signal: AbortSignal) => getCounselorWorkspace(jakartaDate(-30), jakartaDate(90), signal), []);
  const {data, error, retry} = useCounselorData(load);
  const overlaps = useMemo(() => data ? overlappingAppointments(draft, data.appointments) : [], [data, draft]);
  if (error) return <ErrorState title={copy.availability.title} message={copy.errors.load} retry={retry} retryLabel={copy.common.retry}/>;
  if (!data) return <LoadingState label={copy.common.loading} fullPage/>;

  async function submit() {
    setSaving(true);
    setMessage('');
    try {
      await requestException(draft);
      setMessage(language === 'id' ? 'Permintaan berhasil diajukan.' : 'Request submitted.');
      setOpen(false);
      retry();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : copy.errors.mutation);
    } finally {
      setSaving(false);
    }
  }
  const days = language === 'id' ? daysId : daysEn;

  return <PageShell title={copy.availability.title} description={copy.availability.subtitle} actions={<Button onClick={() => setOpen(true)}>{copy.availability.request}</Button>}>
    {message && <InlineAlert tone={message.includes('berhasil') || message.includes('submitted') ? 'success' : 'danger'}>{message}</InlineAlert>}
    <section className="operations-panel availability-routine-panel" aria-labelledby="routine-heading"><header className="operations-panel-header"><div><h2 id="routine-heading">{copy.availability.routine}</h2><p>{copy.availability.readOnly}</p></div></header><div className="operations-table-wrap"><table className="operations-table availability-table"><thead><tr><th>{copy.availability.day}</th><th>{copy.availability.windows}</th></tr></thead><tbody>{days.map((day, index) => {const rows = data.availability.filter((row) => row.day_of_week === index); return <tr key={day}><th scope="row">{day}</th><td>{rows.length ? <div className="availability-windows">{rows.map((row) => <span key={row.counselor_availability_rule_id}>{row.start_time.slice(0, 5)}–{row.end_time.slice(0, 5)}</span>)}</div> : <span className="muted-copy">{copy.availability.unavailable}</span>}</td></tr>})}</tbody></table></div></section>
    <section className="operations-panel" aria-labelledby="exceptions-heading"><header className="operations-panel-header"><h2 id="exceptions-heading">{copy.availability.exceptions}</h2></header>{data.exceptions.length ? <div className="operations-table-wrap"><table className="operations-table counselor-exception-table"><thead><tr><th>{copy.availability.date}</th><th>{copy.schedule.time}</th><th>{copy.availability.reason}</th><th>{copy.availability.submitted}</th><th>{copy.schedule.status}</th><th>{copy.availability.decision}</th></tr></thead><tbody>{data.exceptions.map((row) => <tr key={row.counselor_exception_request_id}><td>{row.date}</td><td className="time-cell">{row.full_day ? copy.availability.fullDay : timeRange(row.starts_at, row.ends_at, language)}</td><td>{row.reason}<small>{row.note ?? ''}</small></td><td>{formatDateTime(row.submitted_at, language)}</td><td><Badge tone={statusTone(row.status)}>{row.status}</Badge></td><td>{row.decision_note ?? '—'}</td></tr>)}</tbody></table></div> : <EmptyState title={copy.availability.exceptions}/>}</section>
    <Drawer open={open} onOpenChange={setOpen} title={copy.availability.request} description={copy.availability.productionGap} footer={<><Button variant="ghost" onClick={() => setOpen(false)}>{copy.common.cancel}</Button><Button loading={saving} onClick={() => void submit()}>{overlaps.length ? copy.availability.continue : copy.common.save}</Button></>}>
      <div className="counselor-form">
        <Input type="date" label={copy.availability.date} value={draft.date} onChange={(event) => setDraft({...draft, date: event.target.value})}/>
        <label className="checkbox-field"><input type="checkbox" checked={draft.full_day} onChange={(event) => setDraft({...draft, full_day: event.target.checked})}/>{copy.availability.fullDay}</label>
        {!draft.full_day && <><div className="form-grid"><TimeField label={copy.availability.start} value={draft.start_time} onChange={(start_time) => setDraft({...draft, start_time})}/><TimeField label={copy.availability.end} value={draft.end_time} onChange={(end_time) => setDraft({...draft, end_time})}/></div>{overlaps.length > 0 && <InlineAlert tone="warning">{copy.availability.overlap.replace('{count}', String(overlaps.length))}<ul>{overlaps.map((row) => <li key={row.counseling_appointment_id}>{row.student_name} · {timeRange(row.starts_at, row.ends_at, language)}</li>)}</ul></InlineAlert>}</>}
        <Input label={copy.availability.reason} value={draft.reason} onChange={(event) => setDraft({...draft, reason: event.target.value})}/>
        <label className="field"><span>{copy.availability.note}</span><textarea value={draft.note} onChange={(event) => setDraft({...draft, note: event.target.value})}/></label>
      </div>
    </Drawer>
  </PageShell>;
}
