import {
  Component,
  inject,
  signal,
  input,
  output,
  OnDestroy,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Dialog } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import {
  ReportsService,
  ReportJobStatus,
} from '../../core/services/reports.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-export-dialog',
  standalone: true,
  imports: [CommonModule, Dialog, ButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      header="Export Report"
      [visible]="visible()"
      (visibleChange)="onVisibleChange($event)"
      [modal]="true"
      [style]="{ width: '420px' }"
      [closable]="true"
      [draggable]="false"
    >
      <div class="space-y-4 pt-2">
        <!-- Format selection -->
        <div>
          <label
            class="block text-sm font-medium mb-2"
            style="color: var(--foreground)"
            >Export Format</label
          >
          <div class="flex gap-3">
            <button
              (click)="selectedFormat.set('csv')"
              class="flex-1 px-4 py-3 rounded-lg border text-sm font-medium transition-all"
              [class]="
                selectedFormat() === 'csv'
                  ? 'border-primary bg-primary/10'
                  : 'border-[var(--border)]'
              "
              [style.color]="
                selectedFormat() === 'csv'
                  ? 'var(--primary)'
                  : 'var(--foreground)'
              "
            >
              <i class="pi pi-file mr-2"></i>
              CSV
              <span
                class="block text-xs mt-1"
                style="color: var(--muted-foreground)"
                >Instant download</span
              >
            </button>
            <button
              (click)="selectedFormat.set('pdf')"
              class="flex-1 px-4 py-3 rounded-lg border text-sm font-medium transition-all"
              [class]="
                selectedFormat() === 'pdf'
                  ? 'border-primary bg-primary/10'
                  : 'border-[var(--border)]'
              "
              [style.color]="
                selectedFormat() === 'pdf'
                  ? 'var(--primary)'
                  : 'var(--foreground)'
              "
            >
              <i class="pi pi-file-pdf mr-2"></i>
              PDF
              <span
                class="block text-xs mt-1"
                style="color: var(--muted-foreground)"
                >Generated async</span
              >
            </button>
          </div>
        </div>

        <!-- PDF Progress -->
        @if (pdfStatus() === 'pending') {
          <div
            class="flex items-center gap-3 p-3 rounded-lg"
            style="background: var(--muted)"
          >
            <i
              class="pi pi-spin pi-spinner text-primary"
            ></i>
            <span class="text-sm" style="color: var(--foreground)"
              >Generating PDF report...</span
            >
          </div>
        }

        @if (pdfStatus() === 'completed' && pdfDownloadUrl()) {
          <div
            class="flex items-center gap-3 p-3 rounded-lg"
            style="background: rgba(16, 185, 129, 0.1)"
          >
            <i class="pi pi-check-circle text-emerald-500"></i>
            <a
              [href]="pdfDownloadUrl()"
              target="_blank"
              rel="noopener"
              class="text-sm font-medium text-primary hover:underline"
              >Download PDF</a
            >
          </div>
        }

        @if (pdfStatus() === 'failed') {
          <div
            class="flex items-center gap-3 p-3 rounded-lg"
            style="background: rgba(239, 68, 68, 0.1)"
          >
            <i class="pi pi-times-circle text-red-500"></i>
            <span class="text-sm" style="color: var(--foreground)"
              >Export failed. Please try again.</span
            >
          </div>
        }

        @if (errorMessage()) {
          <div
            class="text-sm text-red-500 p-2 rounded"
            style="background: rgba(239, 68, 68, 0.1)"
          >
            {{ errorMessage() }}
          </div>
        }
      </div>

      <ng-template #footer>
        <div class="flex items-center justify-end gap-2 pt-2">
          @if (pdfStatus() === 'pending') {
            <button
              pButton
              label="Cancel"
              severity="secondary"
              [outlined]="true"
              (click)="cancelPdfPolling()"
            ></button>
          } @else {
            <button
              pButton
              label="Cancel"
              severity="secondary"
              [outlined]="true"
              (click)="onVisibleChange(false)"
            ></button>
            <button
              pButton
              [label]="selectedFormat() === 'csv' ? 'Download CSV' : 'Generate PDF'"
              (click)="onExport()"
              [loading]="exporting()"
            ></button>
          }
        </div>
      </ng-template>
    </p-dialog>
  `,
})
export class ExportDialogComponent implements OnDestroy {
  visible = input(false);
  projectId = input('');
  reportType = input('burndown');
  days = input(30);
  visibleChange = output<boolean>();

  private reportsService = inject(ReportsService);
  private pollSubscription: Subscription | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  selectedFormat = signal<'csv' | 'pdf'>('csv');
  exporting = signal(false);
  pdfStatus = signal<ReportJobStatus['status'] | null>(null);
  pdfDownloadUrl = signal<string | null>(null);
  errorMessage = signal<string | null>(null);

  onVisibleChange(value: boolean): void {
    this.visibleChange.emit(value);
    if (!value) {
      this.resetState();
    }
  }

  onExport(): void {
    const pid = this.projectId();
    const rt = this.reportType();
    const d = this.days();

    if (!pid) {
      this.errorMessage.set('No project selected');
      return;
    }

    this.errorMessage.set(null);

    if (this.selectedFormat() === 'csv') {
      this.exportCsv(pid, rt, d);
    } else {
      this.exportPdf(pid, rt, d);
    }
  }

  cancelPdfPolling(): void {
    this.stopPolling();
    this.pdfStatus.set(null);
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  private exportCsv(projectId: string, reportType: string, days: number): void {
    this.exporting.set(true);
    this.reportsService.exportCsv(projectId, reportType, days).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${reportType}-report.csv`;
        link.click();
        URL.revokeObjectURL(url);
        this.exporting.set(false);
        this.onVisibleChange(false);
      },
      error: () => {
        this.errorMessage.set('Failed to export CSV. Please try again.');
        this.exporting.set(false);
      },
    });
  }

  private exportPdf(projectId: string, reportType: string, days: number): void {
    this.exporting.set(true);
    this.reportsService.requestPdfExport(projectId, reportType, days).subscribe({
      next: (response) => {
        this.exporting.set(false);
        this.pdfStatus.set('pending');
        this.startPolling(response.job_id);
      },
      error: () => {
        this.errorMessage.set('Failed to start PDF export. Please try again.');
        this.exporting.set(false);
      },
    });
  }

  private startPolling(jobId: string): void {
    this.stopPolling();
    this.pollTimer = setInterval(() => {
      this.pollSubscription = this.reportsService
        .getPdfStatus(jobId)
        .subscribe({
          next: (status) => {
            this.pdfStatus.set(status.status);
            if (status.status === 'completed' && status.download_url) {
              this.pdfDownloadUrl.set(status.download_url);
              this.stopPolling();
            } else if (status.status === 'failed') {
              this.errorMessage.set(
                status.error_message ?? 'PDF generation failed',
              );
              this.stopPolling();
            }
          },
          error: () => {
            this.pdfStatus.set('failed');
            this.errorMessage.set('Failed to check export status');
            this.stopPolling();
          },
        });
    }, 2000);
  }

  private stopPolling(): void {
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.pollSubscription) {
      this.pollSubscription.unsubscribe();
      this.pollSubscription = null;
    }
  }

  private resetState(): void {
    this.stopPolling();
    this.selectedFormat.set('csv');
    this.exporting.set(false);
    this.pdfStatus.set(null);
    this.pdfDownloadUrl.set(null);
    this.errorMessage.set(null);
  }
}
