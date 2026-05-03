import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  OnDestroy,
  DestroyRef,
  inject,
  signal,
  computed,
} from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { BreakpointObserver } from '@angular/cdk/layout';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { catchError, of } from 'rxjs';
import { WorkspaceContextService } from '../../core/services/workspace-context.service';

export type CrmState =
  | 'idle'
  | 'loading'
  | 'connected'
  | 'offline'
  | 'csp_blocked'
  | 'upgrading'
  | 'error'
  | 'disconnected';

const CRM_BASE_URL = 'https://crm.taskflow.paraslace.in';
const CRM_EMBED_URL = `${CRM_BASE_URL}/?embed=1`;
const LOAD_TIMEOUT_MS = 30_000;

interface LinkedCrmSummary {
  contacts: number;
  deals: number;
  companies: number;
  last_synced: string | null;
}

interface TwentyHealthResponse {
  status: 'ok' | 'degraded' | 'down';
  last_checked: string;
  workspace_bound: boolean;
  embed_compatible: boolean;
}

@Component({
  selector: 'app-crm-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule],
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
      }

      .crm-bar {
        flex-shrink: 0;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 12px;
        background: color-mix(in srgb, var(--color-primary, var(--primary)) 10%, transparent);
        border-bottom: 1px solid color-mix(in srgb, var(--color-primary, var(--primary)) 20%, transparent);
        gap: 8px;
      }

      .crm-bar-left,
      .crm-bar-right {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 1;
      }

      .crm-bar-right { justify-content: flex-end; }

      .crm-bar-center {
        flex: 0 0 auto;
        font-size: 0.8125rem;
        font-weight: 600;
        color: var(--foreground);
        white-space: nowrap;
      }

      .crm-back-link {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 0.8125rem;
        color: var(--muted-foreground);
        text-decoration: none;
        padding: 4px 8px;
        border-radius: 6px;
        transition: background 150ms ease, color 150ms ease;
        white-space: nowrap;
      }

      .crm-back-link:hover {
        background: var(--muted, rgba(0,0,0,0.06));
        color: var(--foreground);
      }

      .crm-action-btn {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 0.8125rem;
        color: var(--muted-foreground);
        background: transparent;
        border: none;
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 6px;
        transition: background 150ms ease, color 150ms ease;
        white-space: nowrap;
        text-decoration: none;
      }

      .crm-action-btn:hover {
        background: var(--muted, rgba(0,0,0,0.06));
        color: var(--foreground);
      }

      .crm-action-btn.reconnect { color: #b45309; }

      .upgrading-banner {
        flex-shrink: 0;
        padding: 8px 16px;
        background: #fef9c3;
        border-bottom: 1px solid #fde047;
        color: #713f12;
        font-size: 0.8125rem;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .crm-content {
        flex: 1;
        overflow: hidden;
        position: relative;
      }

      .crm-iframe {
        width: 100%;
        height: 100%;
        border: none;
        display: block;
      }

      .crm-iframe.readonly {
        pointer-events: none;
        opacity: 0.75;
      }

      .crm-skeleton {
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        height: 100%;
        overflow: hidden;
      }

      .skeleton-header-row {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 12px;
      }

      .skeleton-col-header {
        height: 36px;
        border-radius: 6px;
        background: var(--muted, rgba(0,0,0,0.08));
        animation: shimmer 1.5s infinite;
      }

      .skeleton-rows { display: flex; flex-direction: column; gap: 8px; }

      .skeleton-row {
        height: 52px;
        border-radius: 6px;
        background: var(--muted, rgba(0,0,0,0.06));
        animation: shimmer 1.5s infinite;
      }

      .skeleton-row:nth-child(2) { animation-delay: 0.1s; }
      .skeleton-row:nth-child(3) { animation-delay: 0.2s; }
      .skeleton-row:nth-child(4) { animation-delay: 0.3s; }
      .skeleton-row:nth-child(5) { animation-delay: 0.4s; }

      @keyframes shimmer {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }

      .crm-empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        gap: 16px;
        padding: 40px 20px;
        text-align: center;
      }

      .empty-icon {
        width: 56px;
        height: 56px;
        border-radius: 14px;
        background: var(--muted, rgba(0,0,0,0.06));
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.5rem;
        color: var(--muted-foreground);
      }

      .empty-title {
        font-size: 1.125rem;
        font-weight: 600;
        color: var(--foreground);
        margin: 0;
      }

      .empty-desc {
        font-size: 0.875rem;
        color: var(--muted-foreground);
        margin: 0;
        max-width: 320px;
      }

      .empty-actions {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        justify-content: center;
      }

      .btn-primary {
        padding: 8px 18px;
        border-radius: 8px;
        background: var(--primary);
        color: white;
        border: none;
        cursor: pointer;
        font-size: 0.875rem;
        font-weight: 500;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        transition: opacity 150ms ease;
      }

      .btn-primary:hover { opacity: 0.88; }

      .btn-secondary {
        padding: 8px 18px;
        border-radius: 8px;
        background: transparent;
        color: var(--foreground);
        border: 1px solid var(--border);
        cursor: pointer;
        font-size: 0.875rem;
        font-weight: 500;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        transition: background 150ms ease;
      }

      .btn-secondary:hover { background: var(--muted, rgba(0,0,0,0.04)); }

      .mobile-handoff {
        flex: 1;
        overflow-y: auto;
        padding: 24px 16px;
        display: flex;
        flex-direction: column;
        gap: 20px;
        height: 100%;
      }

      .mobile-handoff-title {
        font-size: 1.25rem;
        font-weight: 700;
        color: var(--foreground);
        margin: 0;
      }

      .mobile-handoff-desc {
        font-size: 0.875rem;
        color: var(--muted-foreground);
        margin: 4px 0 0;
        line-height: 1.5;
      }

      .mobile-summary-card {
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 10px;
        padding: 16px;
      }

      .mobile-summary-card h3 {
        font-size: 0.6875rem;
        font-weight: 600;
        color: var(--muted-foreground);
        margin: 0 0 12px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .mobile-stat-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 0;
        border-bottom: 1px solid var(--border);
        font-size: 0.875rem;
      }

      .mobile-stat-row:last-child { border-bottom: none; }
      .mobile-stat-label { color: var(--muted-foreground); }
      .mobile-stat-value { font-weight: 600; color: var(--foreground); }

      .mobile-open-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        width: 100%;
        padding: 13px;
        border-radius: 10px;
        background: var(--primary);
        color: white;
        border: none;
        cursor: pointer;
        font-size: 0.9375rem;
        font-weight: 600;
        text-decoration: none;
        transition: opacity 150ms ease;
      }

      .mobile-open-btn:hover { opacity: 0.88; }
    `,
  ],
  template: `
    <!-- TaskBolt CRM Bar (40px) -->
    <div class="crm-bar" role="toolbar" aria-label="CRM navigation">
      <div class="crm-bar-left">
        <a [routerLink]="tasksLink()" class="crm-back-link" aria-label="Back to Tasks">
          <i class="pi pi-angle-left" aria-hidden="true"></i>
          Tasks
        </a>
      </div>

      <div class="crm-bar-center" aria-label="Current location: CRM Pipeline">
        <span style="color: var(--muted-foreground)">CRM</span>
        <span style="color: var(--muted-foreground); margin: 0 6px" aria-hidden="true">›</span>
        <span>Pipeline</span>
      </div>

      <div class="crm-bar-right">
        <a [href]="crmBaseUrl" target="_blank" rel="noopener" class="crm-action-btn"
           aria-label="Open CRM in new tab">
          <i class="pi pi-external-link" aria-hidden="true"></i>
          <span>Open</span>
        </a>
        @if (crmState() === 'offline') {
          <button class="crm-action-btn reconnect" (click)="retry()" type="button"
                  aria-label="Reconnect to CRM">
            <i class="pi pi-refresh" aria-hidden="true"></i>
            Reconnect
          </button>
        }
      </div>
    </div>

    <!-- Upgrading banner -->
    @if (crmState() === 'upgrading') {
      <div class="upgrading-banner" role="alert" aria-live="polite">
        <i class="pi pi-exclamation-triangle" aria-hidden="true"></i>
        CRM is being updated — view is read-only until the upgrade completes.
      </div>
    }

    <!-- Content area -->
    <div class="crm-content">
      @if (isMobile()) {
        <div class="mobile-handoff">
          <div>
            <p class="mobile-handoff-title">CRM</p>
            <p class="mobile-handoff-desc">
              The full CRM experience is optimised for larger screens.
              Open it in a new tab for the best experience.
            </p>
          </div>

          @if (linkedSummary(); as summary) {
            <div class="mobile-summary-card">
              <h3>Linked Entities</h3>
              <div class="mobile-stat-row">
                <span class="mobile-stat-label">Contacts</span>
                <span class="mobile-stat-value">{{ summary.contacts }}</span>
              </div>
              <div class="mobile-stat-row">
                <span class="mobile-stat-label">Companies</span>
                <span class="mobile-stat-value">{{ summary.companies }}</span>
              </div>
              <div class="mobile-stat-row">
                <span class="mobile-stat-label">Deals</span>
                <span class="mobile-stat-value">{{ summary.deals }}</span>
              </div>
              @if (summary.last_synced) {
                <div class="mobile-stat-row">
                  <span class="mobile-stat-label">Last synced</span>
                  <span class="mobile-stat-value" style="font-size:0.8125rem">
                    {{ summary.last_synced | date:'short' }}
                  </span>
                </div>
              }
            </div>
          }

          <a [href]="crmBaseUrl" target="_blank" rel="noopener" class="mobile-open-btn">
            <i class="pi pi-external-link" aria-hidden="true"></i>
            Open CRM in new tab
          </a>
        </div>
      } @else {
        @switch (crmState()) {
          @case ('loading') {
            <div class="crm-skeleton" role="status" aria-label="Loading CRM" aria-busy="true">
              <div class="skeleton-header-row">
                <div class="skeleton-col-header"></div>
                <div class="skeleton-col-header"></div>
                <div class="skeleton-col-header"></div>
              </div>
              <div class="skeleton-rows">
                <div class="skeleton-row"></div>
                <div class="skeleton-row"></div>
                <div class="skeleton-row"></div>
                <div class="skeleton-row"></div>
                <div class="skeleton-row"></div>
              </div>
            </div>
            <!--
              SANDBOX NOTE: \`allow-same-origin\` is intentional here so that the
              embedded Twenty CRM at \`crm.taskflow.paraslace.in\` can read its
              own session cookies. The CRM origin is fully trusted (same operator,
              same TLS root, served from our own infrastructure); the sandbox
              attribute is defense-in-depth only. Do NOT add untrusted iframes
              to this component or reuse this sandbox string for third-party
              content — \`allow-same-origin\` + \`allow-scripts\` would let an
              untrusted document escape the sandbox.
            -->
            <iframe
              [src]="safeCrmUrl()"
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-storage-access-by-user-activation"
              title="CRM workspace"
              style="position:absolute;width:0;height:0;opacity:0;pointer-events:none;top:0;left:0"
              (load)="onIframeLoad()"
              (error)="onIframeError()"
              aria-hidden="true"
            ></iframe>
          }

          @case ('connected') {
            <iframe
              [src]="safeCrmUrl()"
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-storage-access-by-user-activation"
              title="CRM workspace"
              class="crm-iframe"
              (load)="onIframeLoad()"
              (error)="onIframeError()"
            ></iframe>
          }

          @case ('upgrading') {
            <iframe
              [src]="safeCrmUrl()"
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-storage-access-by-user-activation"
              title="CRM workspace — read-only during upgrade"
              class="crm-iframe readonly"
              (load)="onIframeLoad()"
              (error)="onIframeError()"
            ></iframe>
          }

          @case ('offline') {
            <div class="crm-empty-state" role="alert">
              <div class="empty-icon"><i class="pi pi-wifi" aria-hidden="true"></i></div>
              <p class="empty-title">CRM is unreachable</p>
              <p class="empty-desc">
                Could not connect to the CRM workspace. Check your connection
                or try opening the CRM directly.
              </p>
              <div class="empty-actions">
                <button class="btn-secondary" (click)="retry()" type="button">
                  <i class="pi pi-refresh"></i> Retry
                </button>
                <a [href]="crmBaseUrl" target="_blank" rel="noopener" class="btn-primary">
                  ↗ Open in new tab
                </a>
              </div>
            </div>
          }

          @case ('csp_blocked') {
            <div class="crm-empty-state" role="alert">
              <div class="empty-icon"><i class="pi pi-ban" aria-hidden="true"></i></div>
              <p class="empty-title">Embedding blocked</p>
              <p class="empty-desc">
                The CRM is configured to block iframe embedding.
                Open it in a new tab for the full experience.
              </p>
              <div class="empty-actions">
                <a [href]="crmBaseUrl" target="_blank" rel="noopener" class="btn-primary">
                  Open CRM
                </a>
              </div>
            </div>
          }

          @case ('disconnected') {
            <div class="crm-empty-state" role="alert">
              <div class="empty-icon"><i class="pi pi-link" aria-hidden="true"></i></div>
              <p class="empty-title">CRM not connected</p>
              <p class="empty-desc">
                The CRM integration is not connected for this workspace.
                Connect it from Integration settings to view your pipeline here.
              </p>
              <div class="empty-actions">
                <a routerLink="/settings/integrations" class="btn-primary">
                  Open Integration settings
                </a>
                <a [href]="crmBaseUrl" target="_blank" rel="noopener" class="btn-secondary">
                  ↗ Open CRM directly
                </a>
              </div>
            </div>
          }

          @case ('error') {
            <div class="crm-empty-state" role="alert">
              <div class="empty-icon">
                <i class="pi pi-exclamation-circle" aria-hidden="true"></i>
              </div>
              <p class="empty-title">Something went wrong</p>
              <p class="empty-desc">An error occurred while loading the CRM.</p>
              <div class="empty-actions">
                <button class="btn-secondary" (click)="reload()" type="button">
                  <i class="pi pi-refresh"></i> Reload
                </button>
              </div>
            </div>
          }

          @default {
            <div class="crm-skeleton" aria-hidden="true">
              <div class="skeleton-header-row">
                <div class="skeleton-col-header"></div>
                <div class="skeleton-col-header"></div>
                <div class="skeleton-col-header"></div>
              </div>
            </div>
          }
        }
      }
    </div>
  `,
})
export class CrmShellComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly bp = inject(BreakpointObserver);
  private readonly ctx = inject(WorkspaceContextService);
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);

  readonly crmBaseUrl = CRM_BASE_URL;
  readonly crmState = signal<CrmState>('idle');
  readonly isMobile = signal(false);
  readonly linkedSummary = signal<LinkedCrmSummary | null>(null);

  readonly safeCrmUrl = computed<SafeResourceUrl>(() =>
    this.sanitizer.bypassSecurityTrustResourceUrl(CRM_EMBED_URL)
  );

  readonly tasksLink = computed(() => {
    const wsId = this.ctx.activeWorkspaceId();
    return wsId ? `/workspace/${wsId}/my-work` : '/my-tasks';
  });

  private loadTimeout: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.bp
      .observe(['(max-width: 1023px)'])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        this.isMobile.set(result.matches);
        if (result.matches) {
          this.fetchLinkedSummary();
        }
      });

    // Probe the CRM integration health BEFORE attempting to load the iframe.
    // This is what makes csp_blocked + disconnected reachable instead of always
    // falling through to loading -> offline / error.
    this.probeHealthAndStart();
  }

  ngOnDestroy(): void {
    this.clearLoadTimeout();
  }

  onIframeLoad(): void {
    this.clearLoadTimeout();
    if (this.crmState() === 'loading') {
      this.crmState.set('connected');
    }
  }

  onIframeError(): void {
    this.clearLoadTimeout();
    this.crmState.set('error');
  }

  retry(): void {
    this.startLoading();
  }

  reload(): void {
    this.startLoading();
  }

  /** Called externally to put the shell into disconnected state. */
  disconnect(): void {
    this.crmState.set('disconnected');
    this.router.navigate(['/settings/integrations']);
  }

  /** Called externally to enter upgrading mode. */
  setUpgrading(): void {
    this.crmState.set('upgrading');
  }

  /**
   * Probe the CRM integration health endpoint and decide initial state.
   *
   * - If the response signals the CRM is not embeddable (e.g. CSP frame-ancestors
   *   blocks us) -> state = 'csp_blocked' (template offers an "Open CRM" link).
   * - If the response says the workspace has no Twenty link or the upstream is
   *   down -> state = 'disconnected' (template directs the user to Integration
   *   settings). If the iframe later succeeds despite this, the load handler
   *   will still flip to 'connected' since we only short-circuit when the probe
   *   is decisive.
   * - On any other outcome (network error, ok, or degraded) we fall through to
   *   the iframe load path via `startLoading()`.
   */
  private probeHealthAndStart(): void {
    this.http
      .get<TwentyHealthResponse>('/api/integrations/twenty/health')
      .pipe(catchError(() => of(null)))
      .subscribe((res) => {
        if (res && res.embed_compatible === false) {
          this.crmState.set('csp_blocked');
          return;
        }
        if (res && (res.workspace_bound === false || res.status === 'down')) {
          this.crmState.set('disconnected');
          return;
        }
        // Healthy or unknown — proceed with normal iframe load flow.
        this.startLoading();
      });
  }

  private startLoading(): void {
    this.clearLoadTimeout();
    this.crmState.set('loading');
    this.loadTimeout = setTimeout(() => {
      if (this.crmState() === 'loading') {
        this.crmState.set('offline');
      }
    }, LOAD_TIMEOUT_MS);
  }

  private clearLoadTimeout(): void {
    if (this.loadTimeout !== null) {
      clearTimeout(this.loadTimeout);
      this.loadTimeout = null;
    }
  }

  private fetchLinkedSummary(): void {
    this.http
      .get<LinkedCrmSummary>('/api/crm/recent-summary')
      .pipe(catchError(() => of(null)))
      .subscribe((summary) => this.linkedSummary.set(summary));
  }
}
