---
name: fix
description: Run typechecking and linting, then spawn parallel agents to fix all issues
---

# Project Code Quality Check

Run all linting and typechecking tools for this monorepo (Angular frontend + Rust backend), collect errors, group by domain, and spawn parallel agents to fix them.

## Step 1: Run Linting and Typechecking

Run these commands and capture all output:

**Frontend (Angular/TypeScript):**
```bash
cd frontend && npx ng build --configuration=production 2>&1 | grep -E "ERROR|error TS|Warning"
```

**Backend (Rust) — Docker only (Windows path has spaces):**
```bash
ssh vps-ankur "cd /home/ankur/taskflow/backend && docker compose -f ../docker-compose.yml exec backend cargo clippy -- -D warnings 2>&1" || echo "Backend check requires VPS access"
```

## Step 2: Collect and Parse Errors

Parse the output from Step 1. Group errors by domain:
- **Type errors**: TypeScript compiler errors (`error TS####`)
- **Template errors**: Angular template errors (`error NG####`)
- **Build warnings**: Budget warnings, selector warnings
- **Rust lint**: Clippy warnings from backend

Create a list of all files with issues and the specific problems in each file.

## Step 3: Spawn Parallel Agents

For each domain that has issues, spawn an agent in parallel using the Task tool:

**IMPORTANT**: Use a SINGLE response with MULTIPLE Task tool calls to run agents in parallel.

- Spawn a **"type-fixer"** agent for TypeScript/Angular type errors
- Spawn a **"template-fixer"** agent for Angular template errors
- Spawn a **"rust-fixer"** agent for Clippy warnings (if VPS accessible)

Each agent should:
1. Receive the list of files and specific errors in their domain
2. Fix all errors in their domain using Edit tool (minimal changes only)
3. Run the relevant check command to verify fixes
4. Report completion

## Step 4: Verify All Fixes

After all agents complete, run the full frontend build again:
```bash
cd frontend && npx ng build --configuration=production
```

Confirm zero errors. Warnings about bundle size budget are acceptable.
