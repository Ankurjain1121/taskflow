#!/bin/bash
# Monitor memory usage of all TaskBolt Docker containers
# Usage: ./scripts/monitor-memory.sh
# Warns if any container exceeds 80% of its memory limit

set -euo pipefail

WARN_THRESHOLD=80

echo "=== TaskBolt Container Memory Usage ==="
echo "Timestamp: $(date -Iseconds)"
echo ""

docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.PIDs}}" \
  --filter "name=taskbolt-" 2>/dev/null || {
    echo "ERROR: Could not read docker stats. Are containers running?"
    exit 1
  }

echo ""

# Check for containers exceeding threshold
ALERTS=0
while IFS= read -r line; do
  name=$(echo "$line" | awk '{print $1}')
  pct=$(echo "$line" | awk '{print $2}' | tr -d '%')

  if [ -z "$pct" ] || [ "$pct" = "0.00" ]; then
    continue
  fi

  pct_int=${pct%%.*}
  if [ "$pct_int" -ge "$WARN_THRESHOLD" ] 2>/dev/null; then
    echo "WARNING: $name is at ${pct}% memory usage (threshold: ${WARN_THRESHOLD}%)"
    ALERTS=$((ALERTS + 1))
  fi
done < <(docker stats --no-stream --format "{{.Name}} {{.MemPerc}}" --filter "name=taskbolt-" 2>/dev/null)

if [ "$ALERTS" -eq 0 ]; then
  echo "All containers within memory limits."
else
  echo ""
  echo "$ALERTS container(s) exceeding ${WARN_THRESHOLD}% memory threshold!"
  exit 1
fi
