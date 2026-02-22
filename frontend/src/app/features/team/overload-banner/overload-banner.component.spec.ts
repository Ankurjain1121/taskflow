import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { OverloadBannerComponent } from './overload-banner.component';
import { TeamService, OverloadedMember } from '../../../core/services/team.service';

describe('OverloadBannerComponent', () => {
  let component: OverloadBannerComponent;
  let fixture: ComponentFixture<OverloadBannerComponent>;
  let mockTeamService: any;

  const mockOverloaded: OverloadedMember[] = [
    { user_id: 'u-1', user_name: 'Alice', user_avatar: null, active_tasks: 15 },
    { user_id: 'u-2', user_name: 'Bob', user_avatar: null, active_tasks: 12 },
  ];

  beforeEach(async () => {
    if (!window.matchMedia) {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: false, media: query, onchange: null,
          addListener: vi.fn(), removeListener: vi.fn(),
          addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
        })),
      });
    }

    mockTeamService = {
      getOverloadedMembers: vi.fn().mockReturnValue(of(mockOverloaded)),
    };

    await TestBed.configureTestingModule({
      imports: [OverloadBannerComponent],
      providers: [
        { provide: TeamService, useValue: mockTeamService },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(OverloadBannerComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('workspaceId', 'ws-1');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('loadOverloadedMembers', () => {
    it('should load overloaded members on init', () => {
      component.ngOnInit();
      expect(mockTeamService.getOverloadedMembers).toHaveBeenCalledWith('ws-1', 10);
      expect(component.overloadedMembers()).toEqual(mockOverloaded);
    });

    it('should use custom threshold', () => {
      fixture.componentRef.setInput('threshold', 5);
      fixture.detectChanges();
      component.loadOverloadedMembers();
      expect(mockTeamService.getOverloadedMembers).toHaveBeenCalledWith('ws-1', 5);
    });

    it('should handle errors', () => {
      mockTeamService.getOverloadedMembers.mockReturnValue(throwError(() => new Error('fail')));
      component.loadOverloadedMembers();
      // Should not throw and overloaded remains empty
      expect(component.overloadedMembers()).toEqual(mockOverloaded); // kept from init
    });

    it('should show empty when no overloaded members', () => {
      mockTeamService.getOverloadedMembers.mockReturnValue(of([]));
      component.loadOverloadedMembers();
      expect(component.overloadedMembers()).toEqual([]);
    });
  });

  describe('scrollToOverloaded', () => {
    it('should not throw when no overloaded members', () => {
      component.overloadedMembers.set([]);
      expect(() => component.scrollToOverloaded()).not.toThrow();
    });

    it('should attempt to scroll to first overloaded member', () => {
      const mockElement = {
        scrollIntoView: vi.fn(),
        classList: { add: vi.fn(), remove: vi.fn() },
      };
      vi.spyOn(document, 'getElementById').mockReturnValue(mockElement as any);
      component.overloadedMembers.set(mockOverloaded);
      component.scrollToOverloaded();
      expect(document.getElementById).toHaveBeenCalledWith('member-u-1');
      expect(mockElement.scrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'center',
      });
      expect(mockElement.classList.add).toHaveBeenCalledWith(
        'ring-2', 'ring-amber-400', 'ring-offset-2',
      );
    });

    it('should handle missing element gracefully', () => {
      vi.spyOn(document, 'getElementById').mockReturnValue(null);
      component.overloadedMembers.set(mockOverloaded);
      expect(() => component.scrollToOverloaded()).not.toThrow();
    });
  });
});
