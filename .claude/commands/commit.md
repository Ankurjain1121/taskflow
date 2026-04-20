---
name: commit
description: Run checks, commit with AI message, and push
---

1. Quality checks (fix ALL errors before continuing):
   ```bash
   ./scripts/quick-check.sh
   ```
   Falls back per-stack if `quick-check.sh` is missing:
   ```bash
   cd backend && cargo check --workspace --all-targets
   cd frontend && npx tsc --noEmit
   ```

2. Review: `git status --short` and `git diff --stat`.

3. Generate commit message:
   - Start with type: feat/fix/refactor/test/chore/docs
   - Be specific + concise, one line preferred
   - Match repo style from `git log --oneline -5`

4. Stage specific files (never `git add -A`), commit, push:
   ```bash
   git add <files>
   git commit -m "<type>(<scope>): <summary>"
   git push
   ```
