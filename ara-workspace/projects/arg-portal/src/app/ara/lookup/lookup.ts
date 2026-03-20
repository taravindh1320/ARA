import { Component, signal } from '@angular/core';
import { CommonModule }       from '@angular/common';
import { FormsModule }        from '@angular/forms';
import { AgGridAngular }      from 'ag-grid-angular';
import {
  ColDef, GridReadyEvent, RowClickedEvent,
  AllCommunityModule, ModuleRegistry
} from 'ag-grid-community';

import { PageHeaderComponent, Breadcrumb } from '../shared/page-header/page-header';
import { araGridTheme }                    from '../shared/ara-grid-theme';
import { AraRecord }                       from '../search/search';

ModuleRegistry.registerModules([AllCommunityModule]);

interface DetailSection {
  label: string;
  rows:  { field: string; value: string; badge?: string; badgeStatus?: string }[];
}

@Component({
  selector: 'ara-lookup',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridAngular, PageHeaderComponent],
  templateUrl: './lookup.html',
  styleUrl: './lookup.scss'
})
export class LookupComponent {
  readonly breadcrumbs: Breadcrumb[] = [
    { label: 'ARA', route: '/ara/dashboard' },
    { label: 'Main' },
    { label: 'Abacus Lookup' }
  ];

  readonly theme = araGridTheme;

  searchTerm    = signal('');
  selectedRecord = signal<AraRecord | null>(null);
  filteredList   = signal<AraRecord[]>([]);

  private readonly allRecords: AraRecord[] = [
    { id: 'R001', isin: 'US0378331005', securityName: 'Apple Inc',        region: 'AMER', accountType: 'Equity',       status: 'MATCHED',   matched: 2840, exceptions: 0,  coverage: 100,  lastUpdated: '2026-03-20 09:12', owner: 'J.Smith' },
    { id: 'R002', isin: 'US5949181045', securityName: 'Microsoft Corp',   region: 'AMER', accountType: 'Equity',       status: 'MATCHED',   matched: 3120, exceptions: 0,  coverage: 100,  lastUpdated: '2026-03-20 09:12', owner: 'J.Smith' },
    { id: 'R003', isin: 'US88160R1014', securityName: 'Tesla Inc',        region: 'AMER', accountType: 'Equity',       status: 'EXCEPTION', matched: 1940, exceptions: 23, coverage: 98.8, lastUpdated: '2026-03-20 08:55', owner: 'R.Jones' },
    { id: 'R004', isin: 'US0231351067', securityName: 'Amazon.com Inc',   region: 'AMER', accountType: 'Equity',       status: 'MATCHED',   matched: 2200, exceptions: 5,  coverage: 99.8, lastUpdated: '2026-03-20 09:12', owner: 'J.Smith' },
    { id: 'R005', isin: 'US30303M1027', securityName: 'Meta Platforms',   region: 'AMER', accountType: 'Equity',       status: 'PENDING',   matched: 1650, exceptions: 42, coverage: 97.5, lastUpdated: '2026-03-19 17:30', owner: 'S.Kumar' },
    { id: 'R006', isin: 'GB0002634946', securityName: 'HSBC Holdings',    region: 'EMEA', accountType: 'Equity',       status: 'MATCHED',   matched: 1820, exceptions: 0,  coverage: 100,  lastUpdated: '2026-03-20 09:00', owner: 'L.Chen' },
    { id: 'R007', isin: 'DE0005140008', securityName: 'Deutsche Bank',    region: 'EMEA', accountType: 'Equity',       status: 'EXCEPTION', matched: 1240, exceptions: 88, coverage: 93.4, lastUpdated: '2026-03-20 07:40', owner: 'A.Patel' },
    { id: 'R008', isin: 'JP3633400001', securityName: 'Toyota Motor',     region: 'APAC', accountType: 'Equity',       status: 'MATCHED',   matched: 3400, exceptions: 0,  coverage: 100,  lastUpdated: '2026-03-20 09:10', owner: 'M.Tanaka' },
    { id: 'R009', isin: 'HK0000069689', securityName: 'AIA Group',        region: 'APAC', accountType: 'Equity',       status: 'PENDING',   matched: 870,  exceptions: 15, coverage: 98.3, lastUpdated: '2026-03-19 16:00', owner: 'Y.Wong' },
    { id: 'R010', isin: 'BR0009065276', securityName: 'Petrobras',        region: 'LATAM', accountType: 'Equity',      status: 'EXCEPTION', matched: 620,  exceptions: 45, coverage: 93.2, lastUpdated: '2026-03-20 08:10', owner: 'C.Silva' },
    { id: 'R011', isin: 'US912828U816', securityName: 'US Treasury 2Y',   region: 'AMER', accountType: 'Fixed Income', status: 'MATCHED',   matched: 5600, exceptions: 0,  coverage: 100,  lastUpdated: '2026-03-20 09:12', owner: 'J.Smith' },
    { id: 'R012', isin: 'XS1234567890', securityName: 'DB Bond 2028',     region: 'EMEA', accountType: 'Fixed Income', status: 'EXCEPTION', matched: 320,  exceptions: 28, coverage: 92.0, lastUpdated: '2026-03-20 07:40', owner: 'A.Patel' },
  ];

