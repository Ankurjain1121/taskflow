import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SelectButton } from 'primeng/selectbutton';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

import {
  DashboardService,
  MyTask,
} from '../../core/services/dashboard.service';

type FilterType = 'all' | 'overdue' | 'today' | 'week';

interface FilterOption {
  label: string;
  value: FilterType;
}

@Component({
  selector: 'app-my-tasks',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    SelectButton,
    ButtonModule,
    ToastModule,
  ],
  providers: [MessageService],
  templateUrl: './my-tasks.component.html',
  styleUrls: ['./my-tasks.component.css'],
})
export class MyTasksComponent implements OnInit {
  private dashboardService = inject(DashboardService);
  private messageService = inject(MessageService);

  filterOptions: FilterOption[] = [
    { label: 'All Tasks', value: 'all' },
    { label: 'Overdue', value: 'overdue' },
    { label: 'Due Today', value: 'today' },
    { label: 'Due This Week', value: 'week' },
  ];

  allTasks = signal<MyTask[]>([]);
  selectedFilter = signal<FilterType>('all');
  isLoading = signal(true);

  filteredTasks = computed(() => {
    const tasks = this.allTasks();
    const filter = this.selectedFilter();
    const now = new Date();

    switch (filter) {
      case 'overdue':
        return tasks.filter((t) => {
          if (!t.due_date) return false;
          const dueDate = new Date(t.due_date);
          return dueDate < now;
        });
      case 'today':
        return tasks.filter((t) => {
          if (!t.due_date) return false;
          const dueDate = new Date(t.due_date);
          return dueDate.toDateString() === now.toDateString();
        });
      case 'week':
        return tasks.filter((t) => {
          if (!t.due_date) return false;
          const dueDate = new Date(t.due_date);
          const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          return dueDate >= now && dueDate <= weekFromNow;
        });
      case 'all':
      default:
        return tasks;
    }
  });

  // Group tasks by board
  groupedTasks = computed(() => {
    const tasks = this.filteredTasks();
    const groups = new Map<string, MyTask[]>();

    for (const task of tasks) {
      const boardId = task.board_id;
      if (!groups.has(boardId)) {
        groups.set(boardId, []);
      }
      groups.get(boardId)!.push(task);
    }

    return Array.from(groups.entries());
  });

  ngOnInit() {
    this.loadMyTasks();
  }

  private loadMyTasks() {
    this.isLoading.set(true);
    this.dashboardService.getMyTasks().subscribe({
      next: (tasks) => {
        this.allTasks.set(tasks);
        this.isLoading.set(false);
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load your tasks',
          life: 3000,
        });
        this.isLoading.set(false);
      },
    });
  }

  setFilter(filter: FilterType) {
    this.selectedFilter.set(filter);
  }

  getPriorityColor(priority: string): string {
    const colors: Record<string, string> = {
      urgent: 'bg-red-500',
      high: 'bg-orange-500',
      medium: 'bg-yellow-500',
      low: 'bg-blue-500',
    };
    return colors[priority] || 'bg-gray-500';
  }

  getPriorityBadgeClass(priority: string): string {
    const classes: Record<string, string> = {
      urgent: 'bg-red-100 text-red-800',
      high: 'bg-orange-100 text-orange-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-blue-100 text-blue-800',
    };
    return classes[priority] || 'bg-gray-100 text-gray-800';
  }

  formatDueDate(dueDateStr: string | null): string {
    if (!dueDateStr) return '';
    const dueDate = new Date(dueDateStr);
    const now = new Date();
    const diffMs = dueDate.getTime() - now.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return `Overdue by ${Math.abs(diffDays)} day(s)`;
    } else if (diffDays === 0) {
      return 'Due today';
    } else if (diffDays === 1) {
      return 'Due tomorrow';
    } else if (diffDays < 7) {
      return `Due in ${diffDays} days`;
    } else {
      return dueDate.toLocaleDateString();
    }
  }

  isDueToday(dueDateStr: string | null): boolean {
    if (!dueDateStr) return false;
    const dueDate = new Date(dueDateStr);
    const now = new Date();
    return dueDate.toDateString() === now.toDateString();
  }

  isOverdue(dueDateStr: string | null): boolean {
    if (!dueDateStr) return false;
    const dueDate = new Date(dueDateStr);
    const now = new Date();
    return dueDate < now;
  }
}
