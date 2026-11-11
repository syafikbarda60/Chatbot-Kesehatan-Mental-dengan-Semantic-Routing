import type { AcademicUnit, FacultyDraft, FacultyPayload, UnitDraft, UnitPayload } from './types';

export function unitsForFaculty(units: AcademicUnit[], facultyId: string): AcademicUnit[] { return units.filter((unit) => unit.faculty_id === facultyId); }
export function validateFacultyDraft(draft: FacultyDraft) { return { ...(draft.name.trim() ? {} : { name: 'required' }) }; }
export function validateUnitDraft(draft: UnitDraft) { return { ...(draft.name.trim() ? {} : { name: 'required' }), ...(draft.facultyId ? {} : { facultyId: 'required' }) }; }
export function toFacultyPayload(draft: FacultyDraft): FacultyPayload { return { name: draft.name.trim(), code: draft.code.trim() || null, active: draft.active }; }
export function toUnitPayload(draft: UnitDraft): UnitPayload { return { faculty_id: draft.facultyId, name: draft.name.trim(), code: draft.code.trim() || null, unit_type: draft.unitType, degree_level: draft.degreeLevel.trim() || null, active: draft.active }; }
export function withFacultyActive(draft: FacultyDraft, active: boolean): FacultyPayload { return toFacultyPayload({ ...draft, active }); }
export function withUnitActive(draft: UnitDraft, active: boolean): UnitPayload { return toUnitPayload({ ...draft, active }); }
