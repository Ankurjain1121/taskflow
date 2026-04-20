import { describe, expect, it } from 'vitest';
import {
  buildUpdateRequest,
  buildConflictResubmitRequest,
} from './task-detail-conflict.helper';
import type { Task } from '../../../core/services/task.service';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    project_id: 'p1',
    status_id: 's1',
    task_list_id: null,
    title: 'Example',
    description: null,
    priority: 'medium',
    position: 'a0',
    milestone_id: null,
    due_date: null,
    created_by: 'u1',
    created_at: '2026-04-20T00:00:00Z',
    updated_at: '2026-04-20T00:00:00Z',
    assignees: [],
    labels: [],
    ...overrides,
  } as Task;
}

describe('buildUpdateRequest — OCC version handling', () => {
  it('includes expected_version when task.version is a positive integer', () => {
    const task = makeTask({ version: 5 });
    const result = buildUpdateRequest(task, { title: 'New' });
    expect(result).toEqual({ title: 'New', expected_version: 5 });
  });

  it('includes expected_version when task.version is 0 (regression: truthy coercion bug)', () => {
    // A freshly minted task with version=0 must still preserve OCC.
    // Previous implementation used `task.version ? ...` which evaluated 0 as
    // falsy and silently dropped expected_version, opening a last-write-wins
    // bypass (CWE-841). Guard against regression.
    const task = makeTask({ version: 0 });
    const result = buildUpdateRequest(task, { title: 'New' });
    expect(result).toEqual({ title: 'New', expected_version: 0 });
  });

  it('omits expected_version when task.version is undefined', () => {
    const task = makeTask({ version: undefined });
    const result = buildUpdateRequest(task, { title: 'New' });
    expect(result).toEqual({ title: 'New' });
    expect('expected_version' in result).toBe(false);
  });

  it('passes through the updates object unchanged when no version present', () => {
    const task = makeTask({ version: undefined });
    const updates = { title: 'New', priority: 'high' } as const;
    const result = buildUpdateRequest(task, updates);
    expect(result).toBe(updates);
  });
});

describe('buildConflictResubmitRequest', () => {
  it('returns null when resolution.action is not keep_mine', () => {
    const result = buildConflictResubmitRequest({
      action: 'keep_server',
      serverVersion: 7,
      yourChanges: { title: 'x' },
    } as any);
    expect(result).toBeNull();
  });

  it('returns expected_version from serverVersion on keep_mine', () => {
    const result = buildConflictResubmitRequest({
      action: 'keep_mine',
      serverVersion: 7,
      yourChanges: { title: 'x' },
    } as any);
    expect(result).toEqual({ title: 'x', expected_version: 7 });
  });

  it('preserves expected_version 0 on keep_mine (regression guard)', () => {
    const result = buildConflictResubmitRequest({
      action: 'keep_mine',
      serverVersion: 0,
      yourChanges: { title: 'x' },
    } as any);
    expect(result).toEqual({ title: 'x', expected_version: 0 });
  });
});
