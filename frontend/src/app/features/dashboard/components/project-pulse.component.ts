import {
  Component,
  input,
  ChangeDetectionStrategy,
} from '@angular/core';
import { ProjectPulseCardComponent } from './project-pulse-card.component';
import { ProjectPulse } from '../dashboard.types';

@Component({
  selector: 'app-project-pulse',
  standalone: true,
  imports: [ProjectPulseCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="widget-card overflow-hidden">
      <div
        class="px-5 py-3.5"
        style="border-bottom: 1px solid var(--border)"
      >
        <h2 class="widget-title flex items-center gap-2">
          <i class="pi pi-heart-fill text-primary text-sm"></i>
          Project Pulse
        </h2>
      </div>

      <div class="p-5">
        @if (projects().length > 0) {
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            @for (project of projects(); track project.project_id; let i = $index) {
              <div
                class="animate-fade-in-up"
                [style.animation-delay]="i * 0.06 + 's'"
              >
                <app-project-pulse-card [project]="project" />
              </div>
            }
          </div>
        } @else {
          <div class="flex flex-col items-center justify-center py-8 gap-3">
            <i
              class="pi pi-folder-open text-2xl"
              style="color: var(--muted-foreground)"
            ></i>
            <p class="text-sm" style="color: var(--muted-foreground)">
              Create your first project to see health metrics here
            </p>
          </div>
        }
      </div>
    </div>
  `,
})
export class ProjectPulseComponent {
  readonly projects = input<ProjectPulse[]>([]);
}
