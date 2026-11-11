export type InstrumentKind = 'standard' | 'custom';
export type InstrumentStatus = 'draft' | 'published' | 'archived';
export type Category = string;
export interface DimensionDraft { code: string; name: string; description?: string; position: number; multiplier: number; interpretation_bands: Array<{label:string;minimum:number;maximum:number|null}> }

export interface InstrumentVersionSummary { instrument_version_id: string; version_number: number; status: InstrumentStatus; authoritative_config: boolean; updated_at: string; published_at: string | null }
export interface Instrument { instrument_id: string; code: string; name: string; description: string | null; active: boolean; language: string | null; instrument_kind: InstrumentKind; derived_from_instrument_id: string | null; norms_enabled: boolean; provenance: Record<string, unknown>; versions: InstrumentVersionSummary[]; shown_in_app?: boolean; dass21_subscales?: Category[] | null }
export interface OptionDraft { assessment_answer_option_id?: string; position: number; label: string; score: number }
export interface QuestionDraft { assessment_question_id?: string; item_key: string; category: Category; position: number; wording: string; active: boolean; options: OptionDraft[] }
export interface InstrumentVersion extends InstrumentVersionSummary { instrument_id: string; code: string; name: string; language: string | null; instrument_kind: InstrumentKind; norms_enabled: boolean; provenance: Record<string, unknown>; derived_from_instrument_id: string | null; expected_question_count: number; definition_revision: number; scoring_config: Record<string, unknown> | null; created_at: string; created_by_name: string | null; updated_by_name: string | null; published_by_name: string | null }
export type ReviewStatus = 'pending'|'revision_requested'|'approved';
export interface InstrumentReview { assessment_version_review_id:string; definition_revision:number; status:ReviewStatus; submitted_at?:string|null; reviewer_user_id?:string|null; reviewer_name?:string|null; decided_at?:string|null; decision_comment?:string|null }
export interface InstrumentDetail { version: InstrumentVersion; questions: QuestionDraft[]; dimensions?: DimensionDraft[]; reviews?: InstrumentReview[] }
export interface InstrumentDefinitionDraft { name: string; description: string | null; language: string | null; provenance: Record<string, unknown>; dimensions: DimensionDraft[]; scoring_config: Record<string, unknown> | null }
export interface DirectoryResponse { instruments: Instrument[]; total: number }
export interface ValidationResponse { publishable: boolean; issues: string[] }
export interface DirectoryItem { instrument: Instrument; version: InstrumentVersionSummary | null; questionCount: number | null; categories: Category[]; review: InstrumentReview|null }

export interface Dass21VariantDraft { name: string; code: string; subscales: Category[] }

export interface LocalInstrumentDraft { code: string; name: string; description: string; language: string; dimensions: Category[]; questions: QuestionDraft[] }
