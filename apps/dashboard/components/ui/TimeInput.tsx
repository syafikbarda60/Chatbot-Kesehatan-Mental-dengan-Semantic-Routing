import { useId } from 'react';

// Native <input type="time"> follows the browser's locale. In a 12-hour browser it adds an AM/PM
// segment, and until that is picked its value stays '', so a time that looked filled in ("09:00 --")
// was reported as missing. Two selects are 24-hour in every browser and never hold half a time.
const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, m) => String(m * 5).padStart(2, '0'));

interface TimeInputProps { value: string; onChange: (value: string) => void; label: string; disabled?: boolean; id?: string }

/** "HH:MM", or '' until an hour is picked. Picking an hour fills the minutes with 00, so the value is complete at once. */
export function TimeInput({ value, onChange, label, disabled, id }: TimeInputProps) {
  const [hour = '', minute = ''] = value ? value.split(':') : [];
  // A stored time off the 5-minute grid (e.g. 09:07) stays selectable
  const minutes = minute && !MINUTES.includes(minute) ? [...MINUTES, minute].sort() : MINUTES;
  return <span className="time-input">
    <select id={id} aria-label={`${label} (HH)`} value={hour} disabled={disabled} onChange={(event) => onChange(event.target.value ? `${event.target.value}:${minute || '00'}` : '')}>
      {!hour && <option value="">--</option>}
      {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
    </select>
    <span aria-hidden="true">:</span>
    <select aria-label={`${label} (MM)`} value={minute} disabled={disabled || !hour} onChange={(event) => onChange(`${hour}:${event.target.value}`)}>
      {!minute && <option value="">--</option>}
      {minutes.map((m) => <option key={m} value={m}>{m}</option>)}
    </select>
  </span>;
}

/** TimeInput with the same label block as Input. */
export function TimeField(props: Omit<TimeInputProps, 'id'>) {
  const id = useId();
  return <div className="field"><label htmlFor={id}>{props.label}</label><TimeInput id={id} {...props} /></div>;
}
