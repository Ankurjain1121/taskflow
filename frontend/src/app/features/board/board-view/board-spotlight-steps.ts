import { SpotlightStep } from '../../../shared/components/spotlight-overlay/spotlight-overlay.component';

export const BOARD_SPOTLIGHT_STEPS: SpotlightStep[] = [
  {
    targetSelector:
      '.kanban-columns-wrapper, app-kanban-column, .kanban-column',
    title: 'Your tasks live in columns',
    description:
      'Each column represents a status. Drag cards between columns to update progress. You can add, rename, or reorder columns anytime.',
    position: 'right',
  },
  {
    targetSelector: '.toolbar-wrapper, app-board-toolbar',
    title: 'Find tasks fast with filters',
    description:
      'Use the search bar, priority filters, or quick filter pills to narrow down your view. Press F to focus search.',
    position: 'bottom',
  },
  {
    targetSelector: '',
    title: "You're all set!",
    description:
      "Press ? anytime to see keyboard shortcuts. Use Ctrl+K for the command palette. We'll show you helpful tips as you explore.",
    position: 'bottom',
  },
];
