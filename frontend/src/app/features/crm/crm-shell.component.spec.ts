import { TestBed, fakeAsync, tick, flush } from '@angular/core/testing';
import { Component } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { BreakpointObserver, BreakpointState } from '@angular/cdk/layout';
import { Subject } from 'rxjs';
import { CrmShellComponent, CrmState } from './crm-shell.component';

class MockBreakpointObserver {
  private subject = new Subject<BreakpointState>();
  observe(_queries: string[]) { return this.subject.asObservable(); }
  emit(matches: boolean) {
    this.subject.next({ matches, breakpoints: {} });
  }
}

describe('CrmShellComponent', () => {
  let bpMock: MockBreakpointObserver;

  beforeEach(async () => {
    bpMock = new MockBreakpointObserver();
    await TestBed.configureTestingModule({
      imports: [CrmShellComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: BreakpointObserver, useValue: bpMock },
      ],
    }).compileComponents();
  });

  function createComponent(
    healthOverride?:
      | { status: 'ok' | 'degraded' | 'down'; embed_compatible: boolean; workspace_bound: boolean }
      | 'error'
      | 'null',
  ) {
    const fixture = TestBed.createComponent(CrmShellComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    // ngOnInit fires the health probe — fulfil it so the rest of the flow runs.
    const http = TestBed.inject(HttpTestingController);
    const req = http.expectOne('/api/integrations/twenty/health');
    if (healthOverride === 'error') {
      req.error(new ErrorEvent('network'));
    } else if (healthOverride === 'null') {
      req.flush(null);
    } else if (healthOverride) {
      req.flush({
        ...healthOverride,
        last_checked: new Date().toISOString(),
      });
    } else {
      req.flush({
        status: 'ok',
        last_checked: new Date().toISOString(),
        workspace_bound: true,
        embed_compatible: true,
      });
    }
    fixture.detectChanges();
    return { fixture, component };
  }

  it('starts in idle state before ngOnInit', () => {
    const fixture = TestBed.createComponent(CrmShellComponent);
    const component = fixture.componentInstance;
    expect(component.crmState()).toBe('idle');
  });

  it('transitions to loading on init', () => {
    const { component } = createComponent();
    expect(component.crmState()).toBe('loading');
  });

  it('transitions to connected on iframe load', fakeAsync(() => {
    const { component } = createComponent();
    expect(component.crmState()).toBe('loading');
    component.onIframeLoad();
    expect(component.crmState()).toBe('connected');
    flush();
  }));

  it('transitions to error on iframe error', fakeAsync(() => {
    const { component } = createComponent();
    component.onIframeError();
    expect(component.crmState()).toBe('error');
    flush();
  }));

  it('transitions to offline after 30s timeout', fakeAsync(() => {
    const { component } = createComponent();
    expect(component.crmState()).toBe('loading');
    tick(30_000);
    expect(component.crmState()).toBe('offline');
    flush();
  }));

  it('retry resets state to loading and restarts timeout', fakeAsync(() => {
    const { component } = createComponent();
    tick(30_000);
    expect(component.crmState()).toBe('offline');
    component.retry();
    expect(component.crmState()).toBe('loading');
    flush();
  }));

  it('reload resets state to loading', fakeAsync(() => {
    const { component } = createComponent();
    component.onIframeError();
    expect(component.crmState()).toBe('error');
    component.reload();
    expect(component.crmState()).toBe('loading');
    flush();
  }));

  it('setUpgrading puts state into upgrading', fakeAsync(() => {
    const { component } = createComponent();
    component.onIframeLoad();
    expect(component.crmState()).toBe('connected');
    component.setUpgrading();
    expect(component.crmState()).toBe('upgrading');
    flush();
  }));

  it('onIframeLoad does not override upgrading state', fakeAsync(() => {
    const { component } = createComponent();
    component.setUpgrading();
    component.onIframeLoad();
    expect(component.crmState()).toBe('upgrading');
    flush();
  }));

  it('csp_blocked state can be set directly', () => {
    const { component } = createComponent();
    component.crmState.set('csp_blocked' as CrmState);
    expect(component.crmState()).toBe('csp_blocked');
  });

  it('does not transition to offline if iframe loads before timeout', fakeAsync(() => {
    const { component } = createComponent();
    tick(10_000);
    component.onIframeLoad();
    tick(20_000);
    expect(component.crmState()).toBe('connected');
    flush();
  }));

  it('isMobile reflects breakpoint observer', fakeAsync(() => {
    const { component } = createComponent();
    bpMock.emit(true);
    expect(component.isMobile()).toBe(true);
    bpMock.emit(false);
    expect(component.isMobile()).toBe(false);
    flush();
  }));

  it('clears timeout on destroy', fakeAsync(() => {
    const { component, fixture } = createComponent();
    expect(component.crmState()).toBe('loading');
    fixture.destroy();
    tick(30_000);
    // State stays loading — timer was cleared on destroy
    expect(component.crmState()).toBe('loading');
    flush();
  }));

  it('transitions to csp_blocked when health probe reports embed_compatible=false', () => {
    const { component } = createComponent({
      status: 'ok',
      workspace_bound: true,
      embed_compatible: false,
    });
    expect(component.crmState()).toBe('csp_blocked');
  });

  it('transitions to disconnected when health probe reports workspace_bound=false', () => {
    const { component } = createComponent({
      status: 'ok',
      workspace_bound: false,
      embed_compatible: true,
    });
    expect(component.crmState()).toBe('disconnected');
  });

  it('transitions to disconnected when health probe reports status=down', () => {
    const { component } = createComponent({
      status: 'down',
      workspace_bound: true,
      embed_compatible: true,
    });
    expect(component.crmState()).toBe('disconnected');
  });

  it('falls through to loading on probe network error', () => {
    const { component } = createComponent('error');
    expect(component.crmState()).toBe('loading');
  });

  it('falls through to loading on null probe response', () => {
    const { component } = createComponent('null');
    expect(component.crmState()).toBe('loading');
  });
});
