/**
 * NeuralDataService
 * =================
 * Loads neural_schema.json once at startup into memory.
 * Exposes getSummaries() and getDetail() — the sole data access layer.
 *
 * In a production backend this module would be replaced by DB queries
 * (e.g. PostgreSQL / MongoDB).  The controller layer stays the same.
 */
import fs   from 'fs';
import path from 'path';
import { config } from '../config';
import type {
  FullKeyGroup,
  FullKeySummaryItem,
  SchemaFile,
  SummaryListResponse,
  SummaryQueryParams,
  DetailResponse,
} from '../models/neural.types';

// ── In-memory store ───────────────────────────────────────────────────────────

let _groups: FullKeyGroup[] = [];

// ── Private helpers ───────────────────────────────────────────────────────────

function toSummaryItem(g: FullKeyGroup): FullKeySummaryItem {
  return {
    groupId:        g.groupId,
    fullKey:        g.fullKey,
    region:         g.summary.region,
    recordCount:    g.summary.recordCount,
    countryCount:   g.summary.countryCount,
    reviewStatuses: g.summary.reviewStatuses,
    platforms:      g.summary.platforms,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export const NeuralDataService = {
  /**
   * Load the full schema JSON into memory.
   * Called once during server startup — not on every request.
   */
  load(): Promise<void> {
    const filePath = path.resolve(config.dataFilePath);
    return new Promise((resolve, reject) => {
      fs.readFile(filePath, 'utf-8', (err, raw) => {
        if (err) {
          reject(new Error(`[NeuralDataService] Cannot read data file: ${filePath}\n${err.message}`));
          return;
        }
        try {
          const schema: SchemaFile = JSON.parse(raw);
          _groups = schema.groups ?? [];
          console.log(`[NeuralDataService] Loaded ${_groups.length} groups  (generatedAt: ${schema.generatedAt})`);
          resolve();
        } catch (parseErr) {
          reject(new Error(`[NeuralDataService] Failed to parse JSON: ${(parseErr as Error).message}`));
        }
      });
    });
  },

  /**
   * GET /api/ara-neural/fullkeys
   * Returns a paginated, filtered summary list — no records[] in payload.
   */
  getSummaries(params: SummaryQueryParams): SummaryListResponse {
    let results = _groups;

    // Free-text search across fullKey, region, platforms
    if (params.search) {
      const q = params.search.toLowerCase();
      results = results.filter(g =>
        g.fullKey.toLowerCase().includes(q) ||
        g.summary.region.toLowerCase().includes(q) ||
        g.summary.platforms.some(p => p.toLowerCase().includes(q))
      );
    }

    // Exact region filter (case-insensitive)
    if (params.region) {
      const r = params.region.toUpperCase();
      results = results.filter(g => g.summary.region.toUpperCase() === r);
    }

    // Status filter — match any reviewStatus in the group
    if (params.status) {
      const s = params.status.toLowerCase();
      results = results.filter(g =>
        g.summary.reviewStatuses.some(rs => rs.toLowerCase() === s)
      );
    }

    const total    = results.length;
    const page     = Math.max(1,   params.page     ?? 1);
    const pageSize = Math.min(500, Math.max(1, params.pageSize ?? 100));
    const start    = (page - 1) * pageSize;
    const items    = results.slice(start, start + pageSize).map(toSummaryItem);

    return { total, page, pageSize, items };
  },

  /**
   * GET /api/ara-neural/fullkeys/:groupId
   * Returns the full group detail including all records[].
   * Returns undefined if groupId is not found.
   */
  getDetail(groupId: string): DetailResponse | undefined {
    const group = _groups.find(g => g.groupId === groupId);
    if (!group) return undefined;
    return { groupId: group.groupId, detail: group };
  },
};
