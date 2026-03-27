/**
 * ARA NEURAL — SERVICE ABSTRACTION
 * ==================================
 *
 * NeuralSchemaService   — abstract contract all UI components depend on.
 * LocalMockNeuralSchemaService — current implementation using local JSON assets.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * HOW TO MIGRATE TO A REAL BACKEND (for the dev team)
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. Create a new file, e.g. backend-neural-schema.service.ts
 *
 *      @Injectable()
 *      export class BackendNeuralSchemaService extends NeuralSchemaService {
 *        private readonly http = inject(HttpClient);
 *        private readonly baseUrl = inject(API_BASE_URL);  // env token
 *
 *        getFullKeySummaries(params?) {
 *          return this.http.get<FullKeySummaryListResponse>(
 *            `${this.baseUrl}/api/ara-neural/fullkeys`, { params: { ...params } }
 *          );
 *        }
 *
 *        getFullKeyDetail(groupId) {
 *          return this.http.get<FullKeyDetailResponse>(
 *            `${this.baseUrl}/api/ara-neural/fullkeys/${groupId}`
 *          );
 *        }
 *      }
 *
 * 2. In app.config.ts change the one provider line:
 *      { provide: NeuralSchemaService, useClass: BackendNeuralSchemaService }
 *
 * 3. Delete LocalMockNeuralSchemaService and the two local JSON files:
 *      assets/data/neural_schema_summary.json
 *      assets/data/neural_schema.json
 *
 * Zero component changes required.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, shareReplay } from 'rxjs';

import {
  FullKeyDetail,
  FullKeyDetailResponse,
  FullKeySearchParams,
  FullKeySummaryListResponse,
} from '../models/neural.models';

// ── Abstract service contract ─────────────────────────────────────────────────
// Components depend on this. Never depend on the concrete implementation.

export abstract class NeuralSchemaService {
  /**
   * Stage 1 — returns lightweight summary list for the left panel.
   * Maps to: GET /api/ara-neural/fullkeys
   * Safe for large datasets (68k+ groups) because records[] is excluded.
   */
  abstract getFullKeySummaries(
    params?: FullKeySearchParams
  ): Observable<FullKeySummaryListResponse>;

  /**
   * Stage 2 — returns full lineage detail for a single selected FULL_KEY.
   * Called only when the user selects a group — never on initial page load.
   * Maps to: GET /api/ara-neural/fullkeys/{groupId}
   */
  abstract getFullKeyDetail(groupId: string): Observable<FullKeyDetailResponse>;
}

// ── Local mock implementation ─────────────────────────────────────────────────
// TEMPORARY — uses local JSON assets to simulate async backend calls.
// Replace with BackendNeuralSchemaService when the real API is available.

/** Internal shape of the full neural_schema.json file. */
interface _FullSchemaFile {
  version:     string;
  generatedAt: string;
  groups:      FullKeyDetail[];
}

@Injectable()
export class LocalMockNeuralSchemaService extends NeuralSchemaService {

  private readonly http = inject(HttpClient);

  /**
   * The full schema is loaded once and cached via shareReplay(1).
   * This simulates the real per-group API endpoint: when a user selects a
   * group the service does an in-memory lookup from the already-cached file
   * instead of re-fetching from disk.
   *
   * In the real backend implementation this cache is replaced by a genuine
   * per-group HTTP call that only returns that group's payload.
   */
  private readonly _fullSchema$: Observable<_FullSchemaFile> =
    this.http
      .get<_FullSchemaFile>('assets/data/neural_schema.json')
      .pipe(shareReplay(1));

  // ── Simulates: GET /api/ara-neural/fullkeys ────────────────────────────────
  getFullKeySummaries(
    params?: FullKeySearchParams
  ): Observable<FullKeySummaryListResponse> {
    return this.http
      .get<FullKeySummaryListResponse>('assets/data/neural_schema_summary.json')
      .pipe(
        map((response) => {
          if (!params?.search) return response;
          const q = params.search.toLowerCase();
          const filtered = response.items.filter(
            (item) =>
              item.fullKey.toLowerCase().includes(q) ||
              item.region.toLowerCase().includes(q)  ||
              item.platforms.some((p) => p.toLowerCase().includes(q))
          );
          return { ...response, items: filtered, total: filtered.length };
        })
      );
  }

  // ── Simulates: GET /api/ara-neural/fullkeys/{groupId} ─────────────────────
  getFullKeyDetail(groupId: string): Observable<FullKeyDetailResponse> {
    return this._fullSchema$.pipe(
      map((schema) => {
        const group = schema.groups.find((g) => g.groupId === groupId);
        if (!group) {
          throw new Error(`[NeuralService] Group not found: ${groupId}`);
        }
        return { groupId, detail: group };
      })
    );
  }
}
