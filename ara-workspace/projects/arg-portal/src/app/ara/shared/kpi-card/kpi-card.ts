import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type KpiStatus = 'success' | 'warning' | 'danger' | 'info' | 'neutral';
export type KpiTrend  = 'up' | 'down' | 'flat';

@Component({
  selector: 'ara-kpi-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './kpi-card.html',
  styleUrl: './kpi-card.scss'
})
export class KpiCardComponent {
  label       = input.required<string>();
  value       = input.required<string>();
  subValue    = input<string>('');
  delta       = input<string>('');
  trend       = input<KpiTrend>('flat');
  status      = input<KpiStatus>('neutral');
  description = input<string>('');
}
