"""
ARA Self Rec — Pass Evaluator
------------------------------
Evaluates whether a pair of row dictionaries satisfies all rules in a
single ReconPass.

This module contains only pure comparison logic — no I/O, no state.
It can be unit-tested independently of the engine.

Future use: when real DataFrames are loaded, each row pair is turned into
two plain dicts (one per side) and passed directly to PassEvaluator.evaluate().
"""

from __future__ import annotations

from dataclasses import dataclass, field

from models.recon_run_contract import ReconPass, RuleOperator, ToleranceConfig


@dataclass
class PassEvalResult:
    """Result of evaluating one pass against one row pair."""

    matched: bool
    differences: list[dict] = field(default_factory=list)
    break_reason: str | None = None


class PassEvaluator:
    """
    Evaluates a pair of row dicts against a ReconPass configuration.

    Each row dict is keyed by column name (matching the field names used
    in pass rules and mapping pairs).  Values are plain strings; numeric
    comparison converts them on the fly.
    """

    def evaluate(
        self,
        left_row: dict[str, str],
        right_row: dict[str, str],
        pass_config: ReconPass,
    ) -> PassEvalResult:
        # A manual pass with no rules acts as a catch-all.
        if not pass_config.rules:
            return PassEvalResult(matched=True)

        all_matched = True
        differences: list[dict] = []

        for rule in pass_config.rules:
            lval = left_row.get(rule.left_field, "")
            rval = right_row.get(rule.right_field, "")

            rule_matched, diff_desc = self._eval_rule(
                lval, rval, rule.operator, pass_config.tolerance
            )

            if not rule_matched:
                all_matched = False
                differences.append(
                    {
                        "field": rule.left_field,
                        "leftValue": lval,
                        "rightValue": rval,
                        "difference": diff_desc,
                    }
                )

        break_reason: str | None = None
        if not all_matched and differences:
            first = differences[0]
            break_reason = (
                f"{first['field']}: '{first['leftValue']}' vs '{first['rightValue']}'"
            )

        return PassEvalResult(
            matched=all_matched,
            differences=differences,
            break_reason=break_reason,
        )

    # ── rule-level comparison ────────────────────────────────────────────────

    def _eval_rule(
        self,
        lval: str,
        rval: str,
        operator: RuleOperator,
        tolerance: ToleranceConfig | None,
    ) -> tuple[bool, str | None]:
        """
        Returns (matched, difference_description).
        difference_description is None when matched=True.
        """
        try:
            match operator:
                case RuleOperator.eq:
                    ok = lval.strip() == rval.strip()
                    return ok, None if ok else f"'{lval}' != '{rval}'"

                case RuleOperator.contains:
                    ok = lval.strip().lower() in rval.strip().lower()
                    return ok, None if ok else f"'{lval}' not found in '{rval}'"

                case RuleOperator.starts_with:
                    ok = rval.strip().lower().startswith(lval.strip().lower())
                    return ok, None if ok else f"'{rval}' does not start with '{lval}'"

                case RuleOperator.numeric_abs:
                    l_num = float(lval.replace(",", ""))
                    r_num = float(rval.replace(",", ""))
                    abs_diff = abs(l_num - r_num)
                    tol = tolerance.value if tolerance else 0.0
                    ok = abs_diff <= tol
                    return ok, None if ok else f"abs diff {abs_diff:.4f} > tol {tol}"

                case RuleOperator.numeric_pct:
                    l_num = float(lval.replace(",", ""))
                    r_num = float(rval.replace(",", ""))
                    base = abs(r_num) or 1.0
                    pct = (abs(l_num - r_num) / base) * 100
                    tol = tolerance.value if tolerance else 0.0
                    ok = pct <= tol
                    return ok, None if ok else f"pct diff {pct:.2f}% > tol {tol}%"

        except (ValueError, TypeError) as exc:
            return False, f"type error: {exc}"

        return False, "unknown operator"
