import { Component, signal, OnInit } from '@angular/core';
import { CommonModule }       from '@angular/common';
import { AgGridAngular }      from 'ag-grid-angular';
import {
  ColDef,
  GridReadyEvent,
  GetRowIdParams,
  AllCommunityModule,
  ModuleRegistry,
  SelectionChangedEvent
} from 'ag-grid-community';

import { PageHeaderComponent, Breadcrumb } from '../shared/page-header/page-header';
import { FilterBarComponent }              from '../shared/filter-bar/filter-bar';
import { araGridTheme }                    from '../shared/ara-grid-theme';

ModuleRegistry.registerModules([AllCommunityModule]);

export interface AraRecord {
  id:            string;
  isin:          string;
  securityName:  string;
  region:        string;
  accountType:   string;
  status:        string;
  matched:       number;
  exceptions:    number;
  coverage:      number;
  lastUpdated:   string;
  owner:         string;
}

function makeRecord(
  id: string, isin: string, name: string, region: string,
  acctType: string, status: string, matched: number, exceptions: number, owner: string, lastUpdated: string
): AraRecord {
  const total = matched + exceptions;
  return { id, isin, securityName: name, region, accountType: acctType, status,
           matched, exceptions, coverage: total ? Math.round(matched / total * 1000) / 10 : 0,
           lastUpdated, owner };
}

@Component({
  selector: 'ara-search',
  standalone: true,
  imports: [CommonModule, AgGridAngular, PageHeaderComponent, FilterBarComponent],
  templateUrl: './search.html',
  styleUrl: './search.scss'
})
export class SearchComponent implements OnInit {
  readonly breadcrumbs: Breadcrumb[] = [
    { label: 'ARA', route: '/ara/dashboard' },
    { label: 'Main' },
    { label: 'Search' }
  ];

  readonly theme = araGridTheme;

  selectedRows  = signal<AraRecord[]>([]);
  filteredData  = signal<AraRecord[]>([]);
  isLoading     = signal(false);
  activeFilters = signal<string[]>([]);

  readonly allData: AraRecord[] = [
    makeRecord('R001', 'US0378331005', 'Apple Inc',           'AMER', 'Equity',      'MATCHED',   2840, 0,   'J.Smith',   '2026-03-20 09:12'),
    makeRecord('R002', 'US5949181045', 'Microsoft Corp',      'AMER', 'Equity',      'MATCHED',   3120, 0,   'J.Smith',   '2026-03-20 09:12'),
    makeRecord('R003', 'US88160R1014', 'Tesla Inc',           'AMER', 'Equity',      'EXCEPTION', 1940, 23, 'R.Jones',   '2026-03-20 08:55'),
    makeRecord('R004', 'US0231351067', 'Amazon.com Inc',      'AMER', 'Equity',      'MATCHED',   2200, 5,  'J.Smith',   '2026-03-20 09:12'),
    makeRecord('R005', 'US30303M1027', 'Meta Platforms',      'AMER', 'Equity',      'PENDING',   1650, 42, 'S.Kumar',   '2026-03-19 17:30'),
    makeRecord('R006', 'GB0002634946', 'HSBC Holdings',       'EMEA', 'Equity',      'MATCHED',   1820, 0,  'L.Chen',    '2026-03-20 09:00'),
    makeRecord('R007', 'GB00B16GWD56', 'BHP Group',           'EMEA', 'Equity',      'MATCHED',   990,  2,  'L.Chen',    '2026-03-20 09:00'),
    makeRecord('R008', 'DE0005140008', 'Deutsche Bank',       'EMEA', 'Equity',      'EXCEPTION', 1240, 88, 'A.Patel',   '2026-03-20 07:40'),
    makeRecord('R009', 'JP3633400001', 'Toyota Motor',        'APAC', 'Equity',      'MATCHED',   3400, 0,  'M.Tanaka',  '2026-03-20 09:10'),
    makeRecord('R010', 'JP3435000009', 'Sony Group',          'APAC', 'Equity',      'MATCHED',   2180, 0,  'M.Tanaka',  '2026-03-20 09:10'),
    makeRecord('R011', 'HK0000069689', 'AIA Group',           'APAC', 'Equity',      'PENDING',   870,  15, 'Y.Wong',    '2026-03-19 16:00'),
    makeRecord('R012', 'AU000000BHP3', 'BHP Group AU',        'APAC', 'Equity',      'MATCHED',   1480, 0,  'Y.Wong',    '2026-03-20 09:10'),
    makeRecord('R013', 'BR0009065276', 'Petrobras',           'LATAM','Equity',      'EXCEPTION', 620,  45, 'C.Silva',   '2026-03-20 08:10'),
    makeRecord('R014', 'MX01BA000006', 'Grupo Bimbo',         'LATAM','Equity',      'MATCHED',   340,  0,  'C.Silva',   '2026-03-20 08:10'),
    makeRecord('R015', 'US912828U816', 'US Treasury 2Y',      'AMER', 'Fixed Income','MATCHED',   5600, 0,  'J.Smith',   '2026-03-20 09:12'),
    makeRecord('R016', 'US9128284W88', 'US Treasury 10Y',     'AMER', 'Fixed Income','MATCHED',   4200, 8,  'J.Smith',   '2026-03-20 09:12'),
    makeRecord('R017', 'XS1234567890', 'DB Bond 2028',        'EMEA', 'Fixed Income','EXCEPTION', 320,  28, 'A.Patel',   '2026-03-20 07:40'),
    makeRecord('R018', 'XS9876543210', 'Hong Kong Bond',      'APAC', 'Fixed Income','MATCHED',   1100, 0,  'Y.Wong',    '2026-03-20 09:10'),
    makeRecord('R019', 'US1234567890', 'AMER Equity Fund A',  'AMER', 'Fund',        'PENDING',   780,  32, 'R.Jones',   '2026-03-19 17:30'),
    makeRecord('R020', 'IE00B4L5Y983', 'EMEA Core ETF',       'EMEA', 'Fund',        'MATCHED',   2900, 0,  'L.Chen',    '2026-03-20 09:00'),
  ];

