import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ToastContainerComponent } from './toast.component';
import { ToastService, ToastNotification } from './toast.service';
import { NotificationEventType } from '../../../core/services/notification.service';

function makeToast(overrides: Partial<ToastNotification> = {}): ToastNotification {
  return {
    id: 't-1',
    event_type: 'task_assigned',
    title: 'Test',
    body: 'Body',
    link_url: null,
    ...overrides,
  };
}

describe('ToastContainerComponent', () => {
  let component: ToastContainerComponent;
  let fixture: ComponentFixture<ToastContainerComponent>;
  let mockToastService: { toasts: ReturnType<typeof signal>; dismiss: ReturnType<typeof vi.fn> };
  let mockRouter: { navigateByUrl: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockToastService = {
      toasts: signal<ToastNotification[]>([]),
      dismiss: vi.fn(),
    };

    mockRouter = {
      navigateByUrl: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ToastContainerComponent, NoopAnimationsModule],
      providers: [
        { provide: ToastService, useValue: mockToastService },
        { provide: Router, useValue: mockRouter },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ToastContainerComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('getIconConfig()', () => {
    it('should return correct icon config for task_assigned', () => {
      const config = component.getIconConfig('task_assigned');
      expect(config.icon).toContain('pi-user');
      expect(config.color).toContain('blue');
    });

    it('should return correct icon config for task_due_soon', () => {
      const config = component.getIconConfig('task_due_soon');
      expect(config.icon).toContain('pi-clock');
      expect(config.color).toContain('orange');
    });

    it('should return correct icon config for task_overdue', () => {
      const config = component.getIconConfig('task_overdue');
      expect(config.icon).toContain('pi-exclamation-triangle');
      expect(config.color).toContain('red');
    });

    it('should return correct icon config for task_commented', () => {
      const config = component.getIconConfig('task_commented');
      expect(config.icon).toContain('pi-comment');
      expect(config.color).toContain('green');
    });

    it('should return correct icon config for task_completed', () => {
      const config = component.getIconConfig('task_completed');
      expect(config.icon).toContain('pi-check-circle');
      expect(config.color).toContain('emerald');
    });

    it('should return correct icon config for mention_in_comment', () => {
      const config = component.getIconConfig('mention_in_comment');
      expect(config.icon).toContain('pi-at');
      expect(config.color).toContain('purple');
    });

    it('should return fallback icon for unknown event type', () => {
      const config = component.getIconConfig('unknown_type' as NotificationEventType);
      expect(config.icon).toContain('pi-bell');
      expect(config.color).toContain('gray');
    });
  });

  describe('onToastClick()', () => {
    it('should dismiss and navigate on toast click with internal link', () => {
      const toast = makeToast({ id: 't-1', link_url: '/workspace/ws-1' });
      component.onToastClick(toast);
      expect(mockToastService.dismiss).toHaveBeenCalledWith('t-1');
      expect(mockRouter.navigateByUrl).toHaveBeenCalledWith('/workspace/ws-1');
    });

    it('should dismiss and open external link in new tab', () => {
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
      const toast = makeToast({ id: 't-ext', link_url: 'https://example.com/task' });

      component.onToastClick(toast);

      expect(mockToastService.dismiss).toHaveBeenCalledWith('t-ext');
      expect(openSpy).toHaveBeenCalledWith('https://example.com/task', '_blank');
      expect(mockRouter.navigateByUrl).not.toHaveBeenCalled();

      openSpy.mockRestore();
    });

    it('should dismiss toast without navigation when no link', () => {
      const toast = makeToast({ id: 't-2', link_url: null });
      component.onToastClick(toast);
      expect(mockToastService.dismiss).toHaveBeenCalledWith('t-2');
      expect(mockRouter.navigateByUrl).not.toHaveBeenCalled();
    });

    it('should use navigateByUrl for links starting with /', () => {
      const toast = makeToast({ link_url: '/board/123' });
      component.onToastClick(toast);
      expect(mockRouter.navigateByUrl).toHaveBeenCalledWith('/board/123');
    });
  });

  describe('onDismiss()', () => {
    it('should stop propagation and dismiss', () => {
      const mockEvent = { stopPropagation: vi.fn() } as unknown as MouseEvent;
      component.onDismiss(mockEvent, 't-3');
      expect(mockEvent.stopPropagation).toHaveBeenCalled();
      expect(mockToastService.dismiss).toHaveBeenCalledWith('t-3');
    });

    it('should not trigger toast click navigation', () => {
      const mockEvent = { stopPropagation: vi.fn() } as unknown as MouseEvent;
      component.onDismiss(mockEvent, 't-4');
      expect(mockRouter.navigateByUrl).not.toHaveBeenCalled();
    });
  });

  describe('template rendering', () => {
    it('should render toasts from service', () => {
      mockToastService.toasts.set([
        makeToast({ id: 't-1', title: 'First Toast' }),
        makeToast({ id: 't-2', title: 'Second Toast' }),
      ]);

      fixture.detectChanges();

      const toastEls = fixture.nativeElement.querySelectorAll('[role="alert"]');
      expect(toastEls.length).toBe(2);
    });

    it('should render no toasts when list is empty', () => {
      mockToastService.toasts.set([]);
      fixture.detectChanges();

      const toastEls = fixture.nativeElement.querySelectorAll('[role="alert"]');
      expect(toastEls.length).toBe(0);
    });

    it('should display toast title and body', () => {
      mockToastService.toasts.set([
        makeToast({ id: 't-1', title: 'My Title', body: 'My Body' }),
      ]);
      fixture.detectChanges();

      const textContent = fixture.nativeElement.textContent;
      expect(textContent).toContain('My Title');
      expect(textContent).toContain('My Body');
    });
  });
});