  readonly listColumnDefs: ColDef<AraRecord>[] = [
    { headerName: 'ISIN',          field: 'isin',         width: 130 },
    { headerName: 'Name',          field: 'securityName', flex: 1, minWidth: 100 },
    { headerName: 'Region',        field: 'region',       width: 70 },
    {
      headerName: 'Status',
      field: 'status',
      width: 100,
      cellRenderer: (p: any) => this.statusDot(p.value)
    }
  ];

  readonly defaultColDef: ColDef = {
    sortable: true,
    resizable: true,
    suppressMovable: true,
  };

  ngOnInit(): void {
    this.filteredList.set([...this.allRecords]);
  }

  onGridReady(event: GridReadyEvent): void {
    event.api.sizeColumnsToFit();
  }

  onRowClicked(event: RowClickedEvent<AraRecord>): void {
    if (event.data) this.selectedRecord.set(event.data);
  }

  onSearch(term: string): void {
    this.searchTerm.set(term);
    if (!term) {
      this.filteredList.set([...this.allRecords]);
      return;
    }
    const lower = term.toLowerCase();
    this.filteredList.set(
      this.allRecords.filter(r =>
        r.isin.toLowerCase().includes(lower) ||
        r.securityName.toLowerCase().includes(lower) ||
        r.region.toLowerCase().includes(lower)
      )
    );
  }

  getDetailSections(r: AraRecord): DetailSection[] {
    const statusBadge = r.status === 'MATCHED' ? 'success'
                      : r.status === 'EXCEPTION' ? 'warning'
                      : r.status === 'PENDING' ? 'info' : 'neutral';
    return [
      {
        label: 'Security Information',
        rows: [
          { field: 'ISIN',          value: r.isin },
          { field: 'Security Name', value: r.securityName },
          { field: 'Region',        value: r.region },
          { field: 'Account Type',  value: r.accountType },
          { field: 'Owner',         value: r.owner },
          { field: 'Last Updated',  value: r.lastUpdated },
        ]
      },
      {
        label: 'ARA Coverage',
        rows: [
          { field: 'Status',        value: r.status,               badge: r.status,     badgeStatus: statusBadge },
          { field: 'Matched',       value: r.matched.toLocaleString() },
          { field: 'Exceptions',    value: r.exceptions.toLocaleString(),
            badge: r.exceptions > 0 ? r.exceptions.toLocaleString() : undefined,
            badgeStatus: r.exceptions > 20 ? 'danger' : r.exceptions > 0 ? 'warning' : undefined },
          { field: 'Coverage',      value: r.coverage.toFixed(2) + '%' },
        ]
      },
      {
        label: 'Abacus Reconciliation',
        rows: [
          { field: 'Abacus Ref',    value: 'ABC-' + r.id.padStart(6, '0') },
          { field: 'Rec Status',    value: r.exceptions === 0 ? 'Clean' : 'Break',
            badge: r.exceptions === 0 ? 'Clean' : 'Break',
            badgeStatus: r.exceptions === 0 ? 'success' : 'danger' },
          { field: 'Break Amount',  value: r.exceptions > 0 ? '$ ' + (r.exceptions * 10500).toLocaleString() : '—' },
          { field: 'Source',        value: 'Nightly Batch' },
        ]
      }
    ];
  }

  private statusDot(status: string): string {
    const col = status === 'MATCHED' ? 'var(--color-success)'
              : status === 'EXCEPTION' ? 'var(--color-warning)'
              : status === 'PENDING' ? 'var(--color-info)'
              : 'var(--color-neutral)';
    return `<span style="display:inline-flex;align-items:center;gap:5px;font-size:11px">
      <span style="width:6px;height:6px;border-radius:50%;background:${col};flex-shrink:0"></span>
      ${status.charAt(0) + status.slice(1).toLowerCase()}
    </span>`;
  }
}
