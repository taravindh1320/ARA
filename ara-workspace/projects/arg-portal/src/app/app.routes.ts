import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./core/shell/shell').then(m => m.ShellComponent),
    children: [
      { path: '', redirectTo: 'ara/dashboard', pathMatch: 'full' },

      // ── ARA Neural ───────────────────────────────────────────────────
      {
        path: 'ara-neural/schema',
        loadComponent: () =>
          import('./ara-neural/schema/neural-schema').then(m => m.NeuralSchemaComponent)
      },
      {
        path: 'ara-neural/self-rec',
        loadComponent: () =>
          import('./ara-neural/self-rec/self-rec').then(m => m.SelfRecComponent)
      },

      // ── ARG ──────────────────────────────────────────────────────────
      {
        path: 'arg/dashboard',
        loadComponent: () =>
          import('./arg/dashboard/arg-dashboard').then(m => m.ArgDashboardComponent)
      },
      {
        path: 'arg/workflow',
        loadComponent: () =>
          import('./arg/workflow/arg-workflow').then(m => m.ArgWorkflowComponent)
      },

      // ── ARA ──────────────────────────────────────────────────────────
      {
        path: 'ara/dashboard',
        loadComponent: () =>
          import('./ara/dashboard/dashboard').then(m => m.DashboardComponent)
      },

      // ARA > Main
      {
        path: 'ara/main/search',
        loadComponent: () =>
          import('./ara/search/search').then(m => m.SearchComponent)
      },
      {
        path: 'ara/main/search-read-only',
        loadComponent: () =>
          import('./ara/search-read-only/search-read-only').then(m => m.SearchReadOnlyComponent)
      },
      {
        path: 'ara/main/abacus-lookup',
        loadComponent: () =>
          import('./ara/lookup/lookup').then(m => m.LookupComponent)
      },

      // ARA > Exceptions
      {
        path: 'ara/exceptions/ara-to-abacus',
        loadComponent: () =>
          import('./ara/exceptions/exceptions').then(m => m.ExceptionsComponent),
        data: { queueType: 'ARA → Abacus', queueKey: 'ara-to-abacus', direction: 'outbound' }
      },
      {
        path: 'ara/exceptions/abacus-to-ara',
        loadComponent: () =>
          import('./ara/exceptions/exceptions').then(m => m.ExceptionsComponent),
        data: { queueType: 'Abacus → ARA', queueKey: 'abacus-to-ara', direction: 'inbound' }
      },
      {
        path: 'ara/exceptions/ara-to-recon',
        loadComponent: () =>
          import('./ara/exceptions/exceptions').then(m => m.ExceptionsComponent),
        data: { queueType: 'ARA → Recon', queueKey: 'ara-to-recon', direction: 'outbound' }
      },
      {
        path: 'ara/exceptions/recon-to-ara',
        loadComponent: () =>
          import('./ara/exceptions/exceptions').then(m => m.ExceptionsComponent),
        data: { queueType: 'Recon → ARA', queueKey: 'recon-to-ara', direction: 'inbound' }
      },
      {
        path: 'ara/exceptions/ara-to-bser',
        loadComponent: () =>
          import('./ara/exceptions/exceptions').then(m => m.ExceptionsComponent),
        data: { queueType: 'ARA → BSER', queueKey: 'ara-to-bser', direction: 'outbound' }
      },
      {
        path: 'ara/exceptions/recon-to-ara-bser',
        loadComponent: () =>
          import('./ara/exceptions/exceptions').then(m => m.ExceptionsComponent),
        data: { queueType: 'Recon → ARA BSER', queueKey: 'recon-to-ara-bser', direction: 'inbound' }
      },
      {
        path: 'ara/exceptions/recon-to-ara-new',
        loadComponent: () =>
          import('./ara/exceptions/exceptions').then(m => m.ExceptionsComponent),
        data: { queueType: 'Recon → ARA New', queueKey: 'recon-to-ara-new', direction: 'inbound' }
      },

      // ARA > Other
      {
        path: 'ara/report-repository',
        loadComponent: () =>
          import('./ara/report-repository/report-repository').then(m => m.ReportRepositoryComponent)
      },
      { path: 'ara/feeds', redirectTo: 'ara/feeds/abacus', pathMatch: 'full' },
      {
        path: 'ara/feeds/:feedType',
        loadComponent: () =>
          import('./ara/feeds/feed-recon').then(m => m.FeedReconComponent)
      },

      // ── Settings ─────────────────────────────────────────────────────
      {
        path: 'user-guide',
        loadComponent: () =>
          import('./ara/user-guide/user-guide').then(m => m.UserGuideComponent)
      }
    ]
  },
  { path: '**', redirectTo: 'ara/dashboard' }
];
