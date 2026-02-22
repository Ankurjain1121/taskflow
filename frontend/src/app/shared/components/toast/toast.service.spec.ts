import { ToastService, ToastNotification } from './toast.service';

function makeToast(id: string, overrides: Partial<ToastNotification> = {}): ToastNotification {
  return {
    id,
    event_type: 'task_assigned',
    title: `Toast ${id}`,
    body: 'Body',
    link_url: null,
    ...overrides,
  };
}

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    vi.useFakeTimers();
    service = new ToastService();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should start with no toasts', () => {
    expect(service.toasts()).toEqual([]);
  });

  describe('show()', () => {
    it('should show a toast', () => {
      service.show(makeToast('t-1'));
      expect(service.toasts().length).toBe(1);
      expect(service.toasts()[0].id).toBe('t-1');
    });

    it('should add multiple toasts in order', () => {
      service.show(makeToast('t-1'));
      service.show(makeToast('t-2'));
      service.show(makeToast('t-3'));

      expect(service.toasts().length).toBe(3);
      expect(service.toasts().map((t) => t.id)).toEqual(['t-1', 't-2', 't-3']);
    });

    it('should evict oldest when at max capacity (3)', () => {
      service.show(makeToast('t-1'));
      service.show(makeToast('t-2'));
      service.show(makeToast('t-3'));
      expect(service.toasts().length).toBe(3);

      service.show(makeToast('t-4'));
      expect(service.toasts().length).toBe(3);
      expect(service.toasts().map((t) => t.id)).toEqual(['t-2', 't-3', 't-4']);
    });

    it('should evict multiple oldest when adding beyond capacity', () => {
      service.show(makeToast('t-1'));
      service.show(makeToast('t-2'));
      service.show(makeToast('t-3'));
      service.show(makeToast('t-4'));
      service.show(makeToast('t-5'));

      expect(service.toasts().length).toBe(3);
      expect(service.toasts().map((t) => t.id)).toEqual(['t-3', 't-4', 't-5']);
    });

    it('should auto-dismiss after default duration (5000ms)', () => {
      service.show(makeToast('t-1'));
      expect(service.toasts().length).toBe(1);

      vi.advanceTimersByTime(4999);
      expect(service.toasts().length).toBe(1);

      vi.advanceTimersByTime(1);
      expect(service.toasts().length).toBe(0);
    });

    it('should auto-dismiss after custom duration', () => {
      service.show(makeToast('t-1'), 3000);
      expect(service.toasts().length).toBe(1);

      vi.advanceTimersByTime(2999);
      expect(service.toasts().length).toBe(1);

      vi.advanceTimersByTime(1);
      expect(service.toasts().length).toBe(0);
    });

    it('should auto-dismiss toasts independently at different times', () => {
      service.show(makeToast('t-1'), 1000);
      service.show(makeToast('t-2'), 3000);
      service.show(makeToast('t-3'), 5000);

      vi.advanceTimersByTime(1000);
      expect(service.toasts().length).toBe(2);
      expect(service.toasts().map((t) => t.id)).toEqual(['t-2', 't-3']);

      vi.advanceTimersByTime(2000);
      expect(service.toasts().length).toBe(1);
      expect(service.toasts()[0].id).toBe('t-3');

      vi.advanceTimersByTime(2000);
      expect(service.toasts().length).toBe(0);
    });

    it('should preserve all toast notification properties', () => {
      const toast = makeToast('t-1', {
        event_type: 'task_completed',
        title: 'Task Done',
        body: 'You completed it',
        link_url: '/task/123',
      });
      service.show(toast);

      const result = service.toasts()[0];
      expect(result.id).toBe('t-1');
      expect(result.event_type).toBe('task_completed');
      expect(result.title).toBe('Task Done');
      expect(result.body).toBe('You completed it');
      expect(result.link_url).toBe('/task/123');
    });
  });

  describe('dismiss()', () => {
    it('should dismiss a toast by id', () => {
      service.show(makeToast('t-1'));
      service.show(makeToast('t-2'));
      service.dismiss('t-1');
      expect(service.toasts().length).toBe(1);
      expect(service.toasts()[0].id).toBe('t-2');
    });

    it('should do nothing if id does not exist', () => {
      service.show(makeToast('t-1'));
      service.dismiss('nonexistent');
      expect(service.toasts().length).toBe(1);
    });

    it('should clear the auto-dismiss timer when manually dismissed', () => {
      service.show(makeToast('t-1'), 5000);
      service.dismiss('t-1');

      // Advance past original timeout - should not cause issues
      vi.advanceTimersByTime(6000);
      expect(service.toasts().length).toBe(0);
    });

    it('should dismiss the correct toast from middle of list', () => {
      service.show(makeToast('t-1'));
      service.show(makeToast('t-2'));
      service.show(makeToast('t-3'));

      service.dismiss('t-2');

      expect(service.toasts().map((t) => t.id)).toEqual(['t-1', 't-3']);
    });

    it('should handle dismissing last toast', () => {
      service.show(makeToast('t-1'));
      service.dismiss('t-1');
      expect(service.toasts()).toEqual([]);
    });
  });

  describe('dismissAll()', () => {
    it('should dismiss all toasts', () => {
      service.show(makeToast('t-1'));
      service.show(makeToast('t-2'));
      service.dismissAll();
      expect(service.toasts()).toEqual([]);
    });

    it('should clear all auto-dismiss timers', () => {
      service.show(makeToast('t-1'), 1000);
      service.show(makeToast('t-2'), 2000);
      service.show(makeToast('t-3'), 3000);

      service.dismissAll();

      // Advance past all timeouts - no errors
      vi.advanceTimersByTime(5000);
      expect(service.toasts()).toEqual([]);
    });

    it('should handle dismissAll on empty list', () => {
      service.dismissAll();
      expect(service.toasts()).toEqual([]);
    });

    it('should allow new toasts after dismissAll', () => {
      service.show(makeToast('t-1'));
      service.dismissAll();

      service.show(makeToast('t-new'));
      expect(service.toasts().length).toBe(1);
      expect(service.toasts()[0].id).toBe('t-new');
    });
  });

  describe('toasts computed signal', () => {
    it('should return toast objects without internal timer info', () => {
      service.show(makeToast('t-1'));
      const result = service.toasts()[0];
      // Ensure no internal properties leaked
      expect(Object.keys(result)).toEqual(
        expect.arrayContaining(['id', 'event_type', 'title', 'body', 'link_url']),
      );
    });

    it('should be reactive to show/dismiss changes', () => {
      expect(service.toasts().length).toBe(0);

      service.show(makeToast('t-1'));
      expect(service.toasts().length).toBe(1);

      service.dismiss('t-1');
      expect(service.toasts().length).toBe(0);
    });
  });
});
