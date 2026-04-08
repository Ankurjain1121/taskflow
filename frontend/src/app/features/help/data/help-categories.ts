import { HelpCategory } from '../models/help-article.model';

export const HELP_CATEGORIES: readonly HelpCategory[] = [
  {
    slug: 'getting-started',
    title: 'Getting Started',
    description: 'Set up your workspace, projects, and team in minutes.',
    icon: 'pi pi-play',
    order: 1,
  },
  {
    slug: 'features',
    title: 'Features',
    description: 'Learn about kanban boards, reports, automations, and more.',
    icon: 'pi pi-th-large',
    order: 2,
  },
  {
    slug: 'workflows',
    title: 'Workflows',
    description: 'Tips and best practices for organizing your work.',
    icon: 'pi pi-sitemap',
    order: 3,
  },
  {
    slug: 'troubleshooting',
    title: 'Troubleshooting',
    description: 'Common issues and how to resolve them.',
    icon: 'pi pi-wrench',
    order: 4,
  },
];
