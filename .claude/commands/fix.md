---
name: fix
description: Run typechecking and linting, then spawn parallel agents to fix all issues
---

# Project Code Quality Check

Run all linting and typechecking tools for this monorepo (Angular frontend + Rust backend), collect errors, group by domain, and spawn parallel agents to fix them.

## Step 1: Run Linting and Typechecking

Run these commands and capture all output:

**Backend (Rust):**
```bash
cd backend
cargo check --workspace --all-targets 2>&1
cargo clippy --workspace --all-targets -- -D warnings 2>&1
cargo fmt --all -- --check 2>&1
cd ..
```

**Frontend (Angular/TypeScript):**
```bash
cd frontend
npx tsc --noEmit 2>&1
npm run build -- --configuration=production 2>&1
cd ..
```

## Step 2: Collect and Parse Errors

Parse the output from Step 1. Group errors by domain:
- **Backend type errors**: Rust compiler errors from `cargo check`
- **Backend lint errors**: Clippy warnings from `cargo clippy`
- **Backend format errors**: Rustfmt violations from `cargo fmt --check`
- **Frontend type errors**: TypeScript compiler errors (`error TS####`)
- **Frontend template errors**: Angular template errors (`error NG####`)
- **Frontend build errors**: Angular build errors

Create a list of all files with issues and the specific problems in each file.

## Step 3: Spawn Parallel Agents

For each domain that has issues, spawn an agent in parallel using the Task tool:

**IMPORTANT**: Use a SINGLE response with MULTIPLE Task tool calls to run agents in parallel.

Backend agents:
- Spawn a **"rust-compiler-fixer"** agent for Rust compilation errors
- Spawn a **"rust-clippy-fixer"** agent for Clippy lint warnings
- Spawn a **"rust-fmt-fixer"** agent for format violations

Frontend agents:
- Spawn a **"ts-type-fixer"** agent for TypeScript type errors
- Spawn a **"ng-template-fixer"** agent for Angular template errors
- Spawn a **"ng-build-fixer"** agent for Angular build errors

Each agent should:
1. Receive the list of files and specific errors in their domain
2. Fix all errors in their domain using Edit tool (minimal changes only)
3. Run the relevant check command to verify fixes
4. Report completion

## Step 4: Verify All Fixes

After all agents complete, run the full checks again:

**Backend:**
```bash
cd backend
cargo check --workspace --all-targets
cargo clippy --workspace --all-targets -- -D warnings
cargo fmt --all -- --check
cd ..
```

**Frontend:**
```bash
cd frontend
npx tsc --noEmit
npm run build -- --configuration=production
cd ..
```

Confirm zero errors. Frontend bundle size warnings are acceptable.
