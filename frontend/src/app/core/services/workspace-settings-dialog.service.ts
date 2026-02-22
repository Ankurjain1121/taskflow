import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class WorkspaceSettingsDialogService {
  readonly visible = signal(false);
  readonly workspaceId = signal('');

  open(workspaceId: string): void {
    this.workspaceId.set(workspaceId);
    this.visible.set(true);
  }

  close(): void {
    this.visible.set(false);
    this.workspaceId.set('');
  }
}
