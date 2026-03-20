import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

export interface Breadcrumb {
  label: string;
  route?: string;
}

@Component({
  selector: 'ara-page-header',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './page-header.html',
  styleUrl: './page-header.scss'
})
export class PageHeaderComponent {
  title      = input.required<string>();
  subtitle   = input<string>('');
  breadcrumbs = input<Breadcrumb[]>([]);
  lastRefresh = input<string>('');
}
