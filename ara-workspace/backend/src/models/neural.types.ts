/**
 * ARA Neural Backend — Internal TypeScript types.
 *
 * These mirror the Angular frontend models in:
 *   projects/arg-portal/src/app/ara-neural/models/neural.models.ts
 *
 * The API response shapes MUST remain in sync with the frontend interfaces.
 * When updating one side, update the other.
 */

// ── Internal full-group shape (matches neural_schema.json) ───────────────────

export interface GroupSummary {
  region:           string;
  recordCount:      number;
  countryCount:     number;
  bankAccountCount: number;
  accountStatuses:  string[];
  platforms:        string[];
  databases:        string[];
  aoNames:          string[];
  poNames:          string[];
  reviewStatuses:   string[];
  ddqStatuses:      string[];
}

export interface FullKeyGroup {
  groupId:      string;
  fullKey:      string;
  displayTitle: string;
  summary:      GroupSummary;
  records:      Record<string, unknown>[];   // full record payload — only sent in detail endpoint
}

export interface SchemaFile {
  version:     string;
  generatedAt: string;
  groups:      FullKeyGroup[];
}

// ── API response types (sent over the wire) ───────────────────────────────────

/** Stage 1 — lightweight left-panel item. Mirrors frontend FullKeySummary. */
export interface FullKeySummaryItem {
  groupId:        string;
  fullKey:        string;
  region:         string;
  recordCount:    number;
  countryCount:   number;
  reviewStatuses: string[];
  platforms:      string[];
}

/** Stage 1 response. Mirrors frontend FullKeySummaryListResponse. */
export interface SummaryListResponse {
  total:    number;
  page:     number;
  pageSize: number;
  items:    FullKeySummaryItem[];
}

/** Stage 2 response. Mirrors frontend FullKeyDetailResponse. */
export interface DetailResponse {
  groupId: string;
  detail:  FullKeyGroup;
}

// ── Query parameter types ─────────────────────────────────────────────────────

export interface SummaryQueryParams {
  search?:   string;
  region?:   string;
  status?:   string;
  page?:     number;
  pageSize?: number;
}
