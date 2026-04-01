#!/usr/bin/env bash
set -euo pipefail

# Generate TypeScript types from Rust structs via ts-rs
# Run from project root: ./scripts/export-types.sh

cd "$(dirname "$0")/.."

TYPES_DIR="$(pwd)/frontend/src/app/shared/types"
mkdir -p "$TYPES_DIR"

echo "Exporting TypeScript types from Rust → $TYPES_DIR"
cd backend
TS_RS_EXPORT_DIR="$TYPES_DIR" cargo test -p taskbolt-db -- export_types --ignored --nocapture 2>&1

echo ""
echo "Generated types:"
ls -la ../frontend/src/app/shared/types/*.ts 2>/dev/null | grep -v '.gitkeep' || echo "  (none found — check for errors above)"

echo ""
echo "Done. Types exported to frontend/src/app/shared/types/"
