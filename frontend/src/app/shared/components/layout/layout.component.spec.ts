import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Router, provideRouter } from '@angular/router';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { LayoutComponent } from './layout.component';
import { AuthService } from '../../../core/services/auth.service';
import {
  ThemeService,
  ACCENT_PRESETS,
} from '../../../core/services/theme.service';

describe('LayoutComponent', () => {
  let component: LayoutComponent;
  let fixture: ComponentFixture<LayoutComponent>;
  let mockRouter: any;

  const mockAuthService = {
    currentUser: signal({
      id: 'user-1',
      name: 'Alice Smith',
      email: 'alice@test.com',
      avatar_url: null,
      role: 'Member' as const,
      tenant_id: 't-1',
      onboarding_completed: true,
    }),
  };

  const mockThemeService = {
    theme: signal('light' as const),
    accent: signal('indigo' as const),
    isDark: signal(false),
    resolvedTheme: signal('light' as const),
    setTheme: vi.fn(),
    setAccent: vi.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LayoutComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: mockAuthService },
        { provide: ThemeService, useValue: mockThemeService },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(LayoutComponent);
    component = fixture.componentInstance;
    mockRouter = TestBed.inject(Router);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should return user initials for two-word name', () => {
    expect(component.getUserInitials()).toBe('AS');
  });

  it('should return single initial for single-word name', () => {
    mockAuthService.currentUser.set({
      ...mockAuthService.currentUser(),
      name: 'Bob',
    } as any);
    expect(component.getUserInitials()).toBe('B');
  });

  it('should return ? when no user', () => {
    mockAuthService.currentUser.set(null as any);
    expect(component.getUserInitials()).toBe('?');
    // Reset
    mockAuthService.currentUser.set({
      id: 'user-1',
      name: 'Alice Smith',
      email: 'alice@test.com',
      avatar_url: null,
      role: 'Member' as const,
      tenant_id: 't-1',
      onboarding_completed: true,
    });
  });

  it('should toggle sidebar collapsed state for desktop', () => {
    // Ensure isMobile is false
    (component as any).isMobile.set(false);
    const initial = component.sidebarCollapsed();
    component.onToggleSidebar();
    expect(component.sidebarCollapsed()).toBe(!initial);
  });

  it('should toggle mobile sidebar for mobile', () => {
    (component as any).isMobile.set(true);
    component.mobileOpen.set(false);
    component.onToggleSidebar();
    expect(component.mobileOpen()).toBe(true);
  });

  it('should open mobile sidebar', () => {
    component.openMobileSidebar();
    expect(component.mobileOpen()).toBe(true);
    expect(component.isMobileSidebarOpen()).toBe(true);
  });

  it('should close mobile sidebar', () => {
    component.openMobileSidebar();
    component.closeMobileSidebar();
    expect(component.mobileOpen()).toBe(false);
    expect(component.isMobileSidebarOpen()).toBe(false);
  });

  it('should return correct sidebar classes for mobile open', () => {
    (component as any).isMobile.set(true);
    component.mobileOpen.set(true);
    expect(component.getSidebarClasses()).toContain('translate-x-0');
  });

  it('should return correct sidebar classes for mobile closed', () => {
    (component as any).isMobile.set(true);
    component.mobileOpen.set(false);
    expect(component.getSidebarClasses()).toContain('-translate-x-full');
  });

  it('should return relative for desktop sidebar', () => {
    (component as any).isMobile.set(false);
    expect(component.getSidebarClasses()).toBe('relative');
  });

  it('should set theme', () => {
    component.setTheme('dark');
    expect(mockThemeService.setTheme).toHaveBeenCalledWith('dark');
  });

  it('should set accent', () => {
    component.setAccent('blue');
    expect(mockThemeService.setAccent).toHaveBeenCalledWith('blue');
  });

  it('should return correct theme icon', () => {
    mockThemeService.theme.set('light' as any);
    expect(component.themeIcon()).toBe('pi pi-sun');

    mockThemeService.theme.set('dark' as any);
    expect(component.themeIcon()).toBe('pi pi-moon');

    mockThemeService.theme.set('system' as any);
    expect(component.themeIcon()).toBe('pi pi-desktop');
  });

  it('should navigate to themes on goToThemes', () => {
    const navSpy = vi.spyOn(mockRouter, 'navigate');
    component.goToThemes();
    expect(navSpy).toHaveBeenCalledWith(['/settings/appearance']);
  });
});
