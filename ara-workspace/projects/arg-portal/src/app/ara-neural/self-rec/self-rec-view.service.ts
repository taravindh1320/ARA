import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export type ResultCategory = 'matched' | 'unmatched' | 'exceptions' | 'breaks';
export type SortDirection   = 'asc' | 'desc';

export interface ViewColumn {
  field: string;
  source: 'A' | 'B' | 'both';
  visible: boolean;
  label?: string;
}

export interface SortConfig {
  field: string;
  direction: SortDirection;
}

export interface GroupConfig {
  field: string;
  showSubtotals: boolean;
}

export interface SummaryCard {
  id: string;
  label: string;
  visible: boolean;
}

export interface CategoryConfig {
  category: ResultCategory;
  visible: boolean;
  label: string;
}

export interface ViewConfig {
  name: string;
  columns: ViewColumn[];
  sort?: SortConfig;
  groupBy?: GroupConfig;
  summaryCards: SummaryCard[];
  categories: CategoryConfig[];
}

export interface SaveViewResponse {
  saved: boolean;
  viewId: string;
}

@Injectable({ providedIn: 'root' })
export class SelfRecViewService {
  private readonly http = inject(HttpClient);

  saveView(view: ViewConfig): Observable<SaveViewResponse> {
    return this.http.post<SaveViewResponse>('/api/ara-self-rec/view', { view });
  }
}
