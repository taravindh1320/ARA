import { Request, Response } from 'express';

export interface MappingRow {
  sourceAField: string;
  sourceBField: string | null; // null = unmapped
  confidence: 'high' | 'low' | 'none';
}

export interface SuggestRequest {
  columnsA: string[];
  columnsB: string[];
}

export interface SuggestResponse {
  mappings: MappingRow[];
}

export interface SaveMappingRequest {
  mappings: MappingRow[];
}

export interface SaveMappingResponse {
  saved: boolean;
  mappingId: string;
  mappedCount: number;
}

// ── Heuristic name-similarity scorer ─────────────────────────────────────────
// Normalise: lowercase, strip non-alphanumeric, common abbreviation expansions.
const ABBR: Record<string, string> = {
  ccy:    'currency',
  txn:    'transaction',
  ref:    'reference',
  id:     'id',
  dt:     'date',
  amt:    'amount',
  qty:    'quantity',
  sec:    'security',
  acct:   'account',
  cpty:   'counterparty',
  stl:    'settlement',
  val:    'value',
  bkg:    'booking',
  dir:    'direction',
  prc:    'price',
  pnl:    'pnl',
  desc:   'description',
};

function normalise(s: string): string {
  const tokens = s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/);
  return tokens.map(t => ABBR[t] ?? t).join(' ');
}

function similarity(a: string, b: string): number {
  const na = normalise(a);
  const nb = normalise(b);
  if (na === nb) return 1;
  const wordsA = new Set(na.split(' '));
  const wordsB = new Set(nb.split(' '));
  const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
  const union = new Set([...wordsA, ...wordsB]).size;
  return union === 0 ? 0 : intersection / union;
}

// ── In-memory store (dev only) ────────────────────────────────────────────────
let latestMapping: MappingRow[] = [];
let mappingCounter = 0;

export class SelfRecMappingController {

  // POST /api/ara-self-rec/mapping/suggest
  static suggest = (req: Request, res: Response): void => {
    const body = req.body as SuggestRequest;

    if (!Array.isArray(body?.columnsA) || !Array.isArray(body?.columnsB)) {
      res.status(400).json({ error: 'columnsA and columnsB are required arrays.' });
      return;
    }

    const usedB = new Set<string>();

    const mappings: MappingRow[] = body.columnsA.map(colA => {
      let bestField: string | null = null;
      let bestScore = 0;

      for (const colB of body.columnsB) {
        if (usedB.has(colB)) continue;
        const score = similarity(colA, colB);
        if (score > bestScore) {
          bestScore = score;
          bestField = colB;
        }
      }

      // only suggest if score is meaningful
      const threshold = 0.3;
      if (bestScore >= threshold && bestField) {
        usedB.add(bestField);
        return {
          sourceAField: colA,
          sourceBField: bestField,
          confidence: bestScore >= 0.7 ? 'high' : 'low',
        };
      }

      return { sourceAField: colA, sourceBField: null, confidence: 'none' };
    });

    const response: SuggestResponse = { mappings };
    res.status(200).json(response);
  };

  // POST /api/ara-self-rec/mapping
  static saveMapping = (req: Request, res: Response): void => {
    const body = req.body as SaveMappingRequest;

    if (!Array.isArray(body?.mappings)) {
      res.status(400).json({ error: 'mappings array is required.' });
      return;
    }

    latestMapping = body.mappings;
    mappingCounter += 1;
    const mappingId = `MAP-${String(mappingCounter).padStart(4, '0')}`;

    const response: SaveMappingResponse = {
      saved: true,
      mappingId,
      mappedCount: body.mappings.filter(m => m.sourceBField !== null).length,
    };

    res.status(200).json(response);
  };
}
