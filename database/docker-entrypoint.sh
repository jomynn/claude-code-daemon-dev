#!/bin/bash
set -e

# Use the standard PostgreSQL entrypoint
exec docker-entrypoint.sh "$@"