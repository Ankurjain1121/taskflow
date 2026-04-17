import { Router } from '@angular/router';
import { ThemeService } from '../../../core/services/theme.service';
import { KeyboardShortcutsService } from '../../../core/services/keyboard-shortcuts.service';
import { WorkspaceContextService } from '../../../core/services/workspace-context.service';
import { buildThemeActions } from './theme-commands';
import { CommandAction } from './command-palette.types';

/**
 * Build all command actions available in the command palette.
 * Requires injected services since actions reference them.
 */
export function buildCommandActions(deps: {
  router: Router;
  themeService: ThemeService;
  shortcutsService: KeyboardShortcutsService;
  wsContext: WorkspaceContextService;
}): CommandAction[] {
  const { router, themeService, shortcutsService, wsContext } = deps;

  const navigateToWsRoute = (path: string): void => {
    const wsId = wsContext.activeWorkspaceId();
    if (wsId) {
      router.navigate(['/workspace', wsId, path]);
    } else {
      router.navigate(['/' + path]);
    }
  };

  return [
    {
      id: 'new-task',
      icon: 'plus',
      label: 'Create New Task',
      shortcut: 'N',
      action: () =>
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'n' })),
    },
    {
      id: 'dashboard',
      icon: 'home',
      label: 'Go to Dashboard',
      shortcut: 'G D',
      action: () => navigateToWsRoute('dashboard'),
    },
    {
      id: 'my-tasks',
      icon: 'check-square',
      label: 'Go to My Work',
      shortcut: 'G M',
      action: () => navigateToWsRoute('my-work'),
    },
    {
      id: 'eisenhower',
      icon: 'th-large',
      label: 'Go to Eisenhower Matrix',
      shortcut: 'G E',
      action: () => navigateToWsRoute('my-work'),
    },
    {
      id: 'dark-mode',
      icon: 'moon',
      label: 'Toggle Dark Mode',
      shortcut: 'Ctrl+Shift+D',
      action: () => {
        const current = themeService.resolvedTheme();
        themeService.setTheme(current === 'dark' ? 'light' : 'dark');
      },
    },
    {
      id: 'shortcuts',
      icon: 'key',
      label: 'Show Keyboard Shortcuts',
      shortcut: '?',
      action: () => shortcutsService.helpRequested.update((n) => n + 1),
    },
    {
      id: 'settings',
      icon: 'cog',
      label: 'Go to Settings',
      action: () => router.navigate(['/settings']),
    },
    {
      id: 'profile',
      icon: 'user',
      label: 'Go to Profile',
      action: () => router.navigate(['/settings/profile']),
    },
    {
      id: 'toggle-sidebar',
      icon: 'bars',
      label: 'Toggle Sidebar',
      shortcut: 'Ctrl+B',
      action: () =>
        document.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'b', ctrlKey: true }),
        ),
    },
    {
      id: 'clear-filters',
      icon: 'filter-slash',
      label: 'Clear Project Filters',
      shortcut: 'C',
      action: () =>
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'c' })),
    },
    ...buildThemeActions(themeService),
  ];
}
