"""
ARA Self Rec — Reconciliation Service
---------------------------------------
Thin orchestration layer between the API endpoint and the engine.
Responsible for pre-flight payload validation and engine delegation.
"""

from __future__ import annotations

from engine.recon_engine import ReconEngine
from models.recon_run_contract import PassType, ReconRunPayload
from models.recon_run_result import ReconRunResult


class ReconServiceError(ValueError):
    """Raised when the payload fails a pre-flight business rule check."""


class ReconService:
    """
    Validates a ReconRunPayload and delegates to ReconEngine.run().

    Intended to be instantiated once (e.g. at app startup) and reused.
    """

    def __init__(self) -> None:
        self._engine = ReconEngine()

    def execute(self, payload: ReconRunPayload) -> ReconRunResult:
        self._preflight(payload)
        return self._engine.run(payload)

    # ── pre-flight validation ────────────────────────────────────────────────

    @staticmethod
    def _preflight(payload: ReconRunPayload) -> None:
        """
        Checks business rules that Pydantic structural validation cannot
        enforce on its own.  Raises ReconServiceError on the first failure.
        """

        # 1. Required mapping pairs must have a right-side field.
        for pair in payload.mapping.pairs:
            if pair.required and pair.right_field is None:
                raise ReconServiceError(
                    f"Required mapping pair '{pair.left_field}' has no right-side field."
                )

        # 2. At least one pass must be enabled.
        enabled = [p for p in payload.passes if p.enabled]
        if not enabled:
            raise ReconServiceError("At least one pass must be enabled.")

        # 3. Tolerance passes must carry a tolerance block.
        for p in enabled:
            if p.type == PassType.tolerance and p.tolerance is None:
                raise ReconServiceError(
                    f"Pass '{p.pass_id}' ({p.name}) is type 'tolerance' "
                    "but has no tolerance block."
                )

        # 4. Pass priorities must be unique.
        priorities = [p.priority for p in enabled]
        if len(priorities) != len(set(priorities)):
            raise ReconServiceError(
                "Enabled passes must have unique priority values."
            )
