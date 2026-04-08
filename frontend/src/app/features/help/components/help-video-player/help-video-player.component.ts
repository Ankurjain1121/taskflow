import { Component, ChangeDetectionStrategy, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-help-video-player',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--secondary)]">
      @if (loading()) {
        <div class="aspect-video flex items-center justify-center">
          <i class="pi pi-spin pi-spinner text-2xl text-[var(--muted-foreground)]"></i>
        </div>
      }
      <video
        class="w-full aspect-video"
        [class.hidden]="loading()"
        [src]="src()"
        [poster]="poster()"
        controls
        playsinline
        preload="metadata"
        (loadedmetadata)="loading.set(false)"
        (error)="loading.set(false)"
      ></video>
    </div>
  `,
})
export class HelpVideoPlayerComponent {
  src = input.required<string>();
  poster = input<string>('');
  loading = signal(true);
}
