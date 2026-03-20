import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridAngular } from 'ag-grid-angular';
import {
  ColDef, GridReadyEvent, RowClickedEvent,
  GetRowIdParams, AllCommunityModule, ModuleRegistry
} from 'ag-grid-community';

import { PageHeaderComponent, Breadcrumb } from '../../ara/shared/page-header/page-header';
import { KpiCardComponent }                from '../../ara/shared/kpi-card/kpi-card';
import { FilterBarComponent }              from '../../ara/shared/filter-bar/filter-bar';
import { araGridTheme }                    from '../../ara/shared/ara-grid-theme';

ModuleRegistry.registerModules([AllCommunityModule]);

export interface WorkflowItem {
  id: string; ref: string; description: string; type: string;
  submittedBy: string; submittedDate: string; region: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'ON_HOLD';
  dueDate: string; assignedTo: string; comments: string; overdue: boolean;
}

function makeItem(
  id: string, ref: string, desc: string, type: string, submittedBy: string,
  submittedDate: string, region: string, priority: WorkflowItem['priority'],
  status: WorkflowItem['status'], dueDate: string, assignedTo: string,
  comments: string, overdue: boolean
): WorkflowItem {
  return { id, ref, description: desc, type, submittedBy, submittedDate,
           region, priority, status, dueDate, assignedTo, comments, overdue };
}

@Component({
  selector: 'arg-workflow',
  standalone: true,
  imports: [CommonModule, AgGridAngular, PageHeaderComponent, KpiCardComponent, FilterBarComponent],
  templateUrl: './arg-workflow.html',
  styleUrl: './arg-workflow.scss'
})
export class ArgWorkflowComponent implements OnInit {
  readonly breadcrumbs: Breadcrumb[] = [
    { label: 'ARG', route: '/arg/dashboard' },
    { label: 'Workflow' }
  ];

  readonly theme = araGridTheme;
  selectedItem = signal<WorkflowItem | null>(null);
  drawerOpen   = signal(false);
  filteredData = signal<WorkflowItem[]>([]);

  private readonly allItems: WorkflowItem[] = [
    makeItem('1',  'ARG-2024-0891', 'Reference data update – EMEA equity basket',     'Ref Data',    'C.Davis',     '2026-03-20', 'EMEA',   'HIGH',     'PENDING',   '2026-03-21', 'J.Manager',  'Awaiting sign-off',          false),
    makeItem('2',  'ARG-2024-0892', 'New account mapping – APAC bonds',               'Mapping',     'D.Tanaka',    '2026-03-19', 'APAC',   'CRITICAL', 'IN_REVIEW', '2026-03-20', 'P.Harris',   'Under senior review',        true),
    makeItem('3',  'ARG-2024-0893', 'Currency correction – LATAM FX',                 'Correction',  'E.Rodriguez', '2026-03-19', 'LATAM',  'MEDIUM',   'PENDING',   '2026-03-22', 'J.Manager',  'Pending FX team input',      false),
    makeItem('4',  'ARG-2024-0894', 'Counterparty identifier refresh',                'Identifier',  'A.Williams',  '2026-03-18', 'AMER',   'HIGH',     'ON_HOLD',   '2026-03-20', 'J.Manager',  'Waiting on legal approval',  true),
    makeItem('5',  'ARG-2024-0895', 'Index constituent update – GLOBAL',              'Index',       'B.Thompson',  '2026-03-20', 'GLOBAL', 'MEDIUM',   'IN_REVIEW', '2026-03-23', 'L.Anderson', 'Cross-region validation',    false),
    makeItem('6',  'ARG-2024-0896', 'Rate reset – fixed income schedules',            'Rate',        'F.Johnson',   '2026-03-17', 'AMER',   'LOW',      'PENDING',   '2026-03-25', 'J.Manager',  '',                           false),
    makeItem('7',  'ARG-2024-0887', 'Sector reclassification – tech equities',        'Classif.',    'G.Dupont',    '2026-03-16', 'EMEA',   'HIGH',     'APPROVED',  '2026-03-18', 'P.Harris',   'Fully reviewed and approved', false),
    makeItem('8',  'ARG-2024-0885', 'LEI code update – 140 counterparties',           'LEI',         'H.Chen',      '2026-03-15', 'APAC',   'MEDIUM',   'APPROVED',  '2026-03-17', 'J.Manager',  'Batch processed',            false),
    makeItem('9',  'ARG-2024-0882', 'Bloomberg identifier mismatch correction',       'Identifier',  'K.Brown',     '2026-03-14', 'AMER',   'CRITICAL', 'REJECTED',  '2026-03-15', 'P.Harris',   'Data quality insufficient',   false),
    makeItem('10', 'ARG-2024-0879', 'Missing ISIN – 22 new listings',                'Ref Data',    'I.Lim',       '2026-03-13', 'APAC',   'HIGH',     'REJECTED',  '2026-03-14', 'L.Anderson', 'Returned to issuer',         false),
    makeItem('11', 'ARG-2024-0876', 'Dividend schedule correction – FY2026',         'Dividend',    'M.Garcia',    '2026-03-12', 'AMER',   'MEDIUM',   'APPROVED',  '2026-03-15', 'J.Manager',  'Confirmed with ops team',    false),
    makeItem('12', 'ARG-2024-0870', 'Margin rate update – repo desk',                'Rate',        'N.Jones',     '2026-03-10', 'EMEA',   'HIGH',     'APPROVED',  '2026-03-12', 'P.Harris',   'Auto-validated by system',   false),
  ];

