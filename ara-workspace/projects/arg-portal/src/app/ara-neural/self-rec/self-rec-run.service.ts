import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PassConfig } from './self-rec-passes.service';
import { ViewConfig } from './self-rec-view.service';

export interface RunSourceInfo {
  name: string;
  columns: string[];
  rowCount: number;
}

export interface RunMappingInfo {
  fieldPairs: Array<{ sourceAField: string; sourceBField: string }>;
  mappingId?: string;
}

export interface RunRequest {
  sourceA: RunSourceInfo;
  sourceB: RunSourceInfo;
  mapping: RunMappingInfo;
  passes: PassConfig[];
  view: ViewConfig;
  submittedBy: string;
  runMode: 'preview' | 'execute';
}

export interface RunSummary {
  totalA: number;
  totalB: number;
  matched: number;
  unmatched: number;
  breaks: number;
  exceptions: number;
  matchRate: number;
}

export interface RunResponse {
  runId: string;
  status: 'queued' | 'running' | 'complete' | 'error';
  submittedAt: string;
  runMode: 'preview' | 'execute';
  summary: RunSummary;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class SelfRecRunService {
  private readonly http = inject(HttpClient);

  run(request: RunRequest): Observable<RunResponse> {
    return this.http.post<RunResponse>('/api/ara-self-rec/run', request);
  }
}
