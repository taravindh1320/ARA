import { Component, computed, signal, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { PageHeaderComponent, Breadcrumb } from '../../ara/shared/page-header/page-header';

// â”€â”€ JSON schema types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface NeuralCentral {
  bankAccount:     string;
  accountStatus:   string;
  accountType:     string;
  region:          string;
  country:         string;
  lineOfBusiness:  string;
  riskType:        string;
}

export interface NeuralSystem {
  platform:     string;
  database:     string;
  balancePool:  string;
  reconAccount: string;
}

export interface NeuralOwner { soeid: string; }

export interface NeuralOwnership {
  accountOwner:    NeuralOwner;
  proofOwner:      NeuralOwner;
  argReviewOwner:  NeuralOwner;
}

export interface NeuralAo  { soeid: string; name: string; status: string; }
export interface NeuralPo  { soeid: string; name: string; }

export interface NeuralApproval {
  ao:            NeuralAo;
  po:            NeuralPo;
  reviewStatus:  string;
  ddqStatus:     string;
}

export interface NeuralUsage {
  bssAccountType:  string;
  bserReportable:  string;
}

export interface NeuralRaw { [key: string]: string; }

export interface NeuralRecord {
  recordId:   string;
  central:    NeuralCentral;
  system:     NeuralSystem;
  ownership:  NeuralOwnership;
  approval:   NeuralApproval;
  usage:      NeuralUsage;
  raw:        NeuralRaw;
}

export interface GroupSummary {
  region:           string;
  recordCount:      number;
  countryCount:     number;
  bankAccountCount: number;
  accountStatuses:  string[];
  platforms:        string[];
  databases:        string[];
  aoNames:          string[];
  poNames:          string[];
  reviewStatuses:   string[];
  ddqStatuses:      string[];
}

export interface NeuralGroup {
  groupId:       string;
  fullKey:       string;
  displayTitle:  string;
  records:       NeuralRecord[];
  summary:       GroupSummary;
}

export interface NeuralSchema {
  version:      string;
  generatedAt:  string;
  groups:       NeuralGroup[];
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

@Component({
  selector: 'ara-neural-schema',
  standalone: true,
  imports: [CommonModule, FormsModule, PageHeaderComponent],
  templateUrl: './neural-schema.html',
  styleUrl: './neural-schema.scss',
})
export class NeuralSchemaComponent implements OnInit, OnDestroy {

  private readonly http = inject(HttpClient);

  readonly breadcrumbs: Breadcrumb[] = [
    { label: 'ARA Neural', route: '/ara-neural/schema' },
    { label: 'Schema' },
  ];

  // â”€â”€ Reactive state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  private readonly _groups    = signal<NeuralGroup[]>([]);
  readonly searchQuery        = signal('');
  readonly selectedGroupId    = signal('');
  readonly selectedRecordId   = signal('');
  readonly detailOpen         = signal(false);
  readonly loading            = signal(true);
  readonly loadError          = signal('');

  /**
   * Reveal step for animated canvas entry.
   * -1 = blank  |  0 = center FULL_KEY node  |  1 = record branches
   */
  readonly revealStep = signal<number>(-1);

  private _timers: ReturnType<typeof setTimeout>[] = [];

  // â”€â”€ Derived / computed â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  get allGroups(): NeuralGroup[] { return this._groups(); }

  readonly filteredGroups = computed<NeuralGroup[]>(() => {
    const all = this._groups();
    const q   = this.searchQuery().toLowerCase().trim();
    if (!q) return all;
    return all.filter(g =>
      g.fullKey.toLowerCase().includes(q)                           ||
      g.summary.region.toLowerCase().includes(q)                    ||
      g.summary.aoNames.some(n => n.toLowerCase().includes(q))      ||
      g.summary.platforms.some(p => p.toLowerCase().includes(q))    ||
      g.summary.reviewStatuses.some(s => s.toLowerCase().includes(q))
    );
  });

