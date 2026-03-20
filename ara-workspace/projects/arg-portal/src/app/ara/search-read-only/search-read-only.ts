import { Component, signal, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { AgGridAngular } from 'ag-grid-angular';
import {
  ColDef,
  GridReadyEvent,
  GetRowIdParams,
  RowClickedEvent,
  AllCommunityModule,
  ModuleRegistry
} from 'ag-grid-community';

import { PageHeaderComponent, Breadcrumb } from '../shared/page-header/page-header';
import { FilterBarComponent }              from '../shared/filter-bar/filter-bar';
import { araGridTheme }                    from '../shared/ara-grid-theme';

ModuleRegistry.registerModules([AllCommunityModule]);

interface AraRecord {
  id: string; isin: string; securityName: string; region: string;
  accountType: string; status: string; matched: number; exceptions: number;
  coverage: number; lastUpdated: string; owner: string;
}

function make(
  id: string, isin: string, name: string, region: string,
  acct: string, status: string, matched: number, exc: number, owner: string, date: string
): AraRecord {
  const total = matched + exc;
  return { id, isin, securityName: name, region, accountType: acct, status,
           matched, exceptions: exc, coverage: total ? Math.round(matched / total * 1000) / 10 : 0,
           lastUpdated: date, owner };
}

@Component({
  selector: 'ara-search-read-only',
  standalone: true,
  imports: [CommonModule, DecimalPipe, AgGridAngular, PageHeaderComponent, FilterBarComponent],
  templateUrl: './search-read-only.html',
  styleUrl: './search-read-only.scss'
})
export class SearchReadOnlyComponent implements OnInit {
  readonly breadcrumbs: Breadcrumb[] = [
    { label: 'ARA', route: '/ara/dashboard' },
    { label: 'Main', route: '/ara/main/search' },
    { label: 'Search Read Only' }
  ];

  readonly theme = araGridTheme;
  selectedRow = signal<AraRecord | null>(null);
  filteredData = signal<AraRecord[]>([]);

  private readonly allRecords: AraRecord[] = [
    make('1',  'US0231351067', 'Apple Inc',              'AMER',   'Equity', 'MATCHED',   2140, 12,  'A.Williams', '2026-03-20'),
    make('2',  'US5949181045', 'Microsoft Corporation',  'AMER',   'Equity', 'MATCHED',   1920, 8,   'B.Thompson', '2026-03-20'),
    make('3',  'GB0002634946', 'Shell PLC',              'EMEA',   'Equity', 'EXCEPTION', 1050, 124, 'C.Davis',    '2026-03-19'),
    make('4',  'JP3633400001', 'Toyota Motor',           'APAC',   'Equity', 'MATCHED',   880,  22,  'D.Tanaka',   '2026-03-20'),
    make('5',  'DE0005140008', 'Deutsche Bank',          'EMEA',   'Bond',   'PARTIAL',   560,  70,  'E.Mueller',  '2026-03-19'),
    make('6',  'US46625H1005', 'JPMorgan Chase',         'AMER',   'Bond',   'MATCHED',   3200, 5,   'F.Johnson',  '2026-03-20'),
    make('7',  'FR0000131104', 'BNP Paribas',            'EMEA',   'Bond',   'EXCEPTION', 400,  88,  'G.Dupont',   '2026-03-18'),
    make('8',  'HK0000069689', 'HSBC Holdings HK',       'APAC',   'Equity', 'MATCHED',   1100, 15,  'H.Chen',     '2026-03-20'),
    make('9',  'SG1L01001701', 'DBS Group Holdings',     'APAC',   'Equity', 'PARTIAL',   720,  44,  'I.Lim',      '2026-03-19'),
    make('10', 'CH0012221716', 'ABB Ltd',                'EMEA',   'Equity', 'MATCHED',   620,  9,   'J.Weber',    '2026-03-20'),
    make('11', 'US9255521085', 'Walt Disney',            'AMER',   'Equity', 'MATCHED',   1440, 18,  'K.Brown',    '2026-03-20'),
    make('12', 'AU000000CBA7', 'Commonwealth Bank AU',   'APAC',   'Equity', 'EXCEPTION', 290,  55,  'L.Smith',    '2026-03-18'),
    make('13', 'US7134481081', 'PepsiCo Inc',            'AMER',   'Equity', 'MATCHED',   1680, 7,   'M.Garcia',   '2026-03-20'),
    make('14', 'GB00BH4HKS39', 'Barclays PLC',           'EMEA',   'Bond',   'PARTIAL',   540,  66,  'N.Jones',    '2026-03-19'),
    make('15', 'US4592001014', 'IBM Corporation',        'AMER',   'Equity', 'MATCHED',   990,  11,  'O.Wilson',   '2026-03-20'),
  ];

  readonly columnDefs: ColDef[] = [
    { field: 'isin',         headerName: 'ISIN',          width: 140, pinned: 'left' },
    { field: 'securityName', headerName: 'Security',      flex: 1,    minWidth: 180 },
    { field: 'region',       headerName: 'Region',        width: 90 },
    { field: 'accountType',  headerName: 'Acct Type',     width: 100 },
    { field: 'status',       headerName: 'Status',        width: 110,
      cellRenderer: (p: { value: string }) =>
        `<span class="badge badge--${p.value?.toLowerCase()}">${p.value}</span>` },
    { field: 'matched',      headerName: 'Matched',       width: 95,  type: 'numericColumn' },
    { field: 'exceptions',   headerName: 'Exceptions',    width: 105, type: 'numericColumn',
      cellStyle: (p: { value: number }) => p.value > 50 ? { color: '#f87171' } : null },
    { field: 'coverage',     headerName: 'Coverage %',    width: 105, type: 'numericColumn',
      cellStyle: (p: { value: number }) => ({
        color: p.value >= 90 ? '#34d399' : p.value >= 70 ? '#fbbf24' : '#f87171'
      }) },
    { field: 'owner',        headerName: 'Owner',         width: 120 },
    { field: 'lastUpdated',  headerName: 'Last Updated',  width: 115 }
  ];

  readonly defaultColDef: ColDef = {
    sortable: true, filter: true, resizable: true,
    suppressMovable: false
  };

  getRowId = (p: GetRowIdParams) => p.data.id;

  ngOnInit(): void { this.filteredData.set([...this.allRecords]); }

  onGridReady(_e: GridReadyEvent): void {}

  onRowClicked(e: RowClickedEvent): void {
    this.selectedRow.set(e.data as AraRecord);
  }

  onSearch(term: string): void {
    const t = term.toLowerCase();
    this.filteredData.set(
      t ? this.allRecords.filter(r =>
        r.isin.toLowerCase().includes(t) ||
        r.securityName.toLowerCase().includes(t) ||
        r.owner.toLowerCase().includes(t)
      ) : [...this.allRecords]
    );
  }
}
