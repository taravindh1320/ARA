import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { MappingRow } from './self-rec-mapping.service';
import { PassConfig } from './self-rec-passes.service';
import {
  ViewColumn, SortConfig, GroupConfig, SummaryCard, CategoryConfig,
} from './self-rec-view.service';
import { RunSummary } from './self-rec-run.service';
import { ResultRow, AnalyzerReport } from './self-rec-results.service';

// ── Input ─────────────────────────────────────────────────────────────────────

export interface PythonRunInput {
  sourceAName: string;
  sourceAUploadId?: string;
  sourceAColumns: string[];
  sourceBName: string;
  sourceBUploadId?: string;
  sourceBColumns: string[];
  mappingRows: MappingRow[];
  passes: PassConfig[];
  viewName: string;
  viewColumns: ViewColumn[];
  viewSort: SortConfig | null;
  viewGroupBy: GroupConfig | null;
  viewSummaryCards: SummaryCard[];
  viewCategories: CategoryConfig[];
  submittedBy: string;
  runMode: 'preview' | 'execute';
}

// ── Output (what the component consumes) ─────────────────────────────────────

export interface PythonRunResult {
  runId: string;
  status: 'queued' | 'running' | 'complete' | 'error';
  submittedAt: string;
  runMode: 'preview' | 'execute';
  summary: RunSummary;
  rows: ResultRow[];
  analyzerReport: AnalyzerReport;
  message?: string;
}

// ── Raw shapes returned by the Python engine ──────────────────────────────────

interface PythonFieldDiff {
  field: string;
  leftValue: string;
  rightValue: string;
  difference: string | null;
}

interface PythonResultRow {
  rowId: string;
  status: string;
  matchedByPass: string | null;
  leftKey: string;
  rightKey: string | null;
  fieldDifferences: PythonFieldDiff[];
  breakReason: string | null;
}

interface PythonPassMatchStat {
  passId: string;
  passName: string;
  matchCount: number;
  percentage: number;
}

interface PythonBreakReason {
  reason: string;
  count: number;
  percentage: number;
}

interface PythonAnalyzerReport {
  matchByPass: PythonPassMatchStat[];
  topBreakReasons: PythonBreakReason[];
  exceptionCount: number;
  narrative: string;
}

interface PythonSummary {
  totalLeft: number;
  totalRight: number;
  matched: number;
  unmatched: number;
  breaks: number;
  exceptions: number;
  matchRate: number;
}

