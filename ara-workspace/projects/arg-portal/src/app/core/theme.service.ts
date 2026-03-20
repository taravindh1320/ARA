import { Injectable, signal, computed } from '@angular/core';

export type Theme = 'dark' | 'light';

@Injectable({ providedIn: 'root' })
export class ThemeService {

  private readonly STORAGE_KEY = 'ara-theme';

  private readonly _theme = signal<Theme>(this._loadTheme());

  /** Read-only exposed signal — use in templates with `themeService.theme()` */
  readonly theme = this._theme.asReadonly();
  readonly isDark  = computed(() => this._theme() === 'dark');
  readonly isLight = computed(() => this._theme() === 'light');

  constructor() {
    // Apply persisted theme immediately on boot — before any render
    this._applyTheme(this._theme());
  }

  setTheme(theme: Theme): void {
    this._theme.set(theme);
    this._applyTheme(theme);
    try { localStorage.setItem(this.STORAGE_KEY, theme); } catch { /* SSR / private mode */ }
  }

  toggle(): void {
    this.setTheme(this._theme() === 'dark' ? 'light' : 'dark');
  }

  private _loadTheme(): Theme {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY) as Theme | null;
      if (stored === 'light' || stored === 'dark') return stored;
    } catch { /* ignore */ }
    return 'dark'; // default
  }

  private _applyTheme(theme: Theme): void {
    document.documentElement.setAttribute('data-theme', theme);
  }
}
