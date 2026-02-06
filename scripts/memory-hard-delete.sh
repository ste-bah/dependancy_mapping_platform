#!/bin/bash
# Hard delete from ClaudeFlow memory (bypasses soft-delete bug)
# Usage: ./memory-hard-delete.sh "key-pattern"

KEY_PATTERN="${1:-}"
DB_PATH=".swarm/memory.db"

if [ -z "$KEY_PATTERN" ]; then
  echo "Usage: $0 <key-pattern>"
  echo "Example: $0 'coding/batch%'"
  exit 1
fi

if [ ! -f "$DB_PATH" ]; then
  echo "Database not found at $DB_PATH"
  exit 1
fi

COUNT_BEFORE=$(/usr/bin/sqlite3 "$DB_PATH" "SELECT count(*) FROM memory_entries WHERE key LIKE '$KEY_PATTERN';")
/usr/bin/sqlite3 "$DB_PATH" "DELETE FROM memory_entries WHERE key LIKE '$KEY_PATTERN';"
COUNT_AFTER=$(/usr/bin/sqlite3 "$DB_PATH" "SELECT count(*) FROM memory_entries WHERE key LIKE '$KEY_PATTERN';")

echo "Deleted $((COUNT_BEFORE - COUNT_AFTER)) entries matching '$KEY_PATTERN'"
