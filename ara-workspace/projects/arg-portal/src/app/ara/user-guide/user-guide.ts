import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PageHeaderComponent, Breadcrumb } from '../shared/page-header/page-header';

interface GuideSection {
  id: string; title: string; description: string; icon: string; link: string;
}

@Component({
  selector: 'ara-user-guide',
  standalone: true,
  imports: [CommonModule, RouterLink, PageHeaderComponent],
  templateUrl: './user-guide.html',
  styleUrl: './user-guide.scss'
})
export class UserGuideComponent {
  readonly breadcrumbs: Breadcrumb[] = [
    { label: 'Settings' },
    { label: 'User Guide' }
  ];

  readonly sections: GuideSection[] = [
    {
      id: '1',
      title: 'Getting Started',
      description: 'Introduction to the ARA / ARG portal: navigation, user roles, and key concepts.',
      icon: 'start',
      link: '#'
    },
    {
      id: '2',
      title: 'ARA Dashboard',
      description: 'Understanding the dashboard KPIs, coverage tabs, regional filters and exception aging view.',
      icon: 'dashboard',
      link: '#'
    },
    {
      id: '3',
      title: 'ARA Search & Lookup',
      description: 'How to search ARA records, use filter criteria, export results and view the Abacus lookup panel.',
      icon: 'search',
      link: '#'
    },
    {
      id: '4',
      title: 'Exception Queues',
      description: 'Working with exception queues: identifying breaks, resolving exceptions and escalation procedures.',
      icon: 'exceptions',
      link: '#'
    },
    {
      id: '5',
      title: 'ARG Workflow',
      description: 'Submitting, reviewing and approving ARG change requests. SLA guidelines and priority levels.',
      icon: 'workflow',
      link: '#'
    },
    {
      id: '6',
      title: 'Reports',
      description: 'Accessing the report repository, downloading reports and scheduling ad-hoc report runs.',
      icon: 'reports',
      link: '#'
    },
    {
      id: '7',
      title: 'Feed Monitoring',
      description: 'Monitoring feed health, identifying stalled or failed ingestion pipelines, and anomaly management.',
      icon: 'feeds',
      link: '#'
    },
    {
      id: '8',
      title: 'Access & Permissions',
      description: 'User roles, read-only vs edit access, and how to request elevated permissions.',
      icon: 'access',
      link: '#'
    }
  ];
}
