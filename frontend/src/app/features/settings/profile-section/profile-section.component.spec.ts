import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA, signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { ProfileSectionComponent } from './profile-section.component';
import { AuthService } from '../../../core/services/auth.service';
import { UploadService } from '../../../core/services/upload.service';

describe('ProfileSectionComponent', () => {
  let component: ProfileSectionComponent;
  let fixture: ComponentFixture<ProfileSectionComponent>;
  let mockAuthService: any;
  let mockUploadService: any;

  beforeEach(async () => {
    mockAuthService = {
      currentUser: signal({
        id: 'u-1',
        name: 'Alice Smith',
        email: 'alice@test.com',
        avatar_url: 'https://example.com/avatar.jpg',
        role: 'Member' as const,
        tenant_id: 't-1',
        onboarding_completed: true,
      }),
      updateProfile: vi.fn().mockReturnValue(of({})),
      deleteAccount: vi.fn().mockReturnValue(of(void 0)),
      signOut: vi.fn(),
    };

    mockUploadService = {
      getAvatarUploadUrl: vi.fn(),
      uploadFileToPresignedUrl: vi.fn(),
      confirmAvatarUpload: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ProfileSectionComponent],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: UploadService, useValue: mockUploadService },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfileSectionComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should populate data from user on init', () => {
    component.ngOnInit();
    expect(component.name).toBe('Alice Smith');
    expect(component.avatarUrl).toBe('https://example.com/avatar.jpg');
  });

  it('should compute email from auth service', () => {
    expect(component.email()).toBe('alice@test.com');
  });

  it('should compute initials from name', () => {
    expect(component.initials()).toBe('AS');
  });

  it('should compute ? for initials when user has no name', () => {
    mockAuthService.currentUser.set({
      ...mockAuthService.currentUser(),
      name: '',
    });
    expect(component.initials()).toBe('?');
  });

  it('should compute single initial for single-word name', () => {
    mockAuthService.currentUser.set({
      ...mockAuthService.currentUser(),
      name: 'Alice',
    });
    expect(component.initials()).toBe('A');
  });

  it('should validate phone number as valid when empty', () => {
    expect(component.isPhoneValid()).toBe(true);
  });

  it('should validate valid E.164 phone number', () => {
    component.phoneNumber = '+1234567890';
    expect(component.isPhoneValid()).toBe(true);
  });

  it('should reject invalid phone number', () => {
    component.phoneNumber = '1234567890';
    expect(component.isPhoneValid()).toBe(false);
  });

  it('should reject phone number with letters', () => {
    component.phoneNumber = '+1abc';
    expect(component.isPhoneValid()).toBe(false);
  });

  it('should save profile with name', () => {
    component.ngOnInit();
    component.name = 'Updated Name';
    component.phoneNumber = '';
    component.saveProfile();
    expect(mockAuthService.updateProfile).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Updated Name' }),
    );
    expect(component.profileLoading()).toBe(false);
  });

  it('should save profile with phone number', () => {
    component.ngOnInit();
    component.name = 'Alice';
    component.phoneNumber = '+1234567890';
    component.saveProfile();
    expect(mockAuthService.updateProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Alice',
        phone_number: '+1234567890',
      }),
    );
  });

  it('should not save profile when phone is invalid', () => {
    component.phoneNumber = 'invalid';
    component.saveProfile();
    expect(mockAuthService.updateProfile).not.toHaveBeenCalled();
  });

  it('should handle save profile error', () => {
    mockAuthService.updateProfile.mockReturnValue(
      throwError(() => ({ error: { message: 'Failed' } })),
    );
    component.ngOnInit();
    component.name = 'Alice';
    component.saveProfile();
    expect(component.profileLoading()).toBe(false);
  });

  it('should save profile with avatar_url', () => {
    component.ngOnInit();
    component.name = 'Alice';
    component.avatarUrl = 'https://example.com/new-avatar.jpg';
    component.saveProfile();
    expect(mockAuthService.updateProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        avatar_url: 'https://example.com/new-avatar.jpg',
      }),
    );
  });

  it('should handle drag over', () => {
    const event = { preventDefault: vi.fn(), stopPropagation: vi.fn() } as any;
    component.onDragOver(event);
    expect(component.dragOver()).toBe(true);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
  });

  it('should handle drag leave', () => {
    component.dragOver.set(true);
    component.onDragLeave();
    expect(component.dragOver()).toBe(false);
  });

  it('should handle drop with file', () => {
    const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    Object.defineProperty(mockFile, 'size', { value: 1024 });
    mockUploadService.getAvatarUploadUrl.mockReturnValue(
      of({ upload_url: 'https://upload.url', storage_key: 'key-1' }),
    );
    mockUploadService.uploadFileToPresignedUrl.mockReturnValue(of({}));
    mockUploadService.confirmAvatarUpload.mockReturnValue(
      of({ avatar_url: 'https://new-avatar.jpg' }),
    );

    const event = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      dataTransfer: { files: [mockFile] },
    } as any;

    component.dragOver.set(true);
    component.onDrop(event);

    expect(component.dragOver()).toBe(false);
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('should handle drop without file', () => {
    const event = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      dataTransfer: { files: [] },
    } as any;

    component.onDrop(event);
    expect(component.dragOver()).toBe(false);
  });

  it('should handle file selected and reset input', () => {
    const mockFile = new File(['test'], 'test.png', { type: 'image/png' });
    Object.defineProperty(mockFile, 'size', { value: 1024 });
    mockUploadService.getAvatarUploadUrl.mockReturnValue(
      of({ upload_url: 'https://upload.url', storage_key: 'key-1' }),
    );
    mockUploadService.uploadFileToPresignedUrl.mockReturnValue(of({}));
    mockUploadService.confirmAvatarUpload.mockReturnValue(
      of({ avatar_url: 'https://new-avatar.jpg' }),
    );

    const inputEl = { files: [mockFile], value: 'C:\\fakepath\\test.png' };
    component.onFileSelected({ target: inputEl } as any);
    expect(inputEl.value).toBe('');
  });

  it('should cancel delete', () => {
    component.showDeleteConfirm.set(true);
    component.deleteConfirmText = 'DELETE';
    component.deletePassword = 'pass';
    component.cancelDelete();
    expect(component.showDeleteConfirm()).toBe(false);
    expect(component.deleteConfirmText).toBe('');
    expect(component.deletePassword).toBe('');
  });

  it('should not delete if confirm text is wrong', () => {
    component.deleteConfirmText = 'WRONG';
    component.deletePassword = 'pass';
    component.confirmDeleteAccount();
    expect(mockAuthService.deleteAccount).not.toHaveBeenCalled();
  });

  it('should not delete if password is empty', () => {
    component.deleteConfirmText = 'DELETE';
    component.deletePassword = '';
    component.confirmDeleteAccount();
    expect(mockAuthService.deleteAccount).not.toHaveBeenCalled();
  });

  it('should delete account when confirmed correctly', () => {
    component.deleteConfirmText = 'DELETE';
    component.deletePassword = 'mypass';
    component.confirmDeleteAccount();
    expect(mockAuthService.deleteAccount).toHaveBeenCalledWith('mypass');
    expect(mockAuthService.signOut).toHaveBeenCalledWith('manual');
    expect(component.deleteLoading()).toBe(false);
  });

  it('should handle delete account error', () => {
    mockAuthService.deleteAccount.mockReturnValue(
      throwError(() => ({ error: { message: 'Wrong password' } })),
    );
    component.deleteConfirmText = 'DELETE';
    component.deletePassword = 'wrong';
    component.confirmDeleteAccount();
    expect(component.deleteLoading()).toBe(false);
    expect(mockAuthService.signOut).not.toHaveBeenCalled();
  });

  it('should set avatarPreview on init from user avatar_url', () => {
    component.ngOnInit();
    expect(component.avatarPreview()).toBe('https://example.com/avatar.jpg');
  });

  it('should handle init with no user', () => {
    mockAuthService.currentUser.set(null as any);
    component.ngOnInit();
    expect(component.name).toBe('');
  });
});
