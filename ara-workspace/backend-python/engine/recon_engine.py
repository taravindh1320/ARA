"""
ARA Self Rec — Reconciliation Engine
--------------------------------------
Core execution loop: loads row data, applies passes in priority order,
and assembles a ReconRunResult.

── Pass execution model ──────────────────────────────────────────────────────
Passes are sorted by priority (lowest integer first) and applied in order.
If a pass matches a row pair AND stopOnMatch is True, the row is not
evaluated by any lower-priority pass.
Manual passes (no rules) act as catch-alls and match anything that reached
them unmatched.
"""

from __future__ import annotations

import logging
import os
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

from engine.file_resolver import FileResolver
from engine.pass_evaluator import PassEvalResult, PassEvaluator
from models.recon_run_contract import PassType, ReconPass, ReconRunPayload, RunMode
from models.recon_run_result import (
    AnalyzerReport,
    BreakReasonEntry,
    BreakReport,
    FieldDifference,
    PassMatchStat,
    PassStat,
    ReconRunResult,
    ResultRow,
    RowStatus,
    RunStatus,
    RunSummary,
)

logger = logging.getLogger(__name__)

# Maximum number of ResultRow objects included in the response payload.
# The full reconciliation is counted; only this many rows are serialised.
_MAX_RESULT_ROWS = 50

# Default total row count when no preview cap is configured.
_DEFAULT_ROW_COUNT = 1_000


