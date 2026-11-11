'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { Button, EmptyState, ErrorState, Icon, InlineAlert, PageShell, Skeleton } from '@/components/ui';
import { useLiveRefresh } from '@/lib/realtime/useLiveRefresh';
import { getAcademicStructure } from '@/features/monitoring/api';
import { getStudents } from './api';
import { paginateRange, reconcileStudentUnit, studentInitials, unitsForFaculty } from './model';
import { StudentQuickView, formatDate } from './StudentQuickView';
import type { AcademicStructure, DirectoryFilters, StudentDirectoryResponse } from './types';

const initialFilters: DirectoryFilters = { search: '', facultyId: '', academicUnitId: '', page: 1, pageSize: 25 };

export function StudentDirectoryPage() {
  const { language, text } = useLanguage();
  const [searchDraft, setSearchDraft] = useState('');
  const [filters, setFilters] = useState(initialFilters);
  const [directory, setDirectory] = useState<StudentDirectoryResponse | null>(null);
  const [academic, setAcademic] = useState<AcademicStructure | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [academicError, setAcademicError] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setFilters((current) => {
      if (current.search === searchDraft.trim()) return current;
      setLoading(true); setError(false);
      return { ...current, search: searchDraft.trim(), page: 1 };
    }), 350);
    return () => window.clearTimeout(timer);
  }, [searchDraft]);

  useEffect(() => {
    const controller = new AbortController(); let active = true;
    void getAcademicStructure(controller.signal).then((value) => { if (active) { setAcademic(value); setAcademicError(false); } }).catch(() => { if (active) setAcademicError(true); });
    return () => { active = false; controller.abort(); };
  }, [refreshVersion]);

  useEffect(() => {
    const controller = new AbortController(); let active = true;
    void getStudents(filters, controller.signal).then((value) => { if (active) { setDirectory(value); setLoading(false); } }).catch(() => { if (active) { setError(true); setLoading(false); } });
    return () => { active = false; controller.abort(); };
  }, [filters, refreshVersion]);

  useLiveRefresh(useCallback(() => setRefreshVersion((value) => value + 1), []));
  const refresh = useCallback(() => { setLoading(true); setError(false); setRefreshVersion((value) => value + 1); }, []);
  const availableUnits = useMemo(() => unitsForFaculty(filters.facultyId, academic?.academicUnits ?? []), [filters.facultyId, academic]);
  const pagination = paginateRange(directory?.page ?? filters.page, directory?.page_size ?? filters.pageSize, directory?.total ?? 0);
  const locale = language === 'id' ? 'id-ID' : 'en-GB';
  const setFaculty = (facultyId: string) => { setLoading(true); setError(false); setFilters((current) => ({ ...current, facultyId, academicUnitId: reconcileStudentUnit(facultyId, current.academicUnitId, academic?.academicUnits ?? []), page: 1 })); };

  return <PageShell title={text.students.title} actions={<Button variant="secondary" icon="refresh" onClick={refresh}>{text.students.refresh}</Button>}>
    <div className="students-stack">
      <section className="student-filters" aria-label={text.students.filters.title}>
        <label className="filter-field student-search"><span>{text.students.filters.search}</span><div className="filter-input"><Icon name="search" size={18} /><input value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder={text.students.filters.searchPlaceholder} /></div></label>
        <label className="filter-field"><span>{text.students.fields.faculty}</span><select value={filters.facultyId} disabled={academicError} onChange={(event) => setFaculty(event.target.value)}><option value="">{text.students.filters.allFaculties}</option>{academic?.faculties.map((faculty) => <option key={faculty.faculty_id} value={faculty.faculty_id}>{faculty.name}</option>)}</select></label>
        <label className="filter-field"><span>{text.students.fields.unit}</span><select value={filters.academicUnitId} disabled={!filters.facultyId || academicError} onChange={(event) => { setLoading(true); setError(false); setFilters((current) => ({ ...current, academicUnitId: event.target.value, page: 1 })); }}><option value="">{text.students.filters.allUnits}</option>{availableUnits.map((unit) => <option key={unit.academic_unit_id} value={unit.academic_unit_id}>{unit.name}</option>)}</select></label>
      </section>
      {academicError && <InlineAlert tone="warning">{text.students.errors.academicFilter}</InlineAlert>}
      {error && directory && <InlineAlert tone="warning">{text.common.staleData}</InlineAlert>}
      {loading && !directory ? <section className="operations-panel student-directory-loading" aria-busy="true"><Skeleton lines={8} /></section> : !directory ? <section className="operations-panel"><ErrorState title={text.errors.title} message={text.students.errors.directory} retry={refresh} retryLabel={text.common.retry} /></section> : <section className="operations-panel" aria-label={text.students.title}>
        <header className="student-table-header"><strong>{directory.total} {text.students.count}</strong><span>{text.students.sorting}</span></header>
        {directory.students.length === 0 ? <EmptyState title={text.students.empty.directory} /> : <div className="operations-table-wrap"><table className="operations-table student-table"><thead><tr><th>{text.students.fields.name}</th><th>{text.students.fields.nim}</th><th>{text.students.fields.email}</th><th>{text.students.fields.faculty}</th><th>{text.students.fields.unit}</th><th>{text.students.fields.registered}</th><th>{text.students.fields.action}</th></tr></thead><tbody>{directory.students.map((student) => <tr key={student.user_id}><td><span className="student-name-cell"><span className="avatar avatar-small">{studentInitials(student.name)}</span><strong>{student.name}</strong></span></td><td>{student.nim ?? text.students.unavailable}</td><td className="email-cell">{student.email}</td><td>{student.faculty_name ?? text.students.unavailable}</td><td>{student.academic_unit_name ?? text.students.unavailable}</td><td><time dateTime={student.created_at ?? undefined}>{formatDate(student.created_at, locale)}</time></td><td><Button variant="secondary" onClick={() => setSelectedStudentId(student.user_id)}>{text.students.view}</Button></td></tr>)}</tbody></table></div>}
        <footer className="monitoring-footer student-table-footer"><span>{text.students.pagination.showing} {pagination.from}–{pagination.to} {text.students.pagination.of} {directory.total}</span><label>{text.students.pagination.perPage}<select value={filters.pageSize} onChange={(event) => { setLoading(true); setError(false); setFilters((current) => ({ ...current, pageSize: Number(event.target.value) as 25 | 50, page: 1 })); }}><option value="25">25</option><option value="50">50</option></select></label><div className="pagination"><Button variant="ghost" disabled={filters.page <= 1} onClick={() => { setLoading(true); setError(false); setFilters((current) => ({ ...current, page: current.page - 1 })); }}>{text.students.pagination.previous}</Button><span>{text.students.pagination.page} {filters.page} / {pagination.pageCount}</span><Button variant="ghost" disabled={filters.page >= pagination.pageCount} onClick={() => { setLoading(true); setError(false); setFilters((current) => ({ ...current, page: current.page + 1 })); }}>{text.students.pagination.next}</Button></div></footer>
      </section>}
    </div>
    <StudentQuickView key={selectedStudentId ?? 'closed'} studentId={selectedStudentId} academic={academic} onClose={() => setSelectedStudentId(null)} onDirectoryRefresh={refresh} />
  </PageShell>;
}
