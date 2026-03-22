import { ElementRef, Signal, WritableSignal } from '@angular/core';
import { Router } from '@angular/router';
import {
  SearchResults,
  TaskSearchResult,
  BoardSearchResult,
  CommentSearchResult,
} from '../../../core/services/search.service';
import {
  RecentItemsService,
  RecentItem,
} from '../../../core/services/recent-items.service';
import { CommandAction } from './command-palette.types';

/**
 * Handles keyboard arrow navigation and item selection within the command palette.
 */
export function handleInputKeydown(
  event: KeyboardEvent,
  totalItems: number,
  selectedIndex: WritableSignal<number>,
  resultsList: ElementRef<HTMLDivElement> | undefined,
  selectCurrentItemFn: () => void,
): void {
  if (totalItems === 0) return;

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      selectedIndex.update((i) => (i + 1) % totalItems);
      scrollSelectedIntoView(resultsList, selectedIndex);
      break;
    case 'ArrowUp':
      event.preventDefault();
      selectedIndex.update((i) => (i - 1 + totalItems) % totalItems);
      scrollSelectedIntoView(resultsList, selectedIndex);
      break;
    case 'Enter':
      event.preventDefault();
      selectCurrentItemFn();
      break;
  }
}

/**
 * Scrolls the currently selected item into view within the results list.
 */
export function scrollSelectedIntoView(
  resultsList: ElementRef<HTMLDivElement> | undefined,
  selectedIndex: Signal<number>,
): void {
  requestAnimationFrame(() => {
    const container = resultsList?.nativeElement;
    if (!container) return;
    const item = container.querySelector(
      `[data-item-index="${selectedIndex()}"]`,
    ) as HTMLElement | null;
    item?.scrollIntoView({ block: 'nearest' });
  });
}

/**
 * Resolves which item is selected and executes its action (navigate or run command).
 */
export function selectCurrentItem(deps: {
  selectedIndex: Signal<number>;
  isCommandMode: Signal<boolean>;
  query: Signal<string>;
  filteredActions: Signal<CommandAction[]>;
  recentItems: Signal<RecentItem[]>;
  quickActions: Signal<CommandAction[]>;
  results: Signal<SearchResults | null>;
  executeAction: (action: CommandAction) => void;
  onRecentItemClick: (item: RecentItem) => void;
  navigateToTask: (task: TaskSearchResult) => void;
  navigateToBoard: (board: BoardSearchResult) => void;
  navigateToComment: (comment: CommentSearchResult) => void;
}): void {
  const idx = deps.selectedIndex();

  if (deps.isCommandMode()) {
    const acts = deps.filteredActions();
    if (idx >= 0 && idx < acts.length) {
      deps.executeAction(acts[idx]);
    }
    return;
  }

  if (!deps.query()) {
    const recents = deps.recentItems();
    if (idx < recents.length) {
      deps.onRecentItemClick(recents[idx]);
      return;
    }
    const actionIdx = idx - recents.length;
    const quickActs = deps.quickActions();
    if (actionIdx >= 0 && actionIdx < quickActs.length) {
      deps.executeAction(quickActs[actionIdx]);
    }
    return;
  }

  const r = deps.results();
  if (!r) return;

  const taskLen = r.tasks.length;
  const boardLen = r.boards.length;

  if (idx < taskLen) {
    deps.navigateToTask(r.tasks[idx]);
  } else if (idx < taskLen + boardLen) {
    deps.navigateToBoard(r.boards[idx - taskLen]);
  } else {
    const commentIdx = idx - taskLen - boardLen;
    if (commentIdx < r.comments.length) {
      deps.navigateToComment(r.comments[commentIdx]);
    }
  }
}

/**
 * Navigate to a task and record it as a recent item.
 */
export function navigateToTask(
  task: TaskSearchResult,
  router: Router,
  recentItemsService: RecentItemsService,
  closeFn: () => void,
): void {
  recentItemsService.recordTaskView({
    id: task.id,
    title: task.title,
    boardName: task.board_name,
    workspaceId: task.workspace_id,
    workspaceName: task.workspace_name,
    boardId: task.board_id,
  });
  router.navigate(
    ['/workspace', task.workspace_id, 'project', task.board_id],
    { queryParams: { task: task.id } },
  );
  closeFn();
}

/**
 * Navigate to a board/project and record it as a recent item.
 */
export function navigateToBoard(
  board: BoardSearchResult,
  router: Router,
  recentItemsService: RecentItemsService,
  closeFn: () => void,
): void {
  recentItemsService.recordBoardView({
    id: board.id,
    name: board.name,
    workspaceId: board.workspace_id,
    workspaceName: board.workspace_name,
  });
  router.navigate(['/workspace', board.workspace_id, 'project', board.id]);
  closeFn();
}

/**
 * Navigate to a comment's task.
 */
export function navigateToComment(
  comment: CommentSearchResult,
  router: Router,
  closeFn: () => void,
): void {
  router.navigate(
    ['/workspace', comment.workspace_id, 'project', comment.board_id],
    { queryParams: { task: comment.task_id } },
  );
  closeFn();
}

/**
 * Handle click on a recent item.
 */
export function onRecentItemClick(
  item: RecentItem,
  router: Router,
  closeFn: () => void,
): void {
  if (item.entityType === 'board') {
    router.navigate(['/workspace', item.workspaceId, 'project', item.id]);
  } else if (item.entityType === 'task' && item.boardId) {
    router.navigate(
      ['/workspace', item.workspaceId, 'project', item.boardId],
      { queryParams: { task: item.id } },
    );
  }
  closeFn();
}
