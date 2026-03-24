import * as fs from 'fs';
import * as path from 'path';

const SEED_DATA_PATH = '/tmp/taskbolt-seed-data.json';

export interface SeedUser {
  email: string;
  password: string;
  name: string;
  id?: string;
}

export interface SeedWorkspace {
  id: string;
  name: string;
  memberIndices: number[];
}

export interface SeedColumn {
  id: string;
  name: string;
  position: number;
}

export interface SeedBoard {
  id: string;
  name: string;
  workspaceId: string;
  columns: SeedColumn[];
}

export interface SeedLabel {
  id: string;
  name: string;
  color: string;
  workspaceId: string;
}

export interface SeedTask {
  id: string;
  title: string;
  boardId: string;
  columnId: string;
  workspaceId: string;
  assigneeIndex?: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  labelIds?: string[];
  dueDate?: string;
}

export interface SeedData {
  users: SeedUser[];
  workspaces: SeedWorkspace[];
  boards: SeedBoard[];
  tasks: SeedTask[];
  labels: SeedLabel[];
  timestamp: string;
}

export function loadSeedData(): SeedData {
  if (!fs.existsSync(SEED_DATA_PATH)) {
    throw new Error(
      `Seed data not found at ${SEED_DATA_PATH}. Run global-setup first.`,
    );
  }
  const raw = fs.readFileSync(SEED_DATA_PATH, 'utf-8');
  return JSON.parse(raw) as SeedData;
}


/** Get all workspaces a user (by index) belongs to */
export function getWorkspacesForUser(
  data: SeedData,
  userIndex: number,
): SeedWorkspace[] {
  return data.workspaces.filter((ws) => ws.memberIndices.includes(userIndex));
}

/** Get all boards in a workspace */
export function getBoardsForWorkspace(
  data: SeedData,
  workspaceId: string,
): SeedBoard[] {
  return data.boards.filter((b) => b.workspaceId === workspaceId);
}

/** Get all tasks on a board */
export function getTasksForBoard(
  data: SeedData,
  boardId: string,
): SeedTask[] {
  return data.tasks.filter((t) => t.boardId === boardId);
}

/** Get all tasks assigned to a user (by index) */
export function getTasksForUser(
  data: SeedData,
  userIndex: number,
): SeedTask[] {
  return data.tasks.filter((t) => t.assigneeIndex === userIndex);
}
