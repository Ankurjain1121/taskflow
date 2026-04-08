import { Injectable } from '@angular/core';
import { HelpCategory, HelpArticle } from '../models/help-article.model';
import { HELP_CATEGORIES } from '../data/help-categories';
import { ALL_ARTICLES } from '../data/articles';

@Injectable({ providedIn: 'root' })
export class HelpContentService {
  private readonly categories: readonly HelpCategory[] = HELP_CATEGORIES;
  private readonly articles: readonly HelpArticle[] = ALL_ARTICLES;

  getCategories(): readonly HelpCategory[] {
    return [...this.categories].sort((a, b) => a.order - b.order);
  }

  getCategoryBySlug(slug: string): HelpCategory | undefined {
    return this.categories.find(c => c.slug === slug);
  }

  getArticlesByCategory(categorySlug: string): readonly HelpArticle[] {
    return this.articles
      .filter(a => a.categorySlug === categorySlug)
      .sort((a, b) => a.order - b.order);
  }

  getArticleBySlug(categorySlug: string, articleSlug: string): HelpArticle | undefined {
    return this.articles.find(a => a.categorySlug === categorySlug && a.slug === articleSlug);
  }

  getFeaturedArticles(limit: number = 6): readonly HelpArticle[] {
    return this.articles.slice(0, limit);
  }

  getRelatedArticles(article: HelpArticle): readonly HelpArticle[] {
    if (!article.relatedSlugs?.length) return [];
    return this.articles.filter(a => article.relatedSlugs!.includes(a.slug));
  }

  getAllArticles(): readonly HelpArticle[] {
    return this.articles;
  }

  // localStorage-backed feedback
  submitFeedback(articleSlug: string, helpful: boolean): void {
    const key = `help-feedback:${articleSlug}`;
    localStorage.setItem(key, JSON.stringify({ helpful, timestamp: Date.now() }));
  }

  getFeedback(articleSlug: string): boolean | null {
    const key = `help-feedback:${articleSlug}`;
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    try {
      return JSON.parse(stored).helpful;
    } catch {
      return null;
    }
  }
}
