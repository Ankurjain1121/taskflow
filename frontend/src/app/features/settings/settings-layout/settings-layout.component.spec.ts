import { TestBed, ComponentFixture } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { describe, it, expect, beforeEach } from 'vitest';

import { SettingsLayoutComponent } from './settings-layout.component';

describe('SettingsLayoutComponent', () => {
  let component: SettingsLayoutComponent;
  let fixture: ComponentFixture<SettingsLayoutComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SettingsLayoutComponent, RouterTestingModule.withRoutes([])],
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsLayoutComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('navItems', () => {
    it('should have 5 navigation items', () => {
      expect(component.navItems).toHaveLength(5);
    });

    it('should include profile, security, appearance, notifications', () => {
      const paths = component.navItems.map((item) => item.path);
      expect(paths).toContain('profile');
      expect(paths).toContain('security');
      expect(paths).toContain('appearance');
      expect(paths).toContain('notifications');
    });

    it('each item should have path, label, and icon', () => {
      for (const item of component.navItems) {
        expect(item.path).toBeTruthy();
        expect(item.label).toBeTruthy();
        expect(item.icon).toBeTruthy();
        expect(item.icon).toContain('pi pi-');
      }
    });
  });
});
