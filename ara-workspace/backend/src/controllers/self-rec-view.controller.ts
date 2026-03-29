import { Request, Response } from 'express';

export type ResultCategory = 'matched' | 'unmatched' | 'exceptions' | 'breaks';
export type SortDirection   = 'asc' | 'desc';

export interface ViewColumn {
  field: string;           // logical field name (e.g. "TradeId" or mapped pair label)
  source: 'A' | 'B' | 'both';
  visible: boolean;
  label?: string;          // display override
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
  id: string;             // 'matched' | 'unmatched' | 'breaks' | 'exceptions' | 'match_rate'
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

export interface SaveViewRequest {
  view: ViewConfig;
}

export interface SaveViewResponse {
  saved: boolean;
  viewId: string;
}

// ── In-memory store (dev only) ──────────────────────────────────────────────
let activeView: ViewConfig | null = null;
let viewCounter = 0;

export class SelfRecViewController {

  // GET /api/ara-self-rec/view
  static getView = (_req: Request, res: Response): void => {
    res.status(200).json({ view: activeView });
  };

  // POST /api/ara-self-rec/view
  static saveView = (req: Request, res: Response): void => {
    const body = req.body as SaveViewRequest;

    if (!body?.view || typeof body.view !== 'object') {
      res.status(400).json({ error: 'view object is required.' });
      return;
    }

    activeView = body.view;
    viewCounter += 1;
    const viewId = `VW-${String(viewCounter).padStart(4, '0')}`;

    const response: SaveViewResponse = { saved: true, viewId };
    res.status(200).json(response);
  };
}
