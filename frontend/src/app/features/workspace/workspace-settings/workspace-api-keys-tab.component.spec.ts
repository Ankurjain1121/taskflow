import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { WorkspaceApiKeysTabComponent } from './workspace-api-keys-tab.component';
import { ApiKeyService } from '../../../core/services/api-key.service';

describe('WorkspaceApiKeysTabComponent', () => {
  let component: WorkspaceApiKeysTabComponent;
  let fixture: ComponentFixture<WorkspaceApiKeysTabComponent>;
  let mockApiKeyService: any;

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

    mockApiKeyService = {
      listKeys: vi
        .fn()
        .mockReturnValue(
          of([
            {
              id: 'key-1',
              name: 'Test Key',
              key_prefix: 'tf_abc',
              created_at: '2026-01-01',
            },
          ]),
        ),
      createKey: vi.fn().mockReturnValue(
        of({
          id: 'key-2',
          full_key: 'tf_abc123fullkey',
          name: 'New Key',
          key_prefix: 'tf_abc',
          created_at: '2026-01-15',
        }),
      ),
      revokeKey: vi.fn().mockReturnValue(of(void 0)),
    };

    await TestBed.configureTestingModule({
      imports: [WorkspaceApiKeysTabComponent],
      providers: [{ provide: ApiKeyService, useValue: mockApiKeyService }],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(WorkspaceApiKeysTabComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('workspaceId', 'ws-1');
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load API keys on init', () => {
    component.ngOnInit();
    expect(mockApiKeyService.listKeys).toHaveBeenCalledWith('ws-1');
    expect(component.apiKeys().length).toBe(1);
  });

  it('should handle API keys load error', () => {
    mockApiKeyService.listKeys.mockReturnValue(
      throwError(() => new Error('fail')),
    );
    component.ngOnInit();
    expect(component.apiKeys().length).toBe(0);
  });

  it('should generate API key when name is provided', () => {
    vi.spyOn(globalThis, 'prompt').mockReturnValue('My API Key');
    const emitSpy = vi.spyOn(component.keyGenerated, 'emit');

    component.onGenerateApiKey();

    expect(mockApiKeyService.createKey).toHaveBeenCalledWith(
      'ws-1',
      'My API Key',
    );
    expect(component.newlyCreatedKey()).toBe('tf_abc123fullkey');
    expect(component.generatingKey()).toBe(false);
    expect(emitSpy).toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('should not generate API key when prompt is cancelled', () => {
    vi.spyOn(globalThis, 'prompt').mockReturnValue(null);
    component.onGenerateApiKey();
    expect(mockApiKeyService.createKey).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('should not generate API key when prompt returns empty string', () => {
    vi.spyOn(globalThis, 'prompt').mockReturnValue('');
    component.onGenerateApiKey();
    expect(mockApiKeyService.createKey).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('should handle generate key error', () => {
    vi.spyOn(globalThis, 'prompt').mockReturnValue('Key');
    mockApiKeyService.createKey.mockReturnValue(
      throwError(() => new Error('fail')),
    );
    component.onGenerateApiKey();
    expect(component.generatingKey()).toBe(false);
    vi.restoreAllMocks();
  });

  it('should copy API key to clipboard', async () => {
    component.newlyCreatedKey.set('tf_abc123fullkey');
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: mockWriteText } });

    component.copyApiKey();

    expect(mockWriteText).toHaveBeenCalledWith('tf_abc123fullkey');
  });

  it('should not copy when no key exists', () => {
    component.newlyCreatedKey.set(null);
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: mockWriteText } });

    component.copyApiKey();

    expect(mockWriteText).not.toHaveBeenCalled();
  });

  it('should revoke API key when confirmed', () => {
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
    component.apiKeys.set([
      { id: 'key-1', name: 'Test', key_prefix: 'tf_a', created_at: '' },
    ]);
    const emitSpy = vi.spyOn(component.keyRevoked, 'emit');

    component.onRevokeApiKey({
      id: 'key-1',
      name: 'Test',
      key_prefix: 'tf_a',
      created_at: '',
    });

    expect(mockApiKeyService.revokeKey).toHaveBeenCalledWith('ws-1', 'key-1');
    expect(component.apiKeys().length).toBe(0);
    expect(component.revokingKey()).toBe(null);
    expect(emitSpy).toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('should not revoke API key when not confirmed', () => {
    vi.spyOn(globalThis, 'confirm').mockReturnValue(false);
    component.onRevokeApiKey({
      id: 'key-1',
      name: 'Test',
      key_prefix: 'tf_a',
      created_at: '',
    });
    expect(mockApiKeyService.revokeKey).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('should handle revoke error', () => {
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
    mockApiKeyService.revokeKey.mockReturnValue(
      throwError(() => new Error('fail')),
    );
    component.onRevokeApiKey({
      id: 'key-1',
      name: 'Test',
      key_prefix: 'tf_a',
      created_at: '',
    });
    expect(component.revokingKey()).toBe(null);
    vi.restoreAllMocks();
  });

  it('should format date', () => {
    const formatted = component.formatDate('2026-01-15T00:00:00Z');
    expect(formatted).toContain('Jan');
    expect(formatted).toContain('15');
    expect(formatted).toContain('2026');
  });

  it('should have integration placeholders', () => {
    expect(component.integrationPlaceholders.length).toBe(3);
    const names = component.integrationPlaceholders.map((i) => i.name);
    expect(names).toContain('Slack');
    expect(names).toContain('GitHub');
    expect(names).toContain('Jira');
  });
});
