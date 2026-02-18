/**
 * Global setup for comprehensive E2E tests.
 * Seeds 20 users, 10 workspaces, 23 boards, 30 tasks via API.
 *
 * Multi-tenant strategy:
 *   1. User[0] signs up → creates a new tenant
 *   2. User[0] creates 10 workspaces
 *   3. User[0] invites users 1-19 → they accept → creates accounts in user[0]'s tenant
 *   4. User[0] adds members to workspaces per the distribution table
 *   5. Boards and tasks are created per workspace
 */

import { request } from '@playwright/test';
import {
  apiSignUp,
  apiCreateWorkspace,
  apiInviteUser,
  apiAcceptInvitation,
  apiAddWorkspaceMember,
  apiCreateBoard,
  apiCreateTask,
  apiCreateLabel,
  apiAssignTask,
  apiAddLabelToTask,
  ApiUser,
} from './helpers/data-factory';
import {
  SeedData,
  SeedUser,
  SeedWorkspace,
  SeedBoard,
  SeedTask,
  SeedLabel,
  saveSeedData,
} from './helpers/seed-data';

const BASE_URL = 'https://taskflow.paraslace.in';
const TEST_PASSWORD = 'TestPass123!';

// Workspace distribution: name → member indices from user[0..19]
const WORKSPACE_CONFIG = [
  {
    name: 'WS-Alpha',
    members: [0, 1, 2, 3, 4, 5],
    boardCount: 3,
    taskCount: 5,
  },
  {
    name: 'WS-Beta',
    members: [0, 2, 4, 6, 8, 10],
    boardCount: 2,
    taskCount: 4,
  },
  {
    name: 'WS-Gamma',
    members: [0, 1, 3, 5, 7, 9],
    boardCount: 3,
    taskCount: 4,
  },
  {
    name: 'WS-Delta',
    members: [0, 6, 7, 8, 9, 10],
    boardCount: 2,
    taskCount: 3,
  },
  {
    name: 'WS-Epsilon',
    members: [0, 11, 12, 13, 14, 15],
    boardCount: 2,
    taskCount: 3,
  },
  {
    name: 'WS-Zeta',
    members: [0, 1, 11, 12, 16, 17],
    boardCount: 2,
    taskCount: 2,
  },
  {
    name: 'WS-Eta',
    members: [0, 2, 13, 14, 18, 19],
    boardCount: 2,
    taskCount: 2,
  },
  {
    name: 'WS-Theta',
    members: [0, 3, 15, 16, 17, 18],
    boardCount: 3,
    taskCount: 3,
  },
  {
    name: 'WS-Iota',
    members: [0, 4, 5, 19, 11, 12],
    boardCount: 2,
    taskCount: 2,
  },
  {
    name: 'WS-Kappa',
    members: [0, 6, 7, 13, 14, 19],
    boardCount: 2,
    taskCount: 2,
  },
];

const PRIORITIES: Array<'low' | 'medium' | 'high' | 'urgent'> = [
  'low',
  'medium',
  'high',
  'urgent',
];

const LABEL_COLORS = [
  '#ef4444',
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
];

const LABEL_NAMES = [
  'Bug',
  'Feature',
  'Enhancement',
  'Documentation',
  'Urgent',
  'Design',
];

function generateEmail(index: number, runId: string): string {
  return `e2e-comp-${runId}-user${index}@example.com`;
}

function generateName(index: number): string {
  const names = [
    'Alice Admin',
    'Bob Builder',
    'Carol Chen',
    'Dave Davis',
    'Eve Edwards',
    'Frank Foster',
    'Grace Green',
    'Hank Harris',
    'Iris Irving',
    'Jack Jones',
    'Kate Kim',
    'Leo Lopez',
    'Mia Moore',
    'Noah Nelson',
    'Olivia Owen',
    'Pat Parker',
    'Quinn Quinn',
    'Rosa Rivera',
    'Sam Smith',
    'Tina Turner',
  ];
  return names[index] || `User ${index}`;
}

function getDueDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  // Backend expects full ISO 8601 UTC datetime (chrono::DateTime<Utc>)
  return d.toISOString();
}

