import { Injectable } from '@angular/core';
import Fuse, { FuseResult } from 'fuse.js';
import { HelpArticle } from '../models/help-article.model';
import { ALL_ARTICLES } from '../data/articles';

@Injectable({ providedIn: 'root' })
export class HelpSearchService {
  private readonly fuse: Fuse<HelpArticle>;

  constructor() {
    this.fuse = new Fuse([...ALL_ARTICLES], {
      keys: [
        { name: 'title', weight: 0.4 },
        { name: 'summary', weight: 0.25 },
        { name: 'tags', weight: 0.2 },
        { name: 'content', weight: 0.15 },
      ],
      threshold: 0.3,
      includeScore: true,
    });
  }

  search(query: string): FuseResult<HelpArticle>[] {
    if (!query.trim()) return [];
    return this.fuse.search(query);
  }
}
