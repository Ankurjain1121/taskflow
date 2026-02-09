import { Component, ChangeDetectionStrategy, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { BoardShareService, SharedBoardAccess } from '../../core/services/board-share.service';

@Component({
  selector: 'app-shared-board-view',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatCardModule, MatButtonModule, MatIconModule,
    MatInputModule, MatFormFieldModule, MatChipsModule, MatProgressSpinnerModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <div class="flex items-center justify-center h-screen">
        <mat-spinner diameter="48"></mat-spinner>
      </div>
    } @else if (needsPassword()) {
      <div class="flex items-center justify-center h-screen bg-gray-50">
        <mat-card class="w-96">
          <mat-card-content class="p-6 text-center">
            <mat-icon class="text-6xl text-gray-400 mb-4">lock</mat-icon>
            <h2 class="text-xl font-semibold mb-4">Password Required</h2>
            <p class="text-gray-600 mb-4">This board is password protected.</p>
            <mat-form-field class="w-full">
              <mat-label>Password</mat-label>
              <input matInput type="password" [(ngModel)]="password" (keyup.enter)="submitPassword()">
            </mat-form-field>
            @if (passwordError()) {
              <p class="text-red-500 text-sm mb-2">{{ passwordError() }}</p>
            }
            <button mat-raised-button color="primary" class="w-full mt-2" (click)="submitPassword()">
              Access Board
            </button>
          </mat-card-content>
        </mat-card>
      </div>
    } @else if (error()) {
      <div class="flex items-center justify-center h-screen bg-gray-50">
        <mat-card class="w-96">
          <mat-card-content class="p-6 text-center">
            <mat-icon class="text-6xl text-red-400 mb-4">error_outline</mat-icon>
            <h2 class="text-xl font-semibold mb-2">Unable to Access Board</h2>
            <p class="text-gray-600">{{ error() }}</p>
          </mat-card-content>
        </mat-card>
      </div>
    } @else if (board()) {
      <div class="min-h-screen bg-gray-50">
        <!-- Header -->
        <div class="bg-white border-b px-6 py-4">
          <h1 class="text-2xl font-bold">{{ board()!.board_name }}</h1>
          <p class="text-sm text-gray-500">Shared board view (read-only)</p>
        </div>

        <!-- Kanban columns -->
        <div class="p-6 overflow-x-auto">
          <div class="flex gap-4 min-w-max">
            @for (column of board()!.columns; track column.id) {
              <div class="w-72 bg-gray-100 rounded-lg p-3 flex-shrink-0">
                <div class="flex items-center gap-2 mb-3">
                  @if (column.color) {
                    <div class="w-3 h-3 rounded-full" [style.background-color]="column.color"></div>
                  }
                  <h3 class="font-semibold text-sm">{{ column.name }}</h3>
                  <span class="text-xs text-gray-400 ml-auto">
                    {{ getTasksForColumn(column.id).length }}
                  </span>
                </div>
                <div class="space-y-2">
                  @for (task of getTasksForColumn(column.id); track task.id) {
                    <mat-card class="!shadow-sm">
                      <mat-card-content class="p-3">
                        <h4 class="font-medium text-sm mb-1">{{ task.title }}</h4>
                        @if (task.description) {
                          <p class="text-xs text-gray-500 line-clamp-2">{{ task.description }}</p>
                        }
                        <div class="flex items-center gap-2 mt-2">
                          <mat-chip-set>
                            <mat-chip class="!text-xs" [class]="getPriorityClass(task.priority)">
                              {{ task.priority }}
                            </mat-chip>
                          </mat-chip-set>
                          @if (task.due_date) {
                            <span class="text-xs text-gray-400">{{ task.due_date | date:'shortDate' }}</span>
                          }
                        </div>
                      </mat-card-content>
                    </mat-card>
                  }
                </div>
              </div>
            }
          </div>
        </div>
      </div>
    }
  `,
})
export class SharedBoardViewComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private shareService = inject(BoardShareService);

  loading = signal(true);
  board = signal<SharedBoardAccess | null>(null);
  error = signal<string | null>(null);
  needsPassword = signal(false);
  passwordError = signal<string | null>(null);
  password = '';

  private token = '';

  ngOnInit() {
    this.token = this.route.snapshot.paramMap.get('token') || '';
    if (!this.token) {
      this.error.set('Invalid share link');
      this.loading.set(false);
      return;
    }
    this.loadBoard();
  }

  loadBoard(password?: string) {
    this.loading.set(true);
    this.shareService.accessSharedBoard(this.token, password).subscribe({
      next: (data) => {
        this.board.set(data);
        this.loading.set(false);
        this.needsPassword.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        if (err.status === 401 && err.error?.error?.code === 'UNAUTHORIZED') {
          this.needsPassword.set(true);
          if (password) {
            this.passwordError.set('Incorrect password');
          }
        } else if (err.status === 400) {
          this.error.set(err.error?.error?.message || 'This share link is no longer valid');
        } else {
          this.error.set('Unable to access this board');
        }
      },
    });
  }

  submitPassword() {
    this.passwordError.set(null);
    this.loadBoard(this.password);
  }

  getTasksForColumn(columnId: string) {
    return this.board()?.tasks.filter((t) => t.column_id === columnId) || [];
  }

  getPriorityClass(priority: string): string {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-blue-100 text-blue-800';
      case 'low': return 'bg-gray-100 text-gray-600';
      default: return '';
    }
  }
}
