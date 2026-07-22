#!/usr/bin/env node
import { SyncService } from "./services/syncService";
import { logger } from "./utils/logger";

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const resume = process.argv.includes("--resume");
  const syncService = new SyncService();

  try {
    await syncService.run({ dryRun, resume });
  } catch (error) {
    logger.error(
      `Sync failed: ${error instanceof Error ? (error.stack ?? error.message) : error}`,
    );
    process.exitCode = 1;
  }
}

main();
