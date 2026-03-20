import { Component, signal, computed, OnInit, inject } from '@angular/core';
import { CommonModule }       from '@angular/common';
import { ActivatedRoute }     from '@angular/router';
import { AgGridAngular }      from 'ag-grid-angular';
import {
  ColDef,
  GridReadyEvent,
  RowClickedEvent,
  AllCommunityModule,
  ModuleRegistry
} from 'ag-grid-community';

import { PageHeaderComponent, Breadcrumb } from '../shared/page-header/page-header';
import { KpiCardComponent }                from '../shared/kpi-card/kpi-card';
import { FilterBarComponent }              from '../shared/filter-bar/filter-bar';
import { araGridTheme }                    from '../shared/ara-grid-theme';

ModuleRegistry.registerModules([AllCommunityModule]);

export interface ExceptionRecord {
  id:           string;
  isin:         string;
  securityName: string;
  region:       string;
  status:       'OPEN' | 'PENDING' | 'ESCALATED' | 'RESOLVED';
  breakAmount:  number;
  agingDays:    number;
  owner:        string;
  lastAction:   string;
  comments:     string;
  priority:     'HIGH' | 'MEDIUM' | 'LOW';
  sourceRef:    string;
  targetRef:    string;
}

function makeExc(
  id: string, isin: string, name: string, region: string,
  status: ExceptionRecord['status'], breakAmt: number, agingDays: number,
  owner: string, priority: ExceptionRecord['priority'], lastAction: string, comments: string
): ExceptionRecord {
  return {
    id, isin, securityName: name, region, status, breakAmount: breakAmt, agingDays,
    owner, lastAction, comments, priority,
    sourceRef: 'ARA-' + id.padStart(8, '0'),
    targetRef: 'REC-' + id.padStart(8, '0')
  };
}

@Component({
  selector: 'ara-exceptions',
  standalone: true,
  imports: [CommonModule, AgGridAngular, PageHeaderComponent, KpiCardComponent, FilterBarComponent],
  templateUrl: './exceptions.html',
  styleUrl: './exceptions.scss'
})
export class ExceptionsComponent implements OnInit {
  private route = inject(ActivatedRoute);

  queueType  = signal('Exceptions');
  queueKey   = signal('');
  breadcrumbs = signal<Breadcrumb[]>([]);

  selectedRow   = signal<ExceptionRecord | null>(null);
  drawerOpen    = signal(false);
  allExceptions = signal<ExceptionRecord[]>([]);
  filteredExceptions = signal<ExceptionRecord[]>([]);

  readonly theme = araGridTheme;

  // --- KPIs computed ---
  totalCount     = computed(() => this.filteredExceptions().length);
  openCount      = computed(() => this.filteredExceptions().filter(e => e.status === 'OPEN').length);
  escalatedCount = computed(() => this.filteredExceptions().filter(e => e.status === 'ESCALATED').length);
  resolvedCount  = computed(() => this.filteredExceptions().filter(e => e.status === 'RESOLVED').length);
  avgAging       = computed(() => {
    const data = this.filteredExceptions();
    if (!data.length) return '0';
    return (data.reduce((a, e) => a + e.agingDays, 0) / data.length).toFixed(1);
  });

  readonly columnDefs: ColDef<ExceptionRecord>[] = [
    {
      headerName: 'Priority',
      field: 'priority',
      width: 90,
      pinned: 'left',
      cellRenderer: (p: any) => this.priorityCellHtml(p.value)
    },
    {
      headerName: 'Status',
      field: 'status',
      width: 110,
      pinned: 'left',
      cellRenderer: (p: any) => this.statusCellHtml(p.value)
    },
    { headerName: 'Exception ID', field: 'id',             width: 110 },
    { headerName: 'ISIN',         field: 'isin',           width: 140 },
    { headerName: 'Security',     field: 'securityName',   flex: 1, minWidth: 120 },
    { headerName: 'Region',       field: 'region',         width: 80 },
    {
      headerName: 'Break Amount',
      field: 'breakAmount',
      width: 130,
      type: 'numericColumn',
      valueFormatter: (p: any) => p.value != null ? `$${p.value.toLocaleString()}` : '—',
      cellStyle: { fontWeight: 600 }
    },
    {
      headerName: 'Aging (d)',
      field: 'agingDays',
      width: 100,
      type: 'numericColumn',
      cellRenderer: (p: any) => this.agingCellHtml(p.value)
    },
    { headerName: 'Owner',         field: 'owner',       width: 100 },
    { headerName: 'Last Action',   field: 'lastAction',  flex: 1, minWidth: 120 },
  ];

  readonly defaultColDef: ColDef = {
    sortable:   true,
    resizable:  true,
    filter:     true,
  };

  readonly rowSelection = { mode: 'singleRow' as const };

  ngOnInit(): void {
    this.route.data.subscribe(data => {
      const qt = data['queueType'] ?? 'Exceptions';
      const qk = data['queueKey']  ?? 'exception';
      this.queueType.set(qt);
      this.queueKey.set(qk);
      this.breadcrumbs.set([
        { label: 'ARA', route: '/ara/dashboard' },
        { label: 'Exceptions' },
        { label: qt }
      ]);
      const mockData = this.generateMockExceptions(qk, 30);
      this.allExceptions.set(mockData);
      this.filteredExceptions.set([...mockData]);
    });
  }

