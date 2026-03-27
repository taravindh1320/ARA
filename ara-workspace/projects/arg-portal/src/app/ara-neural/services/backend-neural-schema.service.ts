/**
 * BackendNeuralSchemaService
 * ==========================
 * Production Angular service — calls the real Express backend API.
 * Activated in app.config.ts by replacing LocalMockNeuralSchemaService.
 *
 * API endpoints consumed:
 *   GET /api/ara-neural/fullkeys                — Stage 1 summary list
 *   GET /api/ara-neural/fullkeys/:groupId       — Stage 2 detail
 *
 * Requests are proxied to http://localhost:3000 by proxy.conf.json during
 * local development.  In production, configure a real API base URL via
 * the environment token (API_BASE_URL) instead of relative paths.
 */
import { inject, Injectable }      from '@angular/core';
import { HttpClient, HttpParams }  from '@angular/common/http';
import { Observable }              from 'rxjs';

import { NeuralSchemaService }     from './neural-schema.service';
import {
  FullKeyDetailResponse,
  FullKeySearchParams,
  FullKeySummaryListResponse,
} from '../models/neural.models';

@Injectable()
export class BackendNeuralSchemaService extends NeuralSchemaService {

  private readonly http    = inject(HttpClient);
  private readonly baseUrl = '/api/ara-neural';   // proxied to backend in dev

  /**
   * Stage 1 — calls GET /api/ara-neural/fullkeys
   * Only defined (non-empty) params are appended to the query string.
   */
  override getFullKeySummaries(
    params?: FullKeySearchParams
  ): Observable<FullKeySummaryListResponse> {
    let httpParams = new HttpParams();
    if (params?.search)   httpParams = httpParams.set('search',   params.search);
    if (params?.region)   httpParams = httpParams.set('region',   params.region);
    if (params?.status)   httpParams = httpParams.set('status',   params.status);
    if (params?.page)     httpParams = httpParams.set('page',     String(params.page));
    if (params?.pageSize) httpParams = httpParams.set('pageSize', String(params.pageSize));

    return this.http.get<FullKeySummaryListResponse>(
      `${this.baseUrl}/fullkeys`,
      { params: httpParams }
    );
  }

  /**
   * Stage 2 — calls GET /api/ara-neural/fullkeys/:groupId
   * Only invoked on user selection — never on initial page load.
   */
  override getFullKeyDetail(groupId: string): Observable<FullKeyDetailResponse> {
    return this.http.get<FullKeyDetailResponse>(
      `${this.baseUrl}/fullkeys/${encodeURIComponent(groupId)}`
    );
  }
}
