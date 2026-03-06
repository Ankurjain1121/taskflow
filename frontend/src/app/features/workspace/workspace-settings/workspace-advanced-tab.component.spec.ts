import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { WorkspaceAdvancedTabComponent } from './workspace-advanced-tab.component';

describe('WorkspaceAdvancedTabComponent', () => {
  let component: WorkspaceAdvancedTabComponent;
  let fixture: ComponentFixture<WorkspaceAdvancedTabComponent>;
  let mockHttp: any;

  const testWorkspace = {
    id: 'ws-1',
    name: 'My Workspace',
    slug: 'my-ws',
    owner_id: 'u-1',
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  };

  beforeEach(async () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    mockHttp = {
      get: vi
        .fn()
        .mockReturnValue(of(new Blob(['{}'], { type: 'application/json' }))),
    };

    await TestBed.configureTestingModule({
      imports: [WorkspaceAdvancedTabComponent],
      providers: [{ provide: HttpClient, useValue: mockHttp }],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(WorkspaceAdvancedTabComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('workspaceId', 'ws-1');
    fixture.componentRef.setInput('workspace', testWorkspace);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have advanced placeholders', () => {
    expect(component.advancedPlaceholders.length).toBe(3);
    const titles = component.advancedPlaceholders.map((p) => p.title);
    expect(titles).toContain('Default Board Settings');
    expect(titles).toContain('Custom Field Definitions');
    expect(titles).toContain('Automation Defaults');
  });

  it('should call http.get on export and set exporting to false', () => {
    const mockAnchor = { href: '', download: '', click: vi.fn() };
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(
      (tag: string, options?: any) => {
        if (tag === 'a') return mockAnchor as any;
        return origCreate(tag, options);
      },
    );

    const origCreateObjectURL = URL.createObjectURL;
    const origRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn().mockReturnValue('blob:test');
    URL.revokeObjectURL = vi.fn();

    const emitSpy = vi.spyOn(component.exportRequested, 'emit');

    component.onExportWorkspace('json');

    expect(mockAnchor.download).toContain('My Workspace');
    expect(mockAnchor.click).toHaveBeenCalled();
    expect(component.exporting()).toBe(false);
    expect(emitSpy).toHaveBeenCalled();

    URL.createObjectURL = origCreateObjectURL;
    URL.revokeObjectURL = origRevokeObjectURL;
    vi.restoreAllMocks();
  });

  it('should handle export error', () => {
    mockHttp.get.mockReturnValue(throwError(() => new Error('fail')));
    component.onExportWorkspace('json');
    expect(component.exporting()).toBe(false);
  });

  it('should use workspaceId in filename when workspace name is not available', () => {
    fixture.componentRef.setInput('workspace', null);
    const mockAnchor = { href: '', download: '', click: vi.fn() };
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(
      (tag: string, options?: any) => {
        if (tag === 'a') return mockAnchor as any;
        return origCreate(tag, options);
      },
    );

    const origCreateObjectURL = URL.createObjectURL;
    const origRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn().mockReturnValue('blob:test');
    URL.revokeObjectURL = vi.fn();

    component.onExportWorkspace('json');

    expect(mockAnchor.download).toContain('ws-1');

    URL.createObjectURL = origCreateObjectURL;
    URL.revokeObjectURL = origRevokeObjectURL;
    vi.restoreAllMocks();
  });
});
