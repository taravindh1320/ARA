# ARA Neural & ARA Self Rec — Migration Guide

**Document type:** Developer / Solution Owner migration reference  
**Prototype workspace:** `c:\Personal\Projects\ARA\ara-workspace`  
**Angular version:** 21 (standalone components, signals, `@for`/`@if`)  
**Backend:** Express 4 + TypeScript (`tsx`), port 3000  
**AG Grid version:** 35 (community, new theme API)  
**Date of last prototype inspection:** 2026-03-29

---

## Table of Contents- update

1. [Feature Overview](#1-feature-overview)
2. [Current Implementation Summary](#2-current-implementation-summary)
3. [Files to Migrate](#3-files-to-migrate)
4. [Frontend Migration Steps](#4-frontend-migration-steps)
5. [Backend Migration Steps](#5-backend-migration-steps)
6. [API Contracts](#6-api-contracts)
7. [Data & Config Dependencies](#7-data--config-dependencies)
8. [Mock-to-Real Transition](#8-mock-to-real-transition)
9. [Recommended Migration Phases](#9-recommended-migration-phases)
10. [Risks & Watch-outs](#10-risks--watch-outs)
11. [Local Run / Verification Checklist](#11-local-run--verification-checklist)
12. [Repo Split Guidance](#12-repo-split-guidance)

---

## 1. Feature Overview

### 1.1 ARA Neural

**Business purpose:**  
ARA Neural provides a searchable, paginated lineage view of every FULL_KEY group in the ARA/Recon framework. A FULL_KEY groups together a bank account and all reconciliation accounts linked to it across platforms. The tool lets compliance officers, accountants, and support teams:

- Find a FULL_KEY by name, region, or platform using server-side search
- See a summary card for each group (record count, country count, platform list, review status)
- Drill into the full lineage detail of a selected group (ownership, approval chain, central/system data for every linked record)

**Current prototype status:**  
- The radial graph used in an earlier design has been replaced by a structured two-panel layout (list on the left, lineage detail on the right).  
- The **frontend is fully wired to the real backend service** (`BackendNeuralSchemaService`). There is no mock being served to components.  
- The **backend loads `neural_schema.json` from disk at startup** and serves it from memory. This is mock-like in the sense that the data source is a static JSON file, not a live database.  
- The data pipeline (Excel → JSON) is implemented as a Python script.

**What is backend-ready:**  
The API contract (endpoints, request params, response shapes) is fully specified and implemented. Swapping the data source from a JSON file to a real database requires changes only inside `NeuralDataService` — no controller or frontend code changes.

---

### 1.2 ARA Self Rec

**Business purpose:**  
ARA Self Rec is a 5-step guided wizard that allows a reconciliation analyst to run a self-service reconciliation between two uploaded CSV files, entirely within the browser. The workflow is:

1. **Upload Files** — upload Source A and Source B CSVs
2. **Create Map** — map columns between the two files, with auto-suggested pairs
3. **Create Pass** — define one or more matching passes (exact, tolerance, or manual)
4. **Create View** — configure which result columns appear and how they are sorted/grouped
5. **Run Recon** — execute the reconciliation and view tabbed results (Matched / Breaks / Exceptions / Analyzer)

**Current prototype status:**  
- All 5 wizard steps are fully implemented in the frontend.  
- All backend API routes are registered and return structured responses.  
- **The reconciliation engine is simulated.** `SelfRecRunController` calculates plausible match statistics with a deterministic formula, and `SelfRecResultsController` generates sample rows using a seeded PRNG. No actual record-by-record matching is done.  
- **All backend state is in-memory.** Mapping, passes, view, and run records are stored in module-level variables. They reset on every backend restart.  
- File parsing is real (CSV only). The multer integration parses actual uploaded files and returns columns + a preview of the first 5 rows.

**What is backend-ready:**  
The upload parsing, mapping suggestion heuristics, and all save/get endpoints are real. The only part that must be replaced is the run execution logic and the in-memory data stores.

---

## 2. Current Implementation Summary

### 2.1 ARA Neural

#### Route structure

| Frontend route | Component |
|---|---|
| `/ara-neural/schema` | `NeuralSchemaComponent` |

Backend routes (mounted at `/api/ara-neural`):

| Method | Path | Controller method | Purpose |
|---|---|---|---|
| `GET` | `/api/ara-neural/fullkeys` | `NeuralController.listFullKeys` | Paginated, filtered summary list |
| `GET` | `/api/ara-neural/fullkeys/:groupId` | `NeuralController.getFullKeyDetail` | Full lineage detail for one group |

#### Navigation placement

In the prototype side-nav (`side-nav.ts`), Neural items are grouped under an **ARA Neural** section:
```typescript
readonly neuralItems: NavLink[] = [
  { label: 'Neural Schema', route: '/ara-neural/schema' },
  { label: 'ARA Self Rec',  route: '/ara-neural/self-rec' }
];
```
The office application nav must add an equivalent group.

#### Major frontend components

| File | Role |
|---|---|
| `ara-neural/schema/neural-schema.ts` | Main two-panel Neural screen |
| `ara-neural/schema/neural-schema.html` | Template |
| `ara-neural/schema/neural-schema.scss` | Styles |
| `ara-neural/models/neural.models.ts` | All frontend TypeScript interfaces |
| `ara-neural/services/neural-schema.service.ts` | Abstract service + local mock implementation |
| `ara-neural/services/backend-neural-schema.service.ts` | Production implementation (calls Express API) |

#### Backend files

| File | Role |
|---|---|
| `backend/src/controllers/neural.controller.ts` | Request handling, input validation |
| `backend/src/services/neural.service.ts` | Data loading + business logic (`getSummaries`, `getDetail`) |
| `backend/src/models/neural.types.ts` | Backend TypeScript types (must match frontend models) |
| `backend/src/routes/neural.routes.ts` | Express route registration |

#### Data / assets

| File | Role |
|---|---|
| `projects/arg-portal/src/assets/data/neural_schema.json` | Full detail data — loaded by backend at startup. Should **not** be deployed to the frontend in production. |
| `projects/arg-portal/src/assets/data/neural_schema_summary.json` | Lightweight summary list — used by the local mock service only. Not needed once real backend is active. |
| `scripts/excel_to_neural_json.py` | Python script that converts an Excel/CSV input to the two JSON files above |
| `input/` | Sample input CSV files for the script |

---

### 2.2 ARA Self Rec

#### Route structure

| Frontend route | Component |
|---|---|
| `/ara-neural/self-rec` | `SelfRecComponent` |

Backend routes (mounted at `/api/ara-self-rec`):

| Method | Path | Controller | Purpose |
|---|---|---|---|
| `POST` | `/api/ara-self-rec/uploads` | `SelfRecController` | Upload and parse a CSV file |
| `POST` | `/api/ara-self-rec/mapping/suggest` | `SelfRecMappingController` | Heuristic column-name matching |
| `POST` | `/api/ara-self-rec/mapping` | `SelfRecMappingController` | Save mapping configuration |
| `GET` | `/api/ara-self-rec/passes` | `SelfRecPassesController` | Retrieve active passes |
| `POST` | `/api/ara-self-rec/passes` | `SelfRecPassesController` | Save pass configuration |
| `GET` | `/api/ara-self-rec/view` | `SelfRecViewController` | Retrieve view configuration |
| `POST` | `/api/ara-self-rec/view` | `SelfRecViewController` | Save view configuration |
| `POST` | `/api/ara-self-rec/run` | `SelfRecRunController` | Execute (or preview) a reconciliation |
| `GET` | `/api/ara-self-rec/results/:runId` | `SelfRecResultsController` | Fetch results for a completed run |

#### Navigation placement

Self Rec is listed in the same **ARA Neural** nav group as Neural Schema (see above).

#### Major frontend components

| File | Role |
|---|---|
| `ara-neural/self-rec/self-rec.ts` | Wizard shell — all signals, state, navigation, step guards |
| `ara-neural/self-rec/self-rec.html` | Full 1,239-line template (all 5 steps + results) |
| `ara-neural/self-rec/self-rec.scss` | Scoped styles (~1,715 lines) |
| `ara-neural/self-rec/self-rec-upload.service.ts` | Calls `POST /uploads` |
| `ara-neural/self-rec/self-rec-mapping.service.ts` | Calls mapping suggest + save |
| `ara-neural/self-rec/self-rec-passes.service.ts` | Calls passes save |
| `ara-neural/self-rec/self-rec-view.service.ts` | Calls view save |
| `ara-neural/self-rec/self-rec-run.service.ts` | Calls `POST /run` |
| `ara-neural/self-rec/self-rec-results.service.ts` | Calls `GET /results/:runId` |

All Self Rec Angular services use `providedIn: 'root'` — no explicit provider registration in `app.config.ts` is required.

#### Backend files

| File | Role |
|---|---|
| `backend/src/controllers/self-rec.controller.ts` | Upload handler (multer + CSV parser) |
| `backend/src/controllers/self-rec-mapping.controller.ts` | Suggest + save mapping, in-memory store |
| `backend/src/controllers/self-rec-passes.controller.ts` | Get + save passes, in-memory store |
| `backend/src/controllers/self-rec-view.controller.ts` | Get + save view, in-memory store |
| `backend/src/controllers/self-rec-run.controller.ts` | Simulated reconciliation execution |
| `backend/src/controllers/self-rec-run-store.ts` | Shared Map for run records (cross-controller state) |
| `backend/src/controllers/self-rec-results.controller.ts` | Deterministic sample row generation from run store |
| `backend/src/routes/self-rec.routes.ts` | All 9 route registrations |

#### AG Grid dependency

Self Rec (and the broader ARA feature set) uses AG Grid v35 Community with a custom dark theme. The theme definition is shared:

| File | Role |
|---|---|
| `ara/shared/ara-grid-theme.ts` | `araGridTheme` — AG Grid v35 dark quartz theme with custom palette |

---

## 3. Files to Migrate

All paths below are relative to `ara-workspace/` unless stated otherwise.

### 3.1 ARA Neural — Frontend

```
projects/arg-portal/src/app/ara-neural/
├── models/
│   └── neural.models.ts                        ← interfaces + API contract
├── services/
│   ├── neural-schema.service.ts                ← abstract service + local mock
│   └── backend-neural-schema.service.ts        ← production HTTP implementation
└── schema/
    ├── neural-schema.ts
    ├── neural-schema.html
    └── neural-schema.scss
```

### 3.2 ARA Neural — Backend

```
backend/src/
├── controllers/
│   └── neural.controller.ts
├── services/
│   └── neural.service.ts
├── models/
│   └── neural.types.ts
└── routes/
    └── neural.routes.ts
```

### 3.3 ARA Neural — Data & Scripts

```
projects/arg-portal/src/assets/data/
├── neural_schema.json              ← BACKEND ONLY — do not serve to browser in production
└── neural_schema_summary.json      ← PROTOTYPE ONLY — can be deleted once real backend is active

scripts/
└── excel_to_neural_json.py         ← data pipeline helper

input/
├── source_a.csv                    ← sample input (dev/test use only)
└── source_b.csv                    ← sample input (dev/test use only)
```

### 3.4 ARA Self Rec — Frontend

```
projects/arg-portal/src/app/ara-neural/self-rec/
├── self-rec.ts
├── self-rec.html
├── self-rec.scss
├── self-rec-upload.service.ts
├── self-rec-mapping.service.ts
├── self-rec-passes.service.ts
├── self-rec-view.service.ts
├── self-rec-run.service.ts
└── self-rec-results.service.ts
```

### 3.5 ARA Self Rec — Backend

```
backend/src/
├── controllers/
│   ├── self-rec.controller.ts
│   ├── self-rec-mapping.controller.ts
│   ├── self-rec-passes.controller.ts
│   ├── self-rec-view.controller.ts
│   ├── self-rec-run.controller.ts
│   ├── self-rec-run-store.ts
│   └── self-rec-results.controller.ts
└── routes/
    └── self-rec.routes.ts
```

### 3.6 Shared / Common Files

These files are shared between ARA Neural and ARA Self Rec, or are foundational to the entire portal:

```
projects/arg-portal/src/app/
├── app.routes.ts                     ← route declarations (add to office routes file)
├── app.config.ts                     ← provider registration (merge into office config)
├── core/
│   ├── shell/
│   │   ├── shell.ts / shell.html / shell.scss   ← layout shell with side-nav slot
│   │   └── ...
│   ├── side-nav/
│   │   ├── side-nav.ts / side-nav.html / side-nav.scss
│   │   └── ...
│   └── theme.service.ts              ← light/dark toggle
└── ara/shared/
    └── ara-grid-theme.ts             ← AG Grid v35 custom dark theme

backend/src/
├── app.ts                            ← Express app factory (CORS + routes)
├── server.ts                         ← entry point (loads data → listen)
└── config.ts                         ← environment-driven configuration
```

---

## 4. Frontend Migration Steps

### 4.1 Prerequisites

- Angular 21+ workspace with standalone components enabled
- `@angular/common/http` available (`provideHttpClient()` in root config)
- AG Grid Community v35: `npm install ag-grid-angular@^35 ag-grid-community@^35`
- `@angular/forms` (needed for `[(ngModel)]` in Self Rec wizard)

### 4.2 Copy Component Files

1. Copy the `ara-neural/` folder tree (section 3.1 + 3.4) into the office application under an equivalent feature module path, e.g.:
   ```
   src/app/features/ara-neural/
   ```

2. Copy `ara/shared/ara-grid-theme.ts` to a shared utilities location, e.g.:
   ```
   src/app/shared/ara-grid-theme.ts
   ```
   Update the import path in `self-rec.ts` and any other component that references it.

3. If the office app already has a shell/side-nav, **do not** copy `core/shell/` and `core/side-nav/`. Instead, integrate the navigation items (step 4.4 below).

### 4.3 Update Route Declarations

In the office app's root routes file, add:

```typescript
// ARA Neural
{
  path: 'ara-neural/schema',
  loadComponent: () =>
    import('./features/ara-neural/schema/neural-schema').then(m => m.NeuralSchemaComponent)
},
{
  path: 'ara-neural/self-rec',
  loadComponent: () =>
    import('./features/ara-neural/self-rec/self-rec').then(m => m.SelfRecComponent)
},
```

Adjust the import paths to match wherever you placed the components.

### 4.4 Update Side Navigation

Add two entries to the ARA Neural navigation group in the office side-nav:

```typescript
{ label: 'Neural Schema', route: '/ara-neural/schema'   }
{ label: 'ARA Self Rec',  route: '/ara-neural/self-rec' }
```

The exact mechanism depends on the office app's nav data structure. The prototype uses a `NavLink[]` array with `{ label, route }` objects rendered via `RouterLink`.

### 4.5 Register Providers in `app.config.ts`

ARA Neural requires one explicit provider to select the backend-based service:

```typescript
import { NeuralSchemaService }        from './features/ara-neural/services/neural-schema.service';
import { BackendNeuralSchemaService } from './features/ara-neural/services/backend-neural-schema.service';

// Add to providers array:
{ provide: NeuralSchemaService, useClass: BackendNeuralSchemaService },
```

Self Rec services all use `providedIn: 'root'` — no additional provider registration needed.

Make sure `provideHttpClient()` is present (required by both Neural and Self Rec services).

### 4.6 Configure the API Proxy (Development)

The Angular dev server must proxy `/api/*` to the backend. In `proxy.conf.json` at the workspace root:

```json
{
  "/api": {
    "target":       "http://localhost:3000",
    "secure":       false,
    "changeOrigin": true,
    "logLevel":     "warn"
  }
}
```

Reference this in `angular.json` under the `serve` target:

```json
"proxyConfig": "proxy.conf.json"
```

In production, configure a reverse proxy (nginx / IIS / API gateway) to forward `/api/*` to the backend service.

### 4.7 AG Grid Module Registration

Both `NeuralSchemaComponent` and `SelfRecComponent` call:

```typescript
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
ModuleRegistry.registerModules([AllCommunityModule]);
```

This is safe to call multiple times (AG Grid checks internally). If the office app already registers modules globally, this can be removed from individual components.

### 4.8 Asset Path Changes

If the office application serves assets from a different base path than the prototype (e.g. `/assets/` → `/office-portal/assets/`), you must:

1. Update `config.ts` (backend) `dataFilePath` to point to the new location of `neural_schema.json`.
2. If using the local mock (`LocalMockNeuralSchemaService`), update the two `HttpClient.get()` asset paths in `neural-schema.service.ts`.

In production the local JSON files are **not** used — skip this step once the backend is serving real data.

### 4.9 Styling

- `neural-schema.scss` and `self-rec.scss` use scoped `sr-*`, `vw-*`, `pb-*`, `rr-*` CSS class prefixes. No global style conflicts are expected.
- Both components inherit font and colour variables from the shell/body. Ensure the office app's dark theme provides compatible CSS custom properties:
  - `--bg-card`, `--bg-surface`, `--border-subtle`
  - `--text-primary`, `--text-secondary`, `--text-muted`
  - `--teal-400`, `--teal-500`, `--teal-600`
- If the office app uses a different design token system, search for `var(--` in both SCSS files and remap to office equivalents.

---

## 5. Backend Migration Steps

### 5.1 Decide on Deployment Model

Two options:

**Option A — Keep as a standalone Express service**  
Copy the entire `backend/` folder into the office infrastructure as a separate Node.js service. Mount it behind `/api/` on the office reverse proxy.

**Option B — Integrate into an existing backend**  
Copy the controllers, services, models, and routes into the existing office backend framework. The code is plain TypeScript with no framework-specific decorators — it can be adapted to NestJS, Fastify, or any Express-compatible framework with minimal effort.

### 5.2 Backend Dependencies

```json
{
  "dependencies": {
    "express":  "^4.18.2",
    "cors":     "^2.8.5",
    "multer":   "^2.1.1"
  },
  "devDependencies": {
    "tsx":        "^4.19.0",
    "typescript": "~5.9.2",
    "@types/express": "^5.0.0",
    "@types/cors":    "^2.8.17",
    "@types/multer":  "^2.1.0",
    "@types/node":    "^22.0.0"
  }
}
```

### 5.3 Configure Environment Variables

| Variable | Default | Production value |
|---|---|---|
| `PORT` | `3000` | Office-assigned port |
| `DATA_FILE_PATH` | Resolves to `assets/data/neural_schema.json` relative to the source tree | Absolute path to the neural data file on the server, or remove and replace with DB query |
| `CORS_ORIGINS` | `http://localhost:4200,http://localhost:4201` | Office frontend domain(s), comma-separated |

In production **do not** use the `DATA_FILE_PATH` default — it points inside the frontend assets directory, which is wrong for production. Set the variable explicitly or replace `NeuralDataService.load()` with a database query.

### 5.4 Register Routes in the App

In `app.ts` (or the equivalent office backend entry point):

```typescript
import neuralRoutes  from './routes/neural.routes';
import selfRecRoutes from './routes/self-rec.routes';

app.use('/api/ara-neural',   neuralRoutes);
app.use('/api/ara-self-rec', selfRecRoutes);
```

### 5.5 Migrate ARA Neural Backend

1. Copy `controllers/neural.controller.ts` — no changes needed for migration, only input validation logic.
2. Copy `services/neural.service.ts` — this is where the data source lives. For production, replace `NeuralDataService.load()` and the `_groups` in-memory store with database calls. The `getSummaries()` and `getDetail()` method signatures must remain the same (controller depends on them).
3. Copy `models/neural.types.ts` — keep in sync with the frontend's `neural.models.ts`.
4. Copy `routes/neural.routes.ts` — register as shown above.

**Replacing the data source (Neural):**

Current (file-based):
```typescript
fs.readFile(filePath, 'utf8', (err, raw) => {
  _groups = JSON.parse(raw).groups;
});
```

Replace with (example, PostgreSQL):
```typescript
// In getSummaries():
const rows = await db.query(
  'SELECT group_id, full_key, region, record_count, ... FROM neural_groups WHERE ...'
);

// In getDetail():
const detail = await db.query(
  'SELECT * FROM neural_records WHERE group_id = $1', [groupId]
);
```

The controller layer does not need to change.

### 5.6 Migrate ARA Self Rec Backend

1. Copy all 7 controller files + `self-rec-run-store.ts`.
2. Copy `routes/self-rec.routes.ts`.
3. **Replace in-memory stores** (see section 8 — Mock-to-Real Transition for specifics).
4. **Replace the simulated run engine** with the real matching logic (see section 8).

### 5.7 Multer File Upload Configuration

The current upload controller uses `multer.memoryStorage()` — files are held in RAM and never written to disk. This is appropriate for the prototype but may need adjustment in production:

- If the real backend needs to persist files for a deferred/queued engine run, switch to `multer.diskStorage()` or stream to cloud storage (e.g. S3).
- The 50 MB file size limit (`limits: { fileSize: 50 * 1024 * 1024 }`) is configurable. Set it to match office policy.
- Currently only CSV is parsed. Excel support requires adding a library such as `xlsx` or `exceljs` to the parser.

---

## 6. API Contracts

All paths below are relative to the API base (e.g. `https://office-backend.internal/api`).

### 6.1 ARA Neural APIs

#### `GET /ara-neural/fullkeys`

Returns a paginated, filtered list of FULL_KEY group summaries. No per-record detail included.

**Query parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| `search` | string | No | Free-text search across `fullKey`, `region`, `platforms` |
| `region` | string | No | Exact region filter |
| `status` | string | No | Filter by a value in `reviewStatuses` array |
| `page` | integer ≥ 1 | No | Page number (default: 1) |
| `pageSize` | integer ≥ 1 | No | Items per page (default: 50) |

**Response `200`:**
```json
{
  "total": 12,
  "page": 1,
  "pageSize": 50,
  "items": [
    {
      "groupId":        "fk_000001",
      "fullKey":        "FULL_KEY_VALUE",
      "region":         "EMEA",
      "recordCount":    42,
      "countryCount":   3,
      "reviewStatuses": ["Approved", "Pending"],
      "platforms":      ["Intellimatch", "Duco"]
    }
  ]
}
```

**Response `400`:** `{ "error": "Invalid page parameter." }`

---

#### `GET /ara-neural/fullkeys/:groupId`

Returns the full lineage detail for a single FULL_KEY group. Only called when the user selects a group from the left panel.

**Path parameter:**

| Param | Validation | Description |
|---|---|---|
| `groupId` | alphanumeric, hyphen, underscore, 1–64 chars | The `groupId` from the summary list |

**Response `200`:**
```json
{
  "groupId":      "fk_000001",
  "fullKey":      "FULL_KEY_VALUE",
  "displayTitle": "Human-readable title",
  "summary": {
    "region":           "EMEA",
    "recordCount":      42,
    "countryCount":     3,
    "bankAccountCount": 5,
    "accountStatuses":  ["Active", "Inactive"],
    "platforms":        ["Intellimatch"],
    "databases":        ["ARA_DB_01"],
    "aoNames":          ["John Smith"],
    "poNames":          ["Jane Doe"],
    "reviewStatuses":   ["Approved"],
    "ddqStatuses":      ["Complete"]
  },
  "records": [
    {
      "central": {
        "bankAccount":    "BA-001",
        "accountStatus":  "Active",
        "accountType":    "Nostro",
        "region":         "EMEA",
        "country":        "GB",
        "lineOfBusiness": "FX",
        "riskType":       "Market"
      },
      "system": {
        "platform":     "Intellimatch",
        "database":     "ARA_DB_01",
        "balancePool":  "FX_POOL",
        "reconAccount": "RECON_001"
      },
      "ownership": {
        "accountOwner":   { "soeid": "ab1234" },
        "proofOwner":     { "soeid": "cd5678" },
        "argReviewOwner": { "soeid": "ef9012" }
      },
      "approval": {
        "ao": { "soeid": "gh3456", "name": "John Smith", "status": "Approved" },
        "po": { "soeid": "ij7890", "name": "Jane Doe" }
      },
      "ddq": { "status": "Complete", "completedDate": "2025-01-15" },
      "legalEntity": { "name": "Citibank N.A.", "lei": "AAAAAAAAAAAAAAAAAAA1" }
    }
  ]
}
```

**Response `400`:** `{ "error": "Invalid groupId format." }`  
**Response `404`:** `{ "error": "FULL_KEY group 'xyz' not found." }`

**Important:** The backend validates `groupId` with a strict regex (`/^[a-zA-Z0-9_-]{1,64}$/`). Any groupId that includes dots, slashes, or other special characters will be rejected. Ensure the data pipeline generates safe IDs.

---

### 6.2 ARA Self Rec APIs

#### `POST /ara-self-rec/uploads`

Upload and parse a single CSV file. Uses `multipart/form-data`.

**Request (form fields):**

| Field | Type | Required | Description |
|---|---|---|---|
| `file` | File | Yes | CSV file (field name must be exactly `file`) |
| `source` | string | Yes | `"A"` or `"B"` |

**Response `200`:**
```json
{
  "source":   "A",
  "name":     "source_a.csv",
  "size":     48230,
  "columns":  ["TradeId", "Currency", "Amount", "SettleDate"],
  "preview":  [
    ["TRD-001", "USD", "100000.00", "2026-03-01"],
    ["TRD-002", "EUR", "75000.00",  "2026-03-02"]
  ]
}
```

**Response `400`:**
```json
{ "error": "source must be \"A\" or \"B\"" }
{ "error": "No file provided." }
```

**Notes:**
- File size limit: 50 MB (configurable in `self-rec.controller.ts`).
- Only CSV is parsed in the prototype. Excel support must be added for production.
- `preview` contains at most 5 data rows (header is not included in preview).

---

#### `POST /ara-self-rec/mapping/suggest`

Generates heuristic column-pair suggestions using a normalise-and-score algorithm.

**Request body (`application/json`):**
```json
{
  "columnsA": ["TradeId", "Ccy", "Amt", "StlDt"],
  "columnsB": ["trade_reference", "currency", "amount", "settle_date"]
}
```

**Response `200`:**
```json
{
  "mappings": [
    { "sourceAField": "TradeId",  "sourceBField": "trade_reference", "confidence": "high" },
    { "sourceAField": "Ccy",      "sourceBField": "currency",        "confidence": "high" },
    { "sourceAField": "Amt",      "sourceBField": "amount",          "confidence": "high" },
    { "sourceAField": "StlDt",    "sourceBField": "settle_date",     "confidence": "low"  }
  ]
}
```

`confidence` values: `"high"` (score ≥ 0.6), `"low"` (score > 0), `"none"` (no match found — `sourceBField` will be `null`).

---

#### `POST /ara-self-rec/mapping`

Persist the final mapping configuration.

**Request body:**
```json
{
  "mappings": [
    { "sourceAField": "TradeId", "sourceBField": "trade_reference", "confidence": "high" },
    { "sourceAField": "Amt",     "sourceBField": "amount",          "confidence": "high" }
  ]
}
```

**Response `200`:**
```json
{
  "saved":        true,
  "mappingId":    "MAP-0001",
  "mappedCount":  2
}
```

---

#### `GET /ara-self-rec/passes`

Returns the currently active pass configuration.

**Response `200`:**
```json
{
  "passes": [
    {
      "id":               "pass-1",
      "name":             "Primary Exact Match",
      "order":            1,
      "enabled":          true,
      "matchType":        "exact",
      "keys": [
        { "sourceAField": "TradeId", "sourceBField": "trade_reference" }
      ],
      "toleranceValue":   null,
      "tolerancePercent": null,
      "description":      ""
    }
  ]
}
```

---

#### `POST /ara-self-rec/passes`

Save the full pass configuration (replaces current store).

**Request body:**
```json
{
  "passes": [
    {
      "id":           "pass-1",
      "name":         "Primary Exact Match",
      "order":        1,
      "enabled":      true,
      "matchType":    "exact",
      "keys":         [{ "sourceAField": "TradeId", "sourceBField": "trade_reference" }],
      "description":  ""
    },
    {
      "id":               "pass-2",
      "name":             "Tolerance Pass",
      "order":            2,
      "enabled":          true,
      "matchType":        "tolerance",
      "keys":             [{ "sourceAField": "Amt", "sourceBField": "amount" }],
      "toleranceValue":   0.01,
      "tolerancePercent": null,
      "description":      "Allow 1 cent tolerance on amounts"
    }
  ]
}
```

**Response `200`:**
```json
{
  "saved":      true,
  "passSetId":  "PS-0001",
  "passCount":  2
}
```

`matchType` values: `"exact"` | `"tolerance"` | `"manual"`

---

#### `GET /ara-self-rec/view`

Returns the currently active view configuration.

**Response `200`:** Returns a `ViewConfig` object (see save endpoint below).

---

#### `POST /ara-self-rec/view`

Save the result view configuration.

**Request body:**
```json
{
  "view": {
    "name": "Default View",
    "columns": [
      { "field": "keyRef",        "source": "both", "visible": true,  "label": "Key" },
      { "field": "sourceAValue",  "source": "A",    "visible": true,  "label": "Source A" },
      { "field": "sourceBValue",  "source": "B",    "visible": true,  "label": "Source B" },
      { "field": "difference",    "source": "both", "visible": true,  "label": "Difference" },
      { "field": "breakReason",   "source": "both", "visible": false, "label": "Break Reason" }
    ],
    "sort":   { "field": "keyRef", "direction": "asc" },
    "groupBy": null,
    "summaryCards": [
      { "id": "matched",    "label": "Matched",    "visible": true },
      { "id": "unmatched",  "label": "Unmatched",  "visible": true },
      { "id": "breaks",     "label": "Breaks",     "visible": true },
      { "id": "exceptions", "label": "Exceptions", "visible": true },
      { "id": "match_rate", "label": "Match Rate", "visible": true }
    ],
    "categories": [
      { "category": "matched",    "visible": true,  "label": "Matched"    },
      { "category": "unmatched",  "visible": true,  "label": "Unmatched"  },
      { "category": "breaks",     "visible": true,  "label": "Breaks"     },
      { "category": "exceptions", "visible": false, "label": "Exceptions" }
    ]
  }
}
```

**Response `200`:**
```json
{
  "saved":  true,
  "viewId": "VW-0001"
}
```

---

#### `POST /ara-self-rec/run`

Trigger a reconciliation run. In the prototype this is synchronous (responds immediately after simulated delay). In production this may return a job ID for polling.

**Request body:**
```json
{
  "sourceA":     { "name": "source_a.csv", "columns": ["TradeId", "Ccy", "Amt"], "rowCount": 10000 },
  "sourceB":     { "name": "source_b.csv", "columns": ["trade_reference", "currency", "amount"], "rowCount": 9850 },
  "mapping":     { "fieldPairs": [{ "sourceAField": "TradeId", "sourceBField": "trade_reference" }], "mappingId": "MAP-0001" },
  "passes":      [ /* PassConfig[] — same shape as POST /passes body */ ],
  "view":        { /* ViewConfig — same shape as POST /view body */ },
  "submittedBy": "jsmith",
  "runMode":     "preview"
}
```

`runMode`: `"preview"` (no commit) | `"execute"` (commit results)

**Response `200`:**
```json
{
  "runId":        "RUN-0001",
  "status":       "complete",
  "submittedAt":  "2026-03-29T12:00:00.000Z",
  "runMode":      "preview",
  "submittedBy":  "jsmith",
  "summary": {
    "totalA":     10000,
    "totalB":     9850,
    "matched":    8965,
    "unmatched":  870,
    "breaks":     269,
    "exceptions": 72,
    "matchRate":  91.02
  },
  "message": "Preview run complete. No changes committed."
}
```

**Response `400`:** `{ "error": "sourceA and sourceB are required" }`

**Note for production:** A real engine will likely need to be asynchronous. Consider returning `{ "runId": "...", "status": "queued" }` immediately and providing a polling endpoint or WebSocket notification. The frontend is currently designed for a synchronous response — it blocks the UI during the run. Update the `SelfRecRunService` and the run step UI if switching to async.

---

#### `GET /ara-self-rec/results/:runId`

Fetch sample rows and the Analyzer report for a completed run.

**Path parameter:** `runId` — the value returned from `POST /run`

**Response `200`:**
```json
{
  "runId": "RUN-0001",
  "rows": [
    {
      "id":           "m-0",
      "status":       "matched",
      "keyRef":       "TRA-00001",
      "sourceAValue": "85432.12",
      "sourceBValue": "85432.12",
      "difference":   "—",
      "breakReason":  "—",
      "matchedByPass":"Primary Exact Match",
      "comments":     ""
    },
    {
      "id":           "b-0",
      "status":       "break",
      "keyRef":       "TRA-05000",
      "sourceAValue": "50000.00",
      "sourceBValue": "50001.23",
      "difference":   "-1.23",
      "breakReason":  "Tolerance exceeded",
      "matchedByPass":"Tolerance Pass",
      "comments":     ""
    }
  ],
  "analyzerReport": {
    "matchByPass": [
      { "passName": "Primary Exact Match", "count": 7900, "percentage": 88.1 },
      { "passName": "Tolerance Pass",      "count": 1065, "percentage": 11.9 }
    ],
    "topBreakReasons": [
      { "reason": "Tolerance exceeded", "count": 120, "percentage": 44.6 }
    ],
    "exceptionDistribution": [
      { "type": "Duplicate reference", "count": 35 }
    ],
    "narrative": "Run RUN-0001: 8965 matched (91.0%), 870 unmatched, 269 breaks, 72 exceptions."
  },
  "sampleNote": "Showing a representative sample of 20 matched, 10 break, 8 unmatched, and 5 exception rows."
}
```

**Response `404`:** `{ "error": "Run 'RUN-9999' not found. The run may have expired — please re-run the reconciliation." }`

`status` values per row: `"matched"` | `"break"` | `"exception"` | `"unmatched"`

---

## 7. Data & Config Dependencies

### 7.1 Neural Data Files

| File | Used by | Purpose | Keep in production? |
|---|---|---|---|
| `neural_schema.json` | Backend `NeuralDataService.load()` | Full group + record data | **Yes, but move to backend-only location** — never serve as a static asset |
| `neural_schema_summary.json` | Frontend mock service only | Summary list for the `LocalMockNeuralSchemaService` | **No** — delete once real backend is active |

### 7.2 Python Data Pipeline

`scripts/excel_to_neural_json.py` is a developer utility, **not** a production service. It is run manually to regenerate the JSON files from the source Excel/CSV.

In production, the neural data should come directly from the office data source (database, API). If the pipeline is needed as a one-time data migration tool, it can live in a separate `tools/` repository. It must not be deployed to the production runtime.

### 7.3 Self Rec — No Persistent Data Files

Self Rec has no data files. All state currently lives in in-memory module variables on the backend. In production all of these must be replaced with real persistent storage (see section 8).

### 7.4 Backend Configuration

Current `config.ts` settings that must be set via environment variables in all non-local environments:

```
PORT              — HTTP port to bind (default 3000)
DATA_FILE_PATH    — Absolute path to neural_schema.json (or remove entirely if using DB)
CORS_ORIGINS      — Comma-separated list of allowed frontend origins
```

Do not commit production values to source control. Use environment-specific configuration or secrets management.

---

## 8. Mock-to-Real Transition

This section documents every piece of prototype/mock behaviour and what must be replaced before production.

### 8.1 Neural — Static JSON Data Source

**What it is now:**  
`NeuralDataService.load()` reads `neural_schema.json` from disk into a `FullKeyGroup[]` array. All queries run in-process against that array.

**What must replace it:**  
Replace `load()` and the `_groups` array with database queries. The controller depends only on `getSummaries()` and `getDetail()` — those signatures are the boundary.

Example replacement for `getSummaries()`:
```typescript
async getSummaries(params) {
  const { rows, count } = await orm.findAndCountAll({
    model: 'NeuralGroup',
    where: buildWhereClause(params),
    attributes: summaryAttributes,  // exclude records[]
    limit: params.pageSize,
    offset: (params.page - 1) * params.pageSize,
  });
  return { total: count, page, pageSize, items: rows.map(toSummaryItem) };
}
```

### 8.2 Neural — Local Mock Service

**What it is now:**  
`LocalMockNeuralSchemaService` (defined in `neural-schema.service.ts`) calls `HttpClient.get()` against `/assets/data/neural_schema_summary.json` and `/assets/data/neural_schema.json`.

**What must replace it:**  
`BackendNeuralSchemaService` is already implemented and already set as the active provider in `app.config.ts`. The local mock class and the two JSON asset files can be deleted once the backend API is confirmed working in the target environment.

To revert to the mock during development: swap `useClass` in `app.config.ts`.

### 8.3 Self Rec — In-Memory Stores

**What they are now:**  
Four module-level variables in four controller files act as the "database":
```typescript
let latestMapping: MappingRow[] = [];         // self-rec-mapping.controller.ts
let activePasses:  PassConfig[] = [];          // self-rec-passes.controller.ts
let activeView:    ViewConfig | null = null;   // self-rec-view.controller.ts
const store = new Map<string, StoredRunRecord>(); // self-rec-run-store.ts
```

All data is lost on backend restart. There is no user/session isolation — all requests see the same global state.

**What must replace it:**  
Each store needs a proper persistence layer and must be scoped to a user session or job ID:

| Current store | Production replacement |
|---|---|
| `latestMapping` | DB table `self_rec_mappings` keyed by session/job ID |
| `activePasses` | DB table `self_rec_passes` keyed by session/job ID |
| `activeView` | DB table `self_rec_views` keyed by session/job ID |
| Run store `Map<runId, record>` | DB table `self_rec_runs` keyed by `runId` |

### 8.4 Self Rec — Simulated Reconciliation Engine

**What it is now:**  
`SelfRecRunController.runRecon()` waits 800 ms then returns a result computed from a formula based on row counts, pass count, and field pair count:
```
matchRate = base(0.70) + passBoost(0.05×n) + fieldBoost(min(0.005×n, 0.10))
```
No actual records are matched. The `summary` numbers are derived from this formula.

`SelfRecResultsController.getResults()` generates sample rows using a deterministic LCG PRNG seeded by `runId`. These are plausible-looking rows, not real data.

**What must replace it:**  
The real office reconciliation engine must be invoked. The expected interface from the frontend's perspective:

1. `POST /run` receives the full configuration payload.
2. The engine performs record-by-record matching according to the passes and tolerance rules.
3. The response must include the `summary` object with real counts and `matchRate`.
4. `GET /results/:runId` returns the actual matched/break/exception/unmatched rows.

The `ResultRow` shape (see section 6.2) is the contract the frontend AG Grid columns map to. As long as the response matches that shape, no frontend changes are required.

If the engine is asynchronous (queued job), the frontend's run step and `SelfRecRunService` need to be updated to poll for completion.

### 8.5 Self Rec — File Upload Storage

**What it is now:**  
Files are stored only in RAM (`multer.memoryStorage()`). They are parsed to extract columns and a preview, then discarded. The actual file bytes are never passed to the engine.

**What must replace it:**  
If the office engine needs to read the full file content:
1. Stream the uploaded file to durable storage (e.g. S3, Azure Blob, or a shared volume).
2. Store the file reference (path or object key) in the run record.
3. The engine reads the file from durable storage during execution.

If Excel support is needed, add `xlsx` or `exceljs` to the backend dependencies and extend the CSV parser in `self-rec.controller.ts`.

---

## 9. Recommended Migration Phases

### Phase 1 — Frontend shell and navigation

**Goal:** Neural and Self Rec routes are registered and navigable in the office app.

1. Add AG Grid community dependency to the office workspace.
2. Copy `ara-neural/` feature folder into the office app.
3. Copy `ara/shared/ara-grid-theme.ts` to the office shared utilities.
4. Add route declarations to the office router.
5. Add nav items to the office side nav.
6. Register `NeuralSchemaService` / `BackendNeuralSchemaService` provider.
7. Configure dev proxy for `/api/*`.

**Verification:** Both routes load without runtime errors. Neural screen shows empty state. Self Rec wizard shows step 0.

---

### Phase 2 — Neural backend (data pipeline → API → frontend connected)

**Goal:** Neural schema screen is fully functional end-to-end.

1. Deploy the Express backend (or integrate routes into office backend).
2. Run `excel_to_neural_json.py` against the real source data to generate `neural_schema.json`.
3. Place `neural_schema.json` in a backend-only location (not under frontend assets).
4. Set `DATA_FILE_PATH`, `PORT`, `CORS_ORIGINS` environment variables.
5. Confirm `GET /api/ara-neural/fullkeys` returns real data.
6. Confirm `GET /api/ara-neural/fullkeys/:groupId` returns correct detail.

**Verification:** Neural schema screen loads the summary list, search/filter works, clicking a group loads the lineage detail panel.

---

### Phase 3 — Neural backend: real data source

**Goal:** Replace JSON file loading with real database queries.

1. Define DB schema for `neural_groups` and `neural_records`.
2. Migrate `neural_schema.json` data into the DB.
3. Replace `NeuralDataService.load()` and query methods with DB calls.
4. Remove the file-path configuration.
5. Delete `neural_schema.json` from the deployment.

**Verification:** Same API behaviour as Phase 2. Restart does not lose data.

---

### Phase 4 — Self Rec frontend complete

This is already done in the prototype — no new frontend work required unless the office app requires UX customisation or different styling.

---

### Phase 5 — Self Rec backend: persistent stores

**Goal:** Mapping, passes, view, and run records survive restarts and are isolated by session.

1. Define DB schema for `self_rec_mappings`, `self_rec_passes`, `self_rec_views`, `self_rec_runs`.
2. Issue a session token or job ID to the frontend on first upload (or use existing auth session).
3. Replace all in-memory module variables in the four controller files with DB reads/writes keyed by session/job ID.
4. Update `self-rec-run-store.ts` to use the DB.

**Verification:** Restarting the backend does not break an in-progress wizard. Two concurrent users get isolated state.

---

### Phase 6 — Self Rec backend: real reconciliation engine

**Goal:** `POST /run` triggers the real office engine and `GET /results/:runId` returns actual matched rows.

1. Decide on synchronous vs. asynchronous execution model.
2. Update `SelfRecRunController` to invoke the real engine.
3. Map engine output to the `ResultRow` interface (section 6.2).
4. Populate the `analyzerReport` from real engine statistics.
5. If async: update `SelfRecRunService` on the frontend to poll for status.
6. Update file handling if the engine needs to read the uploaded files.

**Verification:** Run a known test case and verify matched/break/exception counts are correct.

---

### Phase 7 — Hardening & production readiness

1. Remove `LocalMockNeuralSchemaService` and delete `neural_schema_summary.json` from frontend assets.
2. Remove the prototype in-memory stores — confirm no module variable stores remain.
3. Add authentication/authorisation to all backend endpoints.
4. Add rate limiting on the upload and run endpoints.
5. Replace `multer.memoryStorage()` with durable file storage.
6. Enable HTTPS.
7. Set up structured logging and monitoring.
8. Run load tests against the Neural summary endpoint with production data volumes.

---

## 10. Risks & Watch-outs

### 10.1 Neural data volume

The prototype runs with 12 FULL_KEY groups. Production data could contain tens of thousands of groups. Risks:

- **Do not load all neural data into frontend memory.** The local mock (`LocalMockNeuralSchemaService`) fetches the entire `neural_schema.json` to the browser. This must never happen in production. Always use `BackendNeuralSchemaService` which fetches only `/fullkeys` (summary list, no records).
- **Paginate the summary list.** The current default `pageSize` is 50. With 68k+ groups, the frontend list virtualisation must be verified. Consider virtual scrolling if the list exceeds a few thousand visible items.
- **Detail is on-demand only.** `GET /fullkeys/:groupId` is called only when the user selects a group. Never pre-fetch all groups.

### 10.2 Neural search performance

In the prototype, search runs in-process over a `FullKeyGroup[]` array using `.filter()`. With large datasets this is unacceptable. In production:
- Implement database-side filtering with indexed columns (`fullKey`, `region`, `platforms`).
- Consider full-text search (PostgreSQL `tsvector` or Elasticsearch) for the free-text `search` parameter.

### 10.3 Self Rec — no user/session isolation

All in-memory stores are global. If two users run the wizard simultaneously they will overwrite each other's mapping, passes, and view. This must be fixed before deploying to a shared environment (section 8.3).

### 10.4 Self Rec — synchronous run endpoint

`POST /run` blocks for 800 ms (simulated). A real engine may take seconds or minutes. If the office engine is slow:
- Do not increase the HTTP timeout — this will cause frontend timeout errors at scale.
- Return a `runId` immediately and have the frontend poll `GET /results/:runId` until `status === 'complete'`.
- Update the wizard run-step UI to show a polling/progress state.

### 10.5 Self Rec — CSV-only upload

The current CSV parser does not handle Excel files. If the office users expect to upload `.xlsx` or `.xls`, this must be implemented before go-live.

### 10.6 Asset path pitfalls

The backend `config.ts` resolves `DATA_FILE_PATH` relative to the TypeScript source tree:

```typescript
path.resolve(__dirname, '..', '..', 'projects', 'arg-portal', 'src', 'assets', 'data', 'neural_schema.json')
```

When the backend is compiled and deployed, `__dirname` resolves to the compiled output directory, not the source tree. This path will be **wrong** in production. Always override `DATA_FILE_PATH` with an absolute path via the environment variable.

### 10.7 CORS configuration

The default `CORS_ORIGINS` is `http://localhost:4200,http://localhost:4201`. In production this must be updated to the actual office frontend domain. A misconfigured CORS origin will silently block all API calls in the browser.

### 10.8 AG Grid community licence

AG Grid Community is MIT licensed and free. If the office application requires enterprise features (filtering sidebars, row grouping with aggregations, server-side row model), an Enterprise licence is required. The current prototype uses Community only. Verify feature requirements before committing to Community.

### 10.9 Frontend/backend contract mismatches

The backend types (`neural.types.ts`) and frontend models (`neural.models.ts`) are manually kept in sync — there is no shared code generation (e.g. OpenAPI). If one side is updated without updating the other, runtime shape mismatches will cause silent UI bugs. Consider generating types from an OpenAPI spec as part of the CI pipeline.

---

## 11. Local Run / Verification Checklist

Use this checklist after completing each migration phase to confirm correct behaviour.

### Backend

- [ ] `cd backend && npx tsx src/server.ts` starts without errors
- [ ] `GET http://localhost:3000/health` returns `{ "status": "ok" }`
- [ ] `GET http://localhost:3000/api/ara-neural/fullkeys` returns `{ "total": N, "items": [...] }`
- [ ] `GET http://localhost:3000/api/ara-neural/fullkeys/fk_000001` returns a group with `records` array
- [ ] `POST http://localhost:3000/api/ara-self-rec/uploads` (form: `file`, `source=A`) returns `{ columns, preview }`

### Frontend — ARA Neural

- [ ] Nav group "ARA Neural" is visible in the side nav
- [ ] Clicking "Neural Schema" loads the two-panel layout
- [ ] Summary list populates (items appear in the left panel)
- [ ] Search input filters the list
- [ ] Clicking a FULL_KEY group loads the detail panel on the right
- [ ] Detail panel shows records, ownership, approval chain
- [ ] No `neural_schema.json` network request appears in browser DevTools (only `/api/` calls)
- [ ] No `neural_schema_summary.json` network request appears if using backend service

### Frontend — ARA Self Rec

- [ ] Clicking "ARA Self Rec" loads the wizard at step 0 (Upload Files)
- [ ] Step bar locks steps 1–4 (cannot click through before completing step 0)
- [ ] Uploading Source A CSV shows column list and preview table
- [ ] Uploading Source B CSV shows column list and preview table
- [ ] "Next" becomes enabled after both files are uploaded
- [ ] Step 1 shows mapping table with auto-suggested pairs
- [ ] Mapping can be adjusted via dropdowns
- [ ] "Save Map" in step 1 responds with a `mappingId`
- [ ] Step 2 allows adding/configuring passes
- [ ] "Save Passes" responds with a `passSetId`
- [ ] Step 3 shows column chooser and sort/group controls
- [ ] "Save View" responds with a `viewId`
- [ ] Step 4 shows the review summary cards (files, mapping, passes, view)
- [ ] "Run Recon" button triggers the run endpoint
- [ ] Run completes and KPI cards appear (Matched / Breaks / Exceptions / Match Rate)
- [ ] Results grid shows tabbed data (Matched / Breaks / Exceptions)
- [ ] Analyzer tab shows bar charts
- [ ] "Re-run Recon" button appears after first run
- [ ] "Start Over" button in nav footer returns to step 0

### No mock artefacts (for production validation)

- [ ] `CORS_ORIGINS` environment variable set to the real office frontend origin
- [ ] `DATA_FILE_PATH` environment variable points to an absolute path outside the frontend source tree
- [ ] No `LocalMockNeuralSchemaService` references in `app.config.ts`
- [ ] No requests to `/assets/data/neural_schema.json` or `neural_schema_summary.json` in browser DevTools

---

## 12. Repo Split Guidance

The prototype uses a monorepo where the Angular frontend and Express backend coexist under `ara-workspace/`. In the office context these will likely be separate repositories or packages.

### 12.1 Frontend repo

Contains everything under `projects/arg-portal/src/`:

```
src/app/
├── ara-neural/          ← ARA Neural + Self Rec feature code
├── ara/                 ← Existing ARA features
├── arg/                 ← Existing ARG features
├── core/                ← Shell, side-nav, theme
├── app.routes.ts
└── app.config.ts

src/assets/
└── data/
    └── neural_schema_summary.json   ← REMOVE for production
```

Does **not** contain:
- `backend/` folder
- `neural_schema.json` (this is backend-only data)
- Python scripts

### 12.2 Backend repo

Contains everything under `backend/src/`:

```
src/
├── controllers/         ← Neural + Self Rec controllers
├── services/            ← NeuralDataService
├── models/              ← Backend TypeScript types
├── routes/              ← Route registration
├── app.ts
├── server.ts
└── config.ts
```

Also contains:
- `neural_schema.json` (or the equivalent DB data migration)
- `scripts/excel_to_neural_json.py` (or move to a separate `tools/` repo)

### 12.3 Shared API contract

The following interfaces exist in both repos and **must be kept in sync**:

| Concept | Frontend file | Backend file |
|---|---|---|
| Neural summary item | `neural.models.ts → FullKeySummary` | `neural.types.ts → FullKeySummaryItem` |
| Neural summary list response | `neural.models.ts → FullKeySummaryListResponse` | `neural.types.ts → SummaryListResponse` |
| Neural detail response | `neural.models.ts → FullKeyDetailResponse` | `neural.types.ts → DetailResponse` |
| Mapping row | `self-rec-mapping.service.ts → MappingRow` | `self-rec-mapping.controller.ts → MappingRow` |
| Pass config | `self-rec-passes.service.ts → PassConfig` | `self-rec-passes.controller.ts → PassConfig` |
| View config | `self-rec-view.service.ts → ViewConfig` | `self-rec-view.controller.ts → ViewConfig` |
| Run request/response | `self-rec-run.service.ts → RunRequest/RunResponse` | `self-rec-run.controller.ts` (implicit) |
| Results response | `self-rec-results.service.ts → ResultsResponse` | `self-rec-results.controller.ts` (implicit) |

**Recommended approach:** Generate these types from a shared OpenAPI 3.0 specification. Tools like `openapi-typescript` (frontend) and `@nestjs/swagger` or `zod-to-openapi` (backend) can keep both sides automatically in sync from a single source of truth.

Until a code-gen pipeline is in place, any change to a shared interface must be made in both repos in the same PR/deployment.

### 12.4 Keeping FE/BE integration clean

1. **All API calls go through the service layer.** Components never call `HttpClient` directly. This means the base URL is configured in one place per service and is easy to update.
2. **No hardcoded API paths in components.** All paths live in the `*service.ts` files. Updating from `/api/ara-neural` to a new base path requires a one-line change per service.
3. **The `NeuralSchemaService` abstract class is the FE/BE boundary.** The frontend never imports `BackendNeuralSchemaService` directly in any component — only `app.config.ts` knows which concrete class is active.
4. **Use `HttpInterceptor` (Angular) for authentication headers.** Do not add auth headers inside individual services. Add a single interceptor that attaches the office auth token to all `/api/*` requests.
