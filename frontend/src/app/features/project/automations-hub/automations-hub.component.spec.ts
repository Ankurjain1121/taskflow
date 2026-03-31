// Polyfill ResizeObserver for JSDOM
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { MessageService } from 'primeng/api';
import { AutomationsHubComponent } from './automations-hub.component';

describe('AutomationsHubComponent', () => {
  let component: AutomationsHubComponent;
  let fixture: ComponentFixture<AutomationsHubComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AutomationsHubComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        MessageService,
        {
          provide: ActivatedRoute,
          useValue: {
            params: of({ workspaceId: 'ws-1', projectId: 'proj-1' }),
            snapshot: {
              paramMap: { get: () => null },
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AutomationsHubComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should start with tab 0', () => {
    expect(component.activeTab()).toBe(0);
  });

  it('should change tab on onTabChange', () => {
    component.onTabChange(2);
    expect(component.activeTab()).toBe(2);
  });

  it('should extract route params', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    expect(component.workspaceId).toBe('ws-1');
    expect(component.projectId).toBe('proj-1');
  });

  it('should render header', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const heading = fixture.nativeElement.querySelector('h1');
    expect(heading?.textContent).toContain('Automations');
  });
});
