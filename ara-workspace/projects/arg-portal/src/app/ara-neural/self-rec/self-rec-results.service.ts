import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export type ResultRowStatus = 'matched' | 'break' | 'exception' | 'unmatched';

export interface ResultRow {
  id: string;
  status: ResultRowStatus;
  keyRef: string;
  sourceAValue: string;
  sourceBValue: string;
  difference: string;
  breakReason: string;
  matchedByPass: string;
  comments: string;
}

export interface PassMatchCount {
  passName: string;
  count: number;
  percentage: number;
}

export interface BreakReasonEntry {
  reason: string;
  count: number;
  percentage: number;
}

export interface ExceptionEntry {
  type: string;
  count: number;
}

export interface AnalyzerReport {
  matchByPass: PassMatchCount[];
  topBreakReasons: BreakReasonEntry[];
  exceptionDistribution: ExceptionEntry[];
  narrative: string;
}

export interface ResultsResponse {
  runId: string;
  rows: ResultRow[];
  analyzerReport: AnalyzerReport;
  sampleNote?: string;
}

@Injectable({ providedIn: 'root' })
export class SelfRecResultsService {
  private readonly http = inject(HttpClient);

  getResults(runId: string): Observable<ResultsResponse> {
    return this.http.get<ResultsResponse>(`/api/ara-self-rec/results/${encodeURIComponent(runId)}`);
  }
}
