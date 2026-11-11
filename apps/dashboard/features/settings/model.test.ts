import assert from 'node:assert/strict';
import test from 'node:test';
import { toFacultyPayload, toUnitPayload, unitsForFaculty, validateFacultyDraft, validateUnitDraft, withFacultyActive, withUnitActive } from './model.ts';

test('filters units by their faculty dependency', () => {
  const units = [{ academic_unit_id: 'u', faculty_id: 'f', faculty_name: 'F', code: null, name: 'U', unit_type: 'department' as const, degree_level: null, active: true, source_url: null, student_count: 0 }];
  assert.equal(unitsForFaculty(units, 'f').length, 1); assert.equal(unitsForFaculty(units, 'x').length, 0);
});
test('validates required academic fields', () => {
  assert.deepEqual(validateFacultyDraft({ name: ' ', code: '', active: true }), { name: 'required' });
  assert.deepEqual(validateUnitDraft({ facultyId: '', name: '', code: '', unitType: 'department', degreeLevel: '', active: true }), { name: 'required', facultyId: 'required' });
});
test('normalizes optional academic values to null', () => {
  assert.deepEqual(toFacultyPayload({ name: ' Teknik ', code: ' ', active: true }), { name: 'Teknik', code: null, active: true });
  assert.deepEqual(toUnitPayload({ facultyId: 'f', name: ' TI ', code: '', unitType: 'study_program', degreeLevel: '', active: true }), { faculty_id: 'f', name: 'TI', code: null, unit_type: 'study_program', degree_level: null, active: true });
});
test('maps soft deactivation without changing other draft fields', () => {
  assert.equal(withFacultyActive({ name: 'F', code: 'FT', active: true }, false).active, false);
  assert.equal(withUnitActive({ facultyId: 'f', name: 'U', code: '', unitType: 'department', degreeLevel: '', active: true }, false).active, false);
});
