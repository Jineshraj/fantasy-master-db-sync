import { BrowserSession } from "../scrapers/transfermarkt/browser";
import { LeagueScraper } from "../scrapers/transfermarkt/leagueScraper";
import { PlayerScraper } from "../scrapers/transfermarkt/playerScraper";
import { SUPPORTED_LEAGUES } from "../scrapers/transfermarkt/constants";
import { SheetsClient } from "../google/sheetsClient";
import { PlayersSheetRepository } from "../google/playersSheet";
import { ClubsSheetRepository } from "../google/clubsSheet";
import { PositionMappingSheetRepository } from "../google/positionMappingSheet";
import { SyncLogSheetRepository } from "../google/syncLogSheet";
import { DiffService } from "./diffService";
import { RateLimiter } from "../utils/rateLimiter";
import { withRetry } from "../utils/retry";
import { logger } from "../utils/logger";
import { env } from "../config/env";
import { SyncOptions } from "../types/sync";
import { League, PlayerRecord, ScrapedClub } from "../types/player";

interface SyncCounters {
  playersScanned: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: number;
}

export class SyncService {
  private readonly sheetsClient = new SheetsClient();
  private readonly playersRepo = new PlayersSheetRepository(this.sheetsClient);
  private readonly clubsRepo = new ClubsSheetRepository(this.sheetsClient);
  private readonly positionMappingRepo = new PositionMappingSheetRepository(
    this.sheetsClient,
  );
  private readonly syncLogRepo = new SyncLogSheetRepository(this.sheetsClient);
  private readonly diffService = new DiffService();
  private readonly rateLimiter = new RateLimiter(env.requestDelayMs);
  private readonly leagueScraper = new LeagueScraper();
  private readonly playerScraper = new PlayerScraper();

  async run(options: SyncOptions): Promise<void> {
    const startedAt = Date.now();
    const counters: SyncCounters = {
      playersScanned: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
    };

    logger.info(
      `Starting sync${options.dryRun ? " (dry run — no writes will be made)" : ""}...`,
    );

    await this.sheetsClient.init();
    await this.playersRepo.ensureExists();
    await this.clubsRepo.ensureExists();
    await this.positionMappingRepo.ensurePopulated();
    await this.syncLogRepo.ensureExists();

    const existingPlayers = await this.playersRepo.loadExisting();
    const existingClubs = await this.clubsRepo.loadExisting();

    const browser = new BrowserSession();
    await browser.launch();

    try {
      const leaguePage = await browser.newPage();
      const clubsToSync: ScrapedClub[] = [];

      for (const league of SUPPORTED_LEAGUES) {
        const clubs = await this.scrapeLeagueClubs(
          leaguePage,
          league,
          counters,
        );
        if (!clubs) continue;
        clubsToSync.push(...clubs);
      }

      const clubsToProcess = options.resume
        ? clubsToSync.filter(
            (club) => !existingClubs.has(club.transfermarktClubId),
          )
        : clubsToSync;

      if (clubsToProcess.length > 0) {
        await this.syncClubsInParallel(
          browser,
          clubsToProcess,
          existingClubs,
          existingPlayers,
          counters,
          options,
        );
      }
    } finally {
      await browser.close();
    }

    const executionTimeMs = Date.now() - startedAt;
    this.logSummary(counters, executionTimeMs);

    if (!options.dryRun) {
      try {
        await this.syncLogRepo.appendEntry({
          date: new Date().toISOString(),
          playersScanned: counters.playersScanned,
          inserted: counters.inserted,
          updated: counters.updated,
          skipped: counters.skipped,
          errors: counters.errors,
          executionTimeMs,
        });
      } catch (error) {
        logger.error(`Sync completed but failed to write sync log: ${error}`);
      }
    }
  }

  private async scrapeLeagueClubs(
    page: Parameters<LeagueScraper["scrapeClubs"]>[0],
    league: League,
    counters: SyncCounters,
  ): Promise<ScrapedClub[] | null> {
    try {
      await this.rateLimiter.wait();
      return await withRetry(
        () => this.leagueScraper.scrapeClubs(page, league),
        {
          retries: env.maxRetries,
          onRetry: (attempt, error) =>
            logger.warn(
              `Retry ${attempt} scraping league ${league.name}: ${error}`,
            ),
        },
      );
    } catch (error) {
      logger.error(
        `Failed to scrape league ${league.name} after retries: ${error}`,
      );
      counters.errors += 1;
      return null;
    }
  }

