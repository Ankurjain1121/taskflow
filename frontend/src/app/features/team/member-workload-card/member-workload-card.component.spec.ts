import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { provideRouter } from '@angular/router';
import { MemberWorkloadCardComponent } from './member-workload-card.component';
import { MemberWorkload } from '../../../core/services/team.service';

describe('MemberWorkloadCardComponent', () => {
  let component: MemberWorkloadCardComponent;
  let fixture: ComponentFixture<MemberWorkloadCardComponent>;

  const mockMember: MemberWorkload = {
    user_id: 'u-1',
    user_name: 'Alice Smith',
    user_avatar: null,
    active_tasks: 5,
    overdue_tasks: 1,
    done_tasks: 10,
    total_tasks: 15,
    is_overloaded: false,
  };

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

    await TestBed.configureTestingModule({
      imports: [MemberWorkloadCardComponent],
      providers: [provideRouter([])],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(MemberWorkloadCardComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('member', mockMember);
    fixture.componentRef.setInput('workspaceId', 'ws-1');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('getInitials', () => {
    it('should extract initials from full name', () => {
      expect(component.getInitials('Alice Smith')).toBe('AS');
    });

    it('should handle single name', () => {
      expect(component.getInitials('Bob')).toBe('B');
    });

    it('should limit to 2 characters', () => {
      expect(component.getInitials('John Michael Smith')).toBe('JM');
    });
  });

  describe('getProgressPercent', () => {
    it('should calculate correct progress', () => {
      // done: 10, total: 15 => 67%
      expect(component.getProgressPercent()).toBe(67);
    });

    it('should return 0 when total is 0', () => {
      fixture.componentRef.setInput('member', {
        ...mockMember,
        done_tasks: 0,
        total_tasks: 0,
      });
      fixture.detectChanges();
      expect(component.getProgressPercent()).toBe(0);
    });

    it('should return 100 when all done', () => {
      fixture.componentRef.setInput('member', {
        ...mockMember,
        done_tasks: 10,
        total_tasks: 10,
      });
      fixture.detectChanges();
      expect(component.getProgressPercent()).toBe(100);
    });

    it('should round correctly', () => {
      fixture.componentRef.setInput('member', {
        ...mockMember,
        done_tasks: 1,
        total_tasks: 3,
      });
      fixture.detectChanges();
      expect(component.getProgressPercent()).toBe(33); // Math.round(33.33)
    });
  });

  describe('inputs', () => {
    it('should accept member input', () => {
      expect(component.member().user_name).toBe('Alice Smith');
    });

    it('should accept workspaceId input', () => {
      expect(component.workspaceId()).toBe('ws-1');
    });
  });
});
