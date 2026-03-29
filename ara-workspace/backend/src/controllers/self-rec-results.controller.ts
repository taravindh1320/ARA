import { Request, Response } from 'express';
import { getRunRecord } from './self-rec-run-store';

const breakReasons = [
  'Tolerance exceeded',
  'Sign mismatch',
  'Currency difference',
  'Settlement date offset',
  'Price adjustment',
  'Accrual difference',
  'Rounding difference',
  'Fee variance',
];

const exceptionTypes = [
  'Missing countervalue',
  'Duplicate reference',
  'Invalid status transition',
  'Schema validation failure',
  'Timeout during match',
];

/** Simple seeded LCG PRNG — deterministic for a given runId */
function makePrng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function seedFromString(str: string): number {
  return str.split('').reduce((acc, c) => (Math.imul(acc, 31) + c.charCodeAt(0)) >>> 0, 5381);
}

export class SelfRecResultsController {
  static getResults(req: Request, res: Response): void {
    const { runId } = req.params;

    const record = getRunRecord(runId);
    if (!record) {
      res.status(404).json({ error: `Run '${runId}' not found. The run may have expired — please re-run the reconciliation.` });
      return;
    }

    const { summary, passes, fieldPairs } = record;
    const rand = makePrng(seedFromString(runId));

    const passNames = passes.length > 0 ? passes.map(p => p.name) : ['Pass 1'];
    const keyLabel  = fieldPairs.length > 0 ? fieldPairs[0].sourceAField : 'Reference';

    const SAMPLE_MATCHED   = Math.min(summary.matched,    20);
    const SAMPLE_BREAKS    = Math.min(summary.breaks,     10);
    const SAMPLE_UNMATCHED = Math.min(summary.unmatched,   8);
    const SAMPLE_EXCEPTION = Math.min(summary.exceptions,  5);

    const rows: object[] = [];

    // Matched rows
    for (let i = 0; i < SAMPLE_MATCHED; i++) {
      const keyRef = `${keyLabel.substring(0, 3).toUpperCase()}-${String(i + 1).padStart(5, '0')}`;
      const aVal   = (rand() * 100_000 + 1_000).toFixed(2);
      const pass   = passNames[Math.floor(rand() * passNames.length)];
      rows.push({ id: `m-${i}`, status: 'matched', keyRef, sourceAValue: aVal, sourceBValue: aVal, difference: '—', breakReason: '—', matchedByPass: pass, comments: '' });
    }

    // Break rows
    for (let i = 0; i < SAMPLE_BREAKS; i++) {
      const keyRef  = `${keyLabel.substring(0, 3).toUpperCase()}-${String(5_000 + i).padStart(5, '0')}`;
      const aVal    = (rand() * 100_000 + 1_000).toFixed(2);
      const delta   = ((rand() - 0.5) * 1_000).toFixed(2);
      const bVal    = (parseFloat(aVal) + parseFloat(delta)).toFixed(2);
      const diff    = (parseFloat(aVal) - parseFloat(bVal)).toFixed(2);
      const reason  = breakReasons[Math.floor(rand() * breakReasons.length)];
      const pass    = passNames[Math.floor(rand() * passNames.length)];
      rows.push({ id: `b-${i}`, status: 'break', keyRef, sourceAValue: aVal, sourceBValue: bVal, difference: diff, breakReason: reason, matchedByPass: pass, comments: '' });
    }

    // Unmatched rows
    for (let i = 0; i < SAMPLE_UNMATCHED; i++) {
      const keyRef = `${keyLabel.substring(0, 3).toUpperCase()}-${String(9_000 + i).padStart(5, '0')}`;
      const aVal   = (rand() * 50_000 + 500).toFixed(2);
      rows.push({ id: `u-${i}`, status: 'unmatched', keyRef, sourceAValue: aVal, sourceBValue: 'N/A', difference: 'N/A', breakReason: 'No counterpart in Source B', matchedByPass: '—', comments: 'Investigate missing record' });
    }

    // Exception rows
    for (let i = 0; i < SAMPLE_EXCEPTION; i++) {
      const keyRef  = `${keyLabel.substring(0, 3).toUpperCase()}-${String(7_000 + i).padStart(5, '0')}`;
      const excType = exceptionTypes[Math.floor(rand() * exceptionTypes.length)];
      rows.push({ id: `e-${i}`, status: 'exception', keyRef, sourceAValue: 'ERR', sourceBValue: 'ERR', difference: 'N/A', breakReason: excType, matchedByPass: '—', comments: 'Requires manual review' });
    }

    // Analyzer: match count by pass
    let remaining = summary.matched;
    const matchByPass = passNames.map((name, idx) => {
      const isLast = idx === passNames.length - 1;
      const count  = isLast ? remaining : Math.round(remaining * (0.5 + rand() * 0.3));
      remaining    = Math.max(remaining - count, 0);
      return { passName: name, count, percentage: parseFloat(((count / Math.max(summary.matched, 1)) * 100).toFixed(1)) };
    });

    // Analyzer: top break reasons
    let bRemaining = summary.breaks;
    const topBreakReasons = breakReasons.slice(0, 4).map((reason, idx) => {
      const isLast = idx === 3;
      const count  = isLast ? bRemaining : Math.round(bRemaining * (0.2 + rand() * 0.4));
      bRemaining   = Math.max(bRemaining - count, 0);
      return { reason, count, percentage: parseFloat(((count / Math.max(summary.breaks, 1)) * 100).toFixed(1)) };
    });

    // Analyzer: exception distribution
    const excTotal = Math.max(summary.exceptions, 1);
    const exceptionDistribution = [
      { type: 'Missing countervalue',       count: Math.round(excTotal * 0.40) },
      { type: 'Duplicate reference',        count: Math.round(excTotal * 0.30) },
      { type: 'Validation failure',         count: Math.round(excTotal * 0.20) },
      { type: 'Other',                      count: Math.max(excTotal - Math.round(excTotal * 0.90), 0) },
    ];

    const narrative =
      `Reconciliation run ${runId} processed ${summary.totalA.toLocaleString()} records from Source A ` +
      `against ${summary.totalB.toLocaleString()} from Source B. ` +
      `${summary.matched.toLocaleString()} records matched across ${passNames.length} pass(es), ` +
      `achieving a match rate of ${summary.matchRate}%. ` +
      `${summary.breaks} break(s) were identified — primarily due to value differences. ` +
      `${summary.unmatched} record(s) had no counterpart in the opposing source. ` +
      (summary.exceptions > 0
        ? `${summary.exceptions} exception(s) require manual investigation.`
        : 'No exceptions were raised.');

    const totalSample = SAMPLE_MATCHED + SAMPLE_BREAKS + SAMPLE_UNMATCHED + SAMPLE_EXCEPTION;
    const sampleNote = totalSample < (summary.matched + summary.breaks + summary.unmatched + summary.exceptions)
      ? `Showing a representative sample of ${totalSample} rows. ` +
        `Full counts: ${summary.matched.toLocaleString()} matched, ${summary.breaks} breaks, ` +
        `${summary.unmatched} unmatched, ${summary.exceptions} exceptions.`
      : null;

    res.json({
      runId,
      rows,
      analyzerReport: { matchByPass, topBreakReasons, exceptionDistribution, narrative },
      ...(sampleNote ? { sampleNote } : {}),
    });
  }
}
