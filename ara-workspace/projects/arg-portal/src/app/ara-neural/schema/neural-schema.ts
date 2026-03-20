import { Component, computed, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PageHeaderComponent, Breadcrumb } from '../../ara/shared/page-header/page-header';

export type ApprovalStatus = 'Approved' | 'Pending' | 'Rejected' | 'Under Review';
export type MappingStatus  = 'Fully Mapped' | 'Partially Mapped' | 'Unmapped';

export interface LineageRecord {
  id:             string;
  fullkey:        string;
  region:         string;
  country:        string;
  abacusAccount:  string;
  tlmAccount:     string;
  aoName:         string;
  aoId:           string;
  argApprovedBy:  string;
  approvalStatus: ApprovalStatus;
  mappingStatus:  MappingStatus;
  lastUpdated:    string;
  comments:       string;
}

export interface ChainNode {
  entityType: string;
  value:      string;
  subValue:   string;
  colorClass: string;
}

// ── Mock data ─────────────────────────────────────────────────────────
const MOCK_RECORDS: LineageRecord[] = [
  {
    id: 'LIN-001',
    fullkey: 'FK-2024-EMEA-0114',
    region: 'EMEA', country: 'UK',
    abacusAccount: 'ABA-UK-88421',
    tlmAccount: 'TLM-EMEA-3301-A',
    aoName: 'Sarah Mitchell', aoId: 'AO-1042',
    argApprovedBy: 'James Harrington',
    approvalStatus: 'Approved',
    mappingStatus: 'Fully Mapped',
    lastUpdated: '2024-11-18',
    comments: 'Fully reconciled. No exceptions outstanding.',
  },
  {
    id: 'LIN-002',
    fullkey: 'FK-2024-EMEA-0227',
    region: 'EMEA', country: 'Germany',
    abacusAccount: 'ABA-DE-44102',
    tlmAccount: 'TLM-EMEA-4480-B',
    aoName: 'Klaus Weber', aoId: 'AO-2017',
    argApprovedBy: 'Pending',
    approvalStatus: 'Under Review',
    mappingStatus: 'Partially Mapped',
    lastUpdated: '2024-11-20',
    comments: 'TLM link re-established post-migration. ARG review in progress.',
  },
  {
    id: 'LIN-003',
    fullkey: 'FK-2024-APAC-0388',
    region: 'APAC', country: 'Singapore',
    abacusAccount: 'ABA-SG-22904',
    tlmAccount: 'TLM-APAC-1122-C',
    aoName: 'Priya Nair', aoId: 'AO-3055',
    argApprovedBy: 'David Lim',
    approvalStatus: 'Approved',
    mappingStatus: 'Fully Mapped',
    lastUpdated: '2024-11-15',
    comments: 'Compliant. Annual review completed.',
  },
  {
    id: 'LIN-004',
    fullkey: 'FK-2024-APAC-0412',
    region: 'APAC', country: 'Hong Kong',
    abacusAccount: 'ABA-HK-61830',
    tlmAccount: 'TLM-APAC-2240-D',
    aoName: 'Tony Chan', aoId: 'AO-3112',
    argApprovedBy: 'Unassigned',
    approvalStatus: 'Pending',
    mappingStatus: 'Partially Mapped',
    lastUpdated: '2024-11-22',
    comments: 'ARG approver not yet assigned. Escalated to team lead.',
  },
  {
    id: 'LIN-005',
    fullkey: 'FK-2024-NAM-0501',
    region: 'NAM', country: 'USA',
    abacusAccount: 'ABA-US-77410',
    tlmAccount: 'TLM-NAM-8810-E',
    aoName: 'Robert Finley', aoId: 'AO-1188',
    argApprovedBy: 'Angela Torres',
    approvalStatus: 'Approved',
    mappingStatus: 'Fully Mapped',
    lastUpdated: '2024-11-10',
    comments: 'Routine approval cycle. No issues.',
  },
  {
    id: 'LIN-006',
    fullkey: 'FK-2024-NAM-0578',
    region: 'NAM', country: 'Canada',
    abacusAccount: 'ABA-CA-30021',
    tlmAccount: 'TLM-NAM-9955-F',
    aoName: 'Marie Leclerc', aoId: 'AO-1201',
    argApprovedBy: 'Angela Torres',
    approvalStatus: 'Rejected',
    mappingStatus: 'Unmapped',
    lastUpdated: '2024-11-19',
    comments: 'Abacus account mismatch identified. Returned for correction.',
  },
  {
    id: 'LIN-007',
    fullkey: 'FK-2024-LATAM-0631',
    region: 'LATAM', country: 'Brazil',
    abacusAccount: 'ABA-BR-18844',
    tlmAccount: 'TLM-LATAM-5501-G',
    aoName: 'Carlos Mendes', aoId: 'AO-4088',
    argApprovedBy: 'Sofia Peralta',
    approvalStatus: 'Approved',
    mappingStatus: 'Fully Mapped',
    lastUpdated: '2024-11-14',
    comments: 'Clean mapping. Approved in Q4 cycle.',
  },
  {
    id: 'LIN-008',
    fullkey: 'FK-2024-LATAM-0704',
    region: 'LATAM', country: 'Mexico',
    abacusAccount: 'ABA-MX-25510',
    tlmAccount: 'TLM-LATAM-6610-H',
    aoName: 'Isabella Ruiz', aoId: 'AO-4120',
    argApprovedBy: 'Unassigned',
    approvalStatus: 'Pending',
    mappingStatus: 'Partially Mapped',
    lastUpdated: '2024-11-23',
    comments: 'New account. Initial mapping in progress.',
  },
  {
    id: 'LIN-009',
    fullkey: 'FK-2024-EMEA-0819',
    region: 'EMEA', country: 'UAE',
    abacusAccount: 'ABA-UAE-93210',
    tlmAccount: 'TLM-EMEA-7740-I',
    aoName: 'Omar Al-Rashid', aoId: 'AO-2206',
    argApprovedBy: 'James Harrington',
    approvalStatus: 'Under Review',
    mappingStatus: 'Partially Mapped',
    lastUpdated: '2024-11-21',
    comments: 'Regional compliance check pending. Expected clearance by EOM.',
  },
  {
    id: 'LIN-010',
    fullkey: 'FK-2024-APAC-0944',
    region: 'APAC', country: 'India',
    abacusAccount: 'ABA-IN-40188',
    tlmAccount: 'TLM-APAC-3388-J',
    aoName: 'Ananya Sharma', aoId: 'AO-3280',
    argApprovedBy: 'David Lim',
    approvalStatus: 'Approved',
    mappingStatus: 'Fully Mapped',
    lastUpdated: '2024-11-12',
    comments: 'Verified and approved. Part of bulk reconciliation batch.',
  },
];

