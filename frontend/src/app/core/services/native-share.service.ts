import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';

@Injectable({
  providedIn: 'root',
})
export class NativeShareService {
  private readonly baseUrl = 'https://taskflow.paraslace.in';

  async shareTask(task: {
    title: string;
    id: string;
    boardId?: string;
  }): Promise<void> {
    const url = `${this.baseUrl}/task/${task.id}`;
    const title = `TaskBolt: ${task.title}`;

    if (Capacitor.isNativePlatform()) {
      await Share.share({
        title,
        url,
        dialogTitle: 'Share Task',
      });
      return;
    }

    // Web fallback: navigator.share or clipboard
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // User cancelled or share failed — fall through to clipboard
      }
    }

    await navigator.clipboard.writeText(url);
  }
}
