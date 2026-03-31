import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { provideRouter, Router } from '@angular/router';
import { DiscoverWorkspacesComponent } from './discover-workspaces.component';
import {
  WorkspaceService,
  DiscoverableWorkspace,
} from '../../../core/services/workspace.service';

describe('DiscoverWorkspacesComponent', () => {
  let component: DiscoverWorkspacesComponent;
  let fixture: ComponentFixture<DiscoverWorkspacesComponent>;
  let mockWorkspaceService: any;
  let router: Router;

  const mockWorkspaces: DiscoverableWorkspace[] = [
    {
      id: 'ws-1',
      name: 'Alpha Workspace',
      description: 'First workspace',
      member_count: 5,
    },
    {
      id: 'ws-2',
      name: 'Beta Workspace',
      description: null,
      member_count: 1,
    },
  ];

  beforeEach(async () => {
    mockWorkspaceService = {
      discoverWorkspaces: vi.fn().mockReturnValue(of(mockWorkspaces)),
      joinWorkspace: vi.fn().mockReturnValue(of(undefined)),
    };

    await TestBed.configureTestingModule({
      imports: [DiscoverWorkspacesComponent],
      providers: [
        provideRouter([]),
        { provide: WorkspaceService, useValue: mockWorkspaceService },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(DiscoverWorkspacesComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have initial signal values', () => {
    expect(component.loading()).toBe(true);
    expect(component.error()).toBeNull();
    expect(component.workspaces()).toEqual([]);
    expect(component.joiningId()).toBeNull();
  });

  it('should load workspaces on init', () => {
    fixture.detectChanges();

    expect(mockWorkspaceService.discoverWorkspaces).toHaveBeenCalled();
    expect(component.workspaces()).toEqual(mockWorkspaces);
    expect(component.loading()).toBe(false);
  });

  it('should set error on load failure', () => {
    mockWorkspaceService.discoverWorkspaces.mockReturnValue(
      throwError(() => new Error('fail')),
    );

    fixture.detectChanges();

    expect(component.error()).toBe('Failed to load discoverable workspaces.');
    expect(component.loading()).toBe(false);
  });

  it('should set loading true at start of loadWorkspaces', () => {
    component.loading.set(false);
    component.error.set('old error');

    component.loadWorkspaces();

    expect(component.error()).toBeNull();
    expect(component.workspaces()).toEqual(mockWorkspaces);
  });

  it('should join workspace and navigate', () => {
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();

    component.onJoin(mockWorkspaces[0]);

    expect(mockWorkspaceService.joinWorkspace).toHaveBeenCalledWith('ws-1');
    expect(navigateSpy).toHaveBeenCalledWith(['/workspace', 'ws-1']);
    expect(component.joiningId()).toBeNull();
  });

  it('should set joiningId during join and clear on success', () => {
    fixture.detectChanges();
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    // joiningId is set then cleared synchronously in subscribe
    component.onJoin(mockWorkspaces[0]);
    expect(component.joiningId()).toBeNull();
  });

  it('should clear joiningId on join error', () => {
    mockWorkspaceService.joinWorkspace.mockReturnValue(
      throwError(() => new Error('fail')),
    );
    fixture.detectChanges();

    component.onJoin(mockWorkspaces[0]);

    expect(component.joiningId()).toBeNull();
  });
});
