import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { EmptyStateComponent } from './empty-state.component';

@Component({
  standalone: true,
  imports: [EmptyStateComponent],
  template: `<app-empty-state
    [title]="title"
    [variant]="variant"
    [description]="description"
    [subtitle]="subtitle"
    [ctaLabel]="ctaLabel"
    (ctaClicked)="ctaClicked()"
  />`,
})
class TestHostComponent {
  title = 'No items';
  variant: 'board' | 'column' | 'search' | 'tasks' | 'generic' = 'generic';
  description = '';
  subtitle = '';
  ctaLabel = '';
  ctaClicked = vi.fn();
}

describe('EmptyStateComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    const el = fixture.nativeElement.querySelector('app-empty-state');
    expect(el).toBeTruthy();
  });

  it('should display the title', () => {
    expect(fixture.nativeElement.textContent).toContain('No items');
  });

  it('should display description when provided', () => {
    host.description = 'Try a different filter';
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'Try a different filter',
    );
  });

  it('should display subtitle when provided', () => {
    host.subtitle = 'Hint text';
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Hint text');
  });

  it('should show CTA button when ctaLabel is provided', () => {
    host.ctaLabel = 'Create New';
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector('button');
    expect(btn).toBeTruthy();
    expect(btn.textContent.trim()).toContain('Create New');
  });

  it('should emit ctaClicked when CTA button is clicked', () => {
    host.ctaLabel = 'Add Item';
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector('button');
    btn.click();
    expect(host.ctaClicked).toHaveBeenCalled();
  });

  it('should return correct illustration bg for each variant', () => {
    const component = fixture.debugElement.children[0]
      .componentInstance as EmptyStateComponent;

    host.variant = 'board';
    fixture.detectChanges();
    expect(component.getIllustrationBg()).toContain('var(--primary)');

    host.variant = 'column';
    fixture.detectChanges();
    expect(component.getIllustrationBg()).toContain('var(--primary)');

    host.variant = 'search';
    fixture.detectChanges();
    expect(component.getIllustrationBg()).toBe('var(--muted)');

    host.variant = 'tasks';
    fixture.detectChanges();
    expect(component.getIllustrationBg()).toContain('var(--success)');

    host.variant = 'generic';
    fixture.detectChanges();
    expect(component.getIllustrationBg()).toBe('var(--muted)');
  });
});
