#!/bin/bash
set -e

echo "Starting TaskBolt API..."

# Run the application
exec /usr/local/bin/taskbolt-api