  readonly columnDefs: ColDef[] = [
    { field: 'ref',          headerName: 'Reference',    width: 148, pinned: 'left',
      cellStyle: { color: 'var(--teal-400)', fontFamily: "'Roboto Mono', monospace", fontSize: '11px' } },
    { field: 'description',  headerName: 'Description',  flex: 1, minWidth: 220 },
    { field: 'type',         headerName: 'Type',         width: 110 },
    { field: 'region',       headerName: 'Region',       width: 85 },
    { field: 'priority',     headerName: 'Priority',     width: 100,
      cellRenderer: (p: { value: string }) => {
        const cls = { CRITICAL: 'danger', HIGH: 'warning', MEDIUM: 'info', LOW: 'neutral' }[p.value] ?? 'neutral';
        return `<span class="badge badge--${cls} badge--xs">${p.value}</span>`;
      }},
    { field: 'status',       headerName: 'Status',       width: 115,
      cellRenderer: (p: { value: string }) => {
        const cls = { PENDING: 'warning', IN_REVIEW: 'info', APPROVED: 'success', REJECTED: 'danger', ON_HOLD: 'neutral' }[p.value] ?? 'neutral';
        return `<span class="badge badge--${cls}">${p.value.replace('_', ' ')}</span>`;
      }},
    { field: 'assignedTo',   headerName: 'Assigned To',  width: 120 },
    { field: 'dueDate',      headerName: 'Due Date',     width: 110 },
    { field: 'submittedBy',  headerName: 'Submitted By', width: 120 },
  ];

  readonly defaultColDef: ColDef = {
    sortable: true, filter: true, resizable: true
  };

  getRowId = (p: GetRowIdParams) => p.data.id;

  ngOnInit(): void { this.filteredData.set([...this.allItems]); }
  onGridReady(_e: GridReadyEvent): void {}

  onRowClicked(e: RowClickedEvent): void {
    this.selectedItem.set(e.data as WorkflowItem);
    this.drawerOpen.set(true);
  }

  closeDrawer(): void { this.drawerOpen.set(false); }

  onSearch(term: string): void {
    const t = term.toLowerCase();
    this.filteredData.set(
      t ? this.allItems.filter(i =>
        i.ref.toLowerCase().includes(t) ||
        i.description.toLowerCase().includes(t) ||
        i.submittedBy.toLowerCase().includes(t) ||
        i.assignedTo.toLowerCase().includes(t)
      ) : [...this.allItems]
    );
  }

  priorityClass(p: string) {
    return { 'CRITICAL': 'danger', HIGH: 'warning', MEDIUM: 'info', LOW: 'neutral' }[p] ?? 'neutral';
  }

  statusClass(s: string) {
    return { PENDING: 'warning', IN_REVIEW: 'info', APPROVED: 'success', REJECTED: 'danger', ON_HOLD: 'neutral' }[s] ?? 'neutral';
  }

  statusLabel(s: string): string {
    return s.replace(/_/g, ' ');
  }
}
