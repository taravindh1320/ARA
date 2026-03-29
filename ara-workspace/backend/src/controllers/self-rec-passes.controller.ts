import { Request, Response } from 'express';

export type MatchType = 'exact' | 'tolerance' | 'manual';

export interface PassKey {
  sourceAField: string;
  sourceBField: string;
}

export interface PassConfig {
  id: string;
  name: string;
  order: number;
  enabled: boolean;
  matchType: MatchType;
  keys: PassKey[];
  toleranceValue?: number;       // absolute tolerance, e.g. 0.01
  tolerancePercent?: number;     // % tolerance, e.g. 0.5
  description?: string;
}

export interface SavePassesRequest {
  passes: PassConfig[];
}

export interface SavePassesResponse {
  saved: boolean;
  passSetId: string;
  passCount: number;
}

// ── In-memory store (dev only) ─────────────────────────────────────────────
let activePasses: PassConfig[] = [];
let passSetCounter = 0;

export class SelfRecPassesController {

  // GET /api/ara-self-rec/passes
  static getPasses = (_req: Request, res: Response): void => {
    res.status(200).json({ passes: activePasses });
  };

  // POST /api/ara-self-rec/passes
  static savePasses = (req: Request, res: Response): void => {
    const body = req.body as SavePassesRequest;

    if (!Array.isArray(body?.passes)) {
      res.status(400).json({ error: 'passes array is required.' });
      return;
    }

    // Normalise orders to be sequential
    activePasses = body.passes.map((p, i) => ({ ...p, order: i + 1 }));
    passSetCounter += 1;
    const passSetId = `PS-${String(passSetCounter).padStart(4, '0')}`;

    const response: SavePassesResponse = {
      saved: true,
      passSetId,
      passCount: activePasses.length,
    };

    res.status(200).json(response);
  };
}
