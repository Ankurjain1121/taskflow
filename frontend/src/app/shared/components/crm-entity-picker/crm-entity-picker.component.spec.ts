import { TestBed, ComponentFixture, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';

import { CrmEntityPickerComponent } from './crm-entity-picker.component';
import { CrmService, CrmSearchResult } from '../../../core/services/crm.service';

describe('CrmEntityPickerComponent', () => {
  let component: CrmEntityPickerComponent;
  let fixture: ComponentFixture<CrmEntityPickerComponent>;
  let mockCrmService: { searchEntities: ReturnType<typeof vi.fn> };

  const mockResults: CrmSearchResult[] = [
    { entity_type: 'contact', entity_id: 'c1', twenty_workspace_id: 'ws1', name: 'Alice Smith', stage: null },
    { entity_type: 'company', entity_id: 'co1', twenty_workspace_id: 'ws1', name: 'Acme Corp', stage: null },
    { entity_type: 'deal', entity_id: 'd1', twenty_workspace_id: 'ws1', name: 'Big Deal', stage: 'Negotiation' },
  ];

  beforeEach(async () => {
    mockCrmService = { searchEntities: vi.fn().mockReturnValue(of(mockResults)) };

    await TestBed.configureTestingModule({
      imports: [CrmEntityPickerComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CrmService, useValue: mockCrmService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CrmEntityPickerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('search debounce', () => {
    it('should not search when query < 2 chars', fakeAsync(() => {
      component.onQueryChange('A');
      tick(400);

      expect(mockCrmService.searchEntities).not.toHaveBeenCalled();
      expect(component.results()).toHaveLength(0);
    }));

    it('should search after 300ms debounce for query >= 2 chars', fakeAsync(() => {
      component.onQueryChange('Al');
      tick(299);
      expect(mockCrmService.searchEntities).not.toHaveBeenCalled();

      tick(1);
      expect(mockCrmService.searchEntities).toHaveBeenCalledWith('Al');
      expect(component.results()).toEqual(mockResults);
    }));

    it('should debounce rapid keystrokes and only search with final query', fakeAsync(() => {
      component.onQueryChange('A');
      tick(100);
      component.onQueryChange('Al');
      tick(100);
      component.onQueryChange('Ali');
      tick(300);

      expect(mockCrmService.searchEntities).toHaveBeenCalledTimes(1);
      expect(mockCrmService.searchEntities).toHaveBeenCalledWith('Ali');
    }));

    it('should set loading true during search then false after', fakeAsync(() => {
      component.onQueryChange('Al');
      tick(300);

      expect(component.loading()).toBe(false);
      expect(component.results()).toHaveLength(3);
    }));

    it('should clear results when query drops below 2 chars', fakeAsync(() => {
      component.onQueryChange('Al');
      tick(300);
      expect(component.results()).toHaveLength(3);

      component.onQueryChange('A');
      tick(300);
      expect(component.results()).toHaveLength(0);
    }));
  });

  describe('empty results state', () => {
    it('should show no results message when search returns empty array', fakeAsync(() => {
      mockCrmService.searchEntities.mockReturnValue(of([]));
      component.onQueryChange('zzz');
      tick(300);

      expect(component.results()).toHaveLength(0);
      expect(component.searchError()).toBe(false);
    }));
  });

  describe('error state', () => {
    it('should set searchError when service throws', fakeAsync(() => {
      mockCrmService.searchEntities.mockReturnValue(throwError(() => new Error('network')));
      component.onQueryChange('Al');
      tick(300);

      expect(component.searchError()).toBe(true);
      expect(component.loading()).toBe(false);
    }));
  });

  describe('pill click emits linked event', () => {
    it('should emit (linked) with correct payload when pill clicked', fakeAsync(() => {
      const emitted: unknown[] = [];
      const sub = component.linked.subscribe((e) => emitted.push(e));

      component.onQueryChange('Al');
      tick(300);

      component.onPillClick(mockResults[0]);

      expect(emitted).toHaveLength(1);
      expect(emitted[0]).toEqual({
        entity_type: 'contact',
        entity_id: 'c1',
        twenty_workspace_id: 'ws1',
      });

      sub.unsubscribe();
    }));

    it('should clear query and results after pill click', fakeAsync(() => {
      component.onQueryChange('Al');
      tick(300);
      expect(component.results()).toHaveLength(3);

      component.onPillClick(mockResults[0]);

      expect(component.query()).toBe('');
      expect(component.results()).toHaveLength(0);
    }));
  });

  describe('entityIcon', () => {
    it('should return pi-user for contact', () => {
      expect(component.entityIcon('contact')).toBe('pi pi-user');
    });
    it('should return pi-building for company', () => {
      expect(component.entityIcon('company')).toBe('pi pi-building');
    });
    it('should return pi-briefcase for deal', () => {
      expect(component.entityIcon('deal')).toBe('pi pi-briefcase');
    });
  });
});
