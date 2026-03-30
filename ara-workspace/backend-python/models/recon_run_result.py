"""
ARA Self Rec — Reconciliation Run Result Models
------------------------------------------------
Version: 1.0.0

Structured Pydantic models for the output produced by the Python engine
after processing a ReconRunPayload.

Field aliases use camelCase so the JSON payload is consistent with the
TypeScript interfaces on the frontend.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# ─────────────────────────────────────────────────────────────────────────────
# Enumerations
# ─────────────────────────────────────────────────────────────────────────────


class RunStatus(str, Enum):
    queued = "queued"
    running = "running"
    complete = "complete"
    error = "error"


class RowStatus(str, Enum):
    matched = "matched"
    # "break" is a Python reserved word; use break_row as the Python name.
    # The serialised JSON value is "break".
    break_row = "break"
    exception = "exception"
    unmatched = "unmatched"


# ─────────────────────────────────────────────────────────────────────────────
# Sub-models
# ─────────────────────────────────────────────────────────────────────────────


class RunSummary(BaseModel):
    """High-level counts for the completed run."""

    total_left: int = Field(alias="totalLeft")
    total_right: int = Field(alias="totalRight")
    matched: int
    unmatched: int
    breaks: int
    exceptions: int
    match_rate: float = Field(alias="matchRate", description="0–100 percentage")

    model_config = {"populate_by_name": True}


class PassStat(BaseModel):
    """How many rows were satisfied by a single pass."""

    pass_id: str = Field(alias="passId")
    pass_name: str = Field(alias="passName")
    match_count: int = Field(alias="matchCount")
    match_percentage: float = Field(alias="matchPercentage")

    model_config = {"populate_by_name": True}


class FieldDifference(BaseModel):
    """A single field that differed between left and right."""

    field: str
    left_value: str = Field(alias="leftValue")
    right_value: str = Field(alias="rightValue")
    difference: Optional[str] = Field(
        default=None,
        description="Human-readable description of the delta",
    )

    model_config = {"populate_by_name": True}


class ResultRow(BaseModel):
    """One reconciled row pair in the result set."""

    row_id: str = Field(alias="rowId")
    status: RowStatus
    matched_by_pass: Optional[str] = Field(default=None, alias="matchedByPass")
    left_key: str = Field(alias="leftKey", description="Key value from the left source")
    right_key: Optional[str] = Field(
        default=None,
        alias="rightKey",
        description="Key value from the right source (null = unmatched left row)",
    )
    field_differences: list[FieldDifference] = Field(
        default_factory=list,
        alias="fieldDifferences",
    )
    break_reason: Optional[str] = Field(default=None, alias="breakReason")

    model_config = {"populate_by_name": True}


class BreakReasonEntry(BaseModel):
    reason: str
    count: int
    percentage: float


class BreakReport(BaseModel):
    """Structured summary of all break rows."""

    total_breaks: int = Field(alias="totalBreaks")
    break_reasons: list[BreakReasonEntry] = Field(alias="breakReasons")

    model_config = {"populate_by_name": True}


class PassMatchStat(BaseModel):
    """Per-pass breakdown used in the analyzer report."""

    pass_id: str = Field(alias="passId")
    pass_name: str = Field(alias="passName")
    match_count: int = Field(alias="matchCount")
    percentage: float

    model_config = {"populate_by_name": True}


class AnalyzerReport(BaseModel):
    """AI-style narrative summary and breakdown statistics."""

    match_by_pass: list[PassMatchStat] = Field(alias="matchByPass")
    top_break_reasons: list[BreakReasonEntry] = Field(alias="topBreakReasons")
    exception_count: int = Field(alias="exceptionCount")
    narrative: str

    model_config = {"populate_by_name": True}


# ─────────────────────────────────────────────────────────────────────────────
# Root result model
# ─────────────────────────────────────────────────────────────────────────────


class ReconRunResult(BaseModel):
    """
    Complete result returned by the Python engine after processing a
    ReconRunPayload.  This is the document the frontend will later consume
    when the stitching phase begins.
    """

    run_id: str = Field(alias="runId")
    status: RunStatus
    run_mode: str = Field(alias="runMode")
    run_name: str = Field(alias="runName")
    submitted_by: str = Field(alias="submittedBy")
    started_at: datetime = Field(alias="startedAt")
    finished_at: datetime = Field(alias="finishedAt")
    duration_ms: int = Field(alias="durationMs", description="Wall-clock ms")
    summary: RunSummary
    pass_stats: list[PassStat] = Field(alias="passStats")
    rows: list[ResultRow] = Field(
        description="Sample result rows — capped at 50 in this stub"
    )
    break_report: Optional[BreakReport] = Field(default=None, alias="breakReport")
    analyzer_report: Optional[AnalyzerReport] = Field(
        default=None, alias="analyzerReport"
    )
    message: str

    model_config = {"populate_by_name": True}
