/**
 * ARA NEURAL — API CONTRACT MODELS
 * =================================
 * These interfaces define the data shapes the Angular frontend expects from
 * backend API endpoints. They are the agreed FE / BE contract and must remain
 * stable across implementation changes.
 *
 * When a real backend is available, only the *service implementation* changes.
 * The component code and these models stay untouched.
 *
 * BACKEND ENDPOINTS THESE MODELS MAP TO
 * ──────────────────────────────────────
 *   Stage 1  GET /api/ara-neural/fullkeys           → FullKeySummaryListResponse
 *   Stage 2  GET /api/ara-neural/fullkeys/{groupId} → FullKeyDetailResponse
 *   Optional GET /api/ara-neural/fullkeys?search=…  (query params below)
 */

// ── Stage 1 — lightweight left-panel list ────────────────────────────────────
// Only the fields needed to render the sidebar list and basic filtering.
// This is what gets returned for 68k+ groups without killing the browser.

export interface FullKeySummary {
  groupId:        string;   // unique group identifier  (e.g. fk_000001)
  fullKey:        string;   // FULL_KEY value
  region:         string;   // primary region
  recordCount:    number;   // number of linked bank/recon account records
  countryCount:   number;   // number of distinct countries
  reviewStatuses: string[]; // for sidebar badge  (Approved / Pending …)
  platforms:      string[]; // RECON_SYSTEM_PLATFORM values
}

export interface FullKeySummaryListResponse {
  total:     number;
  page?:     number;
  pageSize?: number;
  items:     FullKeySummary[];
}

// Optional query shape — mirrors GET /api/ara-neural/fullkeys query string
export interface FullKeySearchParams {
  search?:   string;
  region?:   string;
  status?:   string;
  page?:     number;
  pageSize?: number;
}

// ── Stage 2 — full lineage detail (loaded on-demand per FULL_KEY) ─────────────
// Only fetched when the user selects a group from the left panel.

export interface NeuralOwner { soeid: string; }
export interface NeuralAo    { soeid: string; name: string; status: string; }
export interface NeuralPo    { soeid: string; name: string; }

export interface NeuralCentral {
  bankAccount:    string;
  accountStatus:  string;
  accountType:    string;
  region:         string;
  country:        string;
  lineOfBusiness: string;
  riskType:       string;
}

export interface NeuralSystem {
  platform:     string;
  database:     string;
  balancePool:  string;
  reconAccount: string;
}

export interface NeuralOwnership {
  accountOwner:   NeuralOwner;
  proofOwner:     NeuralOwner;
  argReviewOwner: NeuralOwner;
}

export interface NeuralApproval {
  ao:           NeuralAo;
  po:           NeuralPo;
  reviewStatus: string;
  ddqStatus:    string;
}

export interface NeuralUsage {
  bssAccountType: string;
  bserReportable: string;
}

export interface NeuralRecord {
  recordId:  string;
  central:   NeuralCentral;
  system:    NeuralSystem;
  ownership: NeuralOwnership;
  approval:  NeuralApproval;
  usage:     NeuralUsage;
  raw:       Record<string, string>;
}

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

export interface FullKeyDetail {
  groupId:      string;
  fullKey:      string;
  displayTitle: string;
  records:      NeuralRecord[];
  summary:      GroupSummary;
}

export interface FullKeyDetailResponse {
  groupId: string;
  detail:  FullKeyDetail;
}
