# Beginner Guide: Fantasy Master DB Sync

This guide is written for beginners who know basic Node.js but are new to TypeScript and web scraping.

## What is this project?

`fantasy-master-db-sync` is a tool that keeps a Google Sheets spreadsheet up to date with data from Transfermarkt.

Think of it like a small script you run from Node.js. Instead of working with a database, it works with Google Sheets, and instead of reading a file, it reads information from web pages.

## What does the tool do?

It:

- Opens Transfermarkt league pages in an automated browser.
- Finds every club in a league.
- Goes to each club's squad page.
- Reads player details like name, position, club, league, nationality, profile link, and image link.
- Compares the scraped data with existing rows in Google Sheets.
- Inserts new player rows.
- Updates changed rows only when needed.
- Writes a sync log with run statistics.

## Why this is useful

If your fantasy football project uses a shared spreadsheet as the master data source, this tool updates that sheet automatically.

It avoids manual copy/paste, and it tries not to overwrite admin decisions unless source data changes.

## How this is like Node.js

If you know Node.js, the basics are the same:

- `npm install` installs packages.
- `npm run sync` runs a script.
- There is an entry point file that starts the process.
- There are modules that each do one job.

The main difference is the code uses TypeScript, which is like JavaScript with extra type checks.
That helps catch errors before running the script, but the runtime commands are still the same.

## What is TypeScript and why does it matter?

TypeScript is a version of JavaScript that adds types like `string`, `number`, and `boolean`.

For example:

- In Node.js you might write `let name = 'Alice';`
- In TypeScript you can write `let name: string = 'Alice';`

This project is written in TypeScript, but you do not need to learn the language to use it.
It is already configured to run with `ts-node`, which lets you execute TypeScript files directly.

## What is web scraping?

Web scraping means reading data from web pages automatically.

In Node.js, you might use `fetch()` or `axios` to get data from an API.
In this project, we use Playwright to open web pages like a browser and read the data from the page content.

So instead of using a public API, this script behaves like a browser that reads pages and extracts information.

## Why the newer version runs faster

The older version of this tool was much more conservative. It did a lot of work one small step at a time, which made it safe but slow.

The newer version speeds things up in a few simple ways:

- It blocks unnecessary page assets like images, fonts, and styles while scraping.
- It processes up to 2 clubs at the same time.
- It reads each club squad page in one browser pass instead of checking every row separately.
- It groups player writes for a club into batches instead of sending one Google Sheets write per player.
- It spaces out Google Sheets writes so the faster scrape does not overwhelm the sheet quota.

In plain English: the browser part is faster, and the sheet-writing part is smarter. That gives you more speed without turning the sync into a quota-failure machine.

## Main parts of the project

Here are the important folders and files:

- `src/cli.ts`
  - The starting point of the tool.
  - Equivalent to a `main.js` script in Node.js.

- `src/config/env.ts`
  - Loads environment variables from `.env`.
  - Similar to using `process.env.VAR_NAME` in Node.

- `src/scrapers/transfermarkt/`
  - Code that reads Transfermarkt pages.
  - `leagueScraper.ts` gets clubs from a league page.
  - `playerScraper.ts` gets players from a club squad page.

- `src/google/`
  - Code that reads and writes Google Sheets.
  - It creates sheets if they do not exist.

- `src/services/syncService.ts`
  - Coordinates the scraping and the sheet updates.
  - Think of it as the orchestration script.

- `src/services/diffService.ts`
  - Compares scraped player data with existing sheet data.
  - Decides whether to insert, update, or skip.

- `src/utils/`
  - `logger.ts` prints messages.
  - `retry.ts` retries failed operations.
  - `rateLimiter.ts` adds pauses between web requests.

## Setup steps

### 1. Install Node.js

You need Node.js 18 or newer.
If you already have Node.js working, you can skip this.

### 2. Install dependencies

In the terminal, run:

```bash
npm install
```

This downloads the packages the project needs.

### 3. Install Playwright browser support

This project uses Playwright to simulate a browser.
Install Chromium with:

```bash
npx playwright install chromium
```

### 4. Create your `.env` file

A template file named `.env.example` exists.
Create a copy called `.env`:

```bash
cp .env.example .env
```

Then fill in the required values.

### 5. Fill in required environment values

Open `.env` and set:

- `GOOGLE_SPREADSHEET_ID`
- `GOOGLE_SERVICE_ACCOUNT_JSON`

The `.env` file is ignored by Git, so your secrets stay private.

## Google Sheets setup

You need an existing Google Sheet that the script will update.

1. Create or open a spreadsheet.
2. Share it with your Google service account email using Editor permissions.
3. Put the spreadsheet ID in `GOOGLE_SPREADSHEET_ID`.
4. Put the JSON contents of the service account key in `GOOGLE_SERVICE_ACCOUNT_JSON`.

## How to run the tool

### Dry run first

This checks what the tool would do without writing changes.

```bash
npm run sync:dry
```

### Real sync

After the dry run looks good, run the actual sync:

```bash
npm run sync
```

## What happens during a sync

The tool follows this flow:

1. Load environment variables from `.env`.
2. Start Google Sheets access.
3. Ensure the required sheets exist.
4. Load existing player and club rows from Google Sheets.
5. Open the Transfermarkt browser.
6. For each league, find all clubs.
7. For each club, load the squad and extract player data.
8. Compare each player to the sheet.
9. Insert or update rows as needed.
10. Record a summary in the `Sync Log` sheet.

Compared to the older version, the main differences are:

- clubs are scraped in parallel instead of strictly one at a time,
- squad pages are parsed in one pass instead of row-by-row,
- writes are batched per club,
- and the Google Sheets client throttles writes so the sync can keep going without hammering the API.

## What data is stored in Google Sheets

The tool works with these sheets:

- `Players`
- `Clubs`
- `Position Mapping`
- `Sync Log`

It will create these sheets if they are missing.

## Beginner-friendly comparison to Node.js

If you know Node.js, here are the closest equivalents:

- `npm install` = install packages
- `npm run sync` = run a Node script
- `src/cli.ts` = the `index.js` you would run
- `process.env` = environment variables from `.env`
- `logger.info()` = `console.log()` in Node
- `async/await` = same as modern JavaScript
- `new Map()` = same as in Node.js

TypeScript adds types, but the runtime workflow is the same as Node.js.
You still run commands from the terminal and the program still communicates with external systems.

## Troubleshooting

- If the tool says `.env` is missing, make sure you copied `.env.example` to `.env`.
- If Google Sheets fails, check your spreadsheet ID and service account access.
- If scraping fails, Transfermarkt may have changed its page layout.
  In that case, the selector definitions in `src/scrapers/transfermarkt/constants.ts` may need updates.

## Notes for beginners

- You do not need to learn all of TypeScript to use this project.
- Focus on the setup and the commands.
- If something goes wrong, read the error message and check the corresponding file.
- The code is organized so the browser logic, Google Sheets logic, and sync logic are separated.

## Summary

This project is a Node.js-style automation tool that:

- reads data from web pages,
- compares it with Google Sheets,
- updates the sheet safely,
- and logs the result.

The key tasks for you are:

1. install dependencies,
2. create `.env`,
3. add Google credentials,
4. run `npm run sync:dry`,
5. then run `npm run sync`.

Good luck! If you know basic Node.js, you can use this project successfully without needing to become a TypeScript expert first.
