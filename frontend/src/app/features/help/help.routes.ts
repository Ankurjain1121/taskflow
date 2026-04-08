import { Routes } from '@angular/router';

export const helpRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./components/help-layout/help-layout.component').then(
        (m) => m.HelpLayoutComponent,
      ),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./components/help-home/help-home.component').then(
            (m) => m.HelpHomeComponent,
          ),
      },
      {
        path: 'search',
        loadComponent: () =>
          import(
            './components/help-search-results/help-search-results.component'
          ).then((m) => m.HelpSearchResultsComponent),
      },
      {
        path: ':categorySlug',
        loadComponent: () =>
          import('./components/help-category/help-category.component').then(
            (m) => m.HelpCategoryComponent,
          ),
      },
      {
        path: ':categorySlug/:articleSlug',
        loadComponent: () =>
          import('./components/help-article/help-article.component').then(
            (m) => m.HelpArticleComponent,
          ),
      },
    ],
  },
];