@Component({
  selector: 'ara-neural-schema',
  standalone: true,
  imports: [CommonModule, FormsModule, PageHeaderComponent],
  templateUrl: './neural-schema.html',
  styleUrl: './neural-schema.scss',
})
export class NeuralSchemaComponent implements OnDestroy {

  readonly breadcrumbs: Breadcrumb[] = [
    { label: 'ARA Neural', route: '/ara-neural/schema' },
    { label: 'Schema' },
  ];

  searchQuery  = signal('');
  selectedId   = signal<string>('LIN-001');
  detailOpen   = signal(false);
  selectedNode = signal<string | null>(null);

  /**
   * Controls staged node reveal.
   * -1 = canvas blank/resetting
   *  0 = Fullkey visible
   *  1 = + Abacus + its line
   *  2 = + TLM   + its line
   *  3 = + AO    + its line
   *  4 = + Approver + its line  (all visible)
   */
  revealStep = signal<number>(4); // start fully visible for initial load

  private _timers: ReturnType<typeof setTimeout>[] = [];

  readonly allRecords = MOCK_RECORDS;

  filteredRecords = computed<LineageRecord[]>(() => {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return this.allRecords;
    return this.allRecords.filter(r =>
      r.fullkey.toLowerCase().includes(q)       ||
      r.region.toLowerCase().includes(q)        ||
      r.country.toLowerCase().includes(q)       ||
      r.abacusAccount.toLowerCase().includes(q) ||
      r.tlmAccount.toLowerCase().includes(q)    ||
      r.aoName.toLowerCase().includes(q)        ||
      r.argApprovedBy.toLowerCase().includes(q)
    );
  });

