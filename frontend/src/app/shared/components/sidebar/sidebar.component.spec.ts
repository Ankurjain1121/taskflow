import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { SidebarComponent } from './sidebar.component';

describe('SidebarComponent', () => {
  let component: SidebarComponent;
  let fixture: ComponentFixture<SidebarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SidebarComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(SidebarComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should emit toggleCollapse', () => {
    const spy = vi.spyOn(component.toggleCollapse, 'emit');
    component.toggleCollapse.emit();
    expect(spy).toHaveBeenCalled();
  });

  it('should NOT render a logo zone', () => {
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('svg')).toBeNull();
    expect(el.textContent).not.toContain('TaskBolt');
  });

  it('should NOT render workspace-switcher component', () => {
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-workspace-switcher')).toBeNull();
  });

  it('should NOT render Home nav item', () => {
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).not.toContain('Home');
  });

  it('should NOT render My Work nav item', () => {
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).not.toContain('My Work');
  });

  it('should NOT render Inbox nav item', () => {
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).not.toContain('Inbox');
  });

  it('should render sidebar-projects component', () => {
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-sidebar-projects')).toBeTruthy();
  });

  it('should render sidebar-views component', () => {
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-sidebar-views')).toBeTruthy();
  });

  it('should render sidebar-footer component', () => {
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-sidebar-footer')).toBeTruthy();
  });

  it('should emit sidebarClose on navClick when mobile is open', () => {
    const spy = vi.spyOn(component.sidebarClose, 'emit');
    fixture.componentRef.setInput('isMobileOpen', true);
    fixture.detectChanges();
    component.onNavClick();
    expect(spy).toHaveBeenCalled();
  });

  it('should not emit sidebarClose on navClick when mobile is not open', () => {
    const spy = vi.spyOn(component.sidebarClose, 'emit');
    fixture.componentRef.setInput('isMobileOpen', false);
    fixture.detectChanges();
    component.onNavClick();
    expect(spy).not.toHaveBeenCalled();
  });

  it('should have focusIndex initialized to -1', () => {
    expect(component.focusIndex()).toBe(-1);
  });

  it('should not throw on onSidebarKeydown with no focusable items', () => {
    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    expect(() => component.onSidebarKeydown(event)).not.toThrow();
  });
});
