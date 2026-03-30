"""
ARA Self Rec — Python Engine API
----------------------------------
FastAPI application exposing the Python reconciliation engine.

This is a PARALLEL execution path.  It does not replace the current
TypeScript backend (ara-workspace/backend/).  Both paths may run
simultaneously during the transition period.

Endpoints
---------
POST /api/python/ara-self-rec/run
    Submit a ReconRunPayload; returns a ReconRunResult.

POST /api/python/ara-self-rec/validate
    Validate a payload without executing a run.

GET  /health
    Liveness probe.

Running locally
---------------
    cd ara-workspace/backend-python
    pip install -r requirements.txt
    uvicorn app:app --reload --port 8001

The TypeScript backend continues running on its own port (default 3000).
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

from models.recon_run_contract import ReconRunPayload
from models.recon_run_result import ReconRunResult
from service.recon_service import ReconService, ReconServiceError


# ─────────────────────────────────────────────────────────────────────────────
# Application lifecycle
# ─────────────────────────────────────────────────────────────────────────────


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    # Future: initialise DB connections, load ML models, read config, etc.
    yield


# ─────────────────────────────────────────────────────────────────────────────
# App instance
# ─────────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="ARA Self Rec — Python Engine",
    description=(
        "Parallel Python execution path for ARA Self Rec reconciliation. "
        "Accepts a ReconRunPayload JSON document and returns a ReconRunResult. "
        "Does not replace the TypeScript backend."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# Allow the Angular dev server to call this endpoint directly during
# local integration testing.  Restrict origins in production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200", "http://localhost:3000"],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)

_service = ReconService()


# ─────────────────────────────────────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────────────────────────────────────


@app.get("/health", tags=["system"], summary="Liveness probe")
def health() -> dict:
    return {"status": "ok", "engine": "ara-self-rec-python", "version": "1.0.0"}


@app.post(
    "/api/python/ara-self-rec/run",
    response_model=ReconRunResult,
    tags=["recon"],
    summary="Execute a reconciliation run",
    response_model_by_alias=True,
)
def run_recon(payload: ReconRunPayload) -> ReconRunResult:
    """
    Accepts a **ReconRunPayload** JSON document, validates it against the
    shared contract models, executes (or simulates) the reconciliation,
    and returns a structured **ReconRunResult**.

    - `runMode: preview` — executes the full engine but does not commit results.
    - `runMode: execute` — full run; results are considered committed.

    Frontend wiring is not yet implemented.  Call this endpoint directly
    with a JSON payload from `docs/samples/recon-run-sample.json` for
    end-to-end testing.
    """
    try:
        return _service.execute(payload)
    except ReconServiceError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Engine error: {exc}",
        ) from exc


@app.post(
    "/api/python/ara-self-rec/validate",
    tags=["recon"],
    summary="Validate a run payload without executing",
)
def validate_payload(payload: ReconRunPayload) -> dict:
    """
    Parses and validates a **ReconRunPayload** without running the engine.
    Returns a concise summary useful for pre-flight UI feedback.
    """
    enabled_passes = [p for p in payload.passes if p.enabled]
    mapped_pairs = [p for p in payload.mapping.pairs if p.right_field is not None]
    unmapped_required = [
        p for p in payload.mapping.pairs if p.required and p.right_field is None
    ]

    validation_errors: list[str] = []
    if unmapped_required:
        validation_errors.append(
            f"Required fields with no right mapping: "
            f"{[p.left_field for p in unmapped_required]}"
        )
    if not enabled_passes:
        validation_errors.append("No enabled passes found.")

    return {
        "valid": len(validation_errors) == 0,
        "contractVersion": payload.metadata.contract_version,
        "runName": payload.metadata.run_name,
        "runMode": payload.metadata.run_mode.value,
        "mappedPairs": len(mapped_pairs),
        "requiredPairsUnmapped": len(unmapped_required),
        "enabledPasses": len(enabled_passes),
        "passes": [
            {
                "passId": p.pass_id,
                "name": p.name,
                "type": p.type.value,
                "ruleCount": len(p.rules),
                "stopOnMatch": p.stop_on_match,
            }
            for p in enabled_passes
        ],
        "validationErrors": validation_errors,
    }
