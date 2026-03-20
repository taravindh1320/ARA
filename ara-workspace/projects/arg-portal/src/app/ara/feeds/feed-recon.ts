import {
  Component, OnInit, OnDestroy, computed, inject, signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { PageHeaderComponent, Breadcrumb } from '../shared/page-header/page-header';

// ── Types ─────────────────────────────────────────────────────────────

export type FeedType = 'abacus' | 'rf' | 'dsmt' | 'fails';
export type ReconStatus =
  | 'Matched'
  | 'Missing in ARA'
  | 'Missing in Source'
  | 'Value Mismatch'
  | 'Format Mismatch'
  | 'Duplicate'
  | 'Exception';

export interface AraDataset {
  feedType:   FeedType;
  feedName:   string;
  sourceType: string;
  lastLoaded: string;
  rowCount:   number;
  batchId:    string;
  status:     'Current' | 'Stale' | 'Processing';
  region:     string;
  description: string;
}

export interface UploadedFile {
  name:      string;
  sizeKb:    number;
  rows:      number;
  uploadedAt: string;
  encoding:  string;
}

export interface ComparisonRow {
  id:           string;
  status:       ReconStatus;
  keyRef:       string;
  araValue:     string;
  sourceValue:  string;
  diffType:     string;
  feedName:     string;
  region:       string;
  loadDate:     string;
  comments:     string;
  // detail snapshot
  araSnapshot:   Record<string, string>;
  srcSnapshot:   Record<string, string>;
}

export interface ReconSummary {
  totalAra:         number;
  totalSource:      number;
  matched:          number;
  missingInAra:     number;
  missingInSource:  number;
  mismatched:       number;
  exceptions:       number;
}

// ── Static metadata per feed ──────────────────────────────────────────

const FEED_META: Record<FeedType, AraDataset> = {
  abacus: {
    feedType: 'abacus',
    feedName: 'ARA Abacus Feed',
    sourceType: 'Abacus System',
    lastLoaded: '2026-03-20 05:00',
    rowCount: 182_311,
    batchId: 'BATCH-ABA-20260320-001',
    status: 'Current',
    region: 'GLOBAL',
    description: 'Daily full account reconciliation between ARA and Abacus booking system.',
  },
  rf: {
    feedType: 'rf',
    feedName: 'RF Feed',
    sourceType: 'Recon Framework',
    lastLoaded: '2026-03-20 06:00',
    rowCount: 94_800,
    batchId: 'BATCH-RF-20260320-001',
    status: 'Current',
    region: 'GLOBAL',
    description: 'Reconciliation Framework position & balance inbound feed from clearing systems.',
  },
  dsmt: {
    feedType: 'dsmt',
    feedName: 'DSMT Feed',
    sourceType: 'DSMT Platform',
    lastLoaded: '2026-03-19 23:30',
    rowCount: 41_204,
    batchId: 'BATCH-DSMT-20260319-002',
    status: 'Stale',
    region: 'EMEA',
    description: 'Data Sourcing & Management Tool inbound reference and position snapshot.',
  },
  fails: {
    feedType: 'fails',
    feedName: 'Fails Feed',
    sourceType: 'Settlement Engine',
    lastLoaded: '2026-03-20 07:15',
    rowCount: 3_280,
    batchId: 'BATCH-FAILS-20260320-001',
    status: 'Current',
    region: 'GLOBAL',
    description: 'Settlement fails and near-fails extracted from the settlement engine.',
  },
};

// ── Mock comparison result builders ──────────────────────────────────

function makeRow(
  id: string, status: ReconStatus, keyRef: string,
  araVal: string, srcVal: string, diffType: string,
  feedName: string, region: string, loadDate: string, comments: string,
  araSnap: Record<string,string>, srcSnap: Record<string,string>
): ComparisonRow {
  return { id, status, keyRef, araValue: araVal, sourceValue: srcVal,
    diffType, feedName, region, loadDate, comments,
    araSnapshot: araSnap, srcSnapshot: srcSnap };
}

function mockResults(ft: FeedType): ComparisonRow[] {
  const d = FEED_META[ft];
  const fn = d.feedName;
  const reg = d.region;
  const ld = '2026-03-20';

  if (ft === 'abacus') return [
    makeRow('R001','Matched',       'ABA-UK-88421',   '882,100.00','882,100.00','—',            fn,reg,ld,'Exact match on all key fields.',{ Account:'ABA-UK-88421',Amount:'882,100.00',Currency:'GBP',Status:'Active' },{ Account:'ABA-UK-88421',Amount:'882,100.00',Currency:'GBP',Status:'Active' }),
    makeRow('R002','Value Mismatch','ABA-DE-44102',   '441,020.00','441,250.50','Amount delta',  fn,reg,ld,'ARA amount differs by +230.50 from Abacus source snapshot.',{ Account:'ABA-DE-44102',Amount:'441,020.00',Currency:'EUR',Status:'Active' },{ Account:'ABA-DE-44102',Amount:'441,250.50',Currency:'EUR',Status:'Active' }),
    makeRow('R003','Matched',       'ABA-SG-22904',   '229,040.00','229,040.00','—',            fn,reg,ld,'',{ Account:'ABA-SG-22904',Amount:'229,040.00',Currency:'SGD',Status:'Active' },{ Account:'ABA-SG-22904',Amount:'229,040.00',Currency:'SGD',Status:'Active' }),
    makeRow('R004','Missing in ARA','ABA-HK-61831',   '—',         '618,310.00','Not in ARA',   fn,reg,ld,'Record present in source but not loaded into ARA. Possible batch gap.',{ },{ Account:'ABA-HK-61831',Amount:'618,310.00',Currency:'HKD',Status:'Active' }),
    makeRow('R005','Matched',       'ABA-US-77410',   '774,100.00','774,100.00','—',            fn,reg,ld,'',{ Account:'ABA-US-77410',Amount:'774,100.00',Currency:'USD',Status:'Active' },{ Account:'ABA-US-77410',Amount:'774,100.00',Currency:'USD',Status:'Active' }),
    makeRow('R006','Missing in Source','ABA-CA-30021','300,210.00','—',         'Not in Source',fn,reg,ld,'Record in ARA with no matching source entry. Flagged for manual review.',{ Account:'ABA-CA-30021',Amount:'300,210.00',Currency:'CAD',Status:'Pending' },{ }),
    makeRow('R007','Value Mismatch','ABA-BR-18844',   '188,440.00','190,000.00','Amount delta',  fn,reg,ld,'ARA shows 188,440 vs source 190,000. Tolerance exceeded.',{ Account:'ABA-BR-18844',Amount:'188,440.00',Currency:'BRL',Status:'Active' },{ Account:'ABA-BR-18844',Amount:'190,000.00',Currency:'BRL',Status:'Active' }),
    makeRow('R008','Matched',       'ABA-MX-25510',   '255,100.00','255,100.00','—',            fn,reg,ld,'',{ Account:'ABA-MX-25510',Amount:'255,100.00',Currency:'MXN',Status:'Active' },{ Account:'ABA-MX-25510',Amount:'255,100.00',Currency:'MXN',Status:'Active' }),
    makeRow('R009','Format Mismatch','ABA-UAE-93210', '932,100.00','932100',    'Format delta', fn,reg,ld,'Source file uses integer format without decimal separator.',{ Account:'ABA-UAE-93210',Amount:'932,100.00',Currency:'AED',Status:'Active' },{ Account:'ABA-UAE-93210',Amount:'932100',Currency:'AED',Status:'Active' }),
    makeRow('R010','Duplicate',     'ABA-IN-40188',   '401,880.00','401,880.00','Duplicate key',fn,reg,ld,'Source file contains 2 rows for this account key. Flagged for dedup.',{ Account:'ABA-IN-40188',Amount:'401,880.00',Currency:'INR',Status:'Active' },{ Account:'ABA-IN-40188',Amount:'401,880.00',Currency:'INR',Status:'Duplicate' }),
    makeRow('R011','Exception',     'ABA-FR-55010',   '550,100.00','—',         'Exception',    fn,reg,ld,'ARA record has validation error flag — excluded from recon scope.',{ Account:'ABA-FR-55010',Amount:'550,100.00',Currency:'EUR',Status:'Exception' },{ }),
    makeRow('R012','Matched',       'ABA-JP-70204',   '702,040.00','702,040.00','—',            fn,reg,ld,'',{ Account:'ABA-JP-70204',Amount:'702,040.00',Currency:'JPY',Status:'Active' },{ Account:'ABA-JP-70204',Amount:'702,040.00',Currency:'JPY',Status:'Active' }),
  ];

  if (ft === 'rf') return [
    makeRow('R001','Matched',         'RF-POS-001122','1,201,400','1,201,400','—',             fn,reg,ld,'',{ Position:'RF-POS-001122',Balance:'1,201,400',CCY:'USD',Source:'Clear' },{ Position:'RF-POS-001122',Balance:'1,201,400',CCY:'USD',Source:'Clear' }),
    makeRow('R002','Value Mismatch',  'RF-POS-002244','980,200',  '981,100',  'Balance delta', fn,reg,ld,'Balance differs by 900. Possible intraday movement.',{ Position:'RF-POS-002244',Balance:'980,200',CCY:'EUR' },{ Position:'RF-POS-002244',Balance:'981,100',CCY:'EUR' }),
    makeRow('R003','Missing in ARA',  'RF-POS-003310','—',        '441,900',  'Not in ARA',    fn,reg,ld,'Source record not present in ARA position store.',{ },{ Position:'RF-POS-003310',Balance:'441,900',CCY:'GBP' }),
    makeRow('R004','Matched',         'RF-POS-004418','322,000',  '322,000',  '—',             fn,reg,ld,'',{ Position:'RF-POS-004418',Balance:'322,000',CCY:'HKD' },{ Position:'RF-POS-004418',Balance:'322,000',CCY:'HKD' }),
    makeRow('R005','Missing in Source','RF-POS-005509','190,500', '—',        'Not in Source', fn,reg,ld,'ARA record has no match in source file.',{ Position:'RF-POS-005509',Balance:'190,500',CCY:'SGD' },{ }),
    makeRow('R006','Exception',       'RF-POS-006612','—',        '—',        'Exception',     fn,reg,ld,'Record flagged by RF validation engine. Manual investigation required.',{ Position:'RF-POS-006612',Status:'Error' },{ Position:'RF-POS-006612',Status:'Error' }),
    makeRow('R007','Matched',         'RF-POS-007714','88,200',   '88,200',   '—',             fn,reg,ld,'',{ Position:'RF-POS-007714',Balance:'88,200',CCY:'INR' },{ Position:'RF-POS-007714',Balance:'88,200',CCY:'INR' }),
    makeRow('R008','Value Mismatch',  'RF-POS-008820','2,140,000','2,180,000','Balance delta', fn,reg,ld,'Significant delta detected. Escalate to RF team.',{ Position:'RF-POS-008820',Balance:'2,140,000',CCY:'USD' },{ Position:'RF-POS-008820',Balance:'2,180,000',CCY:'USD' }),
  ];

  if (ft === 'dsmt') return [
    makeRow('R001','Matched',        'DSMT-REF-00114','ACTIVE',   'ACTIVE',   '—',             fn,'EMEA',ld,'',{ Key:'DSMT-REF-00114',Status:'ACTIVE',Type:'Instrument' },{ Key:'DSMT-REF-00114',Status:'ACTIVE',Type:'Instrument' }),
    makeRow('R002','Value Mismatch', 'DSMT-REF-00227','ACTIVE',   'INACTIVE', 'Status delta',  fn,'EMEA',ld,'DSMT has record as INACTIVE while ARA shows ACTIVE.',{ Key:'DSMT-REF-00227',Status:'ACTIVE' },{ Key:'DSMT-REF-00227',Status:'INACTIVE' }),
    makeRow('R003','Missing in ARA', 'DSMT-REF-00388','—',        'ACTIVE',   'Not in ARA',    fn,'APAC',ld,'New DSMT reference not yet loaded into ARA.',{ },{ Key:'DSMT-REF-00388',Status:'ACTIVE',Type:'CounterParty' }),
    makeRow('R004','Matched',        'DSMT-REF-00412','PENDING',  'PENDING',  '—',             fn,'APAC',ld,'',{ Key:'DSMT-REF-00412',Status:'PENDING' },{ Key:'DSMT-REF-00412',Status:'PENDING' }),
    makeRow('R005','Format Mismatch','DSMT-REF-00501','2026-03-20','20260320','Date format',    fn,'NAM', ld,'Date format inconsistency between ARA (ISO) and DSMT (YYYYMMDD).',{ Key:'DSMT-REF-00501',Date:'2026-03-20' },{ Key:'DSMT-REF-00501',Date:'20260320' }),
    makeRow('R006','Matched',        'DSMT-REF-00631','ACTIVE',   'ACTIVE',   '—',             fn,'LATAM',ld,'',{ Key:'DSMT-REF-00631',Status:'ACTIVE' },{ Key:'DSMT-REF-00631',Status:'ACTIVE' }),
  ];

  // falls
  return [
    makeRow('R001','Matched',         'FAIL-20260320-001','USD 1,200,000','USD 1,200,000','—',          fn,reg,ld,'',{ FailRef:'FAIL-20260320-001',Notional:'1,200,000',CCY:'USD',Reason:'Counterparty' },{ FailRef:'FAIL-20260320-001',Notional:'1,200,000',CCY:'USD',Reason:'Counterparty' }),
    makeRow('R002','Value Mismatch',  'FAIL-20260320-002','EUR 450,000',  'EUR 455,000',  'Notional delta',fn,reg,ld,'Notional delta of EUR 5,000.',{ FailRef:'FAIL-20260320-002',Notional:'450,000',CCY:'EUR' },{ FailRef:'FAIL-20260320-002',Notional:'455,000',CCY:'EUR' }),
    makeRow('R003','Missing in ARA',  'FAIL-20260320-003','—',            'GBP 820,000',  'Not in ARA',    fn,reg,ld,'Fail reported by settlement engine not captured in ARA fails store.',{ },{ FailRef:'FAIL-20260320-003',Notional:'820,000',CCY:'GBP' }),
    makeRow('R004','Matched',         'FAIL-20260320-004','JPY 98,000,000','JPY 98,000,000','—',           fn,reg,ld,'',{ FailRef:'FAIL-20260320-004',Notional:'98,000,000',CCY:'JPY' },{ FailRef:'FAIL-20260320-004',Notional:'98,000,000',CCY:'JPY' }),
    makeRow('R005','Exception',       'FAIL-20260320-005','—',            '—',            'Exception',     fn,reg,ld,'Settlement system flagged this fail as disputed. Excluded from auto-recon.',{ FailRef:'FAIL-20260320-005',Status:'Disputed' },{ FailRef:'FAIL-20260320-005',Status:'Disputed' }),
    makeRow('R006','Missing in Source','FAIL-20260320-006','HKD 310,000', '—',            'Not in Source',fn,reg,ld,'ARA holds this fail but source extract does not include it.',{ FailRef:'FAIL-20260320-006',Notional:'310,000',CCY:'HKD' },{ }),
  ];
}

function computeSummary(rows: ComparisonRow[]): ReconSummary {
  return {
    totalAra:        rows.filter(r => r.araValue !== '—').length,
    totalSource:     rows.filter(r => r.sourceValue !== '—').length,
    matched:         rows.filter(r => r.status === 'Matched').length,
    missingInAra:    rows.filter(r => r.status === 'Missing in ARA').length,
    missingInSource: rows.filter(r => r.status === 'Missing in Source').length,
    mismatched:      rows.filter(r => r.status === 'Value Mismatch' || r.status === 'Format Mismatch' || r.status === 'Duplicate').length,
    exceptions:      rows.filter(r => r.status === 'Exception').length,
  };
}

// ── Component ─────────────────────────────────────────────────────────

@Component({
  selector: 'ara-feed-recon',
  standalone: true,
  imports: [CommonModule, PageHeaderComponent],
  templateUrl: './feed-recon.html',
  styleUrl: './feed-recon.scss',
})
export class FeedReconComponent implements OnInit, OnDestroy {

  private readonly route = inject(ActivatedRoute);
  private _sub?: Subscription;
  private _timer?: ReturnType<typeof setTimeout>;

  breadcrumbs: Breadcrumb[] = [];

  feedType    = signal<FeedType>('abacus');
  araDataset  = computed<AraDataset>(() => FEED_META[this.feedType()]);

  uploadedFile = signal<UploadedFile | null>(null);
  running      = signal(false);
  ran          = signal(false);

  results    = signal<ComparisonRow[]>([]);
  summary    = signal<ReconSummary | null>(null);
  statusFilter = signal<string>('ALL');

  selectedRow = signal<ComparisonRow | null>(null);
  drawerOpen  = signal(false);

  filteredResults = computed<ComparisonRow[]>(() => {
    const f = this.statusFilter();
    const rows = this.results();
    return f === 'ALL' ? rows : rows.filter(r => r.status === f);
  });

  readonly statuses: string[] = [
    'ALL', 'Matched', 'Value Mismatch', 'Missing in ARA',
    'Missing in Source', 'Format Mismatch', 'Duplicate', 'Exception'
  ];

  readonly compareKey: Record<FeedType, string> = {
    abacus: 'Account ID',
    rf:     'Position Ref',
    dsmt:   'Reference Key',
    fails:  'Fail Reference',
  };

  readonly compareFields: Record<FeedType, string> = {
    abacus: 'Amount · Currency · Status',
    rf:     'Balance · Currency',
    dsmt:   'Status · Type · Date',
    fails:  'Notional · Currency · Reason',
  };

  ngOnInit(): void {
    this._sub = this.route.params.subscribe(p => {
      const ft = (p['feedType'] ?? 'abacus') as FeedType;
      this.feedType.set(ft);
      this.breadcrumbs = [
        { label: 'ARA', route: '/ara/dashboard' },
        { label: 'Feeds', route: '/ara/feeds/abacus' },
        { label: FEED_META[ft].feedName },
      ];
      // reset workspace when navigating between feeds
      this.reset();
    });
  }

  ngOnDestroy(): void {
    this._sub?.unsubscribe();
    if (this._timer) clearTimeout(this._timer);
  }

  // ── Mock upload ─────────────────────────────────────────────────────

  triggerUpload(): void {
    // Fake file selection — pick a plausible filename/size based on feed type
    const meta: Record<FeedType, { name: string; sizeKb: number; rows: number }> = {
      abacus: { name: `Abacus_Source_20260320_001.csv`,   sizeKb: 4_820, rows: 182_088 },
      rf:     { name: `RF_PositionSnapshot_20260320.csv`, sizeKb: 2_210, rows: 94_612  },
      dsmt:   { name: `DSMT_RefData_20260319.xlsx`,       sizeKb: 1_390, rows: 40_988  },
      fails:  { name: `SettlementFails_20260320.txt`,     sizeKb: 88,    rows: 3_274   },
    };
    const m = meta[this.feedType()];
    this.uploadedFile.set({
      name:       m.name,
      sizeKb:     m.sizeKb,
      rows:       m.rows,
      uploadedAt: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      encoding:   'UTF-8',
    });
  }

  clearUpload(): void { this.uploadedFile.set(null); }

  canRun = computed(() => this.uploadedFile() !== null && !this.running());

  // ── Mock comparison ─────────────────────────────────────────────────

  runComparison(): void {
    if (!this.canRun()) return;
    this.running.set(true);
    this.ran.set(false);
    this.results.set([]);
    this.summary.set(null);
    this.drawerOpen.set(false);
    this.selectedRow.set(null);
    this.statusFilter.set('ALL');

    this._timer = setTimeout(() => {
      const rows = mockResults(this.feedType());
      this.results.set(rows);
      this.summary.set(computeSummary(rows));
      this.running.set(false);
      this.ran.set(true);
    }, 1800);
  }

  reset(): void {
    if (this._timer) clearTimeout(this._timer);
    this.uploadedFile.set(null);
    this.running.set(false);
    this.ran.set(false);
    this.results.set([]);
    this.summary.set(null);
    this.statusFilter.set('ALL');
    this.drawerOpen.set(false);
    this.selectedRow.set(null);
  }

  // ── Row selection ───────────────────────────────────────────────────

  selectRow(row: ComparisonRow): void {
    this.selectedRow.set(row);
    this.drawerOpen.set(true);
  }

  closeDrawer(): void { this.drawerOpen.set(false); }

  // ── Helpers ─────────────────────────────────────────────────────────

  statusClass(s: ReconStatus | string): string {
    const m: Record<string, string> = {
      'Matched':           'fr-status--matched',
      'Missing in ARA':    'fr-status--missing-ara',
      'Missing in Source': 'fr-status--missing-src',
      'Value Mismatch':    'fr-status--mismatch',
      'Format Mismatch':   'fr-status--format',
      'Duplicate':         'fr-status--duplicate',
      'Exception':         'fr-status--exception',
    };
    return m[s] ?? '';
  }

  datasetStatusClass(s: string): string {
    return s === 'Current' ? 'badge--success' : s === 'Stale' ? 'badge--warning' : 'badge--info';
  }

  formatSize(kb: number): string {
    return kb >= 1024 ? `${(kb/1024).toFixed(1)} MB` : `${kb} KB`;
  }

  snapshotKeys(snap: Record<string,string>): string[] {
    return Object.keys(snap);
  }
}
