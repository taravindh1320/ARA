import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PageHeaderComponent, Breadcrumb } from '../shared/page-header/page-header';
import { FilterBarComponent }              from '../shared/filter-bar/filter-bar';

interface Report {
  id: string; name: string; type: string; frequency: string;
  format: string; owner: string; lastGenerated: string;
  nextScheduled: string; status: 'AVAILABLE' | 'GENERATING' | 'FAILED' | 'PENDING';
  sizeKb: number; region: string;
}

function makeReport(
  id: string, name: string, type: string, freq: string, fmt: string,
  owner: string, lastGen: string, next: string,
  status: Report['status'], sizeKb: number, region: string
): Report {
  return { id, name, type, frequency: freq, format: fmt, owner,
           lastGenerated: lastGen, nextScheduled: next, status, sizeKb, region };
}

@Component({
  selector: 'ara-report-repository',
  standalone: true,
  imports: [CommonModule, PageHeaderComponent, FilterBarComponent],
  templateUrl: './report-repository.html',
  styleUrl: './report-repository.scss'
})
export class ReportRepositoryComponent {
  readonly breadcrumbs: Breadcrumb[] = [
    { label: 'ARA', route: '/ara/dashboard' },
    { label: 'Report Repository' }
  ];

  searchTerm = signal('');
  selectedType = signal('All');

  readonly reportTypes = ['All', 'Coverage', 'Exceptions', 'Reconciliation', 'Feed Summary', 'Audit'];

  readonly reports: Report[] = [
    makeReport('1',  'ARA Daily Coverage Summary',            'Coverage',       'Daily',        'Excel',  'A.Williams',  '2026-03-20 06:00', '2026-03-21 06:00', 'AVAILABLE',  142, 'GLOBAL'),
    makeReport('2',  'EMEA Exception Queue Report',            'Exceptions',     'Daily',        'PDF',    'C.Davis',     '2026-03-20 07:30', '2026-03-21 07:30', 'AVAILABLE',  88,  'EMEA'),
    makeReport('3',  'ARA to Abacus Reconciliation',          'Reconciliation', 'Weekly',       'Excel',  'B.Thompson',  '2026-03-17 09:00', '2026-03-24 09:00', 'AVAILABLE',  256, 'GLOBAL'),
    makeReport('4',  'Feed Ingestion Health Summary',          'Feed Summary',   'Daily',        'CSV',    'D.Tanaka',    '2026-03-20 05:00', '2026-03-21 05:00', 'AVAILABLE',  34,  'APAC'),
    makeReport('5',  'APAC Coverage Drill-Down',               'Coverage',       'Weekly',       'Excel',  'D.Tanaka',    '2026-03-17 08:00', '2026-03-24 08:00', 'AVAILABLE',  198, 'APAC'),
    makeReport('6',  'Exception Aging Analysis',               'Exceptions',     'Weekly',       'PDF',    'E.Rodriguez', '2026-03-17 10:00', '2026-03-24 10:00', 'AVAILABLE',  115, 'GLOBAL'),
    makeReport('7',  'Recon to ARA BSER Summary',             'Reconciliation', 'Monthly',      'Excel',  'F.Johnson',   '2026-03-01 06:00', '2026-04-01 06:00', 'AVAILABLE',  312, 'AMER'),
    makeReport('8',  'ARA User Audit Trail',                   'Audit',          'Monthly',      'PDF',    'Admin',       '2026-03-01 05:00', '2026-04-01 05:00', 'AVAILABLE',  88,  'GLOBAL'),
    makeReport('9',  'LATAM Bank Account Coverage',            'Coverage',       'Daily',        'Excel',  'E.Rodriguez', '2026-03-20 07:00', '2026-03-21 07:00', 'GENERATING', 0,   'LATAM'),
    makeReport('10', 'Abacus Feed Quality Report',             'Feed Summary',   'Daily',        'CSV',    'G.Dupont',    '2026-03-19 05:00', '2026-03-20 05:00', 'FAILED',     0,   'EMEA'),
    makeReport('11', 'Monthly Coverage Health Board Report',   'Coverage',       'Monthly',      'PDF',    'A.Williams',  '2026-03-01 06:00', '2026-04-01 06:00', 'AVAILABLE',  540, 'GLOBAL'),
    makeReport('12', 'ARA to Recon Exception Detail',          'Exceptions',     'Ad-hoc',       'Excel',  'K.Brown',     '2026-03-18 14:22', 'On demand',        'AVAILABLE',  167, 'AMER'),
  ];

  get filteredReports(): Report[] {
    const term = this.searchTerm().toLowerCase();
    const type = this.selectedType();
    return this.reports.filter(r => {
      const matchesType = type === 'All' || r.type === type;
      const matchesTerm = !term ||
        r.name.toLowerCase().includes(term) ||
        r.owner.toLowerCase().includes(term) ||
        r.region.toLowerCase().includes(term);
      return matchesType && matchesTerm;
    });
  }

  setType(t: string): void { this.selectedType.set(t); }
  onSearch(t: string): void { this.searchTerm.set(t); }
  countByStatus(s: string): number { return this.reports.filter(r => r.status === s).length; }
  statusClass(s: string) {
    return { AVAILABLE: 'success', GENERATING: 'info', FAILED: 'danger', PENDING: 'warning' }[s] ?? 'neutral';
  }
  formatSize(kb: number): string {
    if (!kb) return '—';
    return kb >= 1024 ? (kb / 1024).toFixed(1) + ' MB' : kb + ' KB';
  }
}
