# Fantasy Master DB Sync

Fantasy Master DB Sync is a TypeScript service that keeps a Google Sheets master player database in sync with Transfermarkt.

It is designed for a fantasy football workflow where the spreadsheet is the source of truth for clubs, players, positions, and review status.

## What it does

- Scrapes league pages on Transfermarkt.
- Follows each club to its squad page.
- Extracts player identity, position, club, league, nationality, profile URL, and image URL.
- Compares the scraped data with the current Google Sheet rows.
- Inserts new players, updates changed players, and leaves untouched rows alone.
- Records a run summary in a sync log sheet.

## Why this repo exists

This project replaces manual copy-paste work with a repeatable sync flow that:

- keeps the sheet current,
- preserves existing admin edits unless source data changes,
- and gives you a clear audit trail for every run.

## How it works

```text
Transfermarkt league page
  -> club pages
  -> squad pages
  -> player records
  -> diff against Google Sheets
  -> append or update only what changed
```

The scraping and spreadsheet layers are intentionally separated:

- `src/scrapers/transfermarkt/` handles browser automation and parsing.
- `src/services/` coordinates the sync and diffing rules.
- `src/google/` handles Google Sheets reads and writes.
- `src/utils/` contains retry, logging, and rate limiting helpers.

## Repository layout

```text
src/
  cli.ts                      Command-line entry point
  config/                     Environment loading and validation
  scrapers/transfermarkt/     Playwright scrapers for clubs and squads
  services/                   Diffing, orchestration, and position mapping
  google/                    Google Sheets repositories and client wrapper
  types/                     Shared TypeScript types
  utils/                     Logger, retry, and rate limiting helpers
scripts/
  debugClubSquad.ts           Manual backfill for a single club into Debug Squad
```

## Requirements

- Node.js 18 or newer
- A Google Cloud service account with Sheets access
- A Google Spreadsheet shared with that service account
- Playwright Chromium installed locally

## Quick start

```bash
npm install
npx playwright install chromium
cp .env.example .env
```

Then fill in `.env` with your spreadsheet ID and service account JSON.

## Configuration

`src/config/env.ts` reads these environment variables:

| Variable | Required | Purpose |
| --- | --- | --- |
| `GOOGLE_SPREADSHEET_ID` | Yes | ID of the spreadsheet to keep in sync |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Yes | Inline JSON or a path to a service account JSON file |
| `TRANSFERMARKT_BASE_URL` | No | Transfermarkt host to scrape, defaults to `https://www.transfermarkt.com` |
| `REQUEST_DELAY_MS` | No | Delay between outbound web requests, defaults to `1500` |
| `NAVIGATION_TIMEOUT_MS` | No | Playwright navigation timeout, defaults to `30000` |
| `MAX_RETRIES` | No | Retry count for failed requests, defaults to `3` |

If Transfermarkt times out on `.com`, the repo also supports `.co.in` or another regional host through `TRANSFERMARKT_BASE_URL`.

## Google Sheets setup

Before running the sync:

1. Create or open the target spreadsheet.
2. Share it with the Google service account email using Editor access.
3. Put the spreadsheet ID into `GOOGLE_SPREADSHEET_ID`.
4. Put the service account JSON into `GOOGLE_SERVICE_ACCOUNT_JSON` or point that variable at a local JSON file.

The sync uses these tabs:

- `Players`
- `Clubs`
- `Position Mapping`
- `Sync Log`
- `Debug Squad` for manual backfills

## Available scripts

| Command | Purpose |
| --- | --- |
| `npm run build` | Type-check and compile the project |
| `npm run sync` | Run the full sync |
| `npm run sync -- --resume` | Resume a partially completed sync |
| `npm run sync:dry` | Run the sync without writing changes |
| `npm run debug:club -- "Lazio"` | Backfill one club into `Debug Squad` |

## Sync behavior

The sync is designed to be safe and incremental:

- Players are matched by Transfermarkt player ID.
- New players are inserted with `Status = Pending`.
- Club, league, and primary position changes mark the row as `Needs Review`.
- Nationality, profile URL, and image URL changes update quietly.
- Unchanged rows are skipped.
- `lastSeen` is refreshed when a player is observed again.

For transfers:

- If a player moves clubs but keeps the same Transfermarkt ID, the row is updated in place.
- If a new player appears in a club squad, a new row is inserted automatically.
- If a player disappears from the leagues being scanned, the row is not deleted automatically; `lastSeen` can be used later to identify stale rows.

`--resume` is meant for interrupted runs. It continues processing clubs that were not completed yet.

## Debug backfill workflow

If a club was missed during a run, use the debug script:

```bash
npm run debug:club -- "Lazio"
```

That script writes into `Debug Squad` using the same player column schema as `Players`, so the rows can be reviewed and copied into the main sheet if needed.

The debug import is idempotent:

- repeated runs skip rows that are already present,
- and it only appends missing players for that club.

## Performance notes

The current version is faster and more stable than the earlier implementation because it:

- blocks unnecessary page assets like images, fonts, and styles,
- scrapes clubs in parallel,
- parses each squad page in one browser pass,
- batches player writes per club,
- and serializes Google Sheets writes to avoid quota spikes.

That means the browser side runs faster, while the spreadsheet side stays within Google’s write limits.

## Troubleshooting

- If scraping fails on Transfermarkt, check whether the page selectors in `src/scrapers/transfermarkt/constants.ts` still match the live site.
- If Google authentication fails, verify the service account JSON and spreadsheet sharing permissions.
- If writes slow down or return quota errors, increase `REQUEST_DELAY_MS` in `.env` and rerun later.
- If you need to continue a partially completed run, use `npm run sync -- --resume`.

## Notes for publishing on GitHub

- Do not commit `.env`.
- Do not commit service account JSON files.
- Keep generated scratch folders out of the repo.

The repo is now structured so it can be published cleanly as a public source project while keeping local secrets and transient work files out of version control.

