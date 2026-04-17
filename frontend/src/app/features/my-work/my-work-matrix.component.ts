import {
  Component,
  signal,
  computed,
  inject,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  CdkDropList,
  CdkDrag,
  CdkDragDrop,
  CdkDragHandle,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import { Router } from '@angular/router';
import {
  EisenhowerService,
  EisenhowerTask,
  EisenhowerQuadrant,
  EisenhowerMatrixResponse,
} from '../../core/services/eisenhower.service';
import { TaskService } from '../../core/services/task.service';
import { QuickCreateService } from '../../core/services/quick-create.service';

type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

type DueProximity = 'overdue' | 'today' | 'tomorrow' | 'soon' | null;

function getDueProximity(due: string | null | undefined): DueProximity {
  if (!due) return null;
  const dueMs = new Date(due).getTime();
  if (isNaN(dueMs)) return null;
  const nowMs = Date.now();
  const diffDays = Math.ceil((dueMs - nowMs) / 86400000);
  if (diffDays < 0) return 'overdue';
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'tomorrow';
  if (diffDays <= 2) return 'soon';
  return null;
}

interface QuadrantConfig {
  key: EisenhowerQuadrant;
  title: string;
  subtitle: string;
  icon: string;
  emptyIcon: string;
  emptyHint: string;
}

const QUADRANT_MAP: Record<EisenhowerQuadrant, { urgency: boolean; importance: boolean }> = {
  do_first: { urgency: true, importance: true },
  schedule: { urgency: false, importance: true },
  delegate: { urgency: true, importance: false },
  eliminate: { urgency: false, importance: false },
};

const QUADRANT_PRIORITY_MAP: Record<EisenhowerQuadrant, TaskPriority> = {
  do_first: 'urgent',
  schedule: 'high',
  delegate: 'medium',
  eliminate: 'low',
};

const ANIMATION_STORAGE_KEY = 'matrix-animated';

@Component({
  selector: 'app-my-work-matrix',
  standalone: true,
  imports: [CdkDropList, CdkDrag, CdkDragHandle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <div class="matrix-wrapper">
        <div class="matrix-grid">
          @for (i of [1, 2, 3, 4]; track i) {
            <div class="quadrant-skeleton">
              <div class="animate-pulse h-5 w-32 rounded" style="background: var(--muted)"></div>
              <div class="animate-pulse h-9 rounded mt-3" style="background: var(--muted)"></div>
              <div class="animate-pulse h-9 rounded mt-2" style="background: var(--muted)"></div>
            </div>
          }
        </div>
      </div>
    } @else {
      <div class="matrix-wrapper">
        <!-- Y-axis: IMPORTANT (left) -->
        <div class="y-axis left">
          <div class="axis-arrow">
            <svg width="10" height="10" viewBox="0 0 10 10"><path d="M5 0L10 8H0Z" fill="currentColor"/></svg>
          </div>
          <span class="axis-text">IMPORTANT</span>
        </div>

        <div class="matrix-core">
          <!-- X-axis: top -->
          <div class="x-axis top">
            <span class="axis-text">URGENT</span>
            <div class="axis-arrow">
              <svg width="10" height="10" viewBox="0 0 10 10"><path d="M0 5L8 0V10Z" fill="currentColor"/></svg>
            </div>
            <div class="axis-spacer"></div>
            <span class="axis-text muted">NOT URGENT</span>
            <div class="axis-arrow muted">
              <svg width="10" height="10" viewBox="0 0 10 10"><path d="M10 5L2 0V10Z" fill="currentColor"/></svg>
            </div>
          </div>

          <!-- 2x2 grid -->
          <div class="matrix-grid">
            @for (q of quadrants; track q.key; let qi = $index) {
              <div
                class="quadrant"
                [class.animate-scale-in]="shouldAnimate()"
                [style.animation-delay]="shouldAnimate() ? (qi * 0.08) + 's' : '0s'"
                [attr.data-quadrant]="q.key"
                [class.drag-over]="dragOverQuadrant() === q.key"
              >
                <!-- Header -->
                <div class="q-header" [attr.data-quadrant]="q.key">
                  <div class="q-header-info">
                    <i [class]="'pi ' + q.icon + ' q-icon'"></i>
                    <span class="q-title">{{ q.title }}</span>
                    <span class="q-badge">{{ tasksByQuadrant()[q.key].length }}</span>
                    <button
                      class="q-add-btn"
                      (click)="onQuickAdd($event, q.key)"
                      title="Add task"
                      aria-label="Add task to this quadrant"
                    >
                      <i class="pi pi-plus"></i>
                    </button>
                  </div>
                  <span class="q-subtitle">{{ q.subtitle }}</span>
                </div>

                <!-- Task list -->
                <div
                  cdkDropList
                  [id]="'matrix-' + q.key"
                  [cdkDropListData]="tasksByQuadrant()[q.key]"
                  [cdkDropListConnectedTo]="allDropListIds"
                  (cdkDropListDropped)="onDrop($event, q.key)"
                  (cdkDropListEntered)="dragOverQuadrant.set(q.key)"
                  (cdkDropListExited)="dragOverQuadrant.set(null)"
                  class="q-tasks"
                >
                  @for (task of tasksByQuadrant()[q.key]; track task.id; let i = $index) {
                    <div
                      cdkDrag
                      cdkDragPreviewClass="cdk-drag-preview-matrix"
                      class="task-row"
                      [class.animate-fade-in-up]="shouldAnimate()"
                      [style.animation-delay]="shouldAnimate() ? (i * 0.04) + 's' : '0s'"
                      [class.task-landed]="landedTaskId() === task.id"
                      [class.task-completing]="isCompleting(task.id)"
                      [attr.data-quadrant]="q.key"
                      (click)="onTaskClick(task.id)"
                    >
                      <!-- Completion checkbox -->
                      <button
                        class="task-checkbox"
                        [class.completing]="isCompleting(task.id)"
                        (click)="onCompleteTask($event, task.id, q.key)"
                        [attr.aria-label]="'Complete ' + task.title"
                      >
                        @if (isCompleting(task.id)) {
                          <i class="pi pi-check task-check-icon"></i>
                        }
                      </button>
                      <div class="task-accent" [attr.data-quadrant]="q.key"></div>
                      <div class="task-body" cdkDragHandle>
                        <div class="task-main">
                          <span class="task-title">{{ task.title }}</span>
                          @if (task.assignees?.[0]) {
                            <span class="task-avatar" [title]="task.assignees[0].display_name">
                              {{ task.assignees[0].display_name.charAt(0).toUpperCase() }}
                            </span>
                          }
                        </div>
                        <div class="task-meta">
                          @if (task.board_name) {
                            <span class="task-project">{{ task.board_name }}</span>
                          }
                          @if (task.priority && task.priority !== 'none') {
                            <span class="task-priority" [attr.data-priority]="task.priority">
                              {{ task.priority }}
                            </span>
                          }
                          @if (formatDue(task.due_date); as due) {
                            <span class="task-due" [class.overdue]="isDueOverdue(task.due_date)">
                              <i class="pi pi-calendar text-[9px]"></i>
                              {{ due }}
                            </span>
                          }
                          @for (hint of (hintsByTaskId().get(task.id) ?? []); track hint) {
                            <span class="task-hint" [attr.data-hint]="hint">
                              @switch (hint) {
                                @case ('manual') { <i class="pi pi-pencil"></i> pinned }
                                @case ('overdue') { <i class="pi pi-exclamation-triangle"></i> overdue }
                                @case ('due today') { <i class="pi pi-clock"></i> due today }
                                @case ('due tomorrow') { <i class="pi pi-clock"></i> due tomorrow }
                                @case ('due soon') { <i class="pi pi-clock"></i> due soon }
                                @case ('urgent priority') { <i class="pi pi-bolt"></i> urgent }
                                @case ('high priority') { <i class="pi pi-arrow-up"></i> high pri }
                                @case ('low priority') { <i class="pi pi-minus"></i> low pri }
                              }
                            </span>
                          }
                        </div>
                      </div>
                    </div>
                  } @empty {
                    <div class="q-empty">
                      <i [class]="'pi ' + q.emptyIcon + ' q-empty-icon'" [attr.data-quadrant]="q.key"></i>
                      <p>{{ q.emptyHint }}</p>
                    </div>
                  }
                </div>

                <!-- Scroll fade (bottom) -->
                <div class="q-scroll-fade" [attr.data-quadrant]="q.key"></div>
              </div>
            }
          </div>

          <!-- X-axis: bottom -->
          <div class="x-axis bottom">
            <span class="axis-text muted">URGENT</span>
            <div class="axis-spacer"></div>
            <span class="axis-text very-muted">NOT URGENT</span>
          </div>
        </div>

        <!-- Y-axis: NOT IMPORTANT (right) -->
        <div class="y-axis right">
          <span class="axis-text muted">NOT IMPORTANT</span>
          <div class="axis-arrow muted">
            <svg width="10" height="10" viewBox="0 0 10 10"><path d="M5 10L0 2H10Z" fill="currentColor"/></svg>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    :host { display: block; }

    /* ─── Shell ─── */
    .matrix-wrapper {
      display: flex;
      align-items: stretch;
      height: calc(100vh - 240px);
      max-height: calc(100vh - 240px);
      gap: 0;
    }

    @media (max-width: 1023px) {
      .matrix-wrapper { height: auto; max-height: none; }
    }

    /* ─── Y-axis ─── */
    .y-axis {
      display: none;
      writing-mode: vertical-lr;
      align-items: center;
      justify-content: center;
      padding: 0 8px;
      gap: 6px;
    }
    .y-axis.right { transform: rotate(180deg); }

    @media (min-width: 1024px) {
      .y-axis { display: flex; }
    }

    /* ─── X-axis ─── */
    .x-axis {
      display: none;
      align-items: center;
      justify-content: center;
      padding: 0 0 4px;
      gap: 4px;
    }
    .x-axis.bottom { padding: 4px 0 0; }

    @media (min-width: 1024px) {
      .x-axis { display: flex; }
    }

    .axis-spacer { flex: 1; }

    .axis-text {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.14em;
      color: var(--muted-foreground);
      opacity: 0.55;
      text-transform: uppercase;
      user-select: none;
    }
    .axis-text.muted { opacity: 0.35; }
    .axis-text.very-muted { opacity: 0.2; }

    .axis-arrow {
      color: var(--muted-foreground);
      opacity: 0.4;
      display: flex;
      align-items: center;
    }
    .axis-arrow.muted { opacity: 0.2; }

    /* ─── Core ─── */
    .matrix-core {
      flex: 1;
      min-width: 0;
      min-height: 0;
      display: flex;
      flex-direction: column;
    }

    /* ─── 2x2 Grid ─── */
    .matrix-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 10px;
      flex: 1;
      min-height: 0;
    }

    @media (min-width: 1024px) {
      .matrix-grid {
        grid-template-columns: 1fr 1fr;
        grid-template-rows: 1fr 1fr;
      }
    }

    /* ─── Quadrant ─── */
    .quadrant {
      display: flex;
      flex-direction: column;
      border-radius: 10px;
      overflow: hidden;
      min-height: 150px;
      position: relative;
      transition: box-shadow 200ms var(--ease-standard, ease);
    }

    @media (min-width: 1024px) {
      .quadrant { min-height: 0; }
    }

    /* Quadrant color themes — shadows instead of borders */
    .quadrant[data-quadrant="do_first"] {
      background: color-mix(in srgb, var(--destructive) 5%, var(--card));
      box-shadow: 0 1px 3px color-mix(in srgb, var(--foreground) 4%, transparent),
                  0 0 0 1px color-mix(in srgb, var(--destructive) 6%, transparent);
    }
    .quadrant[data-quadrant="schedule"] {
      background: color-mix(in srgb, var(--warning, #d97706) 4%, var(--card));
      box-shadow: 0 1px 3px color-mix(in srgb, var(--foreground) 4%, transparent),
                  0 0 0 1px color-mix(in srgb, var(--warning, #d97706) 6%, transparent);
    }
    .quadrant[data-quadrant="delegate"] {
      background: color-mix(in srgb, var(--primary) 4%, var(--card));
      box-shadow: 0 1px 3px color-mix(in srgb, var(--foreground) 4%, transparent),
                  0 0 0 1px color-mix(in srgb, var(--primary) 6%, transparent);
    }
    .quadrant[data-quadrant="eliminate"] {
      background: var(--card);
      box-shadow: 0 1px 3px color-mix(in srgb, var(--foreground) 4%, transparent),
                  0 0 0 1px color-mix(in srgb, var(--foreground) 4%, transparent);
    }

    .quadrant.drag-over {
      box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--primary) 30%, transparent),
                  0 0 16px color-mix(in srgb, var(--primary) 8%, transparent);
    }

    /* ─── Quadrant header ─── */
    .q-header {
      padding: 12px 14px 8px;
      flex-shrink: 0;
    }

    .q-header-info {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .q-icon { font-size: 13px; }

    .q-header[data-quadrant="do_first"] .q-icon { color: var(--destructive); }
    .q-header[data-quadrant="schedule"] .q-icon { color: var(--warning, #d97706); }
    .q-header[data-quadrant="delegate"] .q-icon { color: var(--primary); }
    .q-header[data-quadrant="eliminate"] .q-icon { color: var(--muted-foreground); }

    .q-title {
      font-size: 14px;
      font-weight: 700;
      color: var(--card-foreground);
      letter-spacing: -0.01em;
    }

    .q-badge {
      font-size: 10px;
      font-weight: 700;
      min-width: 18px;
      height: 18px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 9px;
      font-variant-numeric: tabular-nums;
      margin-left: auto;
    }

    .q-header[data-quadrant="do_first"] .q-badge {
      background: color-mix(in srgb, var(--destructive) 14%, transparent);
      color: var(--destructive);
    }
    .q-header[data-quadrant="schedule"] .q-badge {
      background: color-mix(in srgb, var(--warning, #d97706) 14%, transparent);
      color: var(--warning, #d97706);
    }
    .q-header[data-quadrant="delegate"] .q-badge {
      background: color-mix(in srgb, var(--primary) 12%, transparent);
      color: var(--primary);
    }
    .q-header[data-quadrant="eliminate"] .q-badge {
      background: var(--muted);
      color: var(--muted-foreground);
    }

    /* Quick-add button */
    .q-add-btn {
      width: 22px;
      height: 22px;
      border-radius: 6px;
      border: none;
      background: color-mix(in srgb, var(--foreground) 5%, transparent);
      color: var(--muted-foreground);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      opacity: 0;
      transition: opacity 150ms ease, background 150ms ease;
      font-size: 11px;
    }

    .quadrant:hover .q-add-btn,
    .q-add-btn:focus-visible {
      opacity: 1;
    }

    .q-add-btn:hover {
      background: color-mix(in srgb, var(--foreground) 10%, transparent);
      color: var(--foreground);
    }

    .q-subtitle {
      font-size: 11px;
      color: var(--muted-foreground);
      margin-top: 1px;
      display: block;
    }

    /* ─── Task list ─── */
    .q-tasks {
      flex: 1;
      overflow-y: auto;
      padding: 4px 10px 10px;
      min-height: 36px;
      scrollbar-width: thin;
      scrollbar-color: color-mix(in srgb, var(--foreground) 10%, transparent) transparent;
    }

    /* ─── Scroll fade overlay ─── */
    .q-scroll-fade {
      position: absolute; bottom: 0; left: 0; right: 0;
      height: 28px; pointer-events: none; border-radius: 0 0 10px 10px;
    }
    .q-scroll-fade[data-quadrant="do_first"] { background: linear-gradient(to top, color-mix(in srgb, var(--destructive) 5%, var(--card)), transparent); }
    .q-scroll-fade[data-quadrant="schedule"] { background: linear-gradient(to top, color-mix(in srgb, var(--warning, #d97706) 4%, var(--card)), transparent); }
    .q-scroll-fade[data-quadrant="delegate"] { background: linear-gradient(to top, color-mix(in srgb, var(--primary) 4%, var(--card)), transparent); }
    .q-scroll-fade[data-quadrant="eliminate"] { background: linear-gradient(to top, var(--card), transparent); }

    /* ─── Task row ─── */
    .task-row {
      display: flex;
      align-items: stretch;
      border-radius: 7px;
      margin-bottom: 4px;
      overflow: hidden;
      cursor: pointer;
      transition: background 150ms var(--ease-standard, ease),
                  box-shadow 150ms var(--ease-standard, ease),
                  transform 120ms var(--ease-standard, ease);
    }

    .task-row[data-quadrant="do_first"] { background: color-mix(in srgb, var(--destructive) 3%, var(--background)); }
    .task-row[data-quadrant="schedule"] { background: var(--background); }
    .task-row[data-quadrant="delegate"] { background: var(--background); }
    .task-row[data-quadrant="eliminate"] { background: var(--muted); }

    .task-row:hover {
      box-shadow: 0 2px 8px color-mix(in srgb, var(--foreground) 8%, transparent);
      transform: scale(1.015);
      position: relative;
      z-index: 1;
      transition: background 200ms var(--ease-out-expo, ease),
                  box-shadow 200ms var(--ease-out-expo, ease),
                  transform 200ms var(--ease-out-expo, ease);
    }

    .task-row:active {
      transform: scale(0.985);
      box-shadow: 0 1px 2px color-mix(in srgb, var(--foreground) 4%, transparent);
    }

    /* ─── Completion checkbox ─── */
    .task-checkbox {
      width: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      cursor: pointer;
      background: none;
      border: none;
      padding: 0;
      position: relative;
    }

    .task-checkbox::before {
      content: '';
      width: 16px;
      height: 16px;
      border-radius: 50%;
      border: 1.5px solid color-mix(in srgb, var(--foreground) 20%, transparent);
      transition: border-color 150ms ease, background 150ms ease, transform 150ms ease;
    }

    .task-checkbox:hover::before {
      border-color: color-mix(in srgb, var(--foreground) 40%, transparent);
      transform: scale(1.1);
    }

    .task-checkbox.completing::before {
      background: var(--success, #10b981);
      border-color: var(--success, #10b981);
      animation: celebrateCheck 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
    }

    .task-checkbox .task-check-icon {
      position: absolute;
      font-size: 9px;
      color: white;
      animation: celebrateCheck 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
      animation-delay: 0.1s;
    }

    @keyframes celebrateCheck {
      0% { transform: scale(0); opacity: 0; }
      50% { transform: scale(1.2); }
      100% { transform: scale(1); opacity: 1; }
    }

    .task-row.task-completing {
      animation: taskCompleteOut 0.5s ease-out 0.3s both;
    }
    @keyframes taskCompleteOut {
      to {
        opacity: 0;
        transform: translateX(20px) scale(0.95);
        max-height: 0;
        margin-bottom: 0;
        padding: 0;
        overflow: hidden;
      }
    }

    /* ─── Left accent bar ─── */
    .task-accent {
      width: 4px;
      flex-shrink: 0;
      border-radius: 4px 0 0 4px;
      opacity: 0.8;
    }
    .task-accent[data-quadrant="do_first"] {
      background: linear-gradient(to bottom, var(--destructive), color-mix(in srgb, var(--destructive) 50%, transparent));
    }
    .task-accent[data-quadrant="schedule"] {
      background: linear-gradient(to bottom, var(--warning, #d97706), color-mix(in srgb, var(--warning, #d97706) 50%, transparent));
    }
    .task-accent[data-quadrant="delegate"] {
      background: linear-gradient(to bottom, var(--primary), color-mix(in srgb, var(--primary) 50%, transparent));
    }
    .task-accent[data-quadrant="eliminate"] {
      background: linear-gradient(to bottom, var(--muted-foreground), transparent);
      opacity: 0.35;
    }

    .task-body {
      flex: 1;
      min-width: 0;
      padding: 6px 10px 7px;
      cursor: grab;
    }

    .task-main {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .task-title {
      font-size: 13.5px;
      font-weight: 500;
      color: var(--card-foreground);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex: 1;
      min-width: 0;
      line-height: 1.45;
    }

    .task-avatar {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 9px;
      font-weight: 700;
      flex-shrink: 0;
      background: color-mix(in srgb, var(--primary) 12%, var(--card));
      color: var(--primary);
    }

    .task-meta {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 1px;
      flex-wrap: wrap;
    }

    .task-project {
      font-size: 11px;
      color: var(--muted-foreground);
      max-width: 110px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .task-priority {
      font-size: 9.5px;
      font-weight: 650;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding: 0.5px 5px;
      border-radius: 3px;
      line-height: 1.5;
    }

    .task-priority[data-priority="urgent"] {
      background: color-mix(in srgb, var(--destructive) 14%, transparent);
      color: var(--destructive);
    }
    .task-priority[data-priority="high"] {
      background: color-mix(in srgb, var(--warning, #d97706) 14%, transparent);
      color: var(--warning, #d97706);
    }
    .task-priority[data-priority="medium"] {
      background: color-mix(in srgb, var(--primary) 10%, transparent);
      color: var(--primary);
    }
    .task-priority[data-priority="low"] {
      background: var(--muted);
      color: var(--muted-foreground);
    }

    .task-due {
      font-size: 11px;
      color: var(--muted-foreground);
      display: flex;
      align-items: center;
      gap: 3px;
    }
    .task-due.overdue { color: var(--destructive); font-weight: 600; }

    /* ─── Hint tags ─── */
    .task-hint {
      font-size: 9.5px;
      font-weight: 600;
      padding: 1px 5px;
      border-radius: 3px;
      display: inline-flex;
      align-items: center;
      gap: 2px;
      white-space: nowrap;
      background: color-mix(in srgb, var(--foreground) 5%, transparent);
      color: var(--muted-foreground);
    }

    .task-hint .pi { font-size: 8px; }

    .task-hint[data-hint="manual"] {
      background: color-mix(in srgb, var(--primary) 10%, transparent);
      color: var(--primary);
    }

    .task-hint[data-hint="overdue"] {
      background: color-mix(in srgb, var(--destructive) 10%, transparent);
      color: var(--destructive);
    }

    .task-hint[data-hint="due today"],
    .task-hint[data-hint="due tomorrow"],
    .task-hint[data-hint="due soon"] {
      background: color-mix(in srgb, var(--warning, #d97706) 10%, transparent);
      color: var(--warning, #d97706);
    }

    /* ─── Empty state ─── */
    .q-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      min-height: 60px;
      padding: 16px;
      gap: 6px;
    }
    .q-empty-icon {
      font-size: 20px;
      opacity: 0.15;
    }
    .q-empty-icon[data-quadrant="do_first"] { color: var(--destructive); }
    .q-empty-icon[data-quadrant="schedule"] { color: var(--warning, #d97706); }
    .q-empty-icon[data-quadrant="delegate"] { color: var(--primary); }
    .q-empty-icon[data-quadrant="eliminate"] { color: var(--muted-foreground); }

    .q-empty p {
      font-size: 11px;
      color: var(--muted-foreground);
      text-align: center;
      opacity: 0.5;
    }

    /* ─── Skeleton ─── */
    .quadrant-skeleton {
      border-radius: 10px;
      background: var(--card);
      box-shadow: 0 1px 3px color-mix(in srgb, var(--foreground) 4%, transparent);
      padding: 14px;
    }

    /* ─── Animations ─── */
    .task-landed {
      animation: matrix-land 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    @keyframes matrix-land {
      0% { transform: scale(0.96) translateY(2px); opacity: 0.6; }
      50% { transform: scale(1.02) translateY(-1px); }
      100% { transform: scale(1) translateY(0); opacity: 1; }
    }

    .cdk-drag-placeholder {
      background: color-mix(in srgb, var(--primary) 6%, var(--background));
      border: 1.5px dashed color-mix(in srgb, var(--primary) 30%, var(--border));
      border-radius: 7px;
      min-height: 36px;
      margin-bottom: 4px;
    }

    @media (prefers-reduced-motion: reduce) {
      .task-landed { animation: none; }
      .task-row { transition: none; }
      .task-row.task-completing { animation: none; opacity: 0.5; }
      .task-checkbox.completing::before { animation: none; }
      .task-checkbox .task-check-icon { animation: none; }
      .quadrant.animate-scale-in { animation: none !important; }
      .task-row.animate-fade-in-up { animation: none !important; }
    }
  `],
})
export class MyWorkMatrixComponent implements OnInit {
  private eisenhowerService = inject(EisenhowerService);
  private taskService = inject(TaskService);
  private quickCreateService = inject(QuickCreateService);
  private router = inject(Router);

  readonly loading = signal(false);
  readonly matrix = signal<EisenhowerMatrixResponse | null>(null);
  readonly dragOverQuadrant = signal<EisenhowerQuadrant | null>(null);
  readonly landedTaskId = signal<string | null>(null);
  readonly completingTaskIds = signal<Set<string>>(new Set());
  readonly animationDone = signal(
    typeof sessionStorage !== 'undefined'
      ? sessionStorage.getItem(ANIMATION_STORAGE_KEY) === 'true'
      : true,
  );

  readonly allDropListIds = [
    'matrix-do_first', 'matrix-schedule', 'matrix-delegate', 'matrix-eliminate',
  ];

  readonly quadrants: QuadrantConfig[] = [
    {
      key: 'do_first', title: 'Do First', subtitle: 'Urgent & Important',
      icon: 'pi-bolt', emptyIcon: 'pi-check-circle',
      emptyHint: 'No fires to put out',
    },
    {
      key: 'schedule', title: 'Schedule', subtitle: 'Not Urgent & Important',
      icon: 'pi-calendar', emptyIcon: 'pi-calendar-plus',
      emptyHint: 'Plan something meaningful',
    },
    {
      key: 'delegate', title: 'Delegate', subtitle: 'Urgent & Not Important',
      icon: 'pi-users', emptyIcon: 'pi-users',
      emptyHint: 'Nothing to hand off',
    },
    {
      key: 'eliminate', title: 'Eliminate', subtitle: 'Not Urgent & Not Important',
      icon: 'pi-times-circle', emptyIcon: 'pi-sparkles',
      emptyHint: 'A clean conscience',
    },
  ];

  readonly tasksByQuadrant = computed(() => {
    const m = this.matrix();
    return {
      do_first: m?.do_first ?? [],
      schedule: m?.schedule ?? [],
      delegate: m?.delegate ?? [],
      eliminate: m?.eliminate ?? [],
    };
  });

  readonly hintsByTaskId = computed(() => {
    const m = this.matrix();
    const map = new Map<string, string[]>();
    if (!m) return map;

    const allTasks = [
      ...m.do_first,
      ...m.schedule,
      ...m.delegate,
      ...m.eliminate,
    ];

    for (const task of allTasks) {
      const hints: string[] = [];

      if (task.eisenhower_urgency !== null || task.eisenhower_importance !== null) {
        hints.push('manual');
        map.set(task.id, hints);
        continue;
      }

      const proximity = getDueProximity(task.due_date);
      if (proximity === 'overdue') hints.push('overdue');
      else if (proximity === 'today') hints.push('due today');
      else if (proximity === 'tomorrow') hints.push('due tomorrow');
      else if (proximity === 'soon') hints.push('due soon');

      if (task.priority === 'urgent') hints.push('urgent priority');
      else if (task.priority === 'high') hints.push('high priority');

      if (hints.length === 0) {
        if (task.priority === 'low' || task.priority === 'medium' || !task.priority) {
          hints.push('low priority');
        }
      }

      map.set(task.id, hints);
    }

    return map;
  });

  shouldAnimate(): boolean {
    return !this.animationDone();
  }

  ngOnInit() {
    this.loadMatrix();
  }

  isCompleting(taskId: string): boolean {
    return this.completingTaskIds().has(taskId);
  }

  onTaskClick(taskId: string): void {
    this.router.navigate(['/task', taskId]);
  }

  onCompleteTask(event: MouseEvent, taskId: string, quadrant: EisenhowerQuadrant): void {
    event.stopPropagation();

    this.completingTaskIds.update(ids => {
      const next = new Set(ids);
      next.add(taskId);
      return next;
    });

    this.taskService.completeTask(taskId).subscribe({
      next: () => {
        setTimeout(() => {
          const currentMatrix = this.matrix();
          if (!currentMatrix) return;
          const updated = {
            ...currentMatrix,
            [quadrant]: currentMatrix[quadrant].filter(t => t.id !== taskId),
          };
          this.matrix.set(updated);
          this.completingTaskIds.update(ids => {
            const next = new Set(ids);
            next.delete(taskId);
            return next;
          });
        }, 600);
      },
      error: () => {
        this.completingTaskIds.update(ids => {
          const next = new Set(ids);
          next.delete(taskId);
          return next;
        });
      },
    });
  }

  onQuickAdd(event: MouseEvent, quadrant: EisenhowerQuadrant): void {
    event.stopPropagation();

    const priority = QUADRANT_PRIORITY_MAP[quadrant];
    const isUrgentQuadrant = quadrant === 'do_first' || quadrant === 'delegate';
    const dueDate = isUrgentQuadrant ? new Date() : null;

    // Find most common project in this quadrant
    const tasks = this.tasksByQuadrant()[quadrant];
    const projectCounts = new Map<string, number>();
    for (const task of tasks) {
      if (task.project_id) {
        projectCounts.set(task.project_id, (projectCounts.get(task.project_id) ?? 0) + 1);
      }
    }
    let suggestedProjectId: string | undefined;
    let maxCount = 0;
    for (const [pid, count] of projectCounts) {
      if (count > maxCount) {
        maxCount = count;
        suggestedProjectId = pid;
      }
    }

    this.quickCreateService.openQuickCreate({
      priority,
      dueDate,
      projectId: suggestedProjectId,
    });

    // Reload matrix when dialog closes (give it a moment)
    setTimeout(() => this.loadMatrix(), 1000);
  }

  formatDue(due: string | null | undefined): string {
    if (!due) return '';
    const proximity = getDueProximity(due);
    if (proximity === 'overdue') {
      const diffDays = Math.ceil((Date.now() - new Date(due).getTime()) / 86400000);
      return `${diffDays}d overdue`;
    }
    if (proximity === 'today') return 'Today';
    if (proximity === 'tomorrow') return 'Tomorrow';
    if (proximity === 'soon') {
      const diffDays = Math.ceil((new Date(due).getTime() - Date.now()) / 86400000);
      return `In ${diffDays}d`;
    }
    const dueDate = new Date(due);
    const diffDays = Math.ceil((dueDate.getTime() - Date.now()) / 86400000);
    if (diffDays <= 7) return `In ${diffDays}d`;
    return dueDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  isDueOverdue(due: string | null | undefined): boolean {
    return getDueProximity(due) === 'overdue';
  }

  onDrop(event: CdkDragDrop<EisenhowerTask[]>, targetQuadrant: EisenhowerQuadrant) {
    this.dragOverQuadrant.set(null);

    if (event.previousContainer === event.container) return;

    const task = event.previousContainer.data[event.previousIndex];
    const currentMatrix = this.matrix();
    if (!currentMatrix) return;

    const sourceId = event.previousContainer.id.replace('matrix-', '') as EisenhowerQuadrant;
    const updated = { ...currentMatrix };
    const sourceList = [...updated[sourceId]];
    const targetList = [...updated[targetQuadrant]];

    transferArrayItem(sourceList, targetList, event.previousIndex, event.currentIndex);

    updated[sourceId] = sourceList;
    updated[targetQuadrant] = targetList;
    this.matrix.set(updated);

    this.landedTaskId.set(task.id);
    setTimeout(() => this.landedTaskId.set(null), 350);

    const { urgency, importance } = QUADRANT_MAP[targetQuadrant];
    this.eisenhowerService.updateTaskOverride(task.id, urgency, importance).subscribe({
      error: () => this.loadMatrix(),
    });
  }

  private async loadMatrix() {
    this.loading.set(true);
    try {
      const result = await firstValueFrom(this.eisenhowerService.getMatrix());
      this.matrix.set(result ?? null);

      // Mark entrance animation as done after first load
      if (!this.animationDone()) {
        setTimeout(() => {
          this.animationDone.set(true);
          try {
            sessionStorage.setItem(ANIMATION_STORAGE_KEY, 'true');
          } catch {
            // sessionStorage may be unavailable
          }
        }, 600);
      }
    } catch {
      // empty state
    } finally {
      this.loading.set(false);
    }
  }
}
