#!/bin/bash
set -e

echo "Starting TaskFlow API..."

# Run the application
exec /usr/local/bin/taskflow-api
