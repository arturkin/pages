---
name: airbnb-search
description: Search Airbnb listings with prices, ratings, and direct links. No user API key required (uses Airbnb's public frontend API key). Use when searching for Airbnb stays, vacation rentals, or accommodation pricing.
license: MIT
metadata:
  author: Olafs-World
  version: "0.1.3"
  source: https://github.com/Olafs-World/airbnb-search
---

# Airbnb Search

Search Airbnb listings from the command line. Returns prices, ratings, and direct booking links.

## Requirements

- Python 3.8+
- `requests` library (auto-installed via `uv run --with`)

## Quick Start

Run from the repo root (the script adds its own package dir to the path, so cwd doesn't matter):

```bash
# Run directly (no install needed)
uv run --with requests .claude/skills/airbnb-search/scripts/airbnb-search.py \
  "Montalcino, Italy" --checkin 2026-10-04 --checkout 2026-10-10

# JSON output
uv run --with requests .claude/skills/airbnb-search/scripts/airbnb-search.py \
  "Monte Argentario, Italy" --checkin 2026-10-10 --checkout 2026-10-14 --json
```

## Options

```
query                Search location (e.g., "Steamboat Springs, CO")
--checkin, -i DATE   Check-in date (YYYY-MM-DD)
--checkout, -o DATE  Check-out date (YYYY-MM-DD)
--min-price N        Minimum price filter
--max-price N        Maximum price filter
--min-bedrooms N     Minimum bedrooms filter
--limit N            Max results (default: 50)
--json               Output as JSON
--format FORMAT      table or json (default: table)
```

## Example Output

```
📍 Steamboat Springs, CO
📊 Found 300+ total listings

==========================================================================================
Cozy Mountain Cabin 🏆
  2BR/1BA | ⭐4.92 | 127 reviews
  💰 $407 total
  🔗 https://airbnb.com/rooms/12345678
```

## Notes

- Dates are required for accurate pricing
- Prices include cleaning fees in the total
- No user API key needed — uses Airbnb's public frontend API key (hardcoded, same key used by airbnb.com in the browser)
- May break if Airbnb changes their internal GraphQL API (it rotates the `sha256Hash` in `airbnb_search/search.py`)
- Be respectful of rate limits

## Links

- [PyPI](https://pypi.org/project/airbnb-search/)
- [GitHub](https://github.com/Olafs-World/airbnb-search)
