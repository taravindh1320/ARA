# ARA Neural — Dev Handoff Notes

## What is this?

This repo contains both the Angular frontend and a lightweight Express backend
for the ARA Neural feature.  They are kept together for local development and
are designed to be split into two repos when the dev team is ready.

---

## Repo Structure

```
ara-workspace/
  backend/                          ← Express API (BACKEND REPO candidate)
    src/
      server.ts                     — entry point
      app.ts                        — Express setup (cors, routes)
      config.ts                     — port, data file path, CORS origins
      routes/neural.routes.ts       — route declarations
      controllers/neural.controller.ts
      services/neural.service.ts    — data loading + filtering + pagination
      models/neural.types.ts        — TS types matching frontend contract
    package.json
    tsconfig.json

  projects/arg-portal/src/app/      ← Angular app (FRONTEND REPO candidate)
    ara-neural/
      models/neural.models.ts       — API contract interfaces (FE/BE shared)
      services/
        neural-schema.service.ts    — abstract contract + LocalMockNeuralSchemaService
        backend-neural-schema.service.ts  ← ACTIVE: calls real Express API
      schema/
        neural-schema.ts            — component (no changes needed)
        neural-schema.html
    app.config.ts                   — registers BackendNeuralSchemaService

  proxy.conf.json                   — dev proxy: /api → http://localhost:3000
  scripts/
    excel_to_neural_json.py         — generates neural_schema.json (backend data)
  input/
    ara_neural_input.csv            — sample input (replace with real Excel)
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/api/ara-neural/fullkeys` | Paginated FULL_KEY summary list |
| `GET` | `/api/ara-neural/fullkeys/:groupId` | Full lineage detail for one group |

### Query params for `/fullkeys`

| Param | Type | Description |
|-------|------|-------------|
| `search` | string | Free-text filter on fullKey / region / platform |
| `region` | string | Exact region match (EMEA / APAC / NAM / LATAM) |
| `status` | string | Match any reviewStatus in the group |
| `page` | number | Page number (default: 1) |
| `pageSize` | number | Items per page (default: 100, max: 500) |

---

## Data Flow

```
Excel / CSV
    │
    ▼
scripts/excel_to_neural_json.py
    ├── neural_schema_summary.json   → frontend Stage 1 (in assets/ for mock)
    └── neural_schema.json           → backend data source (move out of assets in prod)
                                           │
                                           ▼
                                     Express backend reads on startup
                                     GET /api/ara-neural/fullkeys          → strips records[]
                                     GET /api/ara-neural/fullkeys/:groupId → returns full group
                                           │
                                           ▼
                                     Angular BackendNeuralSchemaService
                                     (proxied via proxy.conf.json in dev)
                                           │
                                           ▼
                                     NeuralSchemaComponent (unchanged)
```

---

## Running Locally

Open **two terminals** in `ara-workspace/`:

**Terminal 1 — Backend**
```bash
# First time only:
npm run backend:install

# Every time:
npm run backend:dev
# → Running on http://localhost:3000
```

**Terminal 2 — Frontend**
```bash
npm start
# → Angular dev server on http://localhost:4200
# → /api/* proxied to http://localhost:3000
```

Open `http://localhost:4200` and navigate to ARA Neural.

---

## Switching Back to Local Mock (no backend needed)

In `app.config.ts`, change one line:

```typescript
// Backend (current):
{ provide: NeuralSchemaService, useClass: BackendNeuralSchemaService }

// Mock (no backend needed):
{ provide: NeuralSchemaService, useClass: LocalMockNeuralSchemaService }
```

---

## Splitting into Two Repos

**Frontend repo** — copy everything EXCEPT `backend/`:
- All of `projects/`
- `angular.json`, `package.json`, `tsconfig.json`
- `proxy.conf.json`
- Delete `LocalMockNeuralSchemaService` and local JSON assets when done

**Backend repo** — copy `backend/` and the data generation tooling:
- `backend/`
- `scripts/excel_to_neural_json.py`
- `input/` directory
- Update `DATA_FILE_PATH` env var to point to real data location

**Interface contract** — `ara-neural/models/neural.models.ts` (frontend) and
`backend/src/models/neural.types.ts` must stay in sync after the split.
Consider publishing them as a shared npm package or duplicating with a comment.

---

## Regenerating Data

When you update the Excel/CSV input:

```bash
# From ara-workspace/ parent directory:
cd c:\Personal\Projects\ARA
.\.venv\Scripts\python.exe scripts\excel_to_neural_json.py --input input\ara_neural_input.xlsx
# Writes: neural_schema.json + neural_schema_summary.json
# Restart the backend to pick up new data (tsx watch does this automatically)
```