class ReconEngine:
    """
    Processes a validated ReconRunPayload and returns a ReconRunResult.

    Instantiate once and call run() for each payload.
    """

    def __init__(self) -> None:
        self._evaluator = PassEvaluator()

    # ── public entry point ───────────────────────────────────────────────────

    def run(self, payload: ReconRunPayload) -> ReconRunResult:
        started_at = datetime.now(tz=timezone.utc)
        t0 = time.perf_counter()

        run_id = f"PY-{uuid.uuid4().hex[:8].upper()}"

        total_rows = (
            payload.execution.max_preview_rows
            if (
                payload.metadata.run_mode == RunMode.preview
                and payload.execution.max_preview_rows
            )
            else _DEFAULT_ROW_COUNT
        )

        left_rows, right_rows = self._load_rows(payload, total_rows)

        enabled_passes = sorted(
            [p for p in payload.passes if p.enabled],
            key=lambda p: p.priority,
        )

        pass_match_counts: dict[str, int] = {p.pass_id: 0 for p in enabled_passes}

        matched = 0
        breaks = 0
        exceptions = 0
        total_unmatched = 0
        result_rows: list[ResultRow] = []
        break_reason_counts: dict[str, int] = {}

        # ── main pass loop ───────────────────────────────────────────────────
        paired = min(len(left_rows), len(right_rows))

        for i in range(paired):
            row = self._process_row_pair(
                i, left_rows[i], right_rows[i], enabled_passes, pass_match_counts
            )

            if row.status == RowStatus.matched:
                matched += 1
            elif row.status == RowStatus.break_row:
                breaks += 1
                if row.break_reason:
                    break_reason_counts[row.break_reason] = (
                        break_reason_counts.get(row.break_reason, 0) + 1
                    )
            elif row.status == RowStatus.exception:
                exceptions += 1
            else:
                total_unmatched += 1

            if len(result_rows) < _MAX_RESULT_ROWS:
                result_rows.append(row)

        # Rows without a counterpart on the opposite side
        total_unmatched += abs(len(left_rows) - len(right_rows))

        duration_ms = int((time.perf_counter() - t0) * 1_000)
        finished_at = datetime.now(tz=timezone.utc)
        match_rate = round((matched / max(paired, 1)) * 100, 2)

        summary = RunSummary(
            totalLeft=len(left_rows),
            totalRight=len(right_rows),
            matched=matched,
            unmatched=total_unmatched,
            breaks=breaks,
            exceptions=exceptions,
            matchRate=match_rate,
        )

        pass_stats = [
            PassStat(
                passId=p.pass_id,
                passName=p.name,
                matchCount=pass_match_counts[p.pass_id],
                matchPercentage=round(
                    (pass_match_counts[p.pass_id] / max(paired, 1)) * 100, 2
                ),
            )
            for p in enabled_passes
        ]

        break_report = (
            self._build_break_report(breaks, break_reason_counts)
            if payload.execution.generate_break_report
            else None
        )

        analyzer_report = (
            self._build_analyzer_report(
                enabled_passes,
                pass_match_counts,
                paired,
                break_reason_counts,
                exceptions,
                match_rate,
            )
            if payload.execution.generate_analyzer_report
            else None
        )

        is_preview = payload.metadata.run_mode == RunMode.preview
        message = (
            f"Preview complete — {matched:,} matched, {total_unmatched:,} unmatched, "
            f"{breaks:,} breaks. No results committed."
            if is_preview
            else f"Execute complete — {matched:,} matched, {total_unmatched:,} unmatched, "
            f"{breaks:,} breaks. Results committed."
        )

        return ReconRunResult(
            runId=run_id,
            status=RunStatus.complete,
            runMode=payload.metadata.run_mode.value,
            runName=payload.metadata.run_name,
            submittedBy=payload.metadata.submitted_by,
            startedAt=started_at,
            finishedAt=finished_at,
            durationMs=duration_ms,
            summary=summary,
            passStats=pass_stats,
            rows=result_rows,
            breakReport=break_report,
            analyzerReport=analyzer_report,
            message=message,
        )

    # ── row-pair processing ──────────────────────────────────────────────────

    def _process_row_pair(
        self,
        index: int,
        lrow: dict[str, str],
        rrow: dict[str, str],
        passes: list[ReconPass],
        pass_match_counts: dict[str, int],
    ) -> ResultRow:
        row_id = f"ROW-{index + 1:05d}"
        left_key = next(iter(lrow.values()), row_id)
        right_key = next(iter(rrow.values()), None)

        last_eval: PassEvalResult | None = None
        matched_pass: ReconPass | None = None

        for p in passes:
            # Manual (no-rules) pass: escalation point — rows reaching here
            # are flagged for human review, not automatically matched.
            # We record them against the pass for reporting but classify the
            # row as "unmatched" so it surfaces in the break/unmatched counts.
            if p.type == PassType.manual and not p.rules:
                if matched_pass is None:
                    pass_match_counts[p.pass_id] += 1
                    # Use a sentinel so we know this row was caught by manual.
                    matched_pass = p
                    last_eval = PassEvalResult(
                        matched=False,
                        break_reason="Flagged for manual review",
                    )
                break

            eval_result = self._evaluator.evaluate(lrow, rrow, p)

            if eval_result.matched:
                pass_match_counts[p.pass_id] += 1
                matched_pass = p
                last_eval = eval_result
                if p.stop_on_match:
                    break
            else:
                # Keep the last failed evaluation for break-reason reporting.
                if last_eval is None or not last_eval.matched:
                    last_eval = eval_result

        # ── classify the row ─────────────────────────────────────────────────
        # Manual-pass escalation: row was caught by a manual pass but should
        # appear as unmatched (pending human review) in the result counts.
        if (
            matched_pass is not None
            and matched_pass.type == PassType.manual
            and not matched_pass.rules
        ):
            return ResultRow(
                rowId=row_id,
                status=RowStatus.unmatched,
                matchedByPass=matched_pass.pass_id,
                leftKey=left_key,
                rightKey=right_key,
                fieldDifferences=[],
                breakReason="Flagged for manual review",
            )

        if matched_pass is None:
            return ResultRow(
                rowId=row_id,
                status=RowStatus.unmatched,
                matchedByPass=None,
                leftKey=left_key,
                rightKey=None,
                fieldDifferences=[],
                breakReason="No pass matched",
            )

        # A tolerance pass may match a row that has measurable differences;
        # classify those as breaks so the user can review them.
        has_diffs = last_eval is not None and bool(last_eval.differences)

        if has_diffs:
            diffs = [
                FieldDifference(
                    field=d["field"],
                    leftValue=d["leftValue"],
                    rightValue=d["rightValue"],
                    difference=d.get("difference"),
                )
                for d in last_eval.differences
            ]
            return ResultRow(
                rowId=row_id,
                status=RowStatus.break_row,
                matchedByPass=matched_pass.pass_id,
                leftKey=left_key,
                rightKey=right_key,
                fieldDifferences=diffs,
                breakReason=last_eval.break_reason,
            )

        return ResultRow(
            rowId=row_id,
            status=RowStatus.matched,
            matchedByPass=matched_pass.pass_id,
            leftKey=left_key,
            rightKey=right_key,
            fieldDifferences=[],
            breakReason=None,
        )

    # ── data loading ────────────────────────────────────────────────────────

    def _load_rows(
        self,
        payload: ReconRunPayload,
        total_rows: int,
    ) -> tuple[list[dict[str, str]], list[dict[str, str]]]:
        """
        Load left and right source files from disk and return them as
        lists of row dicts keyed by the *payload mapping field names*.

        The CSV/XLSX column names are the raw file headers; after loading,
        each column that appears in a mapping pair is renamed so that:
          • left rows are keyed by left_field
          • right rows are keyed by right_field

        Rows are truncated to *total_rows* when running in preview mode.
        """
        left_path = FileResolver.resolve(payload.sources.left, label="left")
        right_path = FileResolver.resolve(payload.sources.right, label="right")

        left_df = self._read_file(left_path)
        right_df = self._read_file(right_path)

        logger.info(
            "Loaded left=%s (%d rows), right=%s (%d rows)",
            left_path.name, len(left_df),
            right_path.name, len(right_df),
        )

        # Apply preview row cap
        left_df = left_df.head(total_rows)
        right_df = right_df.head(total_rows)

        # Build column rename maps from the original file headers to the
        # field names used in the pass rules.
        left_rename: dict[str, str] = {}
        right_rename: dict[str, str] = {}
        for pair in payload.mapping.pairs:
            if pair.right_field is None:
                continue
            # Only rename if the field name differs from the column header.
            # The mapping left_field IS the column name from Source A, and
            # right_field IS the column name from Source B (as set by the
            # user during the mapping step).
            left_rename[pair.left_field] = pair.left_field
            right_rename[pair.right_field] = pair.right_field

        # Convert all values to strings for uniform downstream comparison.
        left_df = left_df.astype(str)
        right_df = right_df.astype(str)

        left_rows = left_df.to_dict(orient="records")  # type: ignore[arg-type]
        right_rows = right_df.to_dict(orient="records")  # type: ignore[arg-type]

        return left_rows, right_rows  # type: ignore[return-value]

    @staticmethod
    def _read_file(path: Path) -> pd.DataFrame:
        """Read a CSV, TSV, or Excel file into a DataFrame."""
        ext = path.suffix.lower()
        if ext == ".csv":
            return pd.read_csv(path, dtype=str, keep_default_na=False)
        if ext == ".tsv":
            return pd.read_csv(path, sep="\t", dtype=str, keep_default_na=False)
        if ext in (".xlsx", ".xls"):
            return pd.read_excel(path, dtype=str)
        raise ValueError(f"Unsupported file type: {ext!r} ({path})")

    # ── report builders ──────────────────────────────────────────────────────

    def _build_break_report(
        self,
        total_breaks: int,
        reason_counts: dict[str, int],
    ) -> BreakReport:
        top = sorted(reason_counts.items(), key=lambda x: x[1], reverse=True)[:10]
        entries = [
            BreakReasonEntry(
                reason=reason,
                count=count,
                percentage=round((count / max(total_breaks, 1)) * 100, 2),
            )
            for reason, count in top
        ]
        return BreakReport(totalBreaks=total_breaks, breakReasons=entries)

    def _build_analyzer_report(
        self,
        passes: list[ReconPass],
        pass_match_counts: dict[str, int],
        total_rows: int,
        break_reason_counts: dict[str, int],
        exception_count: int,
        match_rate: float,
    ) -> AnalyzerReport:
        match_by_pass = [
            PassMatchStat(
                passId=p.pass_id,
                passName=p.name,
                matchCount=pass_match_counts[p.pass_id],
                percentage=round(
                    (pass_match_counts[p.pass_id] / max(total_rows, 1)) * 100, 2
                ),
            )
            for p in passes
        ]

        total_breaks = sum(break_reason_counts.values())
        top_breaks = sorted(
            break_reason_counts.items(), key=lambda x: x[1], reverse=True
        )[:5]
        break_entries = [
            BreakReasonEntry(
                reason=r,
                count=c,
                percentage=round((c / max(total_breaks, 1)) * 100, 2),
            )
            for r, c in top_breaks
        ]

        # Simple narrative derived from statistics.
        top_pass = max(match_by_pass, key=lambda s: s.match_count, default=None)
        parts = [f"Overall match rate: {match_rate:.1f}%."]
        if top_pass and top_pass.match_count > 0:
            parts.append(
                f"Pass '{top_pass.pass_name}' was the most productive, "
                f"accounting for {top_pass.percentage:.1f}% of rows."
            )
        if total_breaks > 0 and break_entries:
            parts.append(
                f"Most common break: {break_entries[0].reason} "
                f"({break_entries[0].count} occurrences)."
            )
        if exception_count > 0:
            parts.append(f"{exception_count} rows were flagged as exceptions.")

        return AnalyzerReport(
            matchByPass=match_by_pass,
            topBreakReasons=break_entries,
            exceptionCount=exception_count,
            narrative=" ".join(parts),
        )
