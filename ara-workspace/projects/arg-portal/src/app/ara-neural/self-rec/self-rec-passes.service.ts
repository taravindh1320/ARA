import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export type MatchType = 'exact' | 'tolerance' | 'manual';

export interface PassKey {
  sourceAField: string;
  sourceBField: string;
  operator?: MatchType;
}

export interface PassConfig {
  id: string;
  name: string;
  order: number;
  enabled: boolean;
  matchType: MatchType;
  keys: PassKey[];
  toleranceValue?: number;
  tolerancePercent?: number;
  description?: string;
}

export interface SavePassesResponse {
  saved: boolean;
  passSetId: string;
  passCount: number;
}

@Injectable({ providedIn: 'root' })
export class SelfRecPassesService {

  private readonly http = inject(HttpClient);

  savePasses(passes: PassConfig[]): Observable<SavePassesResponse> {
    return this.http.post<SavePassesResponse>('/api/ara-self-rec/passes', { passes });
  }
}
