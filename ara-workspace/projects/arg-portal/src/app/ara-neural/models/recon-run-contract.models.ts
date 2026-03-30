/**
 * ARA Self Rec — Shared Reconciliation Run JSON Contract
 * -------------------------------------------------------
 * Version: 1.0.0
 *
 * This file defines the canonical TypeScript interfaces for the
 * reconciliation run payload.  The frontend will produce this structure;
 * the Python backend engine will consume it.
 *
 * The current TypeScript execution path (SelfRecRunService / RunRequest)
 * remains untouched.  This contract is the TARGET format for future
 * Python-backed execution.
 */

// ─────────────────────────────────────────────────────────────────────────────
// A. Run Metadata
// ─────────────────────────────────────────────────────────────────────────────

export type RunMode = 'preview' | 'execute';

export interface ReconRunMetadata {
  /** Semantic version of this contract schema, e.g. "1.0.0" */
  contractVersion: string;
  /** Human-readable name for this run */
  runName: string;
  /** preview = dry-run only; execute = results are committed */
  runMode: RunMode;
  /** Identity of the person or process that submitted the run */
  submittedBy: string;
  /** ISO-8601 creation timestamp, e.g. "2026-03-30T09:00:00Z" */
  createdAt: string;
  /** Optional free-text description of the run */
  description?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// B. Sources
// ─────────────────────────────────────────────────────────────────────────────

export type FileType = 'csv' | 'xlsx' | 'tsv' | 'json';

export interface ReconSourceDefinition {
  /** Stable ID returned by the upload endpoint (optional on draft runs) */
  uploadId?: string;
  /** Display label, e.g. "Source A" or "GL Extract" */
  label: string;
  /** Original file name as uploaded by the user */
  fileName: string;
  /** Detected or declared file format */
  fileType: FileType;
  /** For xlsx sources: which sheet to read */
  sheetName?: string;
  /** For csv/tsv sources: column delimiter character (default ",") */
  delimiter?: string;
}

export interface ReconSources {
  /** Left-hand side of the reconciliation (historically "Source A") */
  left: ReconSourceDefinition;
  /** Right-hand side of the reconciliation (historically "Source B") */
  right: ReconSourceDefinition;
}

// ─────────────────────────────────────────────────────────────────────────────
// C. Mapping
// ─────────────────────────────────────────────────────────────────────────────

export type TransformType =
  | 'trim'
  | 'uppercase'
  | 'lowercase'
  | 'date_format'
  | 'numeric_round';

export interface FieldTransformation {
  /** The kind of normalisation to apply before comparison */
  type: TransformType;
  /** Optional parameters specific to the transform, e.g. { format: "YYYY-MM-DD" } */
  params?: Record<string, string | number>;
}

export interface MappingPair {
  /** Column name in the left source */
  leftField: string;
  /** Corresponding column name in the right source; null = explicitly unmapped */
  rightField: string | null;
  /** Whether this pair must be present for a run to proceed */
  required: boolean;
  /** Optional normalisation applied to both fields before comparison */
  transformation?: FieldTransformation;
}

export interface ReconMapping {
  /** Ordered list of field pair mappings */
  pairs: MappingPair[];
}

// ─────────────────────────────────────────────────────────────────────────────
// D. Passes
// ─────────────────────────────────────────────────────────────────────────────

export type PassType = 'exact' | 'tolerance' | 'manual';

export type RuleOperator =
  | 'eq'            // exact equality
  | 'contains'      // substring match
  | 'starts_with'
  | 'numeric_abs'   // absolute numeric difference <= tolerance
  | 'numeric_pct';  // percentage numeric difference <= tolerance

export interface PassRule {
  /** Column name in the left source for this rule */
  leftField: string;
  /** Comparison operator */
  operator: RuleOperator;
  /** Column name in the right source for this rule */
  rightField: string;
}

export type ToleranceType = 'absolute' | 'percentage';

export interface ToleranceConfig {
  type: ToleranceType;
  /** Tolerance value — absolute unit or percentage (e.g. 0.01 or 0.5) */
  value: number;
}

export interface ReconPass {
  /** Stable identifier for the pass, e.g. "PASS-001" */
  passId: string;
  /** Human-readable name */
  name: string;
  /** Algorithm category for this pass */
  type: PassType;
  /** Execution order (1 = highest priority) */
  priority: number;
  /** Whether this pass participates in the run */
  enabled: boolean;
  /** If true, a matched row skips all lower-priority passes */
  stopOnMatch: boolean;
  /** One or more match conditions; all must be satisfied for a match */
  rules: PassRule[];
  /** Tolerance block — required when type is "tolerance" */
  tolerance?: ToleranceConfig;
  /** Optional free-text description */
  description?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// E. View
// ─────────────────────────────────────────────────────────────────────────────

export type ViewSource = 'left' | 'right' | 'both';
export type SortDirection = 'asc' | 'desc';
export type ResultCategory = 'matched' | 'unmatched' | 'exceptions' | 'breaks';

export interface ReconViewColumn {
  /** Logical field name (mapped-pair label or raw column) */
  field: string;
  /** Which source side this column originates from */
  source: ViewSource;
  /** Whether this column appears in the result grid */
  visible: boolean;
  /** Optional display-label override */
  label?: string;
}

export interface ReconSortConfig {
  field: string;
  direction: SortDirection;
}

export interface ReconGroupConfig {
  field: string;
  /** Show subtotals row beneath each group */
  showSubtotals: boolean;
}

export interface ReconView {
  /** Optional name saved with this view definition */
  name?: string;
  /** Ordered list of result columns */
  columns: ReconViewColumn[];
  /** Primary sort applied to the result grid */
  sort?: ReconSortConfig;
  /** Grouping applied to the result grid */
  groupBy?: ReconGroupConfig;
  /** Summary-card IDs to display (e.g. "matched", "breaks", "match_rate") */
  summaryCards: string[];
  /** Which result categories are visible in the output */
  visibleCategories: ResultCategory[];
}

// ─────────────────────────────────────────────────────────────────────────────
// F. Execution
// ─────────────────────────────────────────────────────────────────────────────

export type MatchStrategy =
  | 'first_match'  // stop at the first pass that matches — fastest
  | 'best_match'   // evaluate all passes, pick the highest-confidence match
  | 'all_matches'; // report every pass that matches (may produce multiple rows)

export interface ReconExecutionSettings {
  /** How the engine resolves multiple pass hits for the same row pair */
  matchStrategy: MatchStrategy;
  /** Allow a row to match on a subset of the defined mapping pairs */
  allowPartialMatch: boolean;
  /** Emit a structured break report alongside main results */
  generateBreakReport: boolean;
  /** Run the AI-assisted analyzer and attach its narrative to results */
  generateAnalyzerReport: boolean;
  /** Cap the number of rows in a preview run (ignored for execute runs) */
  maxPreviewRows?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Root contract type
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ReconRunPayload — the single JSON document submitted to start a recon run.
 *
 * Frontend produces this; Python backend engine consumes it.
 * TypeScript backend (current path) uses RunRequest from self-rec-run.service.ts
 * and remains unaffected.
 */
export interface ReconRunPayload {
  metadata: ReconRunMetadata;
  sources: ReconSources;
  mapping: ReconMapping;
  passes: ReconPass[];
  view: ReconView;
  execution: ReconExecutionSettings;
}