  selectedRecord = computed<LineageRecord | undefined>(() =>
    this.allRecords.find(r => r.id === this.selectedId())
  );

  chainNodes = computed<ChainNode[]>(() => {
    const rec = this.selectedRecord();
    if (!rec) return [];
    return [
      {
        entityType: 'Fullkey',
        value:      rec.fullkey,
        subValue:   `${rec.region} · ${rec.country}`,
        colorClass: 'ns-node--fullkey',
      },
      {
        entityType: 'Abacus Account',
        value:      rec.abacusAccount,
        subValue:   'Abacus System',
        colorClass: 'ns-node--abacus',
      },
      {
        entityType: 'TLM Account',
        value:      rec.tlmAccount,
        subValue:   'TLM System',
        colorClass: 'ns-node--tlm',
      },
      {
        entityType: 'AO Assigned',
        value:      rec.aoName,
        subValue:   rec.aoId,
        colorClass: 'ns-node--ao',
      },
      {
        entityType: 'ARG Approver',
        value:      rec.argApprovedBy,
        subValue:   rec.approvalStatus,
        colorClass: 'ns-node--approver',
      },
    ];
  });

  detailFields = computed<Array<{ label: string; value: string; type?: string }>>(() => {
    const rec = this.selectedRecord();
    if (!rec) return [];
    return [
      { label: 'Record ID',         value: rec.id },
      { label: 'Fullkey',           value: rec.fullkey },
      { label: 'Region',            value: rec.region },
      { label: 'Country',           value: rec.country },
      { label: 'Abacus Account',    value: rec.abacusAccount },
      { label: 'TLM Account',       value: rec.tlmAccount },
      { label: 'AO Name',           value: rec.aoName },
      { label: 'AO ID',             value: rec.aoId },
      { label: 'ARG Approver',      value: rec.argApprovedBy },
      { label: 'Approval Status',   value: rec.approvalStatus,  type: 'approval' },
      { label: 'Mapping Status',    value: rec.mappingStatus,   type: 'mapping'  },
      { label: 'Last Updated',      value: rec.lastUpdated },
    ];
  });

  select(id: string): void {
    if (this.selectedId() === id) return;  // no-op on same record

    // cancel any in-flight animation timers
    this._timers.forEach(t => clearTimeout(t));
    this._timers = [];

    // reset canvas to blank, swap data, then stagger nodes in
    this.revealStep.set(-1);
    this.detailOpen.set(false);

    const push = (delay: number, step: number) =>
      this._timers.push(setTimeout(() => this.revealStep.set(step), delay));

    // swap the actual data after a very brief blank frame so Angular
    // rerenders the new record values before nodes fade in
    this._timers.push(setTimeout(() => {
      this.selectedId.set(id);
      push(60,  0);   // Fullkey
      push(240, 1);   // Abacus  + line
      push(420, 2);   // TLM     + line
      push(600, 3);   // AO      + line
      push(780, 4);   // Approver + line
    }, 40));
  }
  onSearch(q: string): void { this.searchQuery.set(q); }

  ngOnDestroy(): void {
    this._timers.forEach(t => clearTimeout(t));
  }
  toggleDetail(): void { this.detailOpen.update(v => !v); }
  openDetail(node: string): void { this.selectedNode.set(node); this.detailOpen.set(true); }

  approvalClass(s: ApprovalStatus): string {
    const map: Record<ApprovalStatus, string> = {
      'Approved':     'badge--success',
      'Pending':      'badge--warning',
      'Rejected':     'badge--danger',
      'Under Review': 'badge--info',
    };
    return map[s] ?? 'badge--neutral';
  }

  mappingClass(s: MappingStatus): string {
    const map: Record<MappingStatus, string> = {
      'Fully Mapped':     'badge--success',
      'Partially Mapped': 'badge--warning',
      'Unmapped':         'badge--danger',
    };
    return map[s] ?? 'badge--neutral';
  }

  regionBadge(r: string): string {
    const map: Record<string, string> = {
      EMEA: 'chip--emea', APAC: 'chip--apac',
      LATAM: 'chip--latam', NAM: 'chip--nam',
    };
    return map[r] ?? '';
  }
}
