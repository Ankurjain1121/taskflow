import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { KeyboardShortcutsService } from '../../../core/services/keyboard-shortcuts.service';
import { ViewMode } from '../board-toolbar/board-toolbar.component';
import { ProjectStateService } from './board-state.service';
import { ProjectDragDropHandler } from './board-drag-drop.handler';

@Injectable()
export class ProjectShortcutsService {
  private shortcutsService = inject(KeyboardShortcutsService);
  private router = inject(Router);
  private boardState = inject(ProjectStateService);
  private dragDrop = inject(ProjectDragDropHandler);

  private isDragSimActive(): boolean {
    return this.boardState.dragSimulationActive();
  }

  registerShortcuts(callbacks: {
    createTask: () => void;
    setViewMode: (mode: ViewMode) => void;
    onViewModeChanged: (mode: ViewMode) => void;
    focusFilter: () => void;
    clearFilters: () => void;
    cycleDensity: () => void;
  }): void {
    this.shortcutsService.register('board-new-task', {
      key: 'n',
      description: 'Create new task',
      category: 'Project',
      action: () => callbacks.createTask(),
    });

    this.shortcutsService.register('board-search', {
      key: '/',
      description: 'Focus search',
      category: 'Project',
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
      category: 'Project',
      action: () => callbacks.focusFilter(),
    });

    this.shortcutsService.register('board-escape', {
      key: 'Escape',
      description: 'Close panel / Clear selection / Clear focus',
      category: 'Project',
      action: () => {
        if (this.boardState.focusedTaskId()) {
          this.boardState.focusedTaskId.set(null);
        } else if (this.boardState.selectedTaskIds().length > 0) {
          this.boardState.clearSelection();
        } else if (this.boardState.selectedTaskId()) {
          this.boardState.selectedTaskId.set(null);
        }
      },
    });

    this.shortcutsService.register('board-view-kanban', {
      key: '1',
      description: 'Kanban view',
      category: 'Project',
      action: () => callbacks.setViewMode('kanban'),
    });

    this.shortcutsService.register('board-view-list', {
      key: '2',
      description: 'List view',
      category: 'Project',
      action: () => {
        callbacks.setViewMode('list');
        callbacks.onViewModeChanged('list');
      },
    });

    this.shortcutsService.register('board-view-calendar', {
      key: '3',
      description: 'Calendar view',
      category: 'Project',
      action: () => {
        callbacks.setViewMode('calendar');
        callbacks.onViewModeChanged('calendar');
      },
    });

    this.shortcutsService.register('board-view-gantt', {
      key: '4',
      description: 'Gantt view',
      category: 'Project',
      action: () => {
        callbacks.setViewMode('gantt');
        callbacks.onViewModeChanged('gantt');
      },
    });

    this.shortcutsService.register('board-view-reports', {
      key: '5',
      description: 'Reports view',
      category: 'Project',
      action: () => {
        callbacks.setViewMode('reports');
        callbacks.onViewModeChanged('reports');
      },
    });

    this.shortcutsService.register('board-view-time-report', {
      key: '6',
      description: 'Time report view',
      category: 'Project',
      action: () => {
        callbacks.setViewMode('time-report');
        callbacks.onViewModeChanged('time-report');
      },
    });

    this.shortcutsService.register('board-clear-filters', {
      key: 'c',
      description: 'Clear all filters',
      category: 'Project',
      action: () => callbacks.clearFilters(),
    });

    this.shortcutsService.register('board-cycle-density', {
      key: 'd',
      description: 'Cycle card density',
      category: 'Project',
      action: () => callbacks.cycleDensity(),
    });

    this.shortcutsService.register('board-nav-col-left', {
      key: 'h',
      description: 'Navigate to left column',
      category: 'Navigation',
      action: () => {
        if (this.isDragSimActive()) {
          this.dragDrop.moveCardToAdjacentColumn(-1);
        } else {
          this.dragDrop.navigateCardColumn(-1);
        }
      },
    });

    this.shortcutsService.register('board-nav-col-right', {
      key: 'l',
      description: 'Navigate to right column',
      category: 'Navigation',
      action: () => {
        if (this.isDragSimActive()) {
          this.dragDrop.moveCardToAdjacentColumn(1);
        } else {
          this.dragDrop.navigateCardColumn(1);
        }
      },
    });

    this.shortcutsService.register('board-drag-pick-drop', {
      key: ' ',
      description: 'Pick up / drop card',
      category: 'Navigation',
      action: () => {
        if (this.isDragSimActive()) {
          this.dragDrop.dropCard();
        } else {
          this.dragDrop.pickUpCard();
        }
      },
    });

    this.shortcutsService.register('board-card-edit-title', {
      key: 'e',
      description: 'Edit focused card title',
      category: 'Card Actions',
      action: () => {
        const id = this.boardState.focusedTaskId();
        if (!id) return;
        const el = document.querySelector<HTMLElement>(
          `[data-task-id="${id}"] [data-title-edit]`,
        );
        el?.click();
      },
    });

    this.shortcutsService.register('board-card-delete', {
      key: 'Delete',
      description: 'Delete focused card',
      category: 'Card Actions',
      action: () => {
        const id = this.boardState.focusedTaskId();
        if (id) this.boardState.deleteTask(id);
      },
    });
  }

  unregister(): void {
    this.shortcutsService.unregisterByCategory('Project');
    this.shortcutsService.unregisterByCategory('Navigation');
    this.shortcutsService.unregisterByCategory('Card Actions');
  }

  private currentViewMode: () => ViewMode = () => 'kanban';

  setViewModeGetter(getter: () => ViewMode): void {
    this.currentViewMode = getter;
  }

  handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.isDragSimActive()) {
      this.dragDrop.cancelDrag();
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

    if (this.currentViewMode() !== 'kanban') return;

    switch (event.key) {
      case 'j':
      case 'J':
      case 'ArrowDown':
        this.dragDrop.navigateCard(1);
        event.preventDefault();
        break;
      case 'k':
      case 'K':
      case 'ArrowUp':
        this.dragDrop.navigateCard(-1);
        event.preventDefault();
        break;
      case 'Enter':
        if (this.boardState.focusedTaskId()) {
          this.dragDrop.openFocusedTask();
          event.preventDefault();
        }
        break;
    }
  }
}
