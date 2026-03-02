import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { KeyboardShortcutsService } from '../../../core/services/keyboard-shortcuts.service';
import { ViewMode } from '../board-toolbar/board-toolbar.component';

@Injectable()
export class BoardShortcutsService {
  private shortcutsService = inject(KeyboardShortcutsService);
  private router = inject(Router);

  registerShortcuts(callbacks: {
    createTask: () => void;
    closePanel: () => void;
    clearSelection: () => void;
    closeTaskDetail: () => void;
    getFocusedTaskId: () => string | null;
    setFocusedTaskId: (id: string | null) => void;
    getSelectedTaskIds: () => string[];
    getSelectedTaskId: () => string | null;
    setViewMode: (mode: ViewMode) => void;
    onViewModeChanged: (mode: ViewMode) => void;
    focusFilter: () => void;
  }): void {
    this.shortcutsService.register('board-new-task', {
      key: 'n',
      description: 'Create new task',
      category: 'Board',
      action: () => callbacks.createTask(),
    });

    this.shortcutsService.register('board-search', {
      key: '/',
      description: 'Focus search',
      category: 'Board',
      action: () => {
        const searchInput = document.querySelector<HTMLInputElement>(
          'input[placeholder*="Search"]',
        );
        searchInput?.focus();
      },
    });

    this.shortcutsService.register('board-focus-filter', {
      key: 'f',
      description: 'Focus filter bar',
      category: 'Board',
      action: () => callbacks.focusFilter(),
    });

    this.shortcutsService.register('board-escape', {
      key: 'Escape',
      description: 'Close panel / Clear selection / Clear focus',
      category: 'Board',
      action: () => {
        if (callbacks.getFocusedTaskId()) {
          callbacks.setFocusedTaskId(null);
        } else if (callbacks.getSelectedTaskIds().length > 0) {
          callbacks.clearSelection();
        } else if (callbacks.getSelectedTaskId()) {
          callbacks.closeTaskDetail();
        }
      },
    });

    this.shortcutsService.register('board-view-kanban', {
      key: '1',
      description: 'Kanban view',
      category: 'Board',
      action: () => callbacks.setViewMode('kanban'),
    });

    this.shortcutsService.register('board-view-list', {
      key: '2',
      description: 'List view',
      category: 'Board',
      action: () => {
        callbacks.setViewMode('list');
        callbacks.onViewModeChanged('list');
      },
    });

    this.shortcutsService.register('board-view-calendar', {
      key: '3',
      description: 'Calendar view',
      category: 'Board',
      action: () => {
        callbacks.setViewMode('calendar');
        callbacks.onViewModeChanged('calendar');
      },
    });

    this.shortcutsService.register('board-view-gantt', {
      key: '4',
      description: 'Gantt view',
      category: 'Board',
      action: () => {
        callbacks.setViewMode('gantt');
        callbacks.onViewModeChanged('gantt');
      },
    });

    this.shortcutsService.register('board-view-reports', {
      key: '5',
      description: 'Reports view',
      category: 'Board',
      action: () => {
        callbacks.setViewMode('reports');
        callbacks.onViewModeChanged('reports');
      },
    });

    this.shortcutsService.register('board-view-time-report', {
      key: '6',
      description: 'Time report view',
      category: 'Board',
      action: () => {
        callbacks.setViewMode('time-report');
        callbacks.onViewModeChanged('time-report');
      },
    });
  }

  unregister(): void {
    this.shortcutsService.unregisterByCategory('Board');
  }

  handleKeydown(
    event: KeyboardEvent,
    viewMode: ViewMode,
    focusedTaskId: string | null,
    callbacks: {
      navigateCard: (direction: number) => void;
      openFocusedTask: () => void;
    },
  ): void {
    const target = event.target as HTMLElement;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target.tagName === 'SELECT' ||
      target.isContentEditable
    ) {
      return;
    }

    if (viewMode !== 'kanban') return;

    switch (event.key) {
      case 'j':
      case 'J':
        callbacks.navigateCard(1);
        event.preventDefault();
        break;
      case 'k':
      case 'K':
        callbacks.navigateCard(-1);
        event.preventDefault();
        break;
      case 'Enter':
        if (focusedTaskId) {
          callbacks.openFocusedTask();
          event.preventDefault();
        }
        break;
    }
  }
}
