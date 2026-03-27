/** Randomized loading messages — one is picked each time */
export const LOADING_MESSAGES: readonly string[] = [
  'Herding pixels...',
  'Teaching robots to dance...',
  'Consulting the magic 8-ball...',
  'Counting backwards from infinity...',
  'Warming up the flux capacitors...',
  'Asking the servers nicely...',
  'Brewing fresh data...',
  'Untangling the spaghetti code...',
  'Polishing the pixels...',
  'Loading awesomeness...',
];

/** Map from EmptyStateVariant (or category) to randomized empty messages */
export const EMPTY_MESSAGES: Record<string, readonly string[]> = {
  tasks: [
    'Your task list is empty. Time for a victory lap!',
    'Nothing to do? Plot twist — you\'re crushing it.',
    'Zero tasks. Either you\'re done or you haven\'t started. Both are valid.',
    'All clear! Your future self thanks you.',
  ],
  'my-tasks-done': [
    'You did it! Everything is checked off.',
    'Zero tasks remaining. Treat yourself!',
    'All done — your productivity is showing.',
  ],
  board: [
    'No projects yet. The world is your kanban board.',
    'Your canvas awaits. Create something amazing.',
    'A blank slate — full of potential.',
  ],
  workspace: [
    'No projects yet. The world is your kanban board.',
    'Your canvas awaits. Create something amazing.',
    'A blank slate — full of potential.',
  ],
  notifications: [
    'Inbox zero! You\'re a productivity legend.',
    'Nothing here. Even the notifications are taking a break.',
    'All caught up. Go enjoy the sunshine.',
  ],
  favorites: [
    'No favorites yet. Star the things you love!',
    'Your favorites list is a blank canvas.',
    'Nothing starred — start collecting your go-tos.',
  ],
  search: [
    'No results found. Try different keywords?',
    'Nothing matched. The search continues...',
    'Nada. Zilch. Zero. Try broadening your search.',
  ],
  comments: [
    'No comments yet. Be the first to speak up!',
    'The conversation hasn\'t started. Break the ice!',
  ],
  activity: [
    'No activity yet. It\'s quiet... too quiet.',
    'Nothing to show. Activity will appear as changes happen.',
  ],
  default: [
    'Nothing here yet.',
    'This space is waiting for your brilliance.',
    'Empty — but not for long.',
  ],
};

/** Friendly error messages */
export const ERROR_MESSAGES: Record<string, readonly string[]> = {
  network: [
    'Looks like the internet took a coffee break.',
    'Connection hiccup — give it a sec and try again.',
    'The servers are playing hide and seek. (And winning.)',
  ],
  notFound: [
    'This page went on vacation without telling anyone.',
    '404 — We looked everywhere. Under the couch cushions, even.',
    'Page not found. It was here a minute ago, we swear.',
  ],
  server: [
    'Something went wrong on our end. We\'re on it!',
    'Our servers tripped over their own shoelaces. Retry?',
    'Oops — that wasn\'t supposed to happen. Working on a fix.',
  ],
  permission: [
    'You shall not pass! (Insufficient permissions)',
    'Access denied. Contact your workspace admin for access.',
  ],
  default: [
    'Something went sideways. Try again?',
    'Well, that didn\'t work. Let\'s try again.',
  ],
};

/** Pick a random message from an array */
export function randomMessage(messages: readonly string[]): string {
  return messages[Math.floor(Math.random() * messages.length)];
}

/** Get a random empty-state subtitle for a given variant */
export function randomEmptyMessage(variant: string): string {
  const messages = EMPTY_MESSAGES[variant] ?? EMPTY_MESSAGES['default'];
  return randomMessage(messages);
}

/** Get a random error message for a given error category */
export function randomErrorMessage(category: string): string {
  const messages = ERROR_MESSAGES[category] ?? ERROR_MESSAGES['default'];
  return randomMessage(messages);
}
