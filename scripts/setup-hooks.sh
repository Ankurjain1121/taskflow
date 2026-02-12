#!/bin/sh
# =============================================================================
# TaskFlow - Git Hooks Setup
# =============================================================================
# Run once after cloning to enable pre-commit hooks.
# Usage: ./scripts/setup-hooks.sh
# =============================================================================

echo "Setting up git hooks..."

# Point git to our .githooks directory
git config core.hooksPath .githooks

# Make hooks executable (needed on Unix/Mac/WSL)
chmod +x .githooks/* 2>/dev/null || true

echo ""
echo "Done! Pre-commit hooks are now active."
echo ""
echo "What happens on every commit:"
echo "  1. Scans for hardcoded secrets"
echo "  2. Checks for console.log / debugger"
echo "  3. TypeScript type-check (if frontend files changed)"
echo "  4. Rust code quality warnings"
echo "  5. SQL migration safety"
echo "  6. Large file detection"
echo ""
echo "To skip (emergencies only): git commit --no-verify"
echo ""
