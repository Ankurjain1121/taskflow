export interface HelpCategory {
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly icon: string;
  readonly order: number;
}

export interface HelpArticle {
  readonly slug: string;
  readonly categorySlug: string;
  readonly title: string;
  readonly summary: string;
  readonly content: string;
  readonly tags: readonly string[];
  readonly videoUrl?: string;
  readonly videoPosterUrl?: string;
  readonly order: number;
  readonly updatedAt: string;
  readonly relatedSlugs?: readonly string[];
}
