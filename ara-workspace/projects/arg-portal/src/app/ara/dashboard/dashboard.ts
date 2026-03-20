import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PageHeaderComponent, Breadcrumb } from '../shared/page-header/page-header';

type Region = 'EMEA' | 'APAC' | 'LATAM' | 'NAM' | 'GLOBAL';

interface RegionMetrics {
  fullkeys:             number;
  fullyLinked:          number;
  bankAccounts:         number;
  thirdPartyBanks:      number;
  totalBankAccounts:    number;
  citibankAccounts:     number;
  thirdPartyBankAccts:  number;
  reconAuto:            number;
  reconNonAuto:         number;
}

interface CategoryRow {
  label:      string;
  count:      number;
  total:      number;
  colorVar:   string;
}

interface CategoryPanel {
  title:  string;
  rows:   CategoryRow[];
}

/** Rows used in both the global matrix and the country-split table */
interface TableRow {
  label:  string;
  values: Record<string, number>;
}

interface TableView {
  title:   string;
  columns: string[];   // ordered column keys (region names or country names)
  rows:    TableRow[];
}

@Component({
  selector: 'ara-dashboard',
  standalone: true,
  imports: [CommonModule, PageHeaderComponent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class DashboardComponent {

  readonly breadcrumbs: Breadcrumb[] = [
    { label: 'ARA', route: '/ara/dashboard' },
    { label: 'Dashboard' }
  ];

  readonly lastRefresh = 'Last refreshed: Today, 09:42 AM';

  activeTab    = signal<'fullkeys' | 'bankaccounts'>('fullkeys');
  selectedRegion = signal<Region>('GLOBAL');

  readonly regions: Region[] = ['EMEA', 'APAC', 'LATAM', 'NAM', 'GLOBAL'];

  // ── Per-region metrics data ────────────────────────────────────────
  private readonly data: Record<Region, RegionMetrics> = {
    APAC:  { fullkeys: 18420, fullyLinked: 16740, bankAccounts: 5980,  thirdPartyBanks: 312,  totalBankAccounts: 6920,  citibankAccounts: 3840,  thirdPartyBankAccts: 3080,  reconAuto: 14200, reconNonAuto: 4220 },
    EMEA:  { fullkeys: 22340, fullyLinked: 21200, bankAccounts: 8200,  thirdPartyBanks: 489,  totalBankAccounts: 9140,  citibankAccounts: 5320,  thirdPartyBankAccts: 3820,  reconAuto: 19800, reconNonAuto: 2540 },
    LATAM: { fullkeys:  7820, fullyLinked:  7340, bankAccounts: 2900,  thirdPartyBanks: 178,  totalBankAccounts: 3180,  citibankAccounts: 1740,  thirdPartyBankAccts: 1440,  reconAuto:  6920, reconNonAuto:  900 },
    NAM:   { fullkeys: 31200, fullyLinked: 27840, bankAccounts: 11400, thirdPartyBanks: 723,  totalBankAccounts: 13280, citibankAccounts: 7640,  thirdPartyBankAccts: 5640,  reconAuto: 25600, reconNonAuto: 5600 },
    GLOBAL:{ fullkeys: 79780, fullyLinked: 73120, bankAccounts: 28480, thirdPartyBanks: 1702, totalBankAccounts: 32520, citibankAccounts: 18540, thirdPartyBankAccts: 13980, reconAuto: 66520, reconNonAuto: 13260 },
  };

  // Region colors for the donut (EMEA, APAC, LATAM, NAM, GLOBAL-solid)
  private readonly regionColors: Record<string, string> = {
    EMEA:  '#4A9EE0',
    APAC:  '#00C4B3',
    LATAM: '#F5A623',
    NAM:   '#8B5CF6',
    GLOBAL:'#00C4B3',
  };

  // ── Country-level breakdown data ───────────────────────────────────
  private readonly countryData: Record<Exclude<Region, 'GLOBAL'>, Record<string, RegionMetrics>> = {
    EMEA: {
      UK:       { fullkeys: 6820, fullyLinked: 6580, bankAccounts: 2540, thirdPartyBanks: 148, totalBankAccounts: 2820, citibankAccounts: 1560, thirdPartyBankAccts: 1260, reconAuto: 6020, reconNonAuto:  800 },
      Germany:  { fullkeys: 5240, fullyLinked: 5020, bankAccounts: 1980, thirdPartyBanks: 112, totalBankAccounts: 2180, citibankAccounts: 1240, thirdPartyBankAccts:  940, reconAuto: 4680, reconNonAuto:  560 },
      France:   { fullkeys: 4480, fullyLinked: 4240, bankAccounts: 1640, thirdPartyBanks:  94, totalBankAccounts: 1820, citibankAccounts: 1020, thirdPartyBankAccts:  800, reconAuto: 4020, reconNonAuto:  460 },
      Ireland:  { fullkeys: 3180, fullyLinked: 3080, bankAccounts: 1120, thirdPartyBanks:  68, totalBankAccounts: 1240, citibankAccounts:  720, thirdPartyBankAccts:  520, reconAuto: 2880, reconNonAuto:  300 },
      UAE:      { fullkeys: 2620, fullyLinked: 2280, bankAccounts:  920, thirdPartyBanks:  67, totalBankAccounts: 1080, citibankAccounts:  780, thirdPartyBankAccts:  300, reconAuto: 2200, reconNonAuto:  420 },
    },
    APAC: {
      India:     { fullkeys: 5840, fullyLinked: 5220, bankAccounts: 1840, thirdPartyBanks:  98, totalBankAccounts: 2140, citibankAccounts: 1200, thirdPartyBankAccts:  940, reconAuto: 4560, reconNonAuto: 1280 },
      Singapore: { fullkeys: 4120, fullyLinked: 3880, bankAccounts: 1420, thirdPartyBanks:  74, totalBankAccounts: 1620, citibankAccounts:  940, thirdPartyBankAccts:  680, reconAuto: 3620, reconNonAuto:  500 },
      HongKong:  { fullkeys: 3680, fullyLinked: 3480, bankAccounts: 1280, thirdPartyBanks:  62, totalBankAccounts: 1480, citibankAccounts:  860, thirdPartyBankAccts:  620, reconAuto: 3260, reconNonAuto:  420 },
      Japan:     { fullkeys: 2960, fullyLinked: 2740, bankAccounts:  920, thirdPartyBanks:  48, totalBankAccounts: 1080, citibankAccounts:  580, thirdPartyBankAccts:  500, reconAuto: 2520, reconNonAuto:  440 },
      Australia: { fullkeys: 1820, fullyLinked: 1420, bankAccounts:  520, thirdPartyBanks:  30, totalBankAccounts:  600, citibankAccounts:  260, thirdPartyBankAccts:  340, reconAuto: 1240, reconNonAuto:  580 },
    },
    LATAM: {
      Mexico:    { fullkeys: 2480, fullyLinked: 2340, bankAccounts:  920, thirdPartyBanks:  58, totalBankAccounts: 1020, citibankAccounts:  560, thirdPartyBankAccts:  460, reconAuto: 2180, reconNonAuto:  300 },
      Brazil:    { fullkeys: 2140, fullyLinked: 1980, bankAccounts:  800, thirdPartyBanks:  48, totalBankAccounts:  880, citibankAccounts:  480, thirdPartyBankAccts:  400, reconAuto: 1880, reconNonAuto:  260 },
      Colombia:  { fullkeys: 1420, fullyLinked: 1360, bankAccounts:  540, thirdPartyBanks:  34, totalBankAccounts:  600, citibankAccounts:  340, thirdPartyBankAccts:  260, reconAuto: 1280, reconNonAuto:  140 },
      Argentina: { fullkeys:  980, fullyLinked:  920, bankAccounts:  380, thirdPartyBanks:  24, totalBankAccounts:  420, citibankAccounts:  220, thirdPartyBankAccts:  200, reconAuto:  860, reconNonAuto:  120 },
      Chile:     { fullkeys:  800, fullyLinked:  740, bankAccounts:  260, thirdPartyBanks:  14, totalBankAccounts:  260, citibankAccounts:  140, thirdPartyBankAccts:  120, reconAuto:  720, reconNonAuto:   80 },
    },
    NAM: {
      USA:    { fullkeys: 26840, fullyLinked: 23940, bankAccounts: 9840, thirdPartyBanks: 628, totalBankAccounts: 11480, citibankAccounts: 6600, thirdPartyBankAccts: 4880, reconAuto: 22020, reconNonAuto: 4820 },
      Canada: { fullkeys:  4360, fullyLinked:  3900, bankAccounts: 1560, thirdPartyBanks:  95, totalBankAccounts:  1800, citibankAccounts: 1040, thirdPartyBankAccts:  760, reconAuto:  3580, reconNonAuto:  780 },
    },
  };

  // Metric label definitions shared by both table modes
  private readonly metricDefs: Array<{ label: string; key: keyof RegionMetrics }> = [
    { label: 'No of Fullkeys',                             key: 'fullkeys'            },
    { label: 'Total Bank Accounts',                        key: 'bankAccounts'        },
    { label: 'No of Third Party Banks',                    key: 'thirdPartyBanks'     },
    { label: 'Total No of Bank Accounts (All Types)',      key: 'totalBankAccounts'   },
    { label: 'Bank Accounts with Citibank',                key: 'citibankAccounts'    },
    { label: 'Bank Accounts with Third Party Bank',        key: 'thirdPartyBankAccts' },
    { label: 'Recon Platforms: Automated on Recon',        key: 'reconAuto'           },
    { label: 'Recon Platforms: Not Automated on Recon',    key: 'reconNonAuto'        },
  ];

  // ── Derived state ──────────────────────────────────────────────────

  activeMetrics = computed<RegionMetrics>(() => this.data[this.selectedRegion()]);

  /** CSS conic-gradient string for the donut chart */
  donutGradient = computed<string>(() => {
    const reg = this.selectedRegion();
    if (reg !== 'GLOBAL') {
      // Two-tone: Fully Linked vs Not
      const m = this.data[reg];
      const pct = (m.fullyLinked / m.fullkeys * 100).toFixed(1);
      return `conic-gradient(#00C4B3 0% ${pct}%, #EF4444 ${pct}% 100%)`;
    }
    // Multi-region breakdown
    const regions: Region[] = ['EMEA', 'APAC', 'LATAM', 'NAM'];
    const total = regions.reduce((s, r) => s + this.data[r].fullkeys, 0);
    let acc = 0;
    const stops = regions.map(r => {
      const from = acc;
      acc += (this.data[r].fullkeys / total * 100);
      return `${this.regionColors[r]} ${from.toFixed(1)}% ${acc.toFixed(1)}%`;
    });
    return `conic-gradient(${stops.join(', ')})`;
  });

  donutCenter = computed<{ value: string; label: string }>(() => {
    const m = this.activeMetrics();
    const reg = this.selectedRegion();
    if (this.activeTab() === 'bankaccounts') {
      return { value: this.fmt(m.bankAccounts), label: 'Bank Accts' };
    }
    return reg === 'GLOBAL'
      ? { value: this.fmt(m.fullkeys), label: 'Total' }
      : { value: (m.fullyLinked / m.fullkeys * 100).toFixed(1) + '%', label: 'Fully Linked' };
  });

  donutLegend = computed<Array<{ label: string; color: string; count: number }>>(() => {
    const reg = this.selectedRegion();
    if (reg !== 'GLOBAL') {
      const m = this.data[reg];
      return [
        { label: 'Fully Linked',     color: '#00C4B3', count: m.fullyLinked },
        { label: 'Non Fully Linked', color: '#EF4444', count: m.fullkeys - m.fullyLinked },
      ];
    }
    return (['EMEA', 'APAC', 'LATAM', 'NAM'] as Region[]).map(r => ({
      label: r,
      color: this.regionColors[r],
      count: this.data[r].fullkeys,
    }));
  });

  categoryPanels = computed<CategoryPanel[]>(() => {
    const m = this.activeMetrics();
    return [
      {
        title: 'Data Completeness',
        rows: [
          { label: 'Fully Linked',     count: m.fullyLinked,              total: m.fullkeys,   colorVar: '--teal-500'     },
          { label: 'Non Fully Linked', count: m.fullkeys - m.fullyLinked, total: m.fullkeys,   colorVar: '--color-danger' },
        ]
      },
      {
        title: 'Reconciliation Platforms',
        rows: [
          { label: 'Automated on Recon',     count: m.reconAuto,    total: m.reconAuto + m.reconNonAuto, colorVar: '--teal-500'      },
          { label: 'Non-Automated on Recon', count: m.reconNonAuto, total: m.reconAuto + m.reconNonAuto, colorVar: '--color-warning' },
        ]
      },
      {
        title: 'Bank Accounts',
        rows: [
          { label: 'Found in Abacus',     count: m.totalBankAccounts - (m.totalBankAccounts - m.bankAccounts),
            total: m.totalBankAccounts, colorVar: '--teal-500'      },
          { label: 'Not Found in Abacus', count: m.totalBankAccounts - m.bankAccounts,
            total: m.totalBankAccounts, colorVar: '--color-danger' },
        ]
      }
    ];
  });

  // ── Active table view (GLOBAL = region matrix, region = country split) ──

  activeTableView = computed<TableView>(() => {
    const reg = this.selectedRegion();

    if (reg === 'GLOBAL') {
      // Region comparison matrix — 5 columns
      const cols = ['APAC', 'EMEA', 'LATAM', 'NAM', 'GLOBAL'];
      const rows: TableRow[] = this.metricDefs.map(({ label, key }) => ({
        label,
        values: {
          APAC:   this.data.APAC[key]   as number,
          EMEA:   this.data.EMEA[key]   as number,
          LATAM:  this.data.LATAM[key]  as number,
          NAM:    this.data.NAM[key]    as number,
          GLOBAL: this.data.GLOBAL[key] as number,
        }
      }));
      return { title: 'Global Region Matrix', columns: cols, rows };
    }

    // Country-level split for the selected region
    const countries = this.countryData[reg as Exclude<Region, 'GLOBAL'>];
    const cols = Object.keys(countries);
    const rows: TableRow[] = this.metricDefs.map(({ label, key }) => ({
      label,
      values: Object.fromEntries(cols.map(c => [c, countries[c][key] as number]))
    }));
    return { title: `${reg} Country Split`, columns: cols, rows };
  });

  // ── Helpers ────────────────────────────────────────────────────────

  setTab(tab: 'fullkeys' | 'bankaccounts'): void { this.activeTab.set(tab); }
  setRegion(r: Region): void { this.selectedRegion.set(r); }

  pct(count: number, total: number): string {
    if (!total) return '0.0';
    return (count / total * 100).toFixed(1);
  }

  barWidth(count: number, total: number): string {
    if (!total) return '0%';
    return (count / total * 100).toFixed(1) + '%';
  }

  fmt(n: number): string {
    return n.toLocaleString();
  }
}
