'use client';

import { useMemo, useState } from 'react';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { Button, InlineAlert, Input } from '@/components/ui';
import { updateStudentAcademic, updateStudentIdentity } from './api';
import { reconcileStudentUnit, unitsForFaculty, validateIdentityDraft } from './model';
import type { AcademicStructure, IdentityDraft, StudentRow } from './types';

export function StudentEditPanel({ student, academic, onSaved }: { student: StudentRow; academic: AcademicStructure | null; onSaved: () => void }) {
  const { text } = useLanguage();
  const [identity, setIdentity] = useState<IdentityDraft>({ name: student.name, nim: student.nim ?? '' });
  const [facultyId, setFacultyId] = useState(student.faculty_id ?? '');
  const [unitId, setUnitId] = useState(student.academic_unit_id ?? '');
  const [identityError, setIdentityError] = useState<'name' | 'nim' | 'request' | null>(null);
  const [academicError, setAcademicError] = useState<'unit' | 'request' | null>(null);
  const [identitySaving, setIdentitySaving] = useState(false);
  const [academicSaving, setAcademicSaving] = useState(false);
  const [identitySaved, setIdentitySaved] = useState(false);
  const [academicSaved, setAcademicSaved] = useState(false);
  const units = useMemo(() => unitsForFaculty(facultyId, academic?.academicUnits ?? []), [facultyId, academic]);

  const saveIdentity = async (event: React.FormEvent) => {
    event.preventDefault();
    const validation = validateIdentityDraft(identity, student);
    if (validation.error || !validation.payload) { setIdentityError(validation.error); return; }
    setIdentityError(null); setIdentitySaved(false); setIdentitySaving(true);
    try { await updateStudentIdentity(student.user_id, validation.payload); setIdentitySaved(true); onSaved(); }
    catch { setIdentityError('request'); }
    finally { setIdentitySaving(false); }
  };

  const saveAcademic = async (event: React.FormEvent) => {
    event.preventDefault();
    if (unitId && !units.some((unit) => unit.academic_unit_id === unitId)) { setAcademicError('unit'); return; }
    setAcademicError(null); setAcademicSaved(false); setAcademicSaving(true);
    try { await updateStudentAcademic(student.user_id, facultyId || null, unitId || null); setAcademicSaved(true); onSaved(); }
    catch { setAcademicError('request'); }
    finally { setAcademicSaving(false); }
  };

  return <div className="student-edit-stack">
    <form className="student-edit-section" onSubmit={saveIdentity} noValidate>
      <div><h3>{text.students.edit.identityTitle}</h3><p>{text.students.edit.identityNote}</p></div>
      {identitySaved && <InlineAlert tone="success">{text.students.edit.saved}</InlineAlert>}
      {identityError === 'request' && <InlineAlert tone="danger">{text.students.errors.update}</InlineAlert>}
      <Input label={text.students.fields.name} value={identity.name} onChange={(event) => setIdentity((current) => ({ ...current, name: event.target.value }))} error={identityError === 'name' ? text.students.edit.nameRequired : undefined} required />
      <Input label={text.students.fields.nim} value={identity.nim} onChange={(event) => setIdentity((current) => ({ ...current, nim: event.target.value }))} error={identityError === 'nim' ? text.students.edit.nimCannotClear : undefined} />
      <div className="form-actions"><Button loading={identitySaving} type="submit">{text.students.edit.saveIdentity}</Button></div>
    </form>
    <form className="student-edit-section" onSubmit={saveAcademic}>
      <div><h3>{text.students.edit.academicTitle}</h3><p>{text.students.edit.academicNote}</p></div>
      {academicSaved && <InlineAlert tone="success">{text.students.edit.saved}</InlineAlert>}
      {academicError === 'request' && <InlineAlert tone="danger">{text.students.errors.update}</InlineAlert>}
      {!academic ? <InlineAlert tone="warning">{text.students.errors.academic}</InlineAlert> : <>
        <label className="filter-field"><span>{text.students.fields.faculty}</span><select value={facultyId} onChange={(event) => { const next = event.target.value; setFacultyId(next); setUnitId((current) => reconcileStudentUnit(next, current, academic.academicUnits)); setAcademicError(null); }}><option value="">{text.students.filters.noFaculty}</option>{academic.faculties.map((faculty) => <option key={faculty.faculty_id} value={faculty.faculty_id}>{faculty.name}</option>)}</select></label>
        <label className="filter-field"><span>{text.students.fields.unit}</span><select value={unitId} disabled={!facultyId} onChange={(event) => { setUnitId(event.target.value); setAcademicError(null); }} aria-describedby={academicError === 'unit' ? 'student-unit-error' : undefined}><option value="">{text.students.filters.noUnit}</option>{units.map((unit) => <option key={unit.academic_unit_id} value={unit.academic_unit_id}>{unit.name}</option>)}</select></label>
        {academicError === 'unit' && <p className="field-error" id="student-unit-error">{text.students.edit.invalidUnit}</p>}
        <div className="form-actions"><Button loading={academicSaving} type="submit">{text.students.edit.saveAcademic}</Button></div>
      </>}
    </form>
  </div>;
}
