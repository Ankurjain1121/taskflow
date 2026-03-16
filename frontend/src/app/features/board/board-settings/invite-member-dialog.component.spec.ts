import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ProjectInviteMemberDialogComponent } from './invite-member-dialog.component';

describe('InviteMemberDialogComponent', () => {
  let component: ProjectInviteMemberDialogComponent;
  let fixture: ComponentFixture<ProjectInviteMemberDialogComponent>;

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

    await TestBed.configureTestingModule({
      imports: [ProjectInviteMemberDialogComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectInviteMemberDialogComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have role options', () => {
    expect(component.roleOptions.length).toBe(2);
    const values = component.roleOptions.map((o) => o.value);
    expect(values).toContain('viewer');
    expect(values).toContain('editor');
  });

  it('should have a form with email and role controls', () => {
    expect(component.form.get('email')).toBeTruthy();
    expect(component.form.get('role')).toBeTruthy();
  });

  it('should default role to editor', () => {
    expect(component.form.get('role')?.value).toBe('editor');
  });

  it('should require email', () => {
    component.form.get('email')?.setValue('');
    expect(component.form.get('email')?.valid).toBe(false);
  });

  it('should validate email format', () => {
    component.form.get('email')?.setValue('not-an-email');
    expect(component.form.get('email')?.hasError('email')).toBe(true);

    component.form.get('email')?.setValue('valid@example.com');
    expect(component.form.get('email')?.valid).toBe(true);
  });

  it('should reset form on dialog show', () => {
    component.form.get('email')?.setValue('test@test.com');
    component.form.get('role')?.setValue('viewer');

    component.onDialogShow();

    expect(component.form.get('email')?.value).toBe('');
    expect(component.form.get('role')?.value).toBe('editor');
  });

  it('should close dialog on cancel', () => {
    component.visible.set(true);
    component.onCancel();
    expect(component.visible()).toBe(false);
  });

  it('should emit invite result and close dialog on valid invite', () => {
    component.visible.set(true);
    component.form.get('email')?.setValue('new@test.com');
    component.form.get('role')?.setValue('viewer');

    const emitSpy = vi.spyOn(component.invited, 'emit');
    component.onInvite();

    expect(emitSpy).toHaveBeenCalledWith({
      email: 'new@test.com',
      role: 'viewer',
    });
    expect(component.visible()).toBe(false);
  });

  it('should not emit when form is invalid', () => {
    component.form.get('email')?.setValue('');
    const emitSpy = vi.spyOn(component.invited, 'emit');
    component.onInvite();
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('should default boardId to empty string', () => {
    expect(component.boardId()).toBe('');
  });

  it('should default boardName to empty string', () => {
    expect(component.boardName()).toBe('');
  });
});
