import { GETTING_STARTED_ARTICLES } from './getting-started.articles';
import { FEATURES_ARTICLES } from './features.articles';
import { WORKFLOWS_ARTICLES } from './workflows.articles';
import { TROUBLESHOOTING_ARTICLES } from './troubleshooting.articles';

export const ALL_ARTICLES = [
  ...GETTING_STARTED_ARTICLES,
  ...FEATURES_ARTICLES,
  ...WORKFLOWS_ARTICLES,
  ...TROUBLESHOOTING_ARTICLES,
] as const;
