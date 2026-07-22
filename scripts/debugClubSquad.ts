import { BrowserSession } from "../src/scrapers/transfermarkt/browser";
import { LeagueScraper } from "../src/scrapers/transfermarkt/leagueScraper";
import { PlayerScraper } from "../src/scrapers/transfermarkt/playerScraper";
import { SUPPORTED_LEAGUES } from "../src/scrapers/transfermarkt/constants";
import { SheetsClient } from "../src/google/sheetsClient";
import { DebugSheetRepository } from "../src/google/debugSheet";
import { PlayerRecord } from "../src/types/player";

const clubQuery = process.argv.slice(2).join(" ").trim();

if (!clubQuery) {
  console.error('Usage: npm run debug:club -- "Club Name"');
  process.exit(1);
}

function matchesClub(clubName: string, clubUrl: string, query: string): boolean {
  const normalizedQuery = query.toLocaleLowerCase();
  return (
    clubName.toLocaleLowerCase().includes(normalizedQuery) ||
    clubUrl.toLocaleLowerCase().includes(
      normalizedQuery.replace(/\s+/g, "-"),
    )
  );
}

async function run() {
  const browser = new BrowserSession();
  await browser.launch();
  const sheetsClient = new SheetsClient();
  await sheetsClient.init();
  const debugRepo = new DebugSheetRepository(sheetsClient);
  await debugRepo.ensureExists();

  try {
    const page = await browser.newPage();
    const leagueScraper = new LeagueScraper();
    const playerScraper = new PlayerScraper();

    let targetClub = null;
    for (const league of SUPPORTED_LEAGUES) {
      const clubs = await leagueScraper.scrapeClubs(page, league);
      targetClub = clubs.find((c) =>
        matchesClub(c.clubName, c.clubUrl, clubQuery),
      );
      if (targetClub) break;
    }

    if (!targetClub) {
      console.error(`Club not found: ${clubQuery}`);
      return;
    }

    console.log("Club URL:", targetClub.clubUrl);
    const players = await playerScraper.scrapeSquad(page, targetClub);
    console.log("Players found:", players.length);

    const now = new Date().toISOString();
    const records: PlayerRecord[] = players.map((p) => ({
      transfermarktId: p.transfermarktPlayerId,
      playerName: p.playerName,
      primaryPosition: p.primaryPosition,
      fantasyPosition: "",
      club: targetClub.clubName,
      league: targetClub.league,
      nationality: p.nationality ?? "",
      profileUrl: p.profileUrl,
      imageUrl: p.imageUrl ?? "",
      status: "Pending",
      lastSynced: now,
      lastSeen: now,
    }));

    console.log("Checking existing Debug Squad rows before writing...");
    const { appended, skipped } = await debugRepo.appendMissingRecords(records);
    console.log(
      `Debug Squad complete. Added ${appended} rows; skipped ${skipped} already-present players.`,
    );
  } finally {
    await browser.close();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