  readonly selectedGroup = computed<NeuralGroup | undefined>(() =>
    this._groups().find(g => g.groupId === this.selectedGroupId())
  );

  readonly selectedRecord = computed<NeuralRecord | undefined>(() => {
    const group = this.selectedGroup();
    return group?.records.find(r => r.recordId === this.selectedRecordId());
  });

  readonly detailFields = computed<Array<{ label: string; value: string; type?: string }>>(() => {
    const rec = this.selectedRecord();
    if (!rec) return [];
    return [
      { label: 'Record ID',         value: rec.recordId },
      { label: 'Full Key',          value: rec.raw['fullKey'] },
      { label: 'Bank Account',      value: rec.central.bankAccount },
      { label: 'Account Type',      value: rec.central.accountType },
      { label: 'Account Status',    value: rec.central.accountStatus },
      { label: 'Region',            value: rec.central.region },
      { label: 'Country',           value: rec.central.country },
      { label: 'Line of Business',  value: rec.central.lineOfBusiness },
      { label: 'Risk Type',         value: rec.central.riskType },
      { label: 'Platform',          value: rec.system.platform },
      { label: 'Database',          value: rec.system.database },
      { label: 'Balance Pool',      value: rec.system.balancePool },
      { label: 'Recon Account',     value: rec.system.reconAccount },
      { label: 'AO Name',           value: rec.approval.ao.name },
      { label: 'AO SOEID',          value: rec.approval.ao.soeid },
      { label: 'AO Status',         value: rec.approval.ao.status },
      { label: 'PO Name',           value: rec.approval.po.name },
      { label: 'PO SOEID',          value: rec.approval.po.soeid },
      { label: 'Review Status',     value: rec.approval.reviewStatus, type: 'review' },
      { label: 'DDQ Status',        value: rec.approval.ddqStatus },
      { label: 'BSS Account Type',  value: rec.usage.bssAccountType },
      { label: 'BSER Reportable',   value: rec.usage.bserReportable },
      { label: 'ARG Review Owner',  value: rec.ownership.argReviewOwner.soeid },
      { label: 'Account Owner',     value: rec.ownership.accountOwner.soeid },
      { label: 'Proof Owner',       value: rec.ownership.proofOwner.soeid },
    ];
  });

  // â”€â”€ Lifecycle â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  ngOnInit(): void {
    this.http.get<NeuralSchema>('assets/data/neural_schema.json').subscribe({
      next: (schema) => {
        this._groups.set(schema.groups ?? []);
        this.loading.set(false);
        if (schema.groups?.length > 0) {
          this.selectGroup(schema.groups[0].groupId);
        }
      },
      error: (err) => {
        this.loadError.set('Failed to load neural schema data. Please check assets/data/neural_schema.json.');
        this.loading.set(false);
        console.error('[NeuralSchema] Load error:', err);
      },
    });
  }

  ngOnDestroy(): void {
    this._timers.forEach(t => clearTimeout(t));
  }

  // â”€â”€ Selection actions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  selectGroup(groupId: string): void {
    if (this.selectedGroupId() === groupId) return;

    this._timers.forEach(t => clearTimeout(t));
    this._timers = [];

    this.revealStep.set(-1);
    this.detailOpen.set(false);
    this.selectedRecordId.set('');

    this._timers.push(setTimeout(() => {
      this.selectedGroupId.set(groupId);
      this._timers.push(setTimeout(() => this.revealStep.set(0), 60));   // center node
      this._timers.push(setTimeout(() => this.revealStep.set(1), 280));  // branches in
    }, 40));
  }

  selectRecord(recordId: string): void {
    this.selectedRecordId.set(recordId);
    this.detailOpen.set(true);
  }

  onSearch(q: string): void { this.searchQuery.set(q); }
  toggleDetail(): void { this.detailOpen.update(v => !v); }

  // â”€â”€ Badge style helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

