# ARA Self Rec — Developer Guide

Self Rec is a 5-step guided wizard that lets users run a self-service reconciliation entirely in the browser. No external data source is required — all state is held in Angular signals on the component and in an in-memory Express store on the backend.

---

## Architecture

```
Browser (Angular 19 + AG Grid 35)          Backend (Express + tsx, port 3000)
──────────────────────────────────         ──────────────────────────────────
self-rec.ts  (wizard shell)           ←→   /api/ara-self-rec/*
  ├─ self-rec-upload.service.ts       →    POST   /uploads
  ├─ self-rec-mapping.service.ts      →    POST   /mapping/suggest
  │                                   →    POST   /mapping
  ├─ self-rec-passes.service.ts       →    GET    /passes
  │                                   →    POST   /passes
  ├─ self-rec-view.service.ts         →    GET    /view
  │                                   →    POST   /view
  ├─ self-rec-run.service.ts          →    POST   /run
  └─ self-rec-results.service.ts      →    GET    /results/:runId
```

All Angular services live alongside `self-rec.ts` in:
`projects/arg-portal/src/app/ara-neural/self-rec/`

All backend controllers live in:
`backend/src/controllers/self-rec-*.controller.ts`

Routes are registered in `backend/src/routes/self-rec.routes.ts` and mounted in `backend/src/app.ts` under `/api/ara-self-rec`.

---

## Running locally

### 1 — Backend

```bash
cd backend
npx tsx src/server.ts
# listening on http://localhost:3000
```

The backend loads the Neural schema data via `NeuralDataService.load()` before binding the port.  
All Self Rec data is in-memory — it resets when you restart the process.

### 2 — Frontend

```bash
# from workspace root
npm start
# serves on http://localhost:4202
# /api/* is proxied to localhost:3000 via proxy.conf.json
```

Navigate to **ARA Neural → Self Rec** in the left nav.

---

## Wizard steps

| # | Step | Completion condition | Backend call |
|---|------|---------------------|--------------|
| 0 | Upload Files | Both Source A and Source B are `status: ready` | `POST /uploads` |
| 1 | Create Map | At least one field pair mapped **and** mapping saved | `POST /mapping/suggest` → `POST /mapping` |
| 2 | Create Pass | At least one pass created **and** passes saved | `GET /passes` → `POST /passes` |
| 3 | Create View | View saved | `GET /view` → `POST /view` |
| 4 | Run Recon | (terminal step — no Next button) | `POST /run` → `GET /results/:runId` |

Navigation between steps is guarded via `maxUnlocked` — users cannot jump ahead of their current progress. They can always navigate back.

---

## Key signals (`self-rec.ts`)

| Signal | Type | Purpose |
|--------|------|---------|
| `activeStep` | `signal<number>` | Currently displayed wizard step (0–4) |
| `maxUnlocked` | `computed<number>` | Highest step the user has legitimately reached |
| `canNext` | `computed<boolean>` | Whether the Next button is enabled |
| `nextHint` | `computed<string \| null>` | Tooltip/hint shown when Next is disabled |
| `runStatus` | `signal<string>` | `'idle' \| 'running' \| 'complete' \| 'error'` |
| `resultTab` | `signal<string>` | Active AG Grid tab in results section |

---

## Results section

After a successful run the wizard shows a full AG Grid results panel with four tabs:

- **Matched** — records paired across Source A & B
- **Breaks** — unmatched records with a break reason
- **Exceptions** — records excluded from matching
- **Analyzer** — pass-level bar chart summary

The backend generates deterministic synthetic rows seeded by `runId`, so the results are consistent for the same run without a real matching engine.

---

## Extending

### Add a new field to the mapping
Update the `MappingRow` interface in `self-rec-mapping.service.ts`, the `POST /mapping` controller, and add the column to the mapping table in `self-rec.html` (around line 245).

### Add a new result column
Add an entry to `colDefs` in `self-rec.ts` (around the `resultColDefs` block) and extend the row shape generated in `self-rec-results.controller.ts`.

### Swap in a real matching engine
Replace the deterministic simulation in `self-rec-results.controller.ts` — keep the same `RunResult` interface so the frontend doesn't need to change.

---

## Common issues

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| API calls 404 | Backend not running | `cd backend && npx tsx src/server.ts` |
| Mapping suggestions are all empty | Upload step not completed | Ensure both files were uploaded and `status === 'ready'` |
| AG Grid rows don't appear | `AllCommunityModule` not registered | Already registered in component constructor — check browser console for module errors |
| Step bar steps are all locked | Source files not yet uploaded | Normal — steps unlock as each prior step is completed and saved |
