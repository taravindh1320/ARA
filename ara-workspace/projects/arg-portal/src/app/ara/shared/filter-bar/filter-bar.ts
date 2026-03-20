import { Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface FilterOption {
  label: string;
  value: string;
}

@Component({
  selector: 'ara-filter-bar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './filter-bar.html',
  styleUrl: './filter-bar.scss'
})
export class FilterBarComponent {
  searchPlaceholder = input('Search...');
  showDateRange     = input(false);
  showRegion        = input(false);
  showStatus        = input(false);
  showAdvanced      = input(false);

  searchValue   = signal('');
  regionValue   = signal('');
  statusValue   = signal('');
  advancedOpen  = signal(false);

  searchChange = output<string>();
  applyFilter  = output<Record<string, string>>();
  clearFilter  = output<void>();

  onSearch(value: string): void {
    this.searchValue.set(value);
    this.searchChange.emit(value);
  }

  onApply(): void {
    this.applyFilter.emit({
      search: this.searchValue(),
      region: this.regionValue(),
      status: this.statusValue()
    });
  }

  onClear(): void {
    this.searchValue.set('');
    this.regionValue.set('');
    this.statusValue.set('');
    this.clearFilter.emit();
  }

  toggleAdvanced(): void {
    this.advancedOpen.update(v => !v);
  }

  readonly regionOptions: FilterOption[] = [
    { label: 'All Regions', value: '' },
    { label: 'APAC',        value: 'APAC' },
    { label: 'EMEA',        value: 'EMEA' },
    { label: 'AMER',        value: 'AMER' },
    { label: 'LATAM',       value: 'LATAM' }
  ];

  readonly statusOptions: FilterOption[] = [
    { label: 'All Statuses', value: '' },
    { label: 'Open',         value: 'OPEN' },
    { label: 'Pending',      value: 'PENDING' },
    { label: 'Resolved',     value: 'RESOLVED' },
    { label: 'Escalated',    value: 'ESCALATED' },
    { label: 'Closed',       value: 'CLOSED' }
  ];
}