  onGridReady(event: GridReadyEvent): void {
    event.api.sizeColumnsToFit();
  }

  onRowClicked(event: RowClickedEvent<ExceptionRecord>): void {
    if (event.data) {
      this.selectedRow.set(event.data);
      this.drawerOpen.set(true);
    }
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
    this.selectedRow.set(null);
  }

  onApplyFilter(filters: Record<string, string>): void {
    let data = [...this.allExceptions()];
    if (filters['status'])  data = data.filter(r => r.status  === filters['status']);
    if (filters['region'])  data = data.filter(r => r.region  === filters['region']);
    if (filters['search']) {
      const s = filters['search'].toLowerCase();
      data = data.filter(r =>
        r.isin.toLowerCase().includes(s) ||
        r.securityName.toLowerCase().includes(s) ||
        r.owner.toLowerCase().includes(s)
      );
    }
    this.filteredExceptions.set(data);
  }

  onClearFilter(): void {
    this.filteredExceptions.set([...this.allExceptions()]);
  }

  onResolve(record: ExceptionRecord): void {
    // Mock: mark as resolved
    const updated = this.allExceptions().map(e =>
      e.id === record.id ? { ...e, status: 'RESOLVED' as const } : e
    );
    this.allExceptions.set(updated);
    this.filteredExceptions.set([...updated]);
    this.closeDrawer();
  }

  onEscalate(record: ExceptionRecord): void {
    const updated = this.allExceptions().map(e =>
      e.id === record.id ? { ...e, status: 'ESCALATED' as const, priority: 'HIGH' as const } : e
    );
    this.allExceptions.set(updated);
    this.filteredExceptions.set([...updated]);
    this.closeDrawer();
  }

  private generateMockExceptions(key: string, count: number): ExceptionRecord[] {
    const regions  = ['AMER', 'EMEA', 'APAC', 'LATAM'];
    const owners   = ['J.Smith', 'R.Jones', 'L.Chen', 'A.Patel', 'M.Tanaka', 'S.Kumar', 'C.Silva', 'Y.Wong'];
    const statuses: ExceptionRecord['status'][] = ['OPEN', 'OPEN', 'OPEN', 'PENDING', 'PENDING', 'ESCALATED', 'RESOLVED'];
    const prios:    ExceptionRecord['priority'][] = ['HIGH', 'HIGH', 'MEDIUM', 'MEDIUM', 'MEDIUM', 'LOW'];
    const securities = [
      ['US0378331005', 'Apple Inc'], ['US88160R1014', 'Tesla Inc'], ['DE0005140008', 'Deutsche Bank'],
      ['JP3633400001', 'Toyota Motor'], ['GB0002634946', 'HSBC Holdings'], ['BR0009065276', 'Petrobras'],
      ['XS1234567890', 'DB Bond 2028'], ['HK0000069689', 'AIA Group'], ['US912828U816', 'US Treasury 2Y'],
      ['US30303M1027', 'Meta Platforms'], ['US5949181045', 'Microsoft Corp'], ['MX01BA000006', 'Grupo Bimbo'],
    ];
    const lastActions = [
      'Awaiting confirmation', 'Sent to operations', 'Under investigation',
      'Escalated to team lead', 'Break identified', 'Pending resolution'
    ];
    const comments = [
      'Position break on T+1 settlement',
      'Accrual mismatch detected with source system',
      'FX rate discrepancy — pending revaluation',
      'Manual override applied — awaiting sign-off',
      'Trade not in Abacus — checking booking',
    ];

    const result: ExceptionRecord[] = [];
    for (let i = 0; i < count; i++) {
      const sec    = securities[i % securities.length];
      const region = regions[i % regions.length];
      const status = statuses[i % statuses.length];
      const prio   = prios[i % prios.length];
      const aging  = Math.floor(i * 0.6) + 1;
      const owner  = owners[i % owners.length];
      result.push(makeExc(
        String(i + 1).padStart(4, '0'),
        sec[0], sec[1], region, status,
        Math.round((i * 10730.5 + 3200) / 100) * 100,
        aging, owner, prio,
        lastActions[i % lastActions.length],
        comments[i % comments.length]
      ));
    }
    return result;
  }

  private statusCellHtml(status: string): string {
    const map: Record<string, string> = {
      'OPEN':      `<span class="badge badge--danger">Open</span>`,
      'PENDING':   `<span class="badge badge--warning">Pending</span>`,
      'ESCALATED': `<span class="badge badge--info">Escalated</span>`,
      'RESOLVED':  `<span class="badge badge--success">Resolved</span>`,
    };
    return map[status] ?? `<span class="badge badge--neutral">${status}</span>`;
  }

  private priorityCellHtml(priority: string): string {
    const col = priority === 'HIGH' ? 'var(--color-danger)' :
                priority === 'MEDIUM' ? 'var(--color-warning)' : 'var(--color-neutral)';
    return `<span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;color:${col}">
      <span style="width:7px;height:7px;border-radius:50%;background:${col}"></span>${priority}
    </span>`;
  }

  private agingCellHtml(days: number): string {
    const col = days > 7  ? 'var(--color-danger)'
              : days > 3  ? 'var(--color-warning)'
              : days > 1  ? 'var(--color-info)'
              : 'var(--color-success)';
    return `<span style="font-weight:600;color:${col}">${days}d</span>`;
  }
}
