import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import {
  AdminConfirmDialogComponent,
  ConfirmDialogData,
} from './confirm-dialog.component';

describe('AdminConfirmDialogComponent', () => {
  let component: AdminConfirmDialogComponent;
  let fixture: ComponentFixture<AdminConfirmDialogComponent>;

  const defaultData: ConfirmDialogData = {
    title: 'Confirm Action',
    message: 'Are you sure?',
    confirmText: 'Yes',
    cancelText: 'No',
    isDestructive: false,
  };

  beforeEach(async () => {
    if (!window.matchMedia) {
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
    }

    await TestBed.configureTestingModule({
      imports: [AdminConfirmDialogComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminConfirmDialogComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('data', defaultData);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have visible input defaulting to false', () => {
    expect(component.visible()).toBe(false);
  });

  it('should accept data input', () => {
    expect(component.data().title).toBe('Confirm Action');
    expect(component.data().message).toBe('Are you sure?');
    expect(component.data().confirmText).toBe('Yes');
    expect(component.data().cancelText).toBe('No');
    expect(component.data().isDestructive).toBe(false);
  });

  it('should emit confirmed event', () => {
    const spy = vi.fn();
    component.confirmed.subscribe(spy);
    component.confirmed.emit();
    expect(spy).toHaveBeenCalled();
  });

  it('should emit cancelled event', () => {
    const spy = vi.fn();
    component.cancelled.subscribe(spy);
    component.cancelled.emit();
    expect(spy).toHaveBeenCalled();
  });

  it('should accept destructive data', () => {
    fixture.componentRef.setInput('data', {
      title: 'Delete',
      message: 'This cannot be undone',
      isDestructive: true,
    });
    fixture.detectChanges();
    expect(component.data().isDestructive).toBe(true);
  });
});
