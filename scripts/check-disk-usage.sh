#!/bin/bash
# Check disk usage of Docker volumes for TaskBolt
# Usage: ./scripts/check-disk-usage.sh
# Warns if MinIO data volume exceeds 5GB

set -euo pipefail

WARN_THRESHOLD_GB=5

echo "=== TaskBolt Docker Volume Disk Usage ==="
echo "Timestamp: $(date -Iseconds)"
echo ""

docker system df -v 2>/dev/null | grep -E "VOLUME|taskbolt" || {
  echo "ERROR: Could not read docker volume info."
  exit 1
}

echo ""

# Check minio-data volume size
MINIO_SIZE=$(docker system df -v 2>/dev/null | grep "taskbolt_minio-data" | awk '{print $NF}' | head -1)
if [ -n "$MINIO_SIZE" ]; then
  echo "MinIO data volume: $MINIO_SIZE"

  # Parse size to GB for comparison
  SIZE_NUM=$(echo "$MINIO_SIZE" | grep -oP '[\d.]+')
  SIZE_UNIT=$(echo "$MINIO_SIZE" | grep -oP '[A-Z]+')

  EXCEEDS=0
  case "$SIZE_UNIT" in
    GB)
      if [ "$(echo "$SIZE_NUM > $WARN_THRESHOLD_GB" | bc -l 2>/dev/null)" = "1" ]; then
        EXCEEDS=1
      fi
      ;;
    TB)
      EXCEEDS=1
      ;;
  esac

  if [ "$EXCEEDS" -eq 1 ]; then
    echo "WARNING: MinIO data volume ($MINIO_SIZE) exceeds ${WARN_THRESHOLD_GB}GB threshold!"
    exit 1
  else
    echo "MinIO volume within limits (threshold: ${WARN_THRESHOLD_GB}GB)."
  fi
else
  echo "MinIO data volume not found (may not be created yet)."
fi