  private async syncClubsInParallel(
    browser: BrowserSession,
    clubs: ScrapedClub[],
    existingClubs: Awaited<ReturnType<ClubsSheetRepository["loadExisting"]>>,
    existingPlayers: Awaited<
      ReturnType<PlayersSheetRepository["loadExisting"]>
    >,
    counters: SyncCounters,
    options: SyncOptions,
  ): Promise<void> {
    const maxWorkers = 2;
    const workerPages = await Promise.all(
      Array.from({ length: maxWorkers }, () => browser.newPage()),
    );
    const queue = clubs.slice();

    await Promise.all(
      workerPages.map(async (page) => {
        while (queue.length > 0) {
          const club = queue.shift();
          if (!club) break;

          try {
            await this.syncClub(
              page,
              club,
              existingClubs,
              existingPlayers,
              counters,
              options,
            );
          } catch (error) {
            logger.error(`Worker failed for club ${club.clubName}: ${error}`);
            counters.errors += 1;
          }
        }
      }),
    );
  }

  private async syncClub(
    page: Parameters<PlayerScraper["scrapeSquad"]>[0],
    club: ScrapedClub,
    existingClubs: Awaited<ReturnType<ClubsSheetRepository["loadExisting"]>>,
    existingPlayers: Awaited<
      ReturnType<PlayersSheetRepository["loadExisting"]>
    >,
    counters: SyncCounters,
    options: SyncOptions,
  ): Promise<void> {
    const clubRecord = {
      transfermarktClubId: club.transfermarktClubId,
      clubName: club.clubName,
      league: club.league,
      clubUrl: club.clubUrl,
      lastSynced: new Date().toISOString(),
    };
    const playerInserts: PlayerRecord[] = [];
    const playerUpdates: { rowNumber: number; record: PlayerRecord }[] = [];

    let squadPlayers;
    try {
      await this.rateLimiter.wait();
      squadPlayers = await withRetry(
        () => this.playerScraper.scrapeSquad(page, club),
        {
          retries: env.maxRetries,
          onRetry: (attempt, error) =>
            logger.warn(
              `Retry ${attempt} scraping squad ${club.clubName}: ${error}`,
            ),
        },
      );
    } catch (error) {
      logger.error(
        `Failed to scrape squad for ${club.clubName} after retries: ${error}`,
      );
      counters.errors += 1;
      return;
    }

    for (const scrapedPlayer of squadPlayers) {
      counters.playersScanned += 1;
      const existing = existingPlayers.get(scrapedPlayer.transfermarktPlayerId);
      const { result, nextRecord } = this.diffService.diff(
        existing?.record,
        scrapedPlayer,
      );

      if (result.action === "skip") {
        counters.skipped += 1;
        continue;
      }

      if (options.dryRun) {
        const changeSummary = result.reasonsChanged.length
          ? ` — changed: ${result.reasonsChanged.join(", ")}`
          : "";
        logger.info(
          `[DRY RUN] ${result.action.toUpperCase()} ${scrapedPlayer.playerName} (${scrapedPlayer.transfermarktPlayerId})${changeSummary}`,
        );
      } else if (result.action === "insert") {
        playerInserts.push(nextRecord);
      } else if (existing) {
        playerUpdates.push({
          rowNumber: existing.rowNumber,
          record: nextRecord,
        });
      }

      if (result.action === "insert") counters.inserted += 1;
      if (result.action === "update") counters.updated += 1;
    }

    if (!options.dryRun) {
      if (playerInserts.length > 0) {
        await this.playersRepo.appendRecords(playerInserts);
      }
      if (playerUpdates.length > 0) {
        await this.playersRepo.updateRecords(playerUpdates);
      }

      const existingClub = existingClubs.get(club.transfermarktClubId);
      if (existingClub) {
        await this.clubsRepo.updateRecord(existingClub.rowNumber, clubRecord);
      } else {
        await this.clubsRepo.appendRecords([clubRecord]);
      }
    }
  }

  private logSummary(counters: SyncCounters, executionTimeMs: number): void {
    logger.info(
      `Sync complete. Scanned=${counters.playersScanned} Inserted=${counters.inserted} ` +
        `Updated=${counters.updated} Skipped=${counters.skipped} Errors=${counters.errors} ` +
        `Time=${(executionTimeMs / 1000).toFixed(1)}s`,
    );
  }
}
