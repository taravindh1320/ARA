export interface StoredRunRecord {
  summary: {
    totalA: number;
    totalB: number;
    matched: number;
    unmatched: number;
    breaks: number;
    exceptions: number;
    matchRate: number;
  };
  passes: Array<{ id: string; name: string }>;
  fieldPairs: Array<{ sourceAField: string; sourceBField: string }>;
}

const store = new Map<string, StoredRunRecord>();

export function setRunRecord(runId: string, record: StoredRunRecord): void {
  store.set(runId, record);
}

export function getRunRecord(runId: string): StoredRunRecord | undefined {
  return store.get(runId);
}
