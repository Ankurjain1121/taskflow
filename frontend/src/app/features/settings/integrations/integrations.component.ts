import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { catchError, of } from 'rxjs';
import { CrmFlagService } from '../../../core/services/crm-flag.service';
import { WorkspaceContextService } from '../../../core/services/workspace-context.service';

interface TwentyHealthResponse {
  status: 'ok' | 'degraded' | 'down';
  last_checked: string;
  workspace_bound: boolean;
  embed_compatible: boolean;
}

interface SyncHealth {
  queue_depth: number;
  last_sync: string | null;
  error_rate_pct: number;
  dlq_count: number;
  dlq_url: string | null;
}

type ConnectionStatus = 'unknown' | 'checking' | 'ok' | 'degraded' | 'down';

@Component({
  selector: 'app-integrations',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, DatePipe, RouterModule],
  styles: [
    `
      :host { display: block; }

      .page-title {
        font-size: 1.25rem;
        font-weight: 700;
        color: var(--foreground);
        margin: 0 0 4px;
      }

      .page-subtitle {
        font-size: 0.875rem;
        color: var(--muted-foreground);
        margin: 0 0 28px;
      }

      .panel {
        border: 1px solid var(--border);
        border-radius: 10px;
        overflow: hidden;
        margin-bottom: 20px;
      }

      .panel-header {
        padding: 16px 20px;
        border-bottom: 1px solid var(--border);
        background: var(--card);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }

      .panel-header-left {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .panel-icon {
        width: 36px;
        height: 36px;
        border-radius: 8px;
        background: color-mix(in srgb, var(--primary) 12%, transparent);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1rem;
        color: var(--primary);
        flex-shrink: 0;
      }

      .panel-title {
        font-size: 0.9375rem;
        font-weight: 600;
        color: var(--foreground);
        margin: 0;
      }

      .panel-desc {
        font-size: 0.8125rem;
        color: var(--muted-foreground);
        margin: 2px 0 0;
      }

      .panel-body {
        background: var(--background, var(--card));
        padding: 0;
      }

      .info-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 13px 20px;
        border-bottom: 1px solid var(--border);
        font-size: 0.875rem;
      }

      .info-row:last-child { border-bottom: none; }

      .info-label { color: var(--muted-foreground); font-weight: 500; }
      .info-value { color: var(--foreground); font-weight: 500; }

      .chip {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 3px 10px;
        border-radius: 20px;
        font-size: 0.75rem;
        font-weight: 600;
        letter-spacing: 0.02em;
      }

      .chip-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        flex-shrink: 0;
      }

      .chip-ok {
        background: rgba(34, 197, 94, 0.12);
        color: #15803d;
      }
      .chip-ok .chip-dot { background: #22c55e; }

      .chip-degraded {
        background: rgba(234, 179, 8, 0.12);
        color: #a16207;
      }
      .chip-degraded .chip-dot { background: #eab308; }

      .chip-down {
        background: rgba(239, 68, 68, 0.12);
        color: #b91c1c;
      }
      .chip-down .chip-dot { background: #ef4444; }

      .chip-unknown {
        background: var(--muted, rgba(0,0,0,0.06));
        color: var(--muted-foreground);
      }
      .chip-unknown .chip-dot { background: var(--muted-foreground); }

      .chip-checking {
        background: rgba(59, 130, 246, 0.10);
        color: #1d4ed8;
      }
      .chip-checking .chip-dot {
        background: #3b82f6;
        animation: pulse 1s infinite;
      }

      .chip-compat {
        background: rgba(34, 197, 94, 0.10);
        color: #15803d;
      }
      .chip-compat .chip-dot { background: #22c55e; }

      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
      }

      .actions-row {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        padding: 14px 20px;
        border-top: 1px solid var(--border);
        background: var(--card);
      }

      .btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 7px 14px;
        border-radius: 7px;
        font-size: 0.8125rem;
        font-weight: 500;
        cursor: pointer;
        transition: background 150ms ease, opacity 150ms ease;
        border: 1px solid transparent;
        text-decoration: none;
      }

      .btn-outline {
        background: transparent;
        border-color: var(--border);
        color: var(--foreground);
      }
      .btn-outline:hover { background: var(--muted, rgba(0,0,0,0.04)); }

      .btn-primary {
        background: var(--primary);
        color: white;
        border-color: transparent;
      }
      .btn-primary:hover { opacity: 0.88; }

      .btn-danger {
        background: transparent;
        border-color: var(--border);
        color: #b91c1c;
      }
      .btn-danger:hover { background: rgba(239, 68, 68, 0.06); }

      .btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .confirm-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.4);
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
      }

      .confirm-dialog {
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 24px;
        max-width: 400px;
        width: 100%;
        box-shadow: 0 20px 60px rgba(0,0,0,0.2);
      }

      .confirm-title {
        font-size: 1rem;
        font-weight: 700;
        color: var(--foreground);
        margin: 0 0 8px;
      }

      .confirm-desc {
        font-size: 0.875rem;
        color: var(--muted-foreground);
        margin: 0 0 20px;
        line-height: 1.5;
      }

      .confirm-actions {
        display: flex;
        gap: 10px;
        justify-content: flex-end;
      }

      .crm-toggle-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 20px;
        border-top: 1px solid var(--border);
        background: var(--card);
        font-size: 0.875rem;
      }

      .toggle-label { color: var(--muted-foreground); }

      .toggle {
        position: relative;
        width: 40px;
        height: 22px;
        flex-shrink: 0;
        cursor: pointer;
      }

      .toggle input {
        opacity: 0;
        width: 0;
        height: 0;
        position: absolute;
      }

      .toggle-track {
        position: absolute;
        inset: 0;
        border-radius: 11px;
        background: var(--border);
        transition: background 200ms ease;
      }

      .toggle input:checked ~ .toggle-track { background: var(--primary); }

      .toggle-thumb {
        position: absolute;
        top: 3px;
        left: 3px;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: white;
        transition: transform 200ms ease;
      }

      .toggle input:checked ~ .toggle-thumb { transform: translateX(18px); }
    `,
  ],
  template: `
    <h1 class="page-title">Integrations</h1>
    <p class="page-subtitle">Manage connected services and embedding options.</p>

    <!-- Twenty CRM: Connection panel -->
    <div class="panel">
      <div class="panel-header">
        <div class="panel-header-left">
          <div class="panel-icon"><i class="pi pi-briefcase" aria-hidden="true"></i></div>
          <div>
            <p class="panel-title">Twenty CRM</p>
            <p class="panel-desc">Embed and connect your CRM workspace</p>
          </div>
        </div>
        <ng-container [ngSwitch]="connectionStatus()">
          <span *ngSwitchCase="'ok'" class="chip chip-ok">
            <span class="chip-dot"></span> Connected
          </span>
          <span *ngSwitchCase="'degraded'" class="chip chip-degraded">
            <span class="chip-dot"></span> Degraded
          </span>
          <span *ngSwitchCase="'down'" class="chip chip-down">
            <span class="chip-dot"></span> Down
          </span>
          <span *ngSwitchCase="'checking'" class="chip chip-checking">
            <span class="chip-dot"></span> Checking…
          </span>
          <span *ngSwitchDefault class="chip chip-unknown">
            <span class="chip-dot"></span> Unknown
          </span>
        </ng-container>
      </div>

      <div class="panel-body">
        <div class="info-row">
          <span class="info-label">Workspace binding</span>
          <span class="info-value">
            {{ health()?.workspace_bound ? 'Bound' : 'Not configured' }}
          </span>
        </div>
        <div class="info-row">
          <span class="info-label">Last health check</span>
          <span class="info-value">
            @if (health()?.last_checked) {
              {{ health()!.last_checked | date:'medium' }}
            } @else {
              —
            }
          </span>
        </div>
        <div class="info-row">
          <span class="info-label">Embed compatibility</span>
          <span class="info-value">
            @if (health()?.embed_compatible) {
              <span class="chip chip-compat">
                <span class="chip-dot"></span> Compatible
              </span>
            } @else {
              <span class="chip chip-down">
                <span class="chip-dot"></span> Blocked
              </span>
            }
          </span>
        </div>
      </div>

      <!-- CRM enabled toggle -->
      <div class="crm-toggle-row">
        <span class="toggle-label">Enable CRM sidebar entry</span>
        <label class="toggle" aria-label="Enable CRM in sidebar">
          <input type="checkbox"
                 [checked]="crmEnabled()"
                 (change)="toggleCrmEnabled($event)"
                 role="switch"
                 [attr.aria-checked]="crmEnabled()">
          <span class="toggle-track"></span>
          <span class="toggle-thumb"></span>
        </label>
      </div>

      <div class="actions-row">
        <button class="btn btn-outline"
                (click)="testConnection()"
                [disabled]="connectionStatus() === 'checking'"
                type="button">
          <i class="pi pi-bolt"></i>
          Test connection
        </button>
        <button class="btn btn-outline" (click)="reconnect()" type="button">
          <i class="pi pi-refresh"></i>
          Reconnect
        </button>
        <button class="btn btn-danger" (click)="confirmDisconnect()" type="button">
          <i class="pi pi-times-circle"></i>
          Disconnect
        </button>
      </div>
    </div>

    <!-- Sync health panel -->
    <div class="panel">
      <div class="panel-header">
        <div class="panel-header-left">
          <div class="panel-icon"><i class="pi pi-sync" aria-hidden="true"></i></div>
          <div>
            <p class="panel-title">Sync Health</p>
            <p class="panel-desc">Queue depth, error rate, and dead-letter queue</p>
          </div>
        </div>
      </div>

      <div class="panel-body">
        <div class="info-row">
          <span class="info-label">Queue depth</span>
          <span class="info-value">
            {{ syncHealth()?.queue_depth ?? '—' }}
          </span>
        </div>
        <div class="info-row">
          <span class="info-label">Last sync</span>
          <span class="info-value">
            @if (syncHealth()?.last_sync) {
              {{ syncHealth()!.last_sync | date:'medium' }}
            } @else {
              —
            }
          </span>
        </div>
        <div class="info-row">
          <span class="info-label">Error rate</span>
          <span class="info-value">
            @if (syncHealth() !== null) {
              {{ syncHealth()!.error_rate_pct | number:'1.1-1' }}%
            } @else {
              —
            }
          </span>
        </div>
        <div class="info-row">
          <span class="info-label">Dead-letter queue</span>
          <span class="info-value">
            @if (syncHealth()?.dlq_count) {
              <span style="color: #b91c1c; font-weight: 600">
                {{ syncHealth()!.dlq_count }} item{{ syncHealth()!.dlq_count !== 1 ? 's' : '' }}
              </span>
              @if (syncHealth()?.dlq_url) {
                &nbsp;·&nbsp;
                <a [href]="syncHealth()!.dlq_url" target="_blank" rel="noopener"
                   style="color: var(--primary); font-size: 0.8125rem">
                  View &rarr;
                </a>
              }
            } @else {
              <span style="color: #15803d">Empty</span>
            }
          </span>
        </div>
      </div>

      <div class="actions-row">
        <button class="btn btn-outline" (click)="refreshSyncHealth()" type="button">
          <i class="pi pi-refresh"></i>
          Refresh
        </button>
      </div>
    </div>

    <!-- Disconnect confirm modal -->
    @if (showDisconnectModal()) {
      <div class="confirm-overlay" role="dialog" aria-modal="true"
           aria-labelledby="disconnect-title" (click)="cancelDisconnect()">
        <div class="confirm-dialog" (click)="$event.stopPropagation()">
          <p class="confirm-title" id="disconnect-title">Disconnect Twenty CRM?</p>
          <p class="confirm-desc">
            This will remove the CRM integration from this workspace.
            Synced data is not deleted. You can reconnect at any time.
          </p>
          <div class="confirm-actions">
            <button class="btn btn-outline" (click)="cancelDisconnect()" type="button">
              Cancel
            </button>
            <button class="btn btn-danger" (click)="executeDisconnect()" type="button">
              <i class="pi pi-times-circle"></i>
              Disconnect
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class IntegrationsComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly crmFlag = inject(CrmFlagService);
  private readonly ctx = inject(WorkspaceContextService);

  readonly health = signal<TwentyHealthResponse | null>(null);
  readonly syncHealth = signal<SyncHealth | null>(null);
  readonly connectionStatus = signal<ConnectionStatus>('unknown');
  readonly showDisconnectModal = signal(false);
  readonly crmEnabled = this.crmFlag.crmEnabled;

  ngOnInit(): void {
    this.testConnection();
    this.refreshSyncHealth();
  }

  testConnection(): void {
    this.connectionStatus.set('checking');
    this.http
      .get<TwentyHealthResponse>('/api/integrations/twenty/health')
      .pipe(catchError(() => of(null)))
      .subscribe((res) => {
        this.health.set(res);
        if (!res) {
          this.connectionStatus.set('down');
        } else {
          this.connectionStatus.set(res.status === 'ok' ? 'ok' : res.status);
        }
      });
  }

  refreshSyncHealth(): void {
    this.http
      .get<SyncHealth>('/api/integrations/twenty/sync-health')
      .pipe(catchError(() => of(null)))
      .subscribe((res) => this.syncHealth.set(res));
  }

  reconnect(): void {
    this.testConnection();
  }

  confirmDisconnect(): void {
    this.showDisconnectModal.set(true);
  }

  cancelDisconnect(): void {
    this.showDisconnectModal.set(false);
  }

  executeDisconnect(): void {
    this.showDisconnectModal.set(false);
    const wsId = this.ctx.activeWorkspaceId();
    if (wsId) {
      this.crmFlag.disable(wsId);
    }
    this.connectionStatus.set('unknown');
    this.health.set(null);
  }

  toggleCrmEnabled(event: Event): void {
    const wsId = this.ctx.activeWorkspaceId();
    if (!wsId) return;
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      this.crmFlag.enable(wsId);
    } else {
      this.crmFlag.disable(wsId);
    }
  }
}
