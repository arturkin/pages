#!/usr/bin/env bash
# PostToolUse hook: when any trip's itinerary.md or meta.js is edited, rebuild
# every trip's trip.js (and the index redirect). Reads the tool payload on
# stdin; only acts if a trip source file was the target.
payload=$(cat)
case "$payload" in
  *itinerary.md*|*meta.js*)
    dir="${CLAUDE_PROJECT_DIR:-.}"
    if out=$(node "$dir/assets/sync.js" 2>&1); then
      echo "↻ trips synced — $out"
    else
      echo "⚠ trip sync FAILED:"
      echo "$out"
    fi
    ;;
esac
exit 0
