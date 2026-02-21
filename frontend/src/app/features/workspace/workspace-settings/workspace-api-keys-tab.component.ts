import {
  Component,
  input,
  output,
  signal,
  inject,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ApiKeyService,
  ApiKeyListItem,
} from '../../../core/services/api-key.service';

@Component({
  selector: 'app-workspace-api-keys-tab',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="py-6 space-y-6">
      <!-- API Keys -->
      <div class="widget-card">
        <div class="px-6 py-4 border-b border-[var(--border)]">
          <div class="flex items-center justify-between">
            <div>
              <h3
                class="text-sm font-medium text-[var(--foreground)]"
              >
                API Keys
              </h3>
              <p
                class="text-xs text-[var(--muted-foreground)] mt-1"
              >
                Manage API keys for programmatic access
              </p>
            </div>
            <button
              (click)="onGenerateApiKey()"
              [disabled]="generatingKey()"
              class="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-primary rounded-md hover:brightness-90 disabled:opacity-50"
            >
              @if (generatingKey()) {
                Generating...
              } @else {
                Generate New Key
              }
            </button>
          </div>
        </div>

        <!-- Newly created key display -->
        @if (newlyCreatedKey()) {
          <div
            class="mx-6 mt-4 p-4 bg-[var(--status-green-bg)] border border-[var(--status-green-border)] rounded-lg"
          >
            <div class="flex items-center justify-between mb-2">
              <p
                class="text-sm font-medium text-[var(--status-green-text)]"
              >
                API Key Created - Copy it now! It won't be shown
                again.
              </p>
              <button
                (click)="newlyCreatedKey.set(null)"
                class="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                <svg
                  class="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div class="flex items-center gap-2">
              <code
                class="flex-1 px-3 py-2 bg-[var(--background)] rounded text-sm font-mono text-[var(--foreground)] select-all break-all"
              >
                {{ newlyCreatedKey() }}
              </code>
              <button
                (click)="copyApiKey()"
                class="inline-flex items-center px-3 py-2 text-sm font-medium text-primary border border-primary rounded-md hover:bg-primary/10"
              >
                {{ copiedKey() ? 'Copied!' : 'Copy' }}
              </button>
            </div>
          </div>
        }

        <!-- API Keys Table -->
        @if (apiKeys().length > 0) {
          <div class="overflow-x-auto">
            <table
              class="min-w-full divide-y divide-[var(--border)]"
            >
              <thead class="bg-[var(--secondary)]">
                <tr>
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider"
                  >
                    Name
                  </th>
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider"
                  >
                    Key Prefix
                  </th>
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider"
                  >
                    Created
                  </th>
                  <th
                    class="px-6 py-3 text-right text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider"
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody
                class="bg-[var(--card)] divide-y divide-[var(--border)]"
              >
                @for (key of apiKeys(); track key.id) {
                  <tr class="hover:bg-[var(--muted)]">
                    <td
                      class="px-6 py-4 whitespace-nowrap text-sm font-medium text-[var(--foreground)]"
                    >
                      {{ key.name }}
                    </td>
                    <td
                      class="px-6 py-4 whitespace-nowrap text-sm text-[var(--muted-foreground)] font-mono"
                    >
                      {{ key.key_prefix }}...
                    </td>
                    <td
                      class="px-6 py-4 whitespace-nowrap text-sm text-[var(--muted-foreground)]"
                    >
                      {{ formatDate(key.created_at) }}
                    </td>
                    <td
                      class="px-6 py-4 whitespace-nowrap text-right"
                    >
                      <button
                        (click)="onRevokeApiKey(key)"
                        [disabled]="revokingKey() === key.id"
                        class="text-sm text-red-600 hover:text-red-900 disabled:opacity-50"
                      >
                        {{
                          revokingKey() === key.id
                            ? 'Revoking...'
                            : 'Revoke'
                        }}
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <div
            class="px-6 py-8 text-center text-[var(--muted-foreground)] text-sm"
          >
            No API keys yet. Generate one to get started.
          </div>
        }
      </div>

      <!-- Integration Placeholders -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        @for (
          integration of integrationPlaceholders;
          track integration.name
        ) {
          <div class="widget-card p-5">
            <div class="flex items-center gap-3 mb-3">
              <div
                class="w-10 h-10 rounded-lg bg-[var(--secondary)] flex items-center justify-center"
              >
                <svg
                  class="w-5 h-5 text-[var(--muted-foreground)]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                  />
                </svg>
              </div>
              <div>
                <h4
                  class="text-sm font-medium text-[var(--foreground)]"
                >
                  {{ integration.name }}
                </h4>
                <span
                  class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--secondary)] text-[var(--muted-foreground)]"
                >
                  Coming soon
                </span>
              </div>
            </div>
            <p class="text-xs text-[var(--muted-foreground)]">
              {{ integration.description }}
            </p>
          </div>
        }
      </div>
    </div>
  `,
})
export class WorkspaceApiKeysTabComponent implements OnInit {
  private apiKeyService = inject(ApiKeyService);

  workspaceId = input.required<string>();

  keyGenerated = output<void>();
  keyRevoked = output<void>();

  apiKeys = signal<ApiKeyListItem[]>([]);
  generatingKey = signal(false);
  newlyCreatedKey = signal<string | null>(null);
  copiedKey = signal(false);
  revokingKey = signal<string | null>(null);

  integrationPlaceholders = [
    {
      name: 'Slack',
      description: 'Get notifications and updates in your Slack channels',
    },
    { name: 'GitHub', description: 'Link pull requests and commits to tasks' },
    { name: 'Jira', description: 'Import and sync issues from Jira projects' },
  ];

  ngOnInit(): void {
    this.loadApiKeys();
  }

  onGenerateApiKey(): void {
    const name = prompt('Enter a name for this API key:');
    if (!name) return;

    this.generatingKey.set(true);
    this.apiKeyService.createKey(this.workspaceId(), name).subscribe({
      next: (response) => {
        this.newlyCreatedKey.set(response.full_key);
        this.loadApiKeys();
        this.generatingKey.set(false);
        this.keyGenerated.emit();
      },
      error: () => {
        this.generatingKey.set(false);
      },
    });
  }

  copyApiKey(): void {
    const key = this.newlyCreatedKey();
    if (!key) return;

    navigator.clipboard.writeText(key).then(() => {
      this.copiedKey.set(true);
      setTimeout(() => this.copiedKey.set(false), 2000);
    });
  }

  onRevokeApiKey(key: ApiKeyListItem): void {
    if (!confirm(`Revoke API key "${key.name}"? This cannot be undone.`))
      return;

    this.revokingKey.set(key.id);
    this.apiKeyService.revokeKey(this.workspaceId(), key.id).subscribe({
      next: () => {
        this.apiKeys.update((keys) => keys.filter((k) => k.id !== key.id));
        this.revokingKey.set(null);
        this.keyRevoked.emit();
      },
      error: () => {
        this.revokingKey.set(null);
      },
    });
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  loadApiKeys(): void {
    this.apiKeyService.listKeys(this.workspaceId()).subscribe({
      next: (keys) => {
        this.apiKeys.set(keys);
      },
      error: () => {
        // Non-critical
      },
    });
  }
}
