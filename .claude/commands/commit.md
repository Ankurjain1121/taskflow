---
name: commit
description: Run checks, commit with AI message, and push
---

1. Run quality checks (fix ALL errors before continuing):
   ```bash
   cd frontend && npx tsc --noEmit --project tsconfig.app.json
   ```
   ```bash
   cd backend && cargo check --release 2>&1 | tail -5
   ```

2. Review changes: `git status` and `git diff --stat`

3. Generate commit message:
   - Start with type: feat/fix/refactor/test/chore/docs
   - Be specific and concise, one line preferred
   - Follow existing repo style from `git log --oneline -5`

4. Stage specific files (not `git add -A`), commit, and push:
   ```bash
   git add <files>
   git commit -m "message"
   git push
   ```
