import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import {
  BackgroundPatternComponent,
  BackgroundPattern,
} from './background-pattern.component';

@Component({
  standalone: true,
  imports: [BackgroundPatternComponent],
  template: `<app-background-pattern [pattern]="pattern" />`,
})
class TestHostComponent {
  pattern: BackgroundPattern = 'dots';
}

describe('BackgroundPatternComponent', () => {
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
      fixture.nativeElement.querySelector('app-background-pattern'),
    ).toBeTruthy();
  });

  it('should render pattern div for dots', () => {
    host.pattern = 'dots';
    fixture.detectChanges();
    const patternDiv = fixture.nativeElement.querySelector('.pattern-dots');
    expect(patternDiv).toBeTruthy();
  });

  it('should render pattern div for grid', () => {
    host.pattern = 'grid';
    fixture.detectChanges();
    const patternDiv = fixture.nativeElement.querySelector('.pattern-grid');
    expect(patternDiv).toBeTruthy();
  });

  it('should render pattern div for waves', () => {
    host.pattern = 'waves';
    fixture.detectChanges();
    const patternDiv = fixture.nativeElement.querySelector('.pattern-waves');
    expect(patternDiv).toBeTruthy();
  });

  it('should not render pattern div when pattern is none', () => {
    host.pattern = 'none';
    fixture.detectChanges();
    const patternDiv = fixture.nativeElement.querySelector(
      '.background-pattern',
    );
    expect(patternDiv).toBeNull();
  });
});
