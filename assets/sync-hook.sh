#!/usr/bin/env bash
# PostToolUse hook: when itinerary.md is edited, regenerate assets/trip.js.
# Reads the tool payload on stdin; only acts if itinerary.md was the target.
payload=$(cat)
case "$payload" in
  *itinerary.md*)
    dir="${CLAUDE_PROJECT_DIR:-.}"
    if out=$(node "$dir/assets/sync.js" 2>&1); then
      echo "↻ trip.js synced from itinerary.md — $out"
    else
      echo "⚠ trip.js sync FAILED:"
      echo "$out"
    fi
    ;;
esac
exit 0
