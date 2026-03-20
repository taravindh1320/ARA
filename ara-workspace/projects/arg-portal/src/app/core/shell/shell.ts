import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SideNavComponent } from '../side-nav/side-nav';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, SideNavComponent],
  templateUrl: './shell.html',
  styleUrl: './shell.scss'
})
export class ShellComponent {
  collapsed = signal(false);

  toggleSidebar(): void {
    this.collapsed.update(v => !v);
  }
}
