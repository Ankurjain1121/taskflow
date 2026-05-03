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

  function createComponent() {
    const fixture = TestBed.createComponent(CrmShellComponent);
    const component = fixture.componentInstance;
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
});
