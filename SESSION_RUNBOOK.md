# Session Runbook — Fantasy Master DB Sync

This file records the interactive session work, state, actions, and recovery steps so the project can be continued or reproduced later.

Generated: 2026-07-21 (local session)

---

**Workspace:** c:/Users/jinesh/Downloads/fantasy-master-db-sync

## Purpose

Document what we did in this session, current environment, commands to reproduce, a checklist, and troubleshooting steps for common failures (network, Playwright, Google credentials, selector breakage).

## What we did (summary)

- Installed dependencies (`npm install`).
- Installed Playwright Chromium (`npx playwright install chromium`).
- Built the project (`npm run build`).
- Created `.env` from `.env.example` and filled values locally.
- Updated `GOOGLE_SERVICE_ACCOUNT_JSON` handling to accept a file path in `src/config/env.ts`.
- Detected region-based connectivity issues to Transfermarkt `.com` and switched to `.co.in` by updating `.env`.
- Added Playwright page resource blocking in `src/scrapers/transfermarkt/browser.ts` to skip images, fonts, and styles for faster squad-page loads.
- Added a parallel worker pool in `src/services/syncService.ts` so up to 2 clubs can be scraped concurrently while a shared rate limiter keeps the request rate safe.
- Switched club processing to write player rows in batches per club, then serialize all Google Sheets mutations through one throttled queue in `src/google/sheetsClient.ts`. This keeps the sync fast on the scrape side while avoiding quota bursts on the write side.
- Added `Last Seen` tracking for player rows in `src/types/player.ts`, `src/google/playersSheet.ts`, and `src/services/diffService.ts`, so every observed player row is refreshed even if no other fields changed.
- Extended position mapping in `src/services/positionMapper.ts` to recognize full Transfermarkt labels like `Centre-Back`, `Defensive Midfield`, `Centre-Forward`, etc.
- Added a safe debug workflow: `scripts/debugClubSquad.ts` now scrapes a specified club and writes rows to a separate `Debug Squad` sheet using the same `Players` column schema, so it can be reviewed and merged after the main sync without disrupting the live run. It is idempotent: a retry checks existing Transfermarkt player IDs and appends only missing rows.
- Started a new full sync run after the edits; the previous run was interrupted and has been stopped.

## Why this version is faster than the old one

The old version mostly did everything one row at a time, which meant a lot of tiny Google Sheets writes and a slower overall crawl.

The current version is faster in a few specific ways:

- It blocks page assets like images, fonts, and styles during scraping.
- It scrapes up to 2 clubs at once instead of strictly one club at a time.
- It reads each squad page in one DOM pass instead of many row-by-row Playwright lookups.
- It buffers player inserts and updates for a club, then writes them in a batch.
- It serializes and spaces Google Sheets writes so the sync can keep moving without quota bursts.

The result is that the browser work finishes faster, while the write side stays controlled enough to keep the run automatic.

Files changed in this session:

- [src/config/env.ts](src/config/env.ts) — now accepts either inline JSON or a path to a JSON file for `GOOGLE_SERVICE_ACCOUNT_JSON`.
- [.env](.env) — `TRANSFERMARKT_BASE_URL` set to `https://www.transfermarkt.co.in` for this environment.
- [src/scrapers/transfermarkt/browser.ts](src/scrapers/transfermarkt/browser.ts) — blocks unnecessary page resources during scraping.
- [src/services/syncService.ts](src/services/syncService.ts) — adds a parallel club worker pool with a shared rate limiter.
- [src/types/player.ts](src/types/player.ts) — adds `lastSeen` to the player record.
- [src/google/playersSheet.ts](src/google/playersSheet.ts) — supports the `Last Seen` sheet column.
- [src/services/diffService.ts](src/services/diffService.ts) — updates `lastSeen` for every scraped player and backfills fantasy position logic.
- [src/services/positionMapper.ts](src/services/positionMapper.ts) — expands mapping to full position strings and adds `Centre-Forward` support.

(If you want to see the exact edits, open the files above.)

## Current environment & important values

