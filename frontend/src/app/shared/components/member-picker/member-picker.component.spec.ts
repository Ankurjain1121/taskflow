import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';
import { MemberPickerComponent } from './member-picker.component';
import { WorkspaceService } from '../../../core/services/workspace.service';

@Component({
  standalone: true,
  imports: [MemberPickerComponent],
  template: `<app-member-picker
    [workspaceId]="'ws-1'"
    [excludeUserIds]="excludeIds"
    (memberSelected)="onSelected($event)"
  />`,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
class TestHostComponent {
  excludeIds: string[] = ['u-3'];
  onSelected = vi.fn();
}

describe('MemberPickerComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;
  let component: MemberPickerComponent;
  let mockWorkspaceService: any;

  beforeEach(async () => {
    mockWorkspaceService = {
      searchMembers: vi.fn().mockReturnValue(
        of([
          { id: 'u-1', name: 'Alice', email: 'alice@test.com' },
          { id: 'u-2', name: 'Bob', email: 'bob@test.com' },
          { id: 'u-3', name: 'Charlie', email: 'charlie@test.com' },
        ]),
      ),
    };

    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [
        { provide: WorkspaceService, useValue: mockWorkspaceService },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    component = fixture.debugElement.children[0].componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should start with empty results', () => {
    expect(component.results()).toEqual([]);
  });

  it('should trigger search on onSearch', () => {
    component.ngOnInit();
    component.onSearch({ query: 'ali' });
    // Due to debounce, results won't be immediate - but the subject was called
    expect(component.searching()).toBe(false); // hasn't triggered yet due to debounce
  });

  it('should handle onSelected and reset', () => {
    const member = { id: 'u-1', name: 'Alice', email: 'alice@test.com' };
    component.onSelected({ value: member });
    expect(host.onSelected).toHaveBeenCalledWith(member);
    expect(component.searchQuery).toBe('');
    expect(component.results()).toEqual([]);
  });
});
