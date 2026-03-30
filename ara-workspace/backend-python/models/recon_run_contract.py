"""
ARA Self Rec — Shared Reconciliation Run JSON Contract (Python / Pydantic)
--------------------------------------------------------------------------
Version: 1.0.0

Mirrors recon-run-contract.models.ts exactly so that both sides of the
system share the same field names, types, and optionality rules.

Usage:
    from models.recon_run_contract import ReconRunPayload
    payload = ReconRunPayload.model_validate(json_dict)

Requires: pydantic >= 2.0
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


# ─────────────────────────────────────────────────────────────────────────────
# Shared enumerations
# ─────────────────────────────────────────────────────────────────────────────


class RunMode(str, Enum):
    preview = "preview"
    execute = "execute"


class FileType(str, Enum):
    csv = "csv"
    xlsx = "xlsx"
    tsv = "tsv"
    json = "json"


class TransformType(str, Enum):
    trim = "trim"
    uppercase = "uppercase"
    lowercase = "lowercase"
    date_format = "date_format"
    numeric_round = "numeric_round"


class PassType(str, Enum):
    exact = "exact"
    tolerance = "tolerance"
    manual = "manual"


class RuleOperator(str, Enum):
    eq = "eq"
    contains = "contains"
    starts_with = "starts_with"
    numeric_abs = "numeric_abs"
    numeric_pct = "numeric_pct"


class ToleranceType(str, Enum):
    absolute = "absolute"
    percentage = "percentage"


class ViewSource(str, Enum):
    left = "left"
    right = "right"
    both = "both"


class SortDirection(str, Enum):
    asc = "asc"
    desc = "desc"


class ResultCategory(str, Enum):
    matched = "matched"
    unmatched = "unmatched"
    exceptions = "exceptions"
    breaks = "breaks"


class MatchStrategy(str, Enum):
    first_match = "first_match"
    best_match = "best_match"
    all_matches = "all_matches"


# ─────────────────────────────────────────────────────────────────────────────
# A. Run Metadata
# ─────────────────────────────────────────────────────────────────────────────


class ReconRunMetadata(BaseModel):
    """Top-level metadata describing the run submission."""

    contract_version: str = Field(
        alias="contractVersion",
        description="Semantic version of this contract schema, e.g. '1.0.0'",
    )
    run_name: str = Field(
        alias="runName",
        description="Human-readable name for this run",
    )
    run_mode: RunMode = Field(
        alias="runMode",
        description="preview = dry-run only; execute = results are committed",
    )
    submitted_by: str = Field(
        alias="submittedBy",
        description="Identity of the person or process that submitted the run",
    )
    created_at: datetime = Field(
        alias="createdAt",
        description="ISO-8601 creation timestamp",
    )
    description: Optional[str] = Field(
        default=None,
        description="Optional free-text description of the run",
    )

    model_config = {"populate_by_name": True}


# ─────────────────────────────────────────────────────────────────────────────
# B. Sources
# ─────────────────────────────────────────────────────────────────────────────


class ReconSourceDefinition(BaseModel):
    """Describes one side of the reconciliation (left or right)."""

    upload_id: Optional[str] = Field(
        default=None,
        alias="uploadId",
        description="Stable ID returned by the upload endpoint",
    )
    label: str = Field(description="Display label, e.g. 'Source A' or 'GL Extract'")
    file_name: str = Field(
        alias="fileName",
        description="Original file name as uploaded by the user",
    )
    file_type: FileType = Field(
        alias="fileType",
        description="Detected or declared file format",
    )
    sheet_name: Optional[str] = Field(
        default=None,
        alias="sheetName",
        description="For xlsx sources: which sheet to read",
    )
    delimiter: Optional[str] = Field(
        default=None,
        description="For csv/tsv sources: column delimiter character (default ',')",
    )

    model_config = {"populate_by_name": True}


class ReconSources(BaseModel):
    left: ReconSourceDefinition = Field(
        description="Left-hand side of the reconciliation (historically 'Source A')"
    )
    right: ReconSourceDefinition = Field(
        description="Right-hand side of the reconciliation (historically 'Source B')"
    )


# ─────────────────────────────────────────────────────────────────────────────
# C. Mapping
# ─────────────────────────────────────────────────────────────────────────────


class FieldTransformation(BaseModel):
    """Optional normalisation applied to both fields before comparison."""

    type: TransformType
    params: Optional[dict[str, Any]] = Field(
        default=None,
        description="Optional parameters, e.g. {'format': 'YYYY-MM-DD'}",
    )


class MappingPair(BaseModel):
    """Maps one column from the left source to one column in the right source."""

    left_field: str = Field(
        alias="leftField",
        description="Column name in the left source",
    )
    right_field: Optional[str] = Field(
        alias="rightField",
        description="Corresponding column in the right source; null = explicitly unmapped",
    )
    required: bool = Field(
        description="Whether this pair must be present for a run to proceed"
    )
    transformation: Optional[FieldTransformation] = Field(
        default=None,
        description="Optional normalisation applied before comparison",
    )

    model_config = {"populate_by_name": True}


class ReconMapping(BaseModel):
    pairs: list[MappingPair] = Field(
        description="Ordered list of field-pair mappings"
    )


# ─────────────────────────────────────────────────────────────────────────────
# D. Passes
# ─────────────────────────────────────────────────────────────────────────────


class PassRule(BaseModel):
    left_field: str = Field(
        alias="leftField",
        description="Column name in the left source for this rule",
    )
    operator: RuleOperator
    right_field: str = Field(
        alias="rightField",
        description="Column name in the right source for this rule",
    )

    model_config = {"populate_by_name": True}


class ToleranceConfig(BaseModel):
    type: ToleranceType
    value: float = Field(
        description="Tolerance value — absolute unit or percentage (e.g. 0.01 or 0.5)"
    )


class ReconPass(BaseModel):
    pass_id: str = Field(
        alias="passId",
        description="Stable identifier for the pass, e.g. 'PASS-001'",
    )
    name: str
    type: PassType = Field(description="Algorithm category for this pass")
    priority: int = Field(description="Execution order — 1 is highest priority")
    enabled: bool
    stop_on_match: bool = Field(
        alias="stopOnMatch",
        description="If true, a matched row skips all lower-priority passes",
    )
    rules: list[PassRule] = Field(
        description="One or more match conditions; all must be satisfied for a match"
    )
    tolerance: Optional[ToleranceConfig] = Field(
        default=None,
        description="Required when type is 'tolerance'",
    )
    description: Optional[str] = None

    model_config = {"populate_by_name": True}


# ─────────────────────────────────────────────────────────────────────────────
# E. View
# ─────────────────────────────────────────────────────────────────────────────


class ReconViewColumn(BaseModel):
    field: str = Field(description="Logical field name (mapped-pair label or raw column)")
    source: ViewSource
    visible: bool
    label: Optional[str] = Field(
        default=None,
        description="Optional display-label override",
    )


class ReconSortConfig(BaseModel):
    field: str
    direction: SortDirection


class ReconGroupConfig(BaseModel):
    field: str
    show_subtotals: bool = Field(
        alias="showSubtotals",
        description="Show subtotals row beneath each group",
    )

    model_config = {"populate_by_name": True}


class ReconView(BaseModel):
    name: Optional[str] = Field(
        default=None,
        description="Optional name saved with this view definition",
    )
    columns: list[ReconViewColumn] = Field(
        description="Ordered list of result columns"
    )
    sort: Optional[ReconSortConfig] = Field(
        default=None,
        description="Primary sort applied to the result grid",
    )
    group_by: Optional[ReconGroupConfig] = Field(
        default=None,
        alias="groupBy",
        description="Grouping applied to the result grid",
    )
    summary_cards: list[str] = Field(
        alias="summaryCards",
        description="Summary-card IDs to display, e.g. 'matched', 'breaks', 'match_rate'",
    )
    visible_categories: list[ResultCategory] = Field(
        alias="visibleCategories",
        description="Which result categories are visible in the output",
    )

    model_config = {"populate_by_name": True}


# ─────────────────────────────────────────────────────────────────────────────
# F. Execution
# ─────────────────────────────────────────────────────────────────────────────


class ReconExecutionSettings(BaseModel):
    match_strategy: MatchStrategy = Field(
        alias="matchStrategy",
        description="How the engine resolves multiple pass hits for the same row pair",
    )
    allow_partial_match: bool = Field(
        alias="allowPartialMatch",
        description="Allow a row to match on a subset of the defined mapping pairs",
    )
    generate_break_report: bool = Field(
        alias="generateBreakReport",
        description="Emit a structured break report alongside main results",
    )
    generate_analyzer_report: bool = Field(
        alias="generateAnalyzerReport",
        description="Run the AI analyzer and attach its narrative to results",
    )
    max_preview_rows: Optional[int] = Field(
        default=None,
        alias="maxPreviewRows",
        description="Cap on rows for a preview run (ignored for execute runs)",
    )

    model_config = {"populate_by_name": True}


# ─────────────────────────────────────────────────────────────────────────────
# Root contract model
# ─────────────────────────────────────────────────────────────────────────────


class ReconRunPayload(BaseModel):
    """
    The single JSON document submitted to start a reconciliation run.

    Frontend (Angular) produces this structure.
    Python backend engine consumes it via ReconRunPayload.model_validate(data).
    The existing TypeScript backend (RunRequest / SelfRecRunService) is
    unaffected and continues to run in parallel.
    """

    metadata: ReconRunMetadata
    sources: ReconSources
    mapping: ReconMapping
    passes: list[ReconPass]
    view: ReconView
    execution: ReconExecutionSettings
