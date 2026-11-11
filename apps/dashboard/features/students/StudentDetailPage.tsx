'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { Badge, Button, Drawer, EmptyState, ErrorState, handleTabListKeyDown, InlineAlert, PageShell, Skeleton } from '@/components/ui';
import { getAcademicStructure } from '@/features/monitoring/api';
import { getStudent, getStudentAssessments, getStudentBookings } from './api';
import { isStudentProfile, paginateRange, safeAssessmentSummary, studentInitials } from './model';
import { StudentEditPanel } from './StudentEditPanel';
import { AssessmentSnapshot, BookingSnapshot, Definition, ProfileCard, SupportSnapshot, formatBooking, formatDate, severityLabel, severityTone } from './StudentQuickView';
import type { AcademicStructure, StudentAssessmentPage, StudentBookingPage, StudentRow, StudentWorkspaceTab } from './types';

const HISTORY_PAGE_SIZE = 20;

export function StudentDetailPage() {
  const params = useParams<{ studentId: string }>();
  return <StudentDetailWorkspace key={params.studentId} studentId={params.studentId} />;
}

function StudentDetailWorkspace({ studentId }: { studentId: string }) {
  const { language, text } = useLanguage();
  const [student, setStudent] = useState<StudentRow | null>(null);
  const [academic, setAcademic] = useState<AcademicStructure | null>(null);
  const [assessments, setAssessments] = useState<StudentAssessmentPage | null>(null);
  const [bookings, setBookings] = useState<StudentBookingPage | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [assessmentLoading, setAssessmentLoading] = useState(true);
  const [bookingLoading, setBookingLoading] = useState(true);
  const [profileError, setProfileError] = useState(false);
  const [academicError, setAcademicError] = useState(false);
  const [assessmentError, setAssessmentError] = useState(false);
  const [bookingError, setBookingError] = useState(false);
  const [assessmentPage, setAssessmentPage] = useState(1);
  const [bookingPage, setBookingPage] = useState(1);
  const [tab, setTab] = useState<StudentWorkspaceTab>('overview');
  const [editing, setEditing] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const locale = language === 'id' ? 'id-ID' : 'en-GB';

  const refresh = useCallback(() => { setProfileLoading(true); setAssessmentLoading(true); setBookingLoading(true); setProfileError(false); setAssessmentError(false); setBookingError(false); setRefreshVersion((value) => value + 1); }, []);
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    void getStudent(studentId, controller.signal).then((value) => { if (active) { if (!isStudentProfile(value)) throw new Error('not-student'); setStudent(value); } }).catch(() => { if (active) setProfileError(true); }).finally(() => { if (active) setProfileLoading(false); });
    void getAcademicStructure(controller.signal).then((value) => { if (active) { setAcademic(value); setAcademicError(false); } }).catch(() => { if (active) setAcademicError(true); });
    return () => { active = false; controller.abort(); };
  }, [studentId, refreshVersion]);

  useEffect(() => {
    const controller = new AbortController(); let active = true;
    void getStudentAssessments(studentId, assessmentPage, HISTORY_PAGE_SIZE, controller.signal).then((value) => { if (active) setAssessments(value); }).catch(() => { if (active) setAssessmentError(true); }).finally(() => { if (active) setAssessmentLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [studentId, assessmentPage, refreshVersion]);

  useEffect(() => {
    const controller = new AbortController(); let active = true;
    void getStudentBookings(studentId, bookingPage, HISTORY_PAGE_SIZE, controller.signal).then((value) => { if (active) setBookings(value); }).catch(() => { if (active) setBookingError(true); }).finally(() => { if (active) setBookingLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [studentId, bookingPage, refreshVersion]);

  const assessmentPagination = useMemo(() => paginateRange(assessmentPage, HISTORY_PAGE_SIZE, assessments?.total ?? 0), [assessmentPage, assessments]);
  const bookingPagination = useMemo(() => paginateRange(bookingPage, HISTORY_PAGE_SIZE, bookings?.total ?? 0), [bookingPage, bookings]);
  if (profileLoading && !student) return <PageShell title={text.students.detailTitle}><section className="operations-panel detail-loading" aria-busy="true"><Skeleton lines={12} /></section></PageShell>;
  if (profileError || !student) return <PageShell title={text.students.detailTitle}><section className="operations-panel"><ErrorState title={text.errors.title} message={text.students.errors.profile} retry={refresh} retryLabel={text.common.retry} /></section></PageShell>;

  const tabs: StudentWorkspaceTab[] = ['overview', 'assessments', 'counseling', 'academic'];
  return <PageShell title={student.name} actions={<div className="page-actions"><Button variant="secondary" onClick={() => setEditing(true)}>{text.students.edit.action}</Button><Button variant="secondary" icon="refresh" onClick={refresh}>{text.students.refresh}</Button></div>}>
    <div className="student-detail-stack">
      <section className="detail-identity"><span className="avatar student-avatar">{studentInitials(student.name)}</span><div><Badge tone="success">{text.students.studentRole}</Badge><h2>{student.name}</h2><p>{student.nim ?? text.students.unavailable} · {student.email}</p></div></section>
      <div className="detail-tabs" role="tablist" aria-label={text.students.detailTitle} onKeyDown={handleTabListKeyDown}>{tabs.map((value) => <button key={value} type="button" role="tab" aria-selected={tab === value} tabIndex={tab === value ? 0 : -1} aria-controls={`student-panel-${value}`} id={`student-tab-${value}`} className={tab === value ? 'active' : ''} onClick={() => setTab(value)}>{text.students.tabs[value]}</button>)}</div>
      <section id={`student-panel-${tab}`} role="tabpanel" aria-labelledby={`student-tab-${tab}`}>
        {tab === 'overview' && <StudentOverview student={student} assessments={assessments} bookings={bookings} assessmentLoading={assessmentLoading} bookingLoading={bookingLoading} assessmentError={assessmentError} bookingError={bookingError} locale={locale} />}
        {tab === 'assessments' && <AssessmentHistory data={assessments} loading={assessmentLoading} error={assessmentError} locale={locale} pagination={assessmentPagination} onPrevious={() => { setAssessmentLoading(true); setAssessmentError(false); setAssessmentPage((value) => Math.max(1, value - 1)); }} onNext={() => { setAssessmentLoading(true); setAssessmentError(false); setAssessmentPage((value) => Math.min(assessmentPagination.pageCount, value + 1)); }} />}
        {tab === 'counseling' && <CounselingHistory data={bookings} loading={bookingLoading} error={bookingError} locale={locale} pagination={bookingPagination} onPrevious={() => { setBookingLoading(true); setBookingError(false); setBookingPage((value) => Math.max(1, value - 1)); }} onNext={() => { setBookingLoading(true); setBookingError(false); setBookingPage((value) => Math.min(bookingPagination.pageCount, value + 1)); }} />}
        {tab === 'academic' && <AcademicDetail student={student} />}
      </section>
    </div>
    <Drawer open={editing} onOpenChange={setEditing} title={text.students.edit.title} description={student.email} closeLabel={text.common.close} className="student-edit-drawer"><StudentEditPanel student={student} academic={academicError ? null : academic} onSaved={refresh} /></Drawer>
  </PageShell>;
}

function StudentOverview({ student, assessments, bookings, assessmentLoading, bookingLoading, assessmentError, bookingError, locale }: { student: StudentRow; assessments: StudentAssessmentPage | null; bookings: StudentBookingPage | null; assessmentLoading: boolean; bookingLoading: boolean; assessmentError: boolean; bookingError: boolean; locale: string }) {
  const { text } = useLanguage();
  return <div className="student-overview-grid">
    <ProfileCard title={text.students.sections.identity}><dl><Definition label={text.students.fields.name} value={student.name} /><Definition label={text.students.fields.nim} value={student.nim ?? text.students.unavailable} /><Definition label={text.students.fields.email} value={student.email} /><Definition label={text.students.fields.registered} value={formatDate(student.created_at, locale)} /></dl></ProfileCard>
    <ProfileCard title={text.students.sections.academic}><dl><Definition label={text.students.fields.faculty} value={student.faculty_name ?? text.students.unavailable} /><Definition label={text.students.fields.unit} value={student.academic_unit_name ?? text.students.unavailable} /></dl></ProfileCard>
    <ProfileCard title={text.students.sections.latestAssessment}>{assessmentLoading && !assessments ? <Skeleton lines={3} /> : assessmentError ? <InlineAlert tone="warning">{text.students.errors.assessments}</InlineAlert> : assessments?.assessments[0] ? <AssessmentSnapshot assessment={assessments.assessments[0]} /> : <p className="section-empty">{text.students.empty.assessments}</p>}</ProfileCard>
    <ProfileCard title={text.students.sections.latestCounseling}>{bookingLoading && !bookings ? <Skeleton lines={3} /> : bookingError ? <InlineAlert tone="warning">{text.students.errors.counseling}</InlineAlert> : bookings?.bookings[0] ? <BookingSnapshot booking={bookings.bookings[0]} locale={locale} /> : <p className="section-empty">{text.students.empty.counseling}</p>}</ProfileCard>
    <ProfileCard title={text.students.sections.support}><SupportSnapshot student={student} /></ProfileCard>
  </div>;
}

function AssessmentHistory({ data, loading, error, locale, pagination, onPrevious, onNext }: { data: StudentAssessmentPage | null; loading: boolean; error: boolean; locale: string; pagination: ReturnType<typeof paginateRange>; onPrevious: () => void; onNext: () => void }) {
  const { text } = useLanguage();
  if (loading && !data) return <section className="operations-panel detail-loading" aria-busy="true"><Skeleton lines={8} /></section>;
  if (error) return <section className="operations-panel"><ErrorState title={text.errors.title} message={text.students.errors.assessments} /></section>;
  if (!data?.assessments.length) return <section className="operations-panel"><EmptyState title={text.students.empty.assessments} /></section>;
  return <section className="operations-panel"><div className="operations-table-wrap"><table className="operations-table assessment-history-table"><thead><tr><th>{text.students.fields.date}</th><th>{text.students.fields.instrument}</th><th>{text.students.fields.dimensions}</th><th>{text.students.fields.severity}</th></tr></thead><tbody>{data.assessments.map((assessment) => <tr key={assessment.assessment_id}><td>{formatDate(assessment.taken_at, locale)}</td><td>{assessment.instrument_type}</td><td><div className="dimension-list">{safeAssessmentSummary(assessment).map((part) => <span key={part.category}>{text.overview.categories[part.category as keyof typeof text.overview.categories]}: {part.scaledScore ?? '—'} · {severityLabel(part.severity, text.overview.priority)}</span>)}</div></td><td><Badge tone={severityTone(assessment.severity)}>{severityLabel(assessment.severity, text.overview.priority)}</Badge></td></tr>)}</tbody></table></div><HistoryFooter pagination={pagination} onPrevious={onPrevious} onNext={onNext} /></section>;
}

function CounselingHistory({ data, loading, error, locale, pagination, onPrevious, onNext }: { data: StudentBookingPage | null; loading: boolean; error: boolean; locale: string; pagination: ReturnType<typeof paginateRange>; onPrevious: () => void; onNext: () => void }) {
  const { text } = useLanguage();
  if (loading && !data) return <section className="operations-panel detail-loading" aria-busy="true"><Skeleton lines={8} /></section>;
  if (error) return <section className="operations-panel"><ErrorState title={text.errors.title} message={text.students.errors.counseling} /></section>;
  if (!data?.bookings.length) return <section className="operations-panel"><EmptyState title={text.students.empty.counseling} /></section>;
  return <section className="operations-panel"><div className="operations-table-wrap"><table className="operations-table counseling-history-table"><thead><tr><th>{text.students.fields.schedule}</th><th>{text.students.fields.status}</th><th>{text.students.fields.counselor}</th></tr></thead><tbody>{data.bookings.map((booking) => <tr key={booking.counseling_booking_id}><td>{formatBooking(booking, locale)}</td><td><Badge tone={booking.status === 'cancelled' ? 'danger' : booking.status === 'completed' ? 'success' : 'info'}>{text.students.bookingStatus[booking.status]}</Badge></td><td>{text.students.unsupported.counselor}</td></tr>)}</tbody></table></div><HistoryFooter pagination={pagination} onPrevious={onPrevious} onNext={onNext} /></section>;
}

function AcademicDetail({ student }: { student: StudentRow }) {
  const { text } = useLanguage();
  return <div className="student-overview-grid"><ProfileCard title={text.students.sections.academic}><dl><Definition label={text.students.fields.faculty} value={student.faculty_name ?? text.students.unavailable} /><Definition label={text.students.fields.facultyId} value={student.faculty_id ?? text.students.unavailable} /><Definition label={text.students.fields.unit} value={student.academic_unit_name ?? text.students.unavailable} /><Definition label={text.students.fields.unitId} value={student.academic_unit_id ?? text.students.unavailable} /><Definition label={text.students.fields.nim} value={student.nim ?? text.students.unavailable} /></dl></ProfileCard></div>;
}

function HistoryFooter({ pagination, onPrevious, onNext }: { pagination: ReturnType<typeof paginateRange>; onPrevious: () => void; onNext: () => void }) {
  const { text } = useLanguage(); const page = pagination.from === 0 ? 1 : Math.ceil(pagination.from / HISTORY_PAGE_SIZE);
  return <footer className="monitoring-footer"><span>{text.students.pagination.showing} {pagination.from}–{pagination.to}</span><div className="pagination"><Button variant="ghost" disabled={page <= 1} onClick={onPrevious}>{text.students.pagination.previous}</Button><span>{text.students.pagination.page} {page} / {pagination.pageCount}</span><Button variant="ghost" disabled={page >= pagination.pageCount} onClick={onNext}>{text.students.pagination.next}</Button></div></footer>;
}
