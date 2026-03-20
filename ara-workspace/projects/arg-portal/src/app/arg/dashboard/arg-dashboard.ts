import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PageHeaderComponent, Breadcrumb } from '../../ara/shared/page-header/page-header';
import { KpiCardComponent }                from '../../ara/shared/kpi-card/kpi-card';

interface WorkflowTask {
  id: string;
  ref: string;
  description: string;
  submittedBy: string;
  submittedDate: string;
  region: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'ON_HOLD';
  dueDate: string;
  overdue: boolean;
}

interface ActivityItem {
  id: string;
  action: string;
  ref: string;
  user: string;
  time: string;
  type: 'approval' | 'submission' | 'rejection' | 'escalation';
}

@Component({
  selector: 'arg-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, PageHeaderComponent, KpiCardComponent],
  templateUrl: './arg-dashboard.html',
  styleUrl: './arg-dashboard.scss'
})
export class ArgDashboardComponent {
  readonly breadcrumbs: Breadcrumb[] = [
    { label: 'ARG' },
    { label: 'Dashboard' }
  ];

  activeTab = signal<'pending' | 'approved' | 'all'>('pending');

  readonly pendingTasks: WorkflowTask[] = [
    { id: '1', ref: 'ARG-2024-0891', description: 'Reference data update – EMEA equity basket', submittedBy: 'C.Davis', submittedDate: '2026-03-20', region: 'EMEA', priority: 'HIGH', status: 'PENDING', dueDate: '2026-03-21', overdue: false },
    { id: '2', ref: 'ARG-2024-0892', description: 'New account mapping – APAC bonds', submittedBy: 'D.Tanaka', submittedDate: '2026-03-19', region: 'APAC', priority: 'CRITICAL', status: 'IN_REVIEW', dueDate: '2026-03-20', overdue: true },
    { id: '3', ref: 'ARG-2024-0893', description: 'Currency correction – LATAM FX', submittedBy: 'E.Rodriguez', submittedDate: '2026-03-19', region: 'LATAM', priority: 'MEDIUM', status: 'PENDING', dueDate: '2026-03-22', overdue: false },
    { id: '4', ref: 'ARG-2024-0894', description: 'Counterparty identifier refresh', submittedBy: 'A.Williams', submittedDate: '2026-03-18', region: 'AMER', priority: 'HIGH', status: 'ON_HOLD', dueDate: '2026-03-20', overdue: true },
    { id: '5', ref: 'ARG-2024-0895', description: 'Index constituent update – GLOBAL', submittedBy: 'B.Thompson', submittedDate: '2026-03-20', region: 'GLOBAL', priority: 'MEDIUM', status: 'IN_REVIEW', dueDate: '2026-03-23', overdue: false },
    { id: '6', ref: 'ARG-2024-0896', description: 'Rate reset – fixed income schedules', submittedBy: 'F.Johnson', submittedDate: '2026-03-17', region: 'AMER', priority: 'LOW', status: 'PENDING', dueDate: '2026-03-25', overdue: false },
  ];

  readonly recentActivity: ActivityItem[] = [
    { id: '1', action: 'Approved',  ref: 'ARG-2024-0888', user: 'J.Manager',   time: '10:42 AM', type: 'approval'    },
    { id: '2', action: 'Submitted', ref: 'ARG-2024-0891', user: 'C.Davis',     time: '10:15 AM', type: 'submission'  },
    { id: '3', action: 'Escalated', ref: 'ARG-2024-0882', user: 'K.Brown',     time: '09:58 AM', type: 'escalation'  },
    { id: '4', action: 'Rejected',  ref: 'ARG-2024-0879', user: 'J.Manager',   time: '09:31 AM', type: 'rejection'   },
    { id: '5', action: 'Approved',  ref: 'ARG-2024-0877', user: 'P.Harris',    time: '09:04 AM', type: 'approval'    },
    { id: '6', action: 'Submitted', ref: 'ARG-2024-0895', user: 'B.Thompson',  time: '08:50 AM', type: 'submission'  },
  ];

  readonly regionBreakdown = [
    { region: 'AMER',   pending: 42, approved: 120, slaBreaches: 3 },
    { region: 'EMEA',   pending: 38, approved: 105, slaBreaches: 5 },
    { region: 'APAC',   pending: 29, approved: 88,  slaBreaches: 2 },
    { region: 'LATAM',  pending: 14, approved: 41,  slaBreaches: 1 },
    { region: 'GLOBAL', pending: 7,  approved: 22,  slaBreaches: 0 },
  ];

  setTab(t: 'pending' | 'approved' | 'all'): void { this.activeTab.set(t); }

  filteredTasks() {
    const tab = this.activeTab();
    if (tab === 'pending') return this.pendingTasks.filter(t => t.status === 'PENDING' || t.status === 'IN_REVIEW');
    if (tab === 'approved') return this.pendingTasks.filter(t => t.status === 'APPROVED');
    return this.pendingTasks;
  }

  priorityClass(p: string) {
    return { 'CRITICAL': 'danger', HIGH: 'warning', MEDIUM: 'info', LOW: 'neutral' }[p] ?? 'neutral';
  }

  statusClass(s: string) {
    return {
      PENDING: 'warning', IN_REVIEW: 'info', APPROVED: 'success',
      REJECTED: 'danger', ON_HOLD: 'neutral'
    }[s] ?? 'neutral';
  }
}
