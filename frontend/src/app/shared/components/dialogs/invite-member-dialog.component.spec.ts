import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import {
  InviteMemberDialogComponent,
  InviteMemberDialogResult,
} from './invite-member-dialog.component';

describe('InviteMemberDialogComponent', () => {
  let component: InviteMemberDialogComponent;
  let fixture: ComponentFixture<InviteMemberDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        InviteMemberDialogComponent,
        ReactiveFormsModule,
        FormsModule,
        NoopAnimationsModule,
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(InviteMemberDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('initial state', () => {
    it('should have empty form', () => {
      expect(component.form.get('emailsText')?.value).toBe('');
      expect(component.form.get('role')?.value).toBe('member');
      expect(component.form.get('message')?.value).toBe('');
    });

    it('should have empty parsedEmails', () => {
      expect(component.parsedEmails()).toEqual([]);
    });

    it('should have empty selectedBoardIds', () => {
      expect(component.selectedBoardIds()).toEqual([]);
    });

    it('should not be submitting', () => {
      expect(component.isSubmitting).toBe(false);
    });

    it('should have 3 role options', () => {
      expect(component.roleOptions).toHaveLength(3);
      expect(component.roleOptions.map((r) => r.value)).toEqual([
        'member',
        'manager',
        'admin',
      ]);
    });
  });

  describe('validateEmails()', () => {
    it('should parse valid emails', () => {
      component.form.patchValue({ emailsText: 'alice@example.com, bob@example.com' });
      component.validateEmails();

      expect(component.parsedEmails()).toHaveLength(2);
      expect(component.parsedEmails()[0]).toEqual({
        email: 'alice@example.com',
        valid: true,
      });
      expect(component.parsedEmails()[1]).toEqual({
        email: 'bob@example.com',
        valid: true,
      });
    });

    it('should handle newline-separated emails', () => {
      component.form.patchValue({
        emailsText: 'alice@example.com\nbob@example.com',
      });
      component.validateEmails();

      expect(component.parsedEmails()).toHaveLength(2);
      expect(component.parsedEmails().every((e) => e.valid)).toBe(true);
    });

    it('should handle semicolon-separated emails', () => {
      component.form.patchValue({
        emailsText: 'alice@example.com;bob@example.com',
      });
      component.validateEmails();

      expect(component.parsedEmails()).toHaveLength(2);
    });

    it('should mark invalid emails', () => {
      component.form.patchValue({ emailsText: 'not-an-email, bob@example.com' });
      component.validateEmails();

      expect(component.parsedEmails()).toHaveLength(2);
      expect(component.parsedEmails()[0].valid).toBe(false);
      expect(component.parsedEmails()[0].error).toBe('Invalid email format');
      expect(component.parsedEmails()[1].valid).toBe(true);
    });

    it('should deduplicate emails', () => {
      component.form.patchValue({
        emailsText: 'alice@example.com, alice@example.com, bob@example.com',
      });
      component.validateEmails();

      expect(component.parsedEmails()).toHaveLength(2);
    });

    it('should normalize emails to lowercase', () => {
      component.form.patchValue({ emailsText: 'Alice@Example.COM' });
      component.validateEmails();

      expect(component.parsedEmails()[0].email).toBe('alice@example.com');
    });

    it('should handle empty input', () => {
      component.form.patchValue({ emailsText: '' });
      component.validateEmails();

      expect(component.parsedEmails()).toHaveLength(0);
    });

    it('should trim whitespace around emails', () => {
      component.form.patchValue({ emailsText: '  alice@example.com  ,  bob@example.com  ' });
      component.validateEmails();

      expect(component.parsedEmails()[0].email).toBe('alice@example.com');
      expect(component.parsedEmails()[1].email).toBe('bob@example.com');
    });
  });

  describe('validEmailCount()', () => {
    it('should return count of valid emails', () => {
      component.form.patchValue({
        emailsText: 'alice@example.com, invalid, bob@example.com',
      });
      component.validateEmails();

      expect(component.validEmailCount()).toBe(2);
    });

    it('should return 0 when no valid emails', () => {
      component.form.patchValue({ emailsText: 'notvalid, alsonotvalid' });
      component.validateEmails();

      expect(component.validEmailCount()).toBe(0);
    });
  });

  describe('invalidEmailCount()', () => {
    it('should return count of invalid emails', () => {
      component.form.patchValue({
        emailsText: 'alice@example.com, invalid, bob@example.com',
      });
      component.validateEmails();

      expect(component.invalidEmailCount()).toBe(1);
    });

    it('should return 0 when all emails are valid', () => {
      component.form.patchValue({ emailsText: 'alice@example.com' });
      component.validateEmails();

      expect(component.invalidEmailCount()).toBe(0);
    });
  });

  describe('canSubmit()', () => {
    it('should return false when no emails are parsed', () => {
      expect(component.canSubmit()).toBe(false);
    });

    it('should return true when valid emails exist and role is set', () => {
      component.form.patchValue({ emailsText: 'alice@example.com', role: 'member' });
      component.validateEmails();

      expect(component.canSubmit()).toBe(true);
    });

    it('should return false when only invalid emails exist', () => {
      component.form.patchValue({ emailsText: 'not-valid', role: 'member' });
      component.validateEmails();

      expect(component.canSubmit()).toBe(false);
    });

    it('should return false when role is not set', () => {
      component.form.patchValue({ emailsText: 'alice@example.com', role: '' });
      component.validateEmails();

      expect(component.canSubmit()).toBe(false);
    });
  });

  describe('board selection', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('boards', [
        { id: 'b-1', name: 'Board 1' },
        { id: 'b-2', name: 'Board 2' },
        { id: 'b-3', name: 'Board 3' },
      ]);
      fixture.detectChanges();
    });

    it('isBoardSelected should return false for unselected boards', () => {
      expect(component.isBoardSelected('b-1')).toBe(false);
    });

    it('toggleBoard should add board to selected', () => {
      component.toggleBoard('b-1', true);
      expect(component.selectedBoardIds()).toEqual(['b-1']);
      expect(component.isBoardSelected('b-1')).toBe(true);
    });

    it('toggleBoard should remove board from selected', () => {
      component.toggleBoard('b-1', true);
      component.toggleBoard('b-2', true);
      component.toggleBoard('b-1', false);

      expect(component.selectedBoardIds()).toEqual(['b-2']);
    });

    it('toggleAllBoards(true) should select all boards', () => {
      component.toggleAllBoards(true);

      expect(component.selectedBoardIds()).toEqual(['b-1', 'b-2', 'b-3']);
    });

    it('toggleAllBoards(false) should deselect all boards', () => {
      component.toggleAllBoards(true);
      component.toggleAllBoards(false);

      expect(component.selectedBoardIds()).toEqual([]);
    });

    it('allBoardsSelected should return true when all selected', () => {
      component.toggleAllBoards(true);
      expect(component.allBoardsSelected()).toBe(true);
    });

    it('allBoardsSelected should return false when not all selected', () => {
      component.toggleBoard('b-1', true);
      expect(component.allBoardsSelected()).toBe(false);
    });

    it('allBoardsSelected should return false when no boards', () => {
      fixture.componentRef.setInput('boards', []);
      fixture.detectChanges();
      expect(component.allBoardsSelected()).toBe(false);
    });
  });

  describe('onDialogShow()', () => {
    it('should reset form to defaults', () => {
      component.form.patchValue({
        emailsText: 'old@example.com',
        role: 'admin',
        message: 'old message',
      });
      component.parsedEmails.set([{ email: 'old@example.com', valid: true }]);
      component.selectedBoardIds.set(['b-1']);

      component.onDialogShow();

      expect(component.form.get('emailsText')?.value).toBe('');
      expect(component.form.get('role')?.value).toBe('member');
      expect(component.form.get('message')?.value).toBe('');
      expect(component.parsedEmails()).toEqual([]);
      expect(component.selectedBoardIds()).toEqual([]);
    });
  });

  describe('onCancel()', () => {
    it('should set visible to false', () => {
      component.visible.set(true);
      component.onCancel();
      expect(component.visible()).toBe(false);
    });
  });

  describe('onSubmit()', () => {
    it('should emit created event with valid data', () => {
      const createdSpy = vi.spyOn(component.created, 'emit');

      component.form.patchValue({
        emailsText: 'alice@example.com, bob@example.com',
        role: 'admin',
        message: 'Welcome!',
      });
      component.validateEmails();

      component.onSubmit();

      expect(createdSpy).toHaveBeenCalledWith({
        emails: ['alice@example.com', 'bob@example.com'],
        role: 'admin',
        boardIds: [],
        message: 'Welcome!',
      });
    });

    it('should include selected board IDs', () => {
      const createdSpy = vi.spyOn(component.created, 'emit');

      fixture.componentRef.setInput('boards', [
        { id: 'b-1', name: 'Board 1' },
      ]);
      fixture.detectChanges();

      component.form.patchValue({
        emailsText: 'alice@example.com',
        role: 'member',
      });
      component.validateEmails();
      component.toggleBoard('b-1', true);

      component.onSubmit();

      expect(createdSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          boardIds: ['b-1'],
        }),
      );
    });

    it('should close the dialog on successful submit', () => {
      component.visible.set(true);
      component.form.patchValue({
        emailsText: 'alice@example.com',
        role: 'member',
      });
      component.validateEmails();

      component.onSubmit();

      expect(component.visible()).toBe(false);
    });

    it('should not submit when canSubmit is false', () => {
      const createdSpy = vi.spyOn(component.created, 'emit');
      component.form.patchValue({
        emailsText: '',
        role: 'member',
      });

      component.onSubmit();

      expect(createdSpy).not.toHaveBeenCalled();
    });

    it('should mark form as touched when cannot submit', () => {
      component.form.patchValue({
        emailsText: '',
        role: 'member',
      });

      component.onSubmit();

      expect(component.form.get('emailsText')?.touched).toBe(true);
    });

    it('should omit empty message', () => {
      const createdSpy = vi.spyOn(component.created, 'emit');

      component.form.patchValue({
        emailsText: 'alice@example.com',
        role: 'member',
        message: '',
      });
      component.validateEmails();

      component.onSubmit();

      expect(createdSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: undefined,
        }),
      );
    });

    it('should trim message whitespace', () => {
      const createdSpy = vi.spyOn(component.created, 'emit');

      component.form.patchValue({
        emailsText: 'alice@example.com',
        role: 'member',
        message: '  Welcome team!  ',
      });
      component.validateEmails();

      component.onSubmit();

      expect(createdSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Welcome team!',
        }),
      );
    });

    it('should only include valid emails, not invalid ones', () => {
      const createdSpy = vi.spyOn(component.created, 'emit');

      component.form.patchValue({
        emailsText: 'alice@example.com, notvalid, bob@example.com',
        role: 'member',
      });
      component.validateEmails();

      component.onSubmit();

      const result = createdSpy.mock.calls[0][0] as InviteMemberDialogResult;
      expect(result.emails).toEqual(['alice@example.com', 'bob@example.com']);
    });
  });
});
