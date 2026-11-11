export interface Faculty { faculty_id: string; code: string | null; name: string; active: boolean; source_url: string | null; unit_count: number; student_count: number }
export interface AcademicUnit { academic_unit_id: string; faculty_id: string; faculty_name: string; code: string | null; name: string; unit_type: 'department' | 'study_program'; degree_level: string | null; active: boolean; source_url: string | null; student_count: number }
export interface FacultyDraft { name: string; code: string; active: boolean }
export interface UnitDraft { facultyId: string; name: string; code: string; unitType: AcademicUnit['unit_type']; degreeLevel: string; active: boolean }
export interface FacultyPayload { name: string; code: string | null; active: boolean }
export interface UnitPayload { faculty_id: string; name: string; code: string | null; unit_type: AcademicUnit['unit_type']; degree_level: string | null; active: boolean }