async function globalSetup() {
  const runId = Date.now().toString(36);
  console.log(`[global-setup] Starting seed with runId=${runId}`);

  const ctx = await request.newContext({
    baseURL: BASE_URL,
    ignoreHTTPSErrors: true,
  });

  try {
    // -----------------------------------------------------------------------
    // Step 1: Sign up user[0] (creates tenant)
    // -----------------------------------------------------------------------
    const users: SeedUser[] = [];
    const userIds: string[] = [];

    const email0 = generateEmail(0, runId);
    console.log(`[global-setup] Signing up user[0]: ${email0}`);
    const { user: user0, cookies: cookies0 } = await apiSignUp(
      ctx,
      generateName(0),
      email0,
      TEST_PASSWORD,
    );

    users.push({
      email: email0,
      password: TEST_PASSWORD,
      name: generateName(0),
      id: user0.id,
    });
    userIds.push(user0.id);

    let adminCookies = cookies0;

    // -----------------------------------------------------------------------
    // Step 2: Create 10 workspaces
    // -----------------------------------------------------------------------
    const workspaces: SeedWorkspace[] = [];
    console.log(
      `[global-setup] Creating ${WORKSPACE_CONFIG.length} workspaces...`,
    );

    for (const wsCfg of WORKSPACE_CONFIG) {
      const ws = await apiCreateWorkspace(ctx, adminCookies, wsCfg.name);
      workspaces.push({
        id: ws.id,
        name: ws.name,
        memberIndices: wsCfg.members,
      });
      console.log(`  Created workspace: ${ws.name} (${ws.id})`);
    }

    // -----------------------------------------------------------------------
    // Step 3: Invite users 1-19, each via the first workspace they belong to
    // -----------------------------------------------------------------------
    console.log(`[global-setup] Inviting 19 users...`);

    for (let i = 1; i < 20; i++) {
      const email = generateEmail(i, runId);
      const name = generateName(i);

      // Find the first workspace this user belongs to
      const firstWs = workspaces.find((ws) => ws.memberIndices.includes(i));
      if (!firstWs) {
        throw new Error(`User ${i} is not in any workspace`);
      }

      const invitation = await apiInviteUser(
        ctx,
        adminCookies,
        firstWs.id,
        email,
      );
      const { user: invitedUser, cookies: _invitedCookies } =
        await apiAcceptInvitation(ctx, invitation.token, name, TEST_PASSWORD);

      users.push({ email, password: TEST_PASSWORD, name, id: invitedUser.id });
      userIds.push(invitedUser.id);
      console.log(`  User[${i}] created: ${name} (${invitedUser.id})`);
    }

    // -----------------------------------------------------------------------
    // Step 4: Add members to workspaces
    // -----------------------------------------------------------------------
    console.log(`[global-setup] Adding members to workspaces...`);

    for (const ws of workspaces) {
      for (const memberIdx of ws.memberIndices) {
        if (memberIdx === 0) continue; // user[0] is already a member (creator)
        const userId = userIds[memberIdx];
        try {
          await apiAddWorkspaceMember(ctx, adminCookies, ws.id, userId);
        } catch (err) {
          // May already be a member from invitation acceptance
          console.log(
            `  Note: user[${memberIdx}] may already be in ${ws.name}`,
          );
        }
      }
    }

    // -----------------------------------------------------------------------
    // Step 5: Create labels per workspace
    // -----------------------------------------------------------------------
    const labels: SeedLabel[] = [];
    console.log(`[global-setup] Creating labels...`);

    for (const ws of workspaces) {
      // 2 labels per workspace
      for (let li = 0; li < 2; li++) {
        const labelIdx = (workspaces.indexOf(ws) * 2 + li) % LABEL_NAMES.length;
        try {
          const label = await apiCreateLabel(
            ctx,
            adminCookies,
            ws.id,
            LABEL_NAMES[labelIdx],
            LABEL_COLORS[labelIdx],
          );
          labels.push({
            id: label.id,
            name: label.name,
            color: label.color,
            workspaceId: ws.id,
          });
        } catch (err) {
          console.log(
            `  Warning: Could not create label for ${ws.name}: ${err}`,
          );
        }
      }
    }

    // -----------------------------------------------------------------------
    // Step 6: Create boards per workspace
    // -----------------------------------------------------------------------
    const boards: SeedBoard[] = [];
    console.log(`[global-setup] Creating boards...`);

    const boardNames = ['Sprint Board', 'Backlog', 'Release Planning'];

    for (let wsIdx = 0; wsIdx < WORKSPACE_CONFIG.length; wsIdx++) {
      const wsCfg = WORKSPACE_CONFIG[wsIdx];
      const ws = workspaces[wsIdx];

      for (let bi = 0; bi < wsCfg.boardCount; bi++) {
        const boardName = `${ws.name} - ${boardNames[bi % boardNames.length]}`;
        const board = await apiCreateBoard(ctx, adminCookies, ws.id, boardName);
        boards.push({
          id: board.id,
          name: boardName,
          workspaceId: ws.id,
          columns: (board.columns || []).map((c) => ({
            id: c.id,
            name: c.name,
            position: c.position,
          })),
        });
        console.log(
          `  Board: ${boardName} (${board.columns?.length || 0} columns)`,
        );
      }
    }

    // -----------------------------------------------------------------------
    // Step 7: Create tasks distributed across boards
    // -----------------------------------------------------------------------
    const tasks: SeedTask[] = [];
    console.log(`[global-setup] Creating tasks...`);

    let taskCounter = 0;
    const dueDateOffsets = [-3, -1, 0, 1, 3, 7, 14, 30]; // past-due, today, future

    for (let wsIdx = 0; wsIdx < WORKSPACE_CONFIG.length; wsIdx++) {
      const wsCfg = WORKSPACE_CONFIG[wsIdx];
      const ws = workspaces[wsIdx];
      const wsBoards = boards.filter((b) => b.workspaceId === ws.id);
      const wsLabels = labels.filter((l) => l.workspaceId === ws.id);

      for (let ti = 0; ti < wsCfg.taskCount; ti++) {
        const board = wsBoards[ti % wsBoards.length];
        if (!board.columns.length) {
          console.log(
            `  Warning: Board ${board.name} has no columns, skipping task`,
          );
          continue;
        }

        const column = board.columns[ti % board.columns.length];
        const priority = PRIORITIES[taskCounter % PRIORITIES.length];
        const assigneeIdx = wsCfg.members[(ti + 1) % wsCfg.members.length];
        const hasDueDate = taskCounter % 3 !== 2; // 2/3 of tasks have due dates
        const dueDate = hasDueDate
          ? getDueDate(dueDateOffsets[taskCounter % dueDateOffsets.length])
          : undefined;

        const taskTitle = `Task-${taskCounter + 1}: ${ws.name} ${priority} task`;

        try {
          const task = await apiCreateTask(ctx, adminCookies, board.id, {
            title: taskTitle,
            column_id: column.id,
            priority,
            due_date: dueDate,
            description: `Auto-seeded task for comprehensive E2E testing. Workspace: ${ws.name}, Board: ${board.name}`,
          });

          const seedTask: SeedTask = {
            id: task.id,
            title: taskTitle,
            boardId: board.id,
            columnId: column.id,
            workspaceId: ws.id,
            priority,
            dueDate,
          };

          // Assign task
          if (userIds[assigneeIdx]) {
            try {
              await apiAssignTask(
                ctx,
                adminCookies,
                task.id,
                userIds[assigneeIdx],
              );
              seedTask.assigneeIndex = assigneeIdx;
            } catch {
              console.log(
                `  Warning: Could not assign task to user[${assigneeIdx}]`,
              );
            }
          }

          // Add label to some tasks
          if (wsLabels.length > 0 && taskCounter % 2 === 0) {
            const label = wsLabels[taskCounter % wsLabels.length];
            try {
              await apiAddLabelToTask(ctx, adminCookies, task.id, label.id);
              seedTask.labelIds = [label.id];
            } catch {
              console.log(`  Warning: Could not add label to task`);
            }
          }

          tasks.push(seedTask);
          console.log(`  Task: ${taskTitle} → ${column.name} (${priority})`);
        } catch (err) {
          console.log(`  Error creating task: ${err}`);
        }

        taskCounter++;
      }
    }

    // -----------------------------------------------------------------------
    // Write seed data
    // -----------------------------------------------------------------------
    const seedData: SeedData = {
      users,
      workspaces,
      boards,
      tasks,
      labels,
      timestamp: new Date().toISOString(),
    };

    saveSeedData(seedData);
    console.log(`[global-setup] Seed data written. Summary:`);
    console.log(`  Users: ${users.length}`);
    console.log(`  Workspaces: ${workspaces.length}`);
    console.log(`  Boards: ${boards.length}`);
    console.log(`  Tasks: ${tasks.length}`);
    console.log(`  Labels: ${labels.length}`);
  } finally {
    await ctx.dispose();
  }
}

export default globalSetup;
