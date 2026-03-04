import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { PriorityBadgeComponent } from './priority-badge.component';

@Component({
  standalone: true,
  imports: [PriorityBadgeComponent],
  template: `<app-priority-badge [priority]="priority" />`,
})
class TestHostComponent {
  priority: string = 'medium';
}

describe('PriorityBadgeComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(
      fixture.nativeElement.querySelector('app-priority-badge'),
    ).toBeTruthy();
  });

  it('should display priority label for medium', () => {
    host.priority = 'medium';
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent.trim()).toContain('Medium');
  });

  it('should display priority label for high', () => {
    host.priority = 'high';
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent.trim()).toContain('High');
  });

  it('should display priority label for low', () => {
    host.priority = 'low';
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent.trim()).toContain('Low');
  });

  it('should display priority label for urgent', () => {
    host.priority = 'urgent';
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent.trim()).toContain('Urgent');
  });

  it('should handle unknown priority gracefully', () => {
    host.priority = 'unknown';
    fixture.detectChanges();
    const badge = fixture.nativeElement.querySelector('app-priority-badge');
    expect(badge).toBeTruthy();
  });
});
