import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-admin',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="p-6">
    <h1 class="text-2xl font-bold">Admin</h1>
    <p class="text-[var(--muted-foreground)]">Coming soon</p>
  </div>`,
})
export class AdminComponent {}
