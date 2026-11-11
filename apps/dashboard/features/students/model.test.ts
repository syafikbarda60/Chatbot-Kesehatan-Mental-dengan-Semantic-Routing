import assert from 'node:assert/strict';
import test from 'node:test';
import {
  directoryQuery,
  isStudentProfile,
  paginateRange,
  reconcileStudentUnit,
  safeAssessmentSummary,
  studentInitials,
  unitsForFaculty,
  validateIdentityDraft,
} from './model.ts';
import type { AcademicUnit } from '../monitoring/types.ts';
import type { DirectoryFilters, StudentAssessment, StudentRow } from './types.ts';

const units: AcademicUnit[] = [
  { academic_unit_id: 'u1', faculty_id: 'f1', faculty_name: 'Teknik', code: 'IF', name: 'Informatika', unit_type: 'study_program', active: true },
  { academic_unit_id: 'u2', faculty_id: 'f2', faculty_name: 'Kedokteran', code: 'KD', name: 'Kedokteran', unit_type: 'study_program', active: true },
];
const student: StudentRow = { user_id: 's1', name: 'Alya Pratama', email: 'alya@example.test', nim: '24001', role: 'mahasiswa', created_at: '2026-02-03T00:00:00Z', faculty_id: 'f1', faculty_name: 'Teknik', academic_unit_id: 'u1', academic_unit_name: 'Informatika', unit_type: 'study_program' };

test('builds the server directory query without empty filters', () => {
  const filters: DirectoryFilters = { search: ' Alya ', facultyId: 'f1', academicUnitId: 'u1', page: 2, pageSize: 25 };
  assert.equal(directoryQuery(filters), 'page=2&page_size=25&search=Alya&faculty_id=f1&academic_unit_id=u1');
});

test('restricts units to one faculty and clears an incompatible unit', () => {
  assert.deepEqual(unitsForFaculty('f1', units).map((unit) => unit.academic_unit_id), ['u1']);
  assert.equal(reconcileStudentUnit('f2', 'u1', units), '');
  assert.equal(reconcileStudentUnit('f2', 'u2', units), 'u2');
});

test('validates only identity fields supported by the update endpoint', () => {
  assert.deepEqual(validateIdentityDraft({ name: ' Alya ', nim: ' 24001 ' }, student), { payload: { name: 'Alya', nim: '24001' }, error: null });
  assert.equal(validateIdentityDraft({ name: '', nim: '24001' }, student).error, 'name');
  assert.equal(validateIdentityDraft({ name: 'Alya', nim: '' }, student).error, 'nim');
});

test('maps assessment category results without answer content or raw scores', () => {
  const assessment: StudentAssessment = { assessment_id: 'a1', user_id: 's1', instrument_type: 'DASS-21', instrument_version_id: null, score: 30, severity: 'severe', taken_at: '2026-10-01T00:00:00Z', category_results: [{ category: 'depression', raw_score: 12, scaled_score: 24, severity: 'severe' }] as never };
  assert.deepEqual(safeAssessmentSummary(assessment), [{ category: 'depression', scaledScore: 24, severity: 'severe' }]);
  assert.equal('rawScore' in safeAssessmentSummary(assessment)[0], false);
});

test('formats student identity and true server pagination boundaries', () => {
  assert.equal(studentInitials(' Alya Pratama Putri '), 'AP');
  assert.equal(isStudentProfile(student), true);
  assert.equal(isStudentProfile({ ...student, role: 'admin' }), false);
  assert.deepEqual(paginateRange(2, 25, 61), { from: 26, to: 50, pageCount: 3 });
  assert.deepEqual(paginateRange(1, 25, 0), { from: 0, to: 0, pageCount: 1 });
});
