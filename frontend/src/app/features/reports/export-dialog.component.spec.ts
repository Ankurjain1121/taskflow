import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ExportDialogComponent } from './export-dialog.component';

describe('ExportDialogComponent', () => {
  let component: ExportDialogComponent;
  let fixture: ComponentFixture<ExportDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExportDialogComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ExportDialogComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should default to CSV format', () => {
    expect(component.selectedFormat()).toBe('csv');
  });

  it('should show error when no project selected', () => {
    fixture.componentRef.setInput('projectId', '');
    fixture.detectChanges();
    component.onExport();
    expect(component.errorMessage()).toBe('No project selected');
  });

  it('should switch format to PDF', () => {
    component.selectedFormat.set('pdf');
    expect(component.selectedFormat()).toBe('pdf');
  });

  it('should reset state on close', () => {
    component.selectedFormat.set('pdf');
    component.pdfStatus.set('pending');
    component.onVisibleChange(false);

    expect(component.selectedFormat()).toBe('csv');
    expect(component.pdfStatus()).toBeNull();
  });

  it('should cancel PDF polling', () => {
    component.pdfStatus.set('pending');
    component.cancelPdfPolling();
    expect(component.pdfStatus()).toBeNull();
  });
});
