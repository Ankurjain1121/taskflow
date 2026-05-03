import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { IntegrationsComponent } from './integrations.component';

describe('IntegrationsComponent', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IntegrationsComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function createComponent() {
    const fixture = TestBed.createComponent(IntegrationsComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    return { fixture, component };
  }

  it('starts with unknown connection status', () => {
    const fixture = TestBed.createComponent(IntegrationsComponent);
    const component = fixture.componentInstance;
    expect(component.connectionStatus()).toBe('unknown');
  });

  it('sets status to checking on init then ok on success', fakeAsync(() => {
    const { component } = createComponent();
    expect(component.connectionStatus()).toBe('checking');

    http.expectOne('/api/integrations/twenty/health').flush({
      status: 'ok',
      last_checked: '2026-05-03T10:00:00Z',
      workspace_bound: true,
      embed_compatible: true,
    });
    http.expectOne('/api/integrations/twenty/sync-health').flush({
      queue_depth: 0,
      last_sync: '2026-05-03T09:55:00Z',
      error_rate_pct: 0.5,
      dlq_count: 0,
      dlq_url: null,
    });

    expect(component.connectionStatus()).toBe('ok');
    expect(component.health()?.workspace_bound).toBe(true);
    expect(component.health()?.embed_compatible).toBe(true);
  }));

  it('sets status to degraded when response is degraded', fakeAsync(() => {
    const { component } = createComponent();
    http.expectOne('/api/integrations/twenty/health').flush({
      status: 'degraded',
      last_checked: '2026-05-03T10:00:00Z',
      workspace_bound: true,
      embed_compatible: true,
    });
    http.expectOne('/api/integrations/twenty/sync-health').flush(null);

    expect(component.connectionStatus()).toBe('degraded');
  }));

  it('sets status to down when health call fails', fakeAsync(() => {
    const { component } = createComponent();
    http.expectOne('/api/integrations/twenty/health').error(new ErrorEvent('network'));
    http.expectOne('/api/integrations/twenty/sync-health').error(new ErrorEvent('network'));

    expect(component.connectionStatus()).toBe('down');
    expect(component.health()).toBeNull();
  }));

  it('stores sync health queue depth', fakeAsync(() => {
    const { component } = createComponent();
    http.expectOne('/api/integrations/twenty/health').flush(null);
    http.expectOne('/api/integrations/twenty/sync-health').flush({
      queue_depth: 42,
      last_sync: null,
      error_rate_pct: 3.2,
      dlq_count: 5,
      dlq_url: '/admin/dlq',
    });

    expect(component.syncHealth()?.queue_depth).toBe(42);
    expect(component.syncHealth()?.dlq_count).toBe(5);
  }));

  it('renders embed compatibility chip from health response', fakeAsync(() => {
    const { fixture, component } = createComponent();

    http.expectOne('/api/integrations/twenty/health').flush({
      status: 'ok',
      last_checked: '2026-05-03T10:00:00Z',
      workspace_bound: true,
      embed_compatible: true,
    });
    http.expectOne('/api/integrations/twenty/sync-health').flush(null);

    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    const chipEl = compiled.querySelector('.chip-compat');
    expect(chipEl).toBeTruthy();
  }));

  it('shows disconnect modal on confirmDisconnect', () => {
    const { component } = createComponent();
    http.expectOne('/api/integrations/twenty/health').flush(null);
    http.expectOne('/api/integrations/twenty/sync-health').flush(null);

    expect(component.showDisconnectModal()).toBe(false);
    component.confirmDisconnect();
    expect(component.showDisconnectModal()).toBe(true);
    component.cancelDisconnect();
    expect(component.showDisconnectModal()).toBe(false);
  });
});
