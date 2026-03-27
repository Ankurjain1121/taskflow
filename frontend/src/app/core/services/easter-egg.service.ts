import { Injectable, inject } from '@angular/core';
import { MessageService } from 'primeng/api';
import { ConfettiService } from './confetti.service';

@Injectable({ providedIn: 'root' })
export class EasterEggService {
  private readonly confetti = inject(ConfettiService);
  private readonly messageService = inject(MessageService);

  private sequence: string[] = [];
  private readonly konamiCode = [
    'ArrowUp',
    'ArrowUp',
    'ArrowDown',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'ArrowLeft',
    'ArrowRight',
    'b',
    'a',
  ];

  private readonly keyHandler = (e: KeyboardEvent): void => this.handleKey(e.key);

  init(): void {
    document.addEventListener('keydown', this.keyHandler);
  }

  destroy(): void {
    document.removeEventListener('keydown', this.keyHandler);
  }

  private handleKey(key: string): void {
    this.sequence = [...this.sequence, key];
    if (this.sequence.length > 10) {
      this.sequence = this.sequence.slice(-10);
    }
    if (JSON.stringify(this.sequence) === JSON.stringify(this.konamiCode)) {
      this.activate();
      this.sequence = [];
    }
  }

  private activate(): void {
    this.confetti.fire();
    this.messageService.add({
      severity: 'success',
      summary: 'Party Mode Activated! \uD83C\uDF89',
      life: 5000,
    });
    document.documentElement.setAttribute('data-party-mode', 'true');
    setTimeout(
      () => document.documentElement.removeAttribute('data-party-mode'),
      10000,
    );
  }
}
