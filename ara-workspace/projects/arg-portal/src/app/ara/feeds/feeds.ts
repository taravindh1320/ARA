import { Component, signal } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { PageHeaderComponent, Breadcrumb } from '../shared/page-header/page-header';
import { KpiCardComponent }                from '../shared/kpi-card/kpi-card';

interface Feed {
  id: string; name: string; source: string; target: string;
  frequency: string; lastRun: string; nextRun: string; duration: string;
  recordsIn: number; recordsProcessed: number; recordsRejected: number;
  status: 'SUCCESS' | 'RUNNING' | 'FAILED' | 'STALLED' | 'DISABLED';
  region: string; anomaly: boolean; anomalyDetail: string;
}

function makeFeed(
  id: string, name: string, source: string, target: string, freq: string,
  lastRun: string, nextRun: string, duration: string, recordsIn: number,
  recordsProcessed: number, recordsRejected: number,
  status: Feed['status'], region: string, anomaly: boolean, anomalyDetail: string
): Feed {
  return {
    id, name, source, target, frequency: freq, lastRun, nextRun, duration,
    recordsIn, recordsProcessed, recordsRejected, status, region,
    anomaly, anomalyDetail
  };
}

@Component({
  selector: 'ara-feeds',
  standalone: true,
  imports: [CommonModule, DecimalPipe, PageHeaderComponent, KpiCardComponent],
  templateUrl: './feeds.html',
  styleUrl: './feeds.scss'
})
export class FeedsComponent {
  readonly breadcrumbs: Breadcrumb[] = [
    { label: 'ARA', route: '/ara/dashboard' },
    { label: 'Feeds' }
  ];

  selectedRegion = signal('ALL');
  readonly regions = ['ALL', 'GLOBAL', 'EMEA', 'APAC', 'AMER', 'LATAM'];

  readonly allFeeds: Feed[] = [
    makeFeed('1',  'ARA Full Keys Feed',            'ARA System',      'Abacus',    'Daily',    '2026-03-20 05:00', '2026-03-21 05:00', '4m 12s', 182400, 182311, 89,  'SUCCESS', 'GLOBAL', false, ''),
    makeFeed('2',  'Abacus Position Feed',           'Abacus',          'ARA',       'Daily',    '2026-03-20 05:15', '2026-03-21 05:15', '6m 44s', 94200,  94200,  0,   'SUCCESS', 'GLOBAL', false, ''),
    makeFeed('3',  'EMEA Reference Data',            'Bloomberg',       'ARA',       'Real-time','2026-03-20 10:22', 'Continuous',       '—',      12400,  12400,  0,   'RUNNING', 'EMEA',   false, ''),
    makeFeed('4',  'APAC Price Feed',                'Reuters',         'ARA',       'Hourly',   '2026-03-20 10:00', '2026-03-20 11:00', '1m 02s', 4220,   4220,   0,   'SUCCESS', 'APAC',   false, ''),
    makeFeed('5',  'AMER Equity Prices',             'ICE',             'ARA',       'Daily',    '2026-03-20 06:30', '2026-03-21 06:30', '8m 15s', 74100,  74100,  0,   'SUCCESS', 'AMER',   false, ''),
    makeFeed('6',  'Recon Position File',            'Reconciliation',  'ARA',       'Daily',    '2026-03-19 06:00', '2026-03-20 06:00', '2m 58s', 28800,  28799,  1,   'STALLED', 'GLOBAL', true,  'Feed stalled: no new file received since 06:00 on 2026-03-20'),
    makeFeed('7',  'BSER Reference Data',            'BSER Platform',   'ARA',       'Daily',    '2026-03-20 04:00', '2026-03-21 04:00', '11m 31s',88400,  88201,  199, 'SUCCESS', 'GLOBAL', true,  '199 records rejected: ISIN checksum mismatch'),
    makeFeed('8',  'LATAM Bond Prices',              'FactSet',         'ARA',       'Daily',    '2026-03-20 07:00', '2026-03-21 07:00', '—',      12400,  0,      0,   'FAILED',  'LATAM',  true,  'Connection timeout after 3 retries'),
    makeFeed('9',  'ARA Bank Account Feed',          'ARA System',      'Abacus',    'Daily',    '2026-03-20 05:30', '2026-03-21 05:30', '2m 10s', 41200,  41200,  0,   'SUCCESS', 'GLOBAL', false, ''),
    makeFeed('10', 'EMEA Corporate Actions',         'Bloomberg',       'ARA',       'Daily',    '2026-03-20 07:30', '2026-03-21 07:30', '5m 44s', 2140,   2140,   0,   'SUCCESS', 'EMEA',   false, ''),
    makeFeed('11', 'ARA Abacus Reconciliation Out',  'ARA',             'Recon',     'Weekly',   '2026-03-17 09:00', '2026-03-24 09:00', '14m 08s',244000, 244000, 0,   'SUCCESS', 'GLOBAL', false, ''),
    makeFeed('12', 'FX Rates Feed',                  'Reuters',         'ARA',       'Real-time','2026-03-20 10:22', 'Continuous',       '—',      1880,   1880,   0,   'RUNNING', 'GLOBAL', false, ''),
  ];

  get filteredFeeds(): Feed[] {
    const region = this.selectedRegion();
    return region === 'ALL' ? this.allFeeds : this.allFeeds.filter(f => f.region === region);
  }

  get anomalyCount(): number { return this.allFeeds.filter(f => f.anomaly).length; }
  get failedCount():  number { return this.allFeeds.filter(f => f.status === 'FAILED' || f.status === 'STALLED').length; }
  get runningCount(): number { return this.allFeeds.filter(f => f.status === 'RUNNING').length; }
  get successCount(): number { return this.allFeeds.filter(f => f.status === 'SUCCESS').length; }

  setRegion(r: string): void { this.selectedRegion.set(r); }

  statusClass(s: string) {
    return { SUCCESS: 'success', RUNNING: 'info', FAILED: 'danger', STALLED: 'warning', DISABLED: 'neutral' }[s] ?? 'neutral';
  }

  coveragePct(f: Feed): number {
    if (!f.recordsIn) return 0;
    return Math.round(f.recordsProcessed / f.recordsIn * 100);
  }
}
