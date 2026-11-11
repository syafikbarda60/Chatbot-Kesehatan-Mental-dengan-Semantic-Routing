'use client';

import { useMemo, useState } from 'react';
import { Button, Drawer, InlineAlert, Input, TimeField } from '@/components/ui';
import type { Messages } from '@/lib/i18n/messages';
import { ApiError } from '@/lib/api/client';
import { createBlockedPeriod } from './api';
import { affectedAppointments, localExceptionPayload } from './model';
import type { Appointment, Counselor } from './types';

type Copy = Messages['counseling'];

export function ExceptionDrawer({ open, counselors, appointments, initialCounselorId = '', copy, locale, onClose, onSaved }: { open: boolean; counselors: Counselor[]; appointments: Appointment[]; initialCounselorId?: string; copy: Copy; locale: string; onClose: () => void; onSaved: () => void }) {
  const [counselor, setCounselor] = useState(initialCounselorId);
  const [date, setDate] = useState('');
  const [fullDay, setFullDay] = useState(true);
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('17:00');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const payload = useMemo(() => localExceptionPayload(counselor, date, start, end, fullDay), [counselor, date, start, end, fullDay]);
  const affected = useMemo(() => payload ? affectedAppointments(payload, appointments) : [], [payload, appointments]);

  const save = async () => {
    if (!payload) { setError(copy.drawer.invalid); return; }
    if (affected.length) { setError(copy.drawer.exceptionConflict); return; }
    setSaving(true); setError('');
    try { await createBlockedPeriod({ ...payload, reason: reason.trim() || undefined }); onSaved(); }
    catch (caught) { setError(caught instanceof ApiError && caught.status === 409 ? copy.drawer.exceptionConflict : copy.errors.mutation); }
    finally { setSaving(false); }
  };

  return <Drawer open={open} onOpenChange={(value) => { if (!value) onClose(); }} title={copy.exceptions.createTitle} description={copy.exceptions.createDescription} closeLabel={copy.actions.close} footer={<div className="drawer-actions"><Button variant="secondary" onClick={onClose}>{copy.actions.close}</Button><Button loading={saving} disabled={affected.length > 0} onClick={() => { void save(); }}>{copy.actions.saveException}</Button></div>}>
    <div className="schedule-form">
      {error && <InlineAlert tone="danger">{error}</InlineAlert>}
      {affected.length > 0 && <InlineAlert tone="danger"><strong>{copy.exceptions.affected.replace('{count}', String(affected.length))}</strong><span>{copy.exceptions.affectedBody}</span><ul className="affected-session-list">{affected.map((item) => <li key={item.counseling_appointment_id}><span>{item.student_name}</span><small>{formatDateTime(item.starts_at, locale)} · {item.counselor_name}</small></li>)}</ul></InlineAlert>}
      <label>{copy.fields.counselor}<select value={counselor} onChange={(event) => setCounselor(event.target.value)}><option value="">{copy.drawer.chooseCounselor}</option>{counselors.map((item) => <option value={item.user_id} key={item.user_id}>{item.name}</option>)}</select></label>
      <Input label={copy.fields.date} type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      <label className="check-row"><input type="checkbox" checked={fullDay} onChange={(event) => setFullDay(event.target.checked)} /><span>{copy.exceptions.fullDay}</span></label>
      {!fullDay && <div className="time-fields"><TimeField label={copy.drawer.start} value={start} onChange={setStart} /><TimeField label={copy.drawer.end} value={end} onChange={setEnd} /></div>}
      <Input label={copy.fields.reason} value={reason} maxLength={250} onChange={(event) => setReason(event.target.value)} />
    </div>
  </Drawer>;
}

function formatDateTime(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}
