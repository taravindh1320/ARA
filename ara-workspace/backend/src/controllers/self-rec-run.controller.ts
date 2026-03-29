import { Request, Response } from 'express';
import { setRunRecord } from './self-rec-run-store';

let runCounter = 0;

export class SelfRecRunController {
  static async runRecon(req: Request, res: Response): Promise<void> {
    const { sourceA, sourceB, passes, mapping, view, submittedBy, runMode = 'preview' } = req.body;

    if (!sourceA || !sourceB) {
      res.status(400).json({ error: 'sourceA and sourceB are required' });
      return;
    }

    // Simulate processing time (800 ms)
    await new Promise<void>(r => setTimeout(r, 800));

    const runId = `RUN-${String(++runCounter).padStart(4, '0')}`;

    const passCount  = Array.isArray(passes) ? passes.length : 1;
    const pairCount  = Array.isArray(mapping?.fieldPairs) ? mapping.fieldPairs.length : 0;

    // Normalise pass list for the store (need id + name only)
    const passStore = Array.isArray(passes)
      ? passes.map((p: any) => ({ id: p.id ?? '', name: p.name ?? `Pass ${p.id}` }))
      : [];
    const fieldPairStore = Array.isArray(mapping?.fieldPairs) ? mapping.fieldPairs : [];

    // Derive row counts — fall back to sensible defaults
    const totalA = typeof sourceA.rowCount === 'number' ? sourceA.rowCount : 1000;
    const totalB = typeof sourceB.rowCount === 'number' ? sourceB.rowCount : 1000;

    // Simulated match rate improves with more passes and mapped fields
    const baseRate    = 0.70;
    const passBoost   = passCount  * 0.05;
    const fieldBoost  = Math.min(pairCount * 0.005, 0.10);
    const matchRate   = Math.min(baseRate + passBoost + fieldBoost, 0.99);

    const matched    = Math.round(Math.min(totalA, totalB) * matchRate);
    const unmatched  = Math.max(totalA + totalB - matched * 2, 0);
    const breaks     = Math.round(matched * 0.03);
    const exceptions = Math.round(matched * 0.008);

    const summary = {
      totalA,
      totalB,
      matched,
      unmatched,
      breaks,
      exceptions,
      matchRate: parseFloat(((matched / Math.min(totalA, totalB)) * 100).toFixed(2)),
    };

    // Persist for the results endpoint
    setRunRecord(runId, { summary, passes: passStore, fieldPairs: fieldPairStore });

    res.json({
      runId,
      status: 'complete',
      submittedAt: new Date().toISOString(),
      runMode,
      submittedBy: submittedBy || 'anonymous',
      summary,
      message: runMode === 'preview'
        ? 'Preview run complete. No changes committed.'
        : 'Execute run complete. Results committed.',
    });
  }
}
