import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { KeyboardShortcutsService } from '../../../core/services/keyboard-shortcuts.service';
import { ViewMode } from '../board-toolbar/board-toolbar.component';
import { BoardStateService } from './board-state.service';

@Injectable()
export class BoardShortcutsService {
  private shortcutsService = inject(KeyboardShortcutsService);
  private router = inject(Router);
  private boardState = inject(BoardStateService);

  private isDragSimActive(): boolean {
    return this.boardState.dragSimulationActive();
  }

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
    clearFilters: () => void;
    cycleDensity: () => void;
    navigateCardColumn: (direction: -1 | 1) => void;
    pickUpCard: () => void;
    moveCardToAdjacentColumn: (direction: -1 | 1) => void;
    dropCard: () => void;
    cancelDrag: () => void;
    scrollToColumn: (index: number) => void;
    editFocusedTaskTitle: () => void;
    deleteFocusedTask: () => void;
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

    this.shortcutsService.register('board-clear-filters', {
      key: 'c',
      description: 'Clear all filters',
      category: 'Board',
      action: () => callbacks.clearFilters(),
    });

    this.shortcutsService.register('board-cycle-density', {
      key: 'd',
      description: 'Cycle card density',
      category: 'Board',
      action: () => callbacks.cycleDensity(),
    });

    this.shortcutsService.register('board-nav-col-left', {
      key: 'h',
      description: 'Navigate to left column',
      category: 'Navigation',
      action: () => {
        if (this.isDragSimActive()) {
          callbacks.moveCardToAdjacentColumn(-1);
        } else {
          callbacks.navigateCardColumn(-1);
        }
      },
    });

    this.shortcutsService.register('board-nav-col-right', {
      key: 'l',
      description: 'Navigate to right column',
      category: 'Navigation',
      action: () => {
        if (this.isDragSimActive()) {
          callbacks.moveCardToAdjacentColumn(1);
        } else {
          callbacks.navigateCardColumn(1);
        }
      },
    });

    this.shortcutsService.register('board-drag-pick-drop', {
      key: ' ',
      description: 'Pick up / drop card',
      category: 'Navigation',
      action: () => {
        if (this.isDragSimActive()) {
          callbacks.dropCard();
        } else {
          callbacks.pickUpCard();
        }
      },
    });

    this.shortcutsService.register('board-card-edit-title', {
      key: 'e',
      description: 'Edit focused card title',
      category: 'Card Actions',
      action: () => callbacks.editFocusedTaskTitle(),
    });

    this.shortcutsService.register('board-card-delete', {
      key: 'Delete',
      description: 'Delete focused card',
      category: 'Card Actions',
      action: () => callbacks.deleteFocusedTask(),
    });
  }

  unregister(): void {
    this.shortcutsService.unregisterByCategory('Board');
    this.shortcutsService.unregisterByCategory('Navigation');
    this.shortcutsService.unregisterByCategory('Card Actions');
  }

  handleKeydown(
    event: KeyboardEvent,
    viewMode: ViewMode,
    focusedTaskId: string | null,
    callbacks: {
      navigateCard: (direction: number) => void;
      openFocusedTask: () => void;
      cancelDrag: () => void;
    },
  ): void {
    if (event.key === 'Escape' && this.isDragSimActive()) {
      callbacks.cancelDrag();
      event.preventDefault();
      return;
    }

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
