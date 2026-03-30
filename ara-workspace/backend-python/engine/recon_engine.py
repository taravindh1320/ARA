"""
ARA Self Rec — Reconciliation Engine
--------------------------------------
Core execution loop: loads row data, applies passes in priority order,
and assembles a ReconRunResult.

── Stub vs real data ────────────────────────────────────────────────────────
The only method that changes when real data arrives is _load_rows().
Everything else — the pass loop, statistics, report generation — stays the
same.  Replacing _load_rows() to read from uploaded CSV/XLSX files is the
entire stitching task for a future sprint.

── Pass execution model ──────────────────────────────────────────────────────
Passes are sorted by priority (lowest integer first) and applied in order.
If a pass matches a row pair AND stopOnMatch is True, the row is not
evaluated by any lower-priority pass.
Manual passes (no rules) act as catch-alls and match anything that reached
them unmatched.
"""

from __future__ import annotations

import random
import time
import uuid
from datetime import datetime, timezone

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

    # ── data loading (stub) ──────────────────────────────────────────────────

    def _load_rows(
        self,
        payload: ReconRunPayload,
        total_rows: int,
    ) -> tuple[list[dict[str, str]], list[dict[str, str]]]:
        """
        STUB — generates synthetic row pairs from the mapping configuration.

        ── Replacing this stub ───────────────────────────────────────────────
        1. Use payload.sources.left.upload_id and .right.upload_id to locate
           the uploaded files in your storage layer.
        2. Load each file into a pandas DataFrame (or similar).
        3. Rename columns according to payload.mapping.pairs so that
           left_row keys match PassRule.left_field, etc.
        4. Apply any field transformations declared in mapping.pairs.
        5. Return two lists of row dicts — one per source side.

        The pass loop and result assembly below do not change.
        """
        rng = random.Random(hash(payload.metadata.run_name) & 0xFFFF_FFFF)

        mapped = [
            (p.left_field, p.right_field)
            for p in payload.mapping.pairs
            if p.right_field is not None
        ]

        left_rows: list[dict[str, str]] = []
        right_rows: list[dict[str, str]] = []

        for i in range(total_rows):
            r = rng.random()
            if r < 0.68:
                scenario = "exact"
            elif r < 0.82:
                scenario = "tolerance"
            elif r < 0.91:
                scenario = "break"
            elif r < 0.96:
                scenario = "left_only"
            else:
                scenario = "right_only"

            lrow: dict[str, str] = {}
            rrow: dict[str, str] = {}

            for lf, rf in mapped:
                lv, rv = self._synthetic_pair(lf, rf, i, scenario, rng)
                lrow[lf] = lv
                rrow[rf] = rv

            left_rows.append(lrow)
            right_rows.append(rrow)

        return left_rows, right_rows

    def _synthetic_pair(
        self,
        left_field: str,
        right_field: str,
        index: int,
        scenario: str,
        rng: random.Random,
    ) -> tuple[str, str]:
        """
        Produces a (left_value, right_value) pair whose content is driven
        by the field name archetype and the row scenario.
        """
        row_num = index + 1
        lf = left_field.lower()

        # ── identifier / key fields ──────────────────────────────────────────
        if any(k in lf for k in ("id", "ref", "key", "trade", "confirm", "num")):
            shared_key = f"KEY-{row_num:05d}"
            if scenario in ("left_only", "right_only"):
                return shared_key, f"KEY-{row_num + 90_000:05d}"
            return shared_key, shared_key

        # ── date fields ──────────────────────────────────────────────────────
        if any(k in lf for k in ("date", "dt", "day")):
            lv = "2026-03-30"
            rv = "2026-03-29" if scenario == "break" else "2026-03-30"
            return lv, rv

        # ── numeric / amount fields ──────────────────────────────────────────
        if any(k in lf for k in ("notional", "amount", "amt", "price", "prc", "value", "val", "qty")):
            base = round(rng.uniform(10_000, 5_000_000), 2)
            lv = f"{base:.2f}"
            if scenario == "exact":
                rv = lv
            elif scenario == "tolerance":
                # Small difference — within a 0.01 absolute tolerance
                delta = round(rng.uniform(0.001, 0.009), 4)
                rv = f"{base + delta:.2f}"
            else:
                # Larger difference — outside any declared tolerance
                delta = round(rng.uniform(500.0, 5_000.0), 2)
                rv = f"{base + delta:.2f}"
            return lv, rv

        # ── currency fields ───────────────────────────────────────────────────
        if any(k in lf for k in ("ccy", "currency", "curr")):
            ccy = rng.choice(["USD", "EUR", "GBP", "JPY", "CHF"])
            return ccy, ccy

        # ── party / counterparty fields ───────────────────────────────────────
        if any(k in lf for k in ("party", "cpty", "counterparty", "entity", "account", "acct")):
            parties = ["Goldman Sachs", "JP Morgan", "Barclays", "Deutsche Bank", "HSBC"]
            party = rng.choice(parties)
            rv = party.split()[0] if scenario == "break" else party
            return party, rv

        # ── generic fallback ─────────────────────────────────────────────────
        lv = f"{left_field}_{row_num}"
        rv = f"{right_field}_{row_num}" if scenario != "break" else f"{right_field}_DIFF"
        return lv, rv

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