interface PythonRunResponse {
  runId: string;
  status: string;
  runMode: string;
  startedAt: string;
  summary: PythonSummary;
  rows: PythonResultRow[];
  analyzerReport: PythonAnalyzerReport | null;
  message: string;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class SelfRecPythonRunService {

  private readonly http = inject(HttpClient);

  run(input: PythonRunInput): Observable<PythonRunResult> {
    const payload = this.buildPayload(input);
    return this.http
      .post<PythonRunResponse>('/api/python/ara-self-rec/run', payload)
      .pipe(map(res => this.mapResponse(res)));
  }

  // ── Payload builder ─────────────────────────────────────────────────────────

  private buildPayload(input: PythonRunInput): unknown {
    const mapped = input.mappingRows.filter(r => r.sourceBField !== null);

    return {
      metadata: {
        contractVersion: '1.0.0',
        runName: `${input.sourceAName} vs ${input.sourceBName}`,
        runMode: input.runMode,
        submittedBy: input.submittedBy || 'anonymous',
        createdAt: new Date().toISOString(),
      },
      sources: {
        left: {
          label: 'Source A',
          fileName: input.sourceAName,
          fileType: this.detectFileType(input.sourceAName),
          ...(input.sourceAUploadId ? { uploadId: input.sourceAUploadId } : {}),
        },
        right: {
          label: 'Source B',
          fileName: input.sourceBName,
          fileType: this.detectFileType(input.sourceBName),
          ...(input.sourceBUploadId ? { uploadId: input.sourceBUploadId } : {}),
        },
      },
      mapping: {
        pairs: mapped.map(r => ({
          leftField: r.sourceAField,
          rightField: r.sourceBField,
          required: true,
        })),
      },
      passes: input.passes.map((p, i) => ({
        passId: p.id,
        name: p.name,
        type: p.matchType,
        priority: p.order ?? i + 1,
        enabled: p.enabled,
        stopOnMatch: true,
        description: p.description,
        rules: p.keys.map(k => ({
          leftField: k.sourceAField,
          operator: p.matchType === 'tolerance' ? 'numeric_abs' : 'eq',
          rightField: k.sourceBField,
        })),
        tolerance: p.toleranceValue != null
          ? { type: 'absolute',   value: p.toleranceValue }
          : p.tolerancePercent != null
          ? { type: 'percentage', value: p.tolerancePercent }
          : undefined,
      })),
      view: {
        name: input.viewName || undefined,
        columns: input.viewColumns.map(c => ({
          field: c.field,
          source: c.source === 'A' ? 'left' : c.source === 'B' ? 'right' : 'both',
          visible: c.visible,
          label: c.label,
        })),
        sort: input.viewSort ?? undefined,
        groupBy: input.viewGroupBy ?? undefined,
        summaryCards: input.viewSummaryCards
          .filter(c => c.visible)
          .map(c => c.id),
        visibleCategories: input.viewCategories
          .filter(c => c.visible)
          .map(c => c.category),
      },
      execution: {
        matchStrategy: 'first_match',
        allowPartialMatch: false,
        generateBreakReport: true,
        generateAnalyzerReport: true,
        maxPreviewRows: input.runMode === 'preview' ? 500 : undefined,
      },
    };
  }

  // ── Response mapper ─────────────────────────────────────────────────────────

  private mapResponse(res: PythonRunResponse): PythonRunResult {
    return {
      runId:       res.runId,
      status:      res.status as PythonRunResult['status'],
      submittedAt: res.startedAt,
      runMode:     res.runMode as 'preview' | 'execute',
      summary: {
        totalA:    res.summary.totalLeft,
        totalB:    res.summary.totalRight,
        matched:   res.summary.matched,
        unmatched: res.summary.unmatched,
        breaks:    res.summary.breaks,
        exceptions: res.summary.exceptions,
        matchRate: res.summary.matchRate,
      },
      rows: res.rows.map(r => this.mapRow(r)),
      analyzerReport: res.analyzerReport
        ? this.mapAnalyzer(res.analyzerReport)
        : { matchByPass: [], topBreakReasons: [], exceptionDistribution: [], narrative: '' },
      message: res.message,
    };
  }

  private mapRow(r: PythonResultRow): ResultRow {
    const first = r.fieldDifferences[0];
    return {
      id:            r.rowId,
      status:        r.status as ResultRow['status'],
      keyRef:        r.leftKey,
      sourceAValue:  first?.leftValue  ?? r.leftKey,
      sourceBValue:  first?.rightValue ?? r.rightKey ?? '',
      difference:    first?.difference ?? '',
      breakReason:   r.breakReason ?? '',
      matchedByPass: r.matchedByPass ?? '',
      comments:      '',
    };
  }

  private mapAnalyzer(r: PythonAnalyzerReport): AnalyzerReport {
    return {
      matchByPass: r.matchByPass.map(p => ({
        passName:   p.passName,
        count:      p.matchCount,
        percentage: p.percentage,
      })),
      topBreakReasons: r.topBreakReasons,
      exceptionDistribution: [
        { type: 'exceptions', count: r.exceptionCount },
      ],
      narrative: r.narrative,
    };
  }

  private detectFileType(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'xlsx' || ext === 'xls') return 'xlsx';
    if (ext === 'tsv') return 'tsv';
    return 'csv';
  }
}