- OS: Windows (session ran on user's machine)
- Node: project requires `node >= 18` (see `package.json`)
- Playwright: installed (`npx playwright --version` reported a version)
- `GOOGLE_SPREADSHEET_ID`: set in `.env` (not printed here for security)
- `GOOGLE_SERVICE_ACCOUNT_JSON`: currently set to a local file path: `./credentials/fantasy-football-sync-68fa847f7bb9.json`

Important local files:

- [src/config/env.ts](src/config/env.ts)
- [.env](.env)
- [credentials/fantasy-football-sync-68fa847f7bb9.json](credentials/fantasy-football-sync-68fa847f7bb9.json)

## Commands you can run locally

Install and build (one-time):

```bash
npm install
npx playwright install chromium
npm run build
```

Dry-run (safe; logs changes, does not write players/clubs or sync log):

```bash
npm run sync:dry
```

Full sync (writes to the spreadsheet):

```bash
npm run sync
```

Add a missed club to the separate `Debug Squad` sheet (safe to retry):

```bash
npm run debug:club -- "Lazio"
```

The command reports `Added N rows; skipped N already-present players.`. Do not use the old `debugAstonVilla.ts` filename; the supported script is `debugClubSquad.ts`.

If you need to change the Transfermarkt host (e.g., `.co.in` vs `.com`), edit `.env`:

```bash
# in project root
# edit .env and change the line:
TRANSFERMARKT_BASE_URL=https://www.transfermarkt.co.in
```

If you use a local JSON file for the Google service account, `src/config/env.ts` accepts a path (relative to project root) or inline JSON. Example in `.env`:

```
GOOGLE_SERVICE_ACCOUNT_JSON=./credentials/fantasy-football-sync-68fa847f7bb9.json
```

Or paste the entire JSON as a single-line value (less recommended for security).

## Troubleshooting checklist (ordered)

1. Network/timeouts to Transfermarkt
   - If `transfermarkt.com` times out but `transfermarkt.co.in` works, set `TRANSFERMARKT_BASE_URL` accordingly.
   - Confirm with:
     ```bash
     curl -I -L "https://www.transfermarkt.co.in/premier-league/startseite/wettbewerb/GB1"
     ```
   - If both fail, test DNS and traceroute (`nslookup`, `tracert`) and try a different network or proxy.

2. Playwright failures
   - Re-install browser binaries:
     ```bash
     npx playwright install chromium
     ```
   - Try running Playwright in headful mode (edit `src/scrapers/transfermarkt/browser.ts` to set `headless: false`) and watch the browser.

3. Google Sheets / Service account errors
   - Ensure the spreadsheet is shared with the service account email listed in the JSON file.
   - If `GOOGLE_SERVICE_ACCOUNT_JSON` is a path, ensure the file exists and is readable by the process.
   - Look for auth-related errors printed by the program.

4. Selector changes (scraping returns zero items)
   - Inspect `src/scrapers/transfermarkt/constants.ts` and compare the selectors with the live page structure in your browser.
   - Update selectors accordingly and re-run `npm run sync:dry`.

5. Rate limiting or bans
   - Increase `REQUEST_DELAY_MS` in `.env` (default 1500 ms). Also increase `MAX_RETRIES` and `NAVIGATION_TIMEOUT_MS` if necessary.

## Recovery steps if the session is lost or you need to continue later

1. Re-open the workspace and check `SESSION_RUNBOOK.md` (this file) for context.
2. Re-run the one-line verification commands below to confirm environment:

```bash
npm install
npm run build
npx playwright --version
curl -I -L "${TRANSFERMARKT_BASE_URL:-https://www.transfermarkt.co.in}/premier-league/startseite/wettbewerb/GB1"
```

3. If you need to re-run the same dry-run we ran here, run:

```bash
npm run sync:dry
```

4. If you changed `src/config/env.ts` locally and want to revert to the upstream version, use your VCS (git) to discard changes.

## How to change models or external tooling used by the assistant

- The assistant/model used to interact here is independent from this codebase. If you need a different assistant model, that is an external configuration in your tooling and not part of the repo. Make a note in this runbook about desired model changes and record the timestamp and reason.
- If the repo includes automated AI tooling later, record where to configure the model in repo docs. (No code changes were made that depend on the assistant model in this session.)

## Security notes

- Never commit `.env` or service account JSON to git. `.gitignore` already excludes `.env`.
- The service account JSON contains a private key — keep it secure and rotate if accidentally exposed.

## Open tasks and next steps

- [ ] Decide whether to run the real sync (`npm run sync`) after verifying the dry-run output.
- [ ] Add automated tests for scrapers (future improvement).
- [ ] Consider adding a `--no-sheets` flag if you want a run that doesn't even create missing sheets during dry runs.
- [ ] Monitor the new parallel worker behavior and ensure the shared rate limiter keeps total requests within `0.5–1 req/sec`.

---

End of runbook.
