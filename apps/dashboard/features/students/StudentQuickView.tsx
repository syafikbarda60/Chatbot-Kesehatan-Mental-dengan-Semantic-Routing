'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { Badge, Button, Drawer, ErrorState, handleTabListKeyDown, InlineAlert, Skeleton } from '@/components/ui';
import { getStudent, getStudentAssessments, getStudentBookings } from './api';
import { isStudentProfile, safeAssessmentSummary, studentInitials } from './model';
import { StudentEditPanel } from './StudentEditPanel';
import type { AcademicStructure, StudentAssessmentPage, StudentBookingPage, StudentRow, StudentWorkspaceTab } from './types';

export function StudentQuickView({ studentId, academic, onClose, onDirectoryRefresh }: { studentId: string | null; academic: AcademicStructure | null; onClose: () => void; onDirectoryRefresh: () => void }) {
  const { language, text } = useLanguage();
  const router = useRouter();
  const [student, setStudent] = useState<StudentRow | null>(null);
  const [assessments, setAssessments] = useState<StudentAssessmentPage | null>(null);
  const [bookings, setBookings] = useState<StudentBookingPage | null>(null);
  const [profileError, setProfileError] = useState(false);
  const [assessmentError, setAssessmentError] = useState(false);
  const [bookingError, setBookingError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<StudentWorkspaceTab>('overview');
  const [version, setVersion] = useState(0);

  const reload = useCallback(() => { setLoading(true); setProfileError(false); setAssessmentError(false); setBookingError(false); setEditing(false); setTab('overview'); setVersion((value) => value + 1); onDirectoryRefresh(); }, [onDirectoryRefresh]);
  useEffect(() => {
    if (!studentId) return;
    const controller = new AbortController(); let active = true;
    void getStudent(studentId, controller.signal).then((value) => { if (active) { if (!isStudentProfile(value)) throw new Error('not-student'); setStudent(value); } }).catch(() => { if (active) setProfileError(true); }).finally(() => { if (active) setLoading(false); });
    void getStudentAssessments(studentId, 1, 1, controller.signal).then((value) => { if (active) setAssessments(value); }).catch(() => { if (active) setAssessmentError(true); });
    void getStudentBookings(studentId, 1, 1, controller.signal).then((value) => { if (active) setBookings(value); }).catch(() => { if (active) setBookingError(true); });
    return () => { active = false; controller.abort(); };
  }, [studentId, version]);

  const locale = language === 'id' ? 'id-ID' : 'en-GB';
  const title = student?.name ?? text.students.quick.title;
  return <Drawer open={!!studentId} onOpenChange={(open) => { if (!open) onClose(); }} title={title} description={student ? `${student.nim ?? text.students.unavailable} · ${student.email}` : text.students.quick.description} closeLabel={text.common.close} className="student-quick-drawer" footer={student && !editing ? <Button className="drawer-primary-action" onClick={() => router.push(`/students/${student.user_id}`)}>{text.students.quick.openFull}</Button> : undefined}>
    {loading ? <div className="drawer-skeleton" aria-busy="true"><Skeleton lines={9} /></div> : profileError || !student ? <ErrorState title={text.errors.title} message={text.students.errors.profile} retry={reload} retryLabel={text.common.retry} /> : editing ? <StudentEditPanel student={student} academic={academic} onSaved={reload} /> : <div className="student-quick-content">
      <section className="student-identity"><span className="avatar student-avatar">{studentInitials(student.name)}</span><div><Badge tone="success">{text.students.studentRole}</Badge><h3>{student.name}</h3><p>{student.nim ?? text.students.unavailable} · {student.email}</p></div></section>
      <div className="quick-actions"><Button variant="secondary" onClick={() => setEditing(true)}>{text.students.edit.action}</Button></div>
      <div className="detail-tabs student-drawer-tabs" role="tablist" aria-label={text.students.quick.title} onKeyDown={handleTabListKeyDown}>{(['overview', 'assessments', 'counseling', 'academic'] as StudentWorkspaceTab[]).map((key) => <button key={key} role="tab" aria-selected={tab === key} tabIndex={tab === key ? 0 : -1} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{text.students.tabs[key]}</button>)}</div>
      {tab === 'overview' && <><ProfileCard title={text.students.sections.account}><Definition label={text.students.fields.registered} value={formatDate(student.created_at, locale)} /><Definition label={text.students.fields.lastLogin} value={text.students.unsupported.lastLogin} /></ProfileCard><ProfileCard title={text.students.sections.support}><SupportSnapshot student={student} /></ProfileCard><ProfileCard title={text.students.sections.latestAssessment}>{assessmentError ? <InlineAlert tone="warning">{text.students.errors.assessments}</InlineAlert> : assessments?.assessments[0] ? <AssessmentSnapshot assessment={assessments.assessments[0]} /> : <p className="section-empty">{text.students.empty.assessments}</p>}</ProfileCard><ProfileCard title={text.students.sections.latestCounseling}>{bookingError ? <InlineAlert tone="warning">{text.students.errors.counseling}</InlineAlert> : bookings?.bookings[0] ? <BookingSnapshot booking={bookings.bookings[0]} locale={locale} /> : <p className="section-empty">{text.students.empty.counseling}</p>}</ProfileCard></>}
      {tab === 'assessments' && <ProfileCard title={text.students.sections.latestAssessment}>{assessmentError ? <InlineAlert tone="warning">{text.students.errors.assessments}</InlineAlert> : assessments?.assessments[0] ? <AssessmentSnapshot assessment={assessments.assessments[0]} /> : <p className="section-empty">{text.students.empty.assessments}</p>}</ProfileCard>}
      {tab === 'counseling' && <ProfileCard title={text.students.sections.latestCounseling}>{bookingError ? <InlineAlert tone="warning">{text.students.errors.counseling}</InlineAlert> : bookings?.bookings[0] ? <BookingSnapshot booking={bookings.bookings[0]} locale={locale} /> : <p className="section-empty">{text.students.empty.counseling}</p>}</ProfileCard>}
      {tab === 'academic' && <ProfileCard title={text.students.sections.academic}><Definition label={text.students.fields.faculty} value={student.faculty_name ?? text.students.unavailable} /><Definition label={text.students.fields.unit} value={student.academic_unit_name ?? text.students.unavailable} /></ProfileCard>}
    </div>}
  </Drawer>;
}

export function ProfileCard({ title, children }: { title: string; children: React.ReactNode }) { return <section className="profile-card"><h3>{title}</h3><div className="profile-card-body">{children}</div></section>; }
export function Definition({ label, value }: { label: string; value: string }) { return <div className="definition-row"><dt>{label}</dt><dd>{value}</dd></div>; }
export function SupportSnapshot({ student }: { student: StudentRow }) {
  const { language, text } = useLanguage();
  if (!student.support_condition && !student.support_disability) return <p className="section-empty">{text.students.unsupported.historicalSupport}</p>;
  const labels = language === 'id'
    ? { condition: 'Kondisi dilaporkan', disability: 'Disabilitas', none: 'Tidak ada', present: 'Ada', unknown: 'Belum diketahui', prefer_not_to_say: 'Memilih tidak menjawab' }
    : { condition: 'Reported condition', disability: 'Disability', none: 'None', present: 'Present', unknown: 'Unknown', prefer_not_to_say: 'Prefer not to say' };
  return <dl><Definition label={labels.condition} value={labels[student.support_condition ?? 'unknown']} /><Definition label={labels.disability} value={labels[student.support_disability ?? 'unknown']} /></dl>;
}
export function AssessmentSnapshot({ assessment }: { assessment: StudentAssessmentPage['assessments'][number] }) {
  const { text } = useLanguage(); const parts = safeAssessmentSummary(assessment);
  return <div className="snapshot"><div className="snapshot-heading"><strong>{assessment.instrument_type}</strong><Badge tone={severityTone(assessment.severity)}>{severityLabel(assessment.severity, text.overview.priority)}</Badge></div>{parts.length > 0 && <div className="dimension-list">{parts.map((part) => <span key={part.category}>{text.overview.categories[part.category as keyof typeof text.overview.categories]}: {part.scaledScore ?? '—'} · {severityLabel(part.severity, text.overview.priority)}</span>)}</div>}</div>;
}
export function BookingSnapshot({ booking, locale }: { booking: StudentBookingPage['bookings'][number]; locale: string }) {
  const { text } = useLanguage();
  return <div className="snapshot"><div className="snapshot-heading"><strong>{formatBooking(booking, locale)}</strong><Badge tone={booking.status === 'cancelled' ? 'danger' : booking.status === 'completed' ? 'success' : 'info'}>{text.students.bookingStatus[booking.status]}</Badge></div></div>;
}
export function formatDate(value: string | null, locale: string) { if (!value) return '—'; const date = new Date(value); return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat(locale, { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', year: 'numeric' }).format(date); }
export function formatBooking(booking: StudentBookingPage['bookings'][number], locale: string) { const date = new Date(`${booking.date}T00:00:00+07:00`); const day = Number.isNaN(date.getTime()) ? booking.date : new Intl.DateTimeFormat(locale, { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', year: 'numeric' }).format(date); return `${day} · ${booking.start_time.slice(0, 5)}–${booking.end_time.slice(0, 5)}`; }
export function severityLabel(value: string | null, labels: Record<string, string>) { if (!value) return labels.unknown; const key = value.trim().toLowerCase().replaceAll(' ', '_'); return labels[key] ?? value; }
export function severityTone(value: string | null): 'neutral' | 'info' | 'warning' | 'danger' { const key = value?.trim().toLowerCase().replaceAll(' ', '_'); return key === 'extremely_severe' || key === 'severe' ? 'danger' : key === 'moderate' ? 'warning' : key === 'mild' || key === 'minimal' || key === 'normal' ? 'info' : 'neutral'; }
