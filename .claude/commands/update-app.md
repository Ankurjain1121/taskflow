---
name: update-app
description: Update dependencies and fix deprecations (frontend + backend)
---

## Frontend (npm)

```bash
cd frontend && npm outdated
npm update && npm audit fix
```

Look for deprecations, peer warnings, security issues. Fix all before continuing.

```bash
rm -rf node_modules package-lock.json && npm install
npx tsc --noEmit --project tsconfig.app.json
```

## Backend (Cargo)

```bash
cd backend && cargo outdated   # requires: cargo install cargo-outdated
cargo update
cargo check --workspace --all-targets
cargo clippy --workspace --all-targets -- -D warnings
cargo fmt --all -- --check
```

Fix ALL errors and warnings before finishing.
