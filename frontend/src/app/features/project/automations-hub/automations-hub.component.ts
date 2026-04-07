import {
  Component,
  inject,
  signal,
  effect,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Tabs, TabList, Tab, TabPanels, TabPanel } from 'primeng/tabs';
import { AutomationRulesComponent } from '../automations/automation-rules.component';
import { RecurringSchedulesTabComponent } from './recurring-schedules-tab.component';
import { ActivityLogTabComponent } from './activity-log-tab.component';

@Component({
  selector: 'app-automations-hub',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    Tabs,
    TabList,
    Tab,
    TabPanels,
    TabPanel,
    AutomationRulesComponent,
    RecurringSchedulesTabComponent,
    ActivityLogTabComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-[var(--background)]">
      <div class="max-w-5xl mx-auto px-4 py-8">
        <!-- Header -->
        <div class="mb-8">
          <nav class="text-sm text-[var(--muted-foreground)] mb-2">
            <a
              [routerLink]="['/workspace', workspaceId, 'project', projectId]"
              class="hover:text-primary"
              >Back to Project</a
            >
          </nav>
          <h1 class="text-3xl font-bold font-display text-[var(--foreground)]">
            Automations
          </h1>
          <p class="mt-2 text-[var(--muted-foreground)]">
            Manage recurring schedules, automation rules, and view activity.
          </p>
        </div>

        <p-tabs [value]="activeTab()" (valueChange)="onTabChange($event)">
          <p-tablist>
            <p-tab [value]="0">Recurring Schedules</p-tab>
            <p-tab [value]="1">Automation Rules</p-tab>
            <p-tab [value]="2">Activity Log</p-tab>
          </p-tablist>
          <p-tabpanels>
            <!-- Tab 0: Recurring Schedules -->
            <p-tabpanel [value]="0">
              <div class="py-6">
                <app-recurring-schedules-tab [projectId]="projectId" [workspaceId]="workspaceId" />
              </div>
            </p-tabpanel>

            <!-- Tab 1: Automation Rules -->
            <p-tabpanel [value]="1">
              <div class="py-6">
                @defer {
                  <app-automation-rules [boardId]="projectId" />
                } @placeholder {
                  <div class="flex items-center justify-center py-12">
                    <svg
                      class="animate-spin h-6 w-6 text-primary"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        class="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        stroke-width="4"
                      ></circle>
                      <path
                        class="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                  </div>
                }
              </div>
            </p-tabpanel>

            <!-- Tab 2: Activity Log -->
            <p-tabpanel [value]="2">
              <div class="py-6">
                <app-activity-log-tab [projectId]="projectId" />
              </div>
            </p-tabpanel>
          </p-tabpanels>
        </p-tabs>
      </div>
    </div>
  `,
})
export class AutomationsHubComponent {
  private route = inject(ActivatedRoute);
  private params = toSignal(this.route.params);

  workspaceId = '';
  projectId = '';
  activeTab = signal(0);

  constructor() {
    effect(() => {
      const p = this.params();
      if (p) {
        this.workspaceId = p['workspaceId'];
        this.projectId = p['projectId'];
      }
    });
  }

  onTabChange(tabValue: unknown): void {
    this.activeTab.set(tabValue as number);
  }
}
