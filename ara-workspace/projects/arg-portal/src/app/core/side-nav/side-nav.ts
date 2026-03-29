import { Component, HostListener, inject, input, output, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ThemeService } from '../theme.service';

export interface NavLink {
  label: string;
  route: string;
}

@Component({
  selector: 'app-side-nav',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './side-nav.html',
  styleUrl: './side-nav.scss'
})
export class SideNavComponent {
  collapsed = input(false);
  toggleCollapse = output<void>();

  readonly theme = inject(ThemeService);

  profileMenuOpen = signal(false);

  // Collapsible group state
  araMainOpen    = signal(true);
  exceptionsOpen = signal(false);
  feedsOpen      = signal(false);

  // ── ARA Neural ───────────────────────────────────────────────────
  readonly neuralItems: NavLink[] = [
    { label: 'Neural Schema', route: '/ara-neural/schema' },
    { label: 'ARA Self Rec',  route: '/ara-neural/self-rec' }
  ];

  // ── ARG ──────────────────────────────────────────────────────────
  readonly argItems: NavLink[] = [
    { label: 'Dashboard', route: '/arg/dashboard' },
    { label: 'Workflow',  route: '/arg/workflow'  }
  ];

  // ── ARA top-level ────────────────────────────────────────────────
  readonly araTopItems: NavLink[] = [
    { label: 'Dashboard', route: '/ara/dashboard' }
  ];

  // ── ARA > Main sub-items ─────────────────────────────────────────
  readonly araMainItems: NavLink[] = [
    { label: 'Search',           route: '/ara/main/search'           },
    { label: 'Search Read Only', route: '/ara/main/search-read-only' },
    { label: 'Abacus Lookup',    route: '/ara/main/abacus-lookup'    }
  ];

  // ── ARA > Exceptions ─────────────────────────────────────────────
  readonly exceptionItems: NavLink[] = [
    { label: 'ARA to Abacus',       route: '/ara/exceptions/ara-to-abacus'      },
    { label: 'Abacus to ARA',       route: '/ara/exceptions/abacus-to-ara'      },
    { label: 'ARA to Recon',        route: '/ara/exceptions/ara-to-recon'        },
    { label: 'Recon to ARA',        route: '/ara/exceptions/recon-to-ara'        },
    { label: 'ARA to BSER',         route: '/ara/exceptions/ara-to-bser'         },
    { label: 'Recon to ARA BSER',   route: '/ara/exceptions/recon-to-ara-bser'   },
    { label: 'Recon to ARA New',    route: '/ara/exceptions/recon-to-ara-new'    }
  ];

  // ── ARA other items ──────────────────────────────────────────────
  readonly araOtherItems: NavLink[] = [
    { label: 'Report Repository', route: '/ara/report-repository' }
  ];

  // ── Feeds sub-items ──────────────────────────────────────────────
  readonly feedItems: NavLink[] = [
    { label: 'ARA Abacus Feed', route: '/ara/feeds/abacus' },
    { label: 'RF Feed',        route: '/ara/feeds/rf'     },
    { label: 'DSMT Feed',      route: '/ara/feeds/dsmt'   },
    { label: 'Fails Feed',     route: '/ara/feeds/fails'  },
  ];

  // ── Settings ─────────────────────────────────────────────────────
  readonly settingsItems: NavLink[] = [
    { label: 'User Guide', route: '/user-guide' }
  ];

  toggleAraMain(): void    { this.araMainOpen.update(v => !v); }
  toggleExceptions(): void { this.exceptionsOpen.update(v => !v); }
  toggleFeeds(): void      { this.feedsOpen.update(v => !v); }
  onToggle(): void         { this.toggleCollapse.emit(); }

  toggleProfileMenu(): void { this.profileMenuOpen.update(v => !v); }

  setTheme(t: 'dark' | 'light'): void {
    this.theme.setTheme(t);
    this.profileMenuOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    if (!target.closest('.side-nav__profile-wrap')) {
      this.profileMenuOpen.set(false);
    }
  }
}
