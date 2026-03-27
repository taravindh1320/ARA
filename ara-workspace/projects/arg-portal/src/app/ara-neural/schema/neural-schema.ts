import { Component, computed, signal, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PageHeaderComponent, Breadcrumb } from '../../ara/shared/page-header/page-header';
import { NeuralSchemaService } from '../services/neural-schema.service';
import {
  FullKeySummary,
  FullKeyDetail,
  NeuralRecord,
} from '../models/neural.models';

@Component({
  selector: 'ara-neural-schema',
  standalone: true,
  imports: [CommonModule, FormsModule, PageHeaderComponent],
  templateUrl: './neural-schema.html',
  styleUrl: './neural-schema.scss',
})
export class NeuralSchemaComponent implements OnInit, OnDestroy {

  private readonly service = inject(NeuralSchemaService);

  readonly breadcrumbs: Breadcrumb[] = [
    { label: 'ARA Neural', route: '/ara-neural/schema' },
    { label: 'Schema' },
  ];

  // ── Stage 1 state: left-panel summary list ───────────────────────────────
  private readonly _summaries = signal<FullKeySummary[]>([]);
  readonly listLoading         = signal(true);
  readonly listError           = signal('');
  readonly searchQuery         = signal('');
  readonly selectedGroupId     = signal('');

  // ── Stage 2 state: canvas / graph detail ────────────────────────────────
  private readonly _selectedDetail = signal<FullKeyDetail | null>(null);
  readonly detailLoading            = signal(false);
  readonly detailError              = signal('');
  readonly selectedRecordId         = signal('');
  readonly detailOpen               = signal(false);
  readonly revealStep               = signal<number>(-1);

  private _timers: ReturnType<typeof setTimeout>[] = [];

  // ── Derived ──────────────────────────────────────────────────────────────

  /** Total count of all summaries loaded from the API. */
  get totalCount(): number { return this._summaries().length; }

  /** Filtered left-panel list — client-side filter over lightweight summaries. */
  readonly filteredSummaries = computed<FullKeySummary[]>(() => {
    const all = this._summaries();
    const q   = this.searchQuery().toLowerCase().trim();
    if (!q) return all;
    return all.filter(s =>
      s.fullKey.toLowerCase().includes(q)                       ||
      s.region.toLowerCase().includes(q)                        ||
      s.platforms.some(p => p.toLowerCase().includes(q))
    );
  });

  /** Currently loaded detail for the selected FULL_KEY group. */
  readonly selectedDetail = computed<FullKeyDetail | null>(
    () => this._selectedDetail()
  );

  /** Currently selected record within the detail group. */
  readonly selectedRecord = computed<NeuralRecord | undefined>(() =>
    this._selectedDetail()?.records.find(r => r.recordId === this.selectedRecordId())
  );

  /** Fields rendered in the detail drawer. */
  readonly detailFields = computed<Array<{ label: string; value: string; type?: string }>>(() => {
    const rec = this.selectedRecord();
    if (!rec) return [];
    return [
      { label: 'Record ID',        value: rec.recordId },
      { label: 'Full Key',         value: rec.raw['fullKey'] },
      { label: 'Bank Account',     value: rec.central.bankAccount },
      { label: 'Account Type',     value: rec.central.accountType },
      { label: 'Account Status',   value: rec.central.accountStatus },
      { label: 'Region',           value: rec.central.region },
      { label: 'Country',          value: rec.central.country },
      { label: 'Line of Business', value: rec.central.lineOfBusiness },
      { label: 'Risk Type',        value: rec.central.riskType },
      { label: 'Platform',         value: rec.system.platform },
      { label: 'Database',         value: rec.system.database },
      { label: 'Balance Pool',     value: rec.system.balancePool },
      { label: 'Recon Account',    value: rec.system.reconAccount },
      { label: 'AO Name',          value: rec.approval.ao.name },
      { label: 'AO SOEID',         value: rec.approval.ao.soeid },
      { label: 'AO Status',        value: rec.approval.ao.status },
      { label: 'PO Name',          value: rec.approval.po.name },
      { label: 'PO SOEID',         value: rec.approval.po.soeid },
      { label: 'Review Status',    value: rec.approval.reviewStatus, type: 'review' },
      { label: 'DDQ Status',       value: rec.approval.ddqStatus },
      { label: 'BSS Account Type', value: rec.usage.bssAccountType },
      { label: 'BSER Reportable',  value: rec.usage.bserReportable },
      { label: 'ARG Review Owner', value: rec.ownership.argReviewOwner.soeid },
      { label: 'Account Owner',    value: rec.ownership.accountOwner.soeid },
      { label: 'Proof Owner',      value: rec.ownership.proofOwner.soeid },
    ];
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  ngOnInit(): void {
    // Stage 1: load lightweight summary list — fast, no records[] included
    this.service.getFullKeySummaries().subscribe({
      next: (response) => {
        this._summaries.set(response.items);
        this.listLoading.set(false);
        if (response.items.length > 0) {
          this.selectGroup(response.items[0].groupId);
        }
      },
      error: (err) => {
        this.listError.set('Failed to load FULL_KEY list. Please check the data source.');
        this.listLoading.set(false);
        console.error('[NeuralSchema] Summary load error:', err);
      },
    });
  }

  ngOnDestroy(): void {
    this._timers.forEach(t => clearTimeout(t));
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  selectGroup(groupId: string): void {
    if (this.selectedGroupId() === groupId) return;

    this._timers.forEach(t => clearTimeout(t));
    this._timers = [];

    // Reset canvas state immediately
    this.selectedGroupId.set(groupId);
    this.revealStep.set(-1);
    this.detailOpen.set(false);
    this.selectedRecordId.set('');
    this.detailError.set('');
    this.detailLoading.set(true);
    this._selectedDetail.set(null);

    // Stage 2: fetch detail only for the selected FULL_KEY
    this.service.getFullKeyDetail(groupId).subscribe({
      next: (response) => {
        this.detailLoading.set(false);
        this._selectedDetail.set(response.detail);
        this._timers.push(setTimeout(() => this.revealStep.set(0), 60));
        this._timers.push(setTimeout(() => this.revealStep.set(1), 280));
      },
      error: (err) => {
        this.detailLoading.set(false);
        this.detailError.set('Failed to load lineage detail for this group.');
        console.error('[NeuralSchema] Detail load error:', err);
      },
    });
  }

  selectRecord(recordId: string): void {
    this.selectedRecordId.set(recordId);
    this.detailOpen.set(true);
  }

  onSearch(q: string): void { this.searchQuery.set(q); }
  toggleDetail(): void      { this.detailOpen.update(v => !v); }

  // ── Badge style helpers ───────────────────────────────────────────────────

  reviewClass(status: string): string {
    const map: Record<string, string> = {
      'Approved':     'badge--success',
      'Pending':      'badge--warning',
      'Rejected':     'badge--danger',
      'Under Review': 'badge--info',
    };
    return map[status] ?? 'badge--neutral';
  }

  ddqClass(status: string): string {
    const map: Record<string, string> = {
      'Completed':   'badge--success',
      'In Progress': 'badge--info',
      'Not Started': 'badge--neutral',
    };
    return map[status] ?? 'badge--neutral';
  }

  accountStatusClass(status: string): string {
    const map: Record<string, string> = {
      'Active':    'badge--success',
      'Inactive':  'badge--danger',
      'Suspended': 'badge--warning',
    };
    return map[status] ?? 'badge--neutral';
  }
}