  readonly columnDefs: ColDef<AraRecord>[] = [
    {
      headerName: 'Status',
      field: 'status',
      width: 110,
      pinned: 'left',
      cellRenderer: (p: any) => this.statusCellHtml(p.value)
    },
    { headerName: 'ISIN',           field: 'isin',           width: 140, pinned: 'left' },
    { headerName: 'Security Name',  field: 'securityName',   flex: 2, minWidth: 160 },
    { headerName: 'Region',         field: 'region',         width: 90  },
    { headerName: 'Account Type',   field: 'accountType',    width: 120 },
    {
      headerName: 'Matched',
      field: 'matched',
      width: 100,
      type: 'numericColumn',
      valueFormatter: (p: any) => p.value?.toLocaleString()
    },
    {
      headerName: 'Exceptions',
      field: 'exceptions',
      width: 110,
      type: 'numericColumn',
      cellRenderer: (p: any) => p.value > 0
        ? `<span style="color:var(--color-warning);font-weight:600">${p.value}</span>`
        : `<span style="color:var(--text-muted)">—</span>`
    },
    {
      headerName: 'Coverage',
      field: 'coverage',
      width: 100,
      type: 'numericColumn',
      valueFormatter: (p: any) => p.value?.toFixed(1) + '%',
      cellStyle: (p: any) => ({
        color: p.value >= 98 ? 'var(--color-success)'
             : p.value >= 95 ? 'var(--color-info)'
             : 'var(--color-warning)',
        fontWeight: 600
      })
    },
    { headerName: 'Owner',       field: 'owner',       width: 110 },
    { headerName: 'Last Updated', field: 'lastUpdated', width: 150, sort: 'desc' }
  ];

  readonly defaultColDef: ColDef = {
    sortable:   true,
    resizable:  true,
    filter:     true,
    suppressMovable: false,
  };

  readonly rowSelection = { mode: 'multiRow' as const };

  ngOnInit(): void {
    this.filteredData.set([...this.allData]);
  }

  onGridReady(event: GridReadyEvent): void {
    event.api.sizeColumnsToFit();
  }

  onSelectionChanged(event: SelectionChangedEvent<AraRecord>): void {
    this.selectedRows.set(event.api.getSelectedRows());
  }

  getRowId(params: GetRowIdParams<AraRecord>): string {
    return params.data.id;
  }

  onSearchChange(term: string): void {
    if (!term) {
      this.filteredData.set([...this.allData]);
      this.activeFilters.update(f => f.filter(x => !x.startsWith('Search')));
      return;
    }
    const lower = term.toLowerCase();
    this.filteredData.set(
      this.allData.filter(r =>
        r.isin.toLowerCase().includes(lower) ||
        r.securityName.toLowerCase().includes(lower) ||
        r.region.toLowerCase().includes(lower) ||
        r.accountType.toLowerCase().includes(lower)
      )
    );
    this.activeFilters.update(f => {
      const without = f.filter(x => !x.startsWith('Search:'));
      return [...without, `Search: "${term}"`];
    });
  }

  onApplyFilter(filters: Record<string, string>): void {
    let data = [...this.allData];
    const chips: string[] = [];
    if (filters['search']) {
      const s = filters['search'].toLowerCase();
      data = data.filter(r =>
        r.isin.toLowerCase().includes(s) ||
        r.securityName.toLowerCase().includes(s)
      );
      chips.push(`Search: "${filters['search']}"`);
    }
    if (filters['region']) {
      data = data.filter(r => r.region === filters['region']);
      chips.push(`Region: ${filters['region']}`);
    }
    if (filters['status']) {
      data = data.filter(r => r.status === filters['status']);
      chips.push(`Status: ${filters['status']}`);
    }
    this.filteredData.set(data);
    this.activeFilters.set(chips);
  }

  onClearFilter(): void {
    this.filteredData.set([...this.allData]);
    this.activeFilters.set([]);
  }

  removeFilter(chip: string): void {
    this.activeFilters.update(f => f.filter(c => c !== chip));
    this.onClearFilter();
  }

  private statusCellHtml(status: string): string {
    const map: Record<string, string> = {
      'MATCHED':   `<span class="badge badge--success">Matched</span>`,
      'EXCEPTION': `<span class="badge badge--warning">Exception</span>`,
      'PENDING':   `<span class="badge badge--info">Pending</span>`,
      'CLOSED':    `<span class="badge badge--neutral">Closed</span>`,
    };
    return map[status] ?? `<span class="badge badge--neutral">${status}</span>`;
  }
}
