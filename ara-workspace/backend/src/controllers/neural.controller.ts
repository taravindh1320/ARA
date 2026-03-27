import { Request, Response } from 'express';
import { NeuralDataService } from '../services/neural.service';

// Simple alphanumeric + hyphen/underscore guard for groupId path param
const GROUP_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

export const NeuralController = {
  /**
   * GET /api/ara-neural/fullkeys
   * Supported query params: search, region, status, page, pageSize
   */
  listFullKeys(req: Request, res: Response): void {
    const q = req.query as Record<string, string | undefined>;

    const page     = q['page']     ? Number(q['page'])     : undefined;
    const pageSize = q['pageSize'] ? Number(q['pageSize']) : undefined;

    if (page     !== undefined && (isNaN(page)     || page     < 1)) { res.status(400).json({ error: 'Invalid page parameter.'     }); return; }
    if (pageSize !== undefined && (isNaN(pageSize) || pageSize < 1)) { res.status(400).json({ error: 'Invalid pageSize parameter.' }); return; }

    const result = NeuralDataService.getSummaries({
      search:   q['search'],
      region:   q['region'],
      status:   q['status'],
      page,
      pageSize,
    });

    res.json(result);
  },

  /**
   * GET /api/ara-neural/fullkeys/:groupId
   * Returns the full lineage detail for a single FULL_KEY group.
   */
  getFullKeyDetail(req: Request, res: Response): void {
    const groupId = String(req.params['groupId'] ?? '');

    if (!GROUP_ID_PATTERN.test(groupId)) {
      res.status(400).json({ error: 'Invalid groupId format.' });
      return;
    }

    const result = NeuralDataService.getDetail(groupId);
    if (!result) {
      res.status(404).json({ error: `FULL_KEY group '${groupId}' not found.` });
      return;
    }

    res.json(result);
  },
};
