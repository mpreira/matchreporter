/**
 * Import teams & players from TheSportsDB into the local database.
 * Maps external data to the existing stored_rosters / players / competitions tables
 * using ON CONFLICT upserts — existing data is preserved and enriched.
 */

import {
  LEAGUE_IDS,
  getTeamsByLeague,
  getTeamPlayers,
  type SdbTeam,
  type SdbPlayer,
  type LeagueKey,
} from "~/utils/thesportsdb.server";
import {
  getRostersStateForAccount,
  saveRostersStateForAccount,
} from "~/utils/database.server";
import type { Player, PlayerPosition, Roster } from "~/types/tracker";

/* ------------------------------------------------------------------ */
/*  Public entry point                                                 */
/* ------------------------------------------------------------------ */

export interface ImportResult {
  rostersImported: number;
  playersImported: number;
  leagues: string[];
}

export async function importTeamsFromSportsDb(
  accountId: string,
  leagueKeys: string[]
): Promise<ImportResult> {
  const resolvedIds = resolveLeagueIds(leagueKeys);

  // 1. Fetch current state so we can merge
  const currentState = await getRostersStateForAccount(accountId);
  const existingById = new Map(
    currentState.rosters.map((r) => [r.id, r])
  );

  let totalPlayers = 0;
  const newRosters: Roster[] = [];

  // 2. Fetch teams (and players) per league
  for (const { key, id } of resolvedIds) {
    const category = key === "TOP_14" ? "Top 14" : key === "PRO_D2" ? "Pro D2" : "W6N";
    const sdbTeams = await getTeamsByLeague(id);

    for (const sdbTeam of sdbTeams) {
      const rosterId = `sdb_${sdbTeam.idTeam}`;
      const existing = existingById.get(rosterId);

      // Fetch players for this team (free tier: 10 players per call)
      let players: Player[] = [];
      try {
        const sdbPlayers = await getTeamPlayers(sdbTeam.idTeam);
        players = sdbPlayers.map((p) => mapPlayer(p, sdbTeam.strTeam));
        totalPlayers += players.length;
      } catch {
        // Rate limit or network error — keep going with empty roster
        console.warn(`[sportsdb-import] Skipping players for ${sdbTeam.strTeam}`);
      }

      const roster = mapRoster(sdbTeam, category, players, existing);
      existingById.set(rosterId, roster);
      newRosters.push(roster);
    }
  }

  // 3. Merge: imported rosters replace any with same id, keep the rest
  const merged = [
    ...currentState.rosters.filter((r) => !existingById.has(r.id) || !newRosters.some((nr) => nr.id === r.id)),
    ...newRosters,
  ];

  // 4. Save — this triggers syncRosterDataToTables internally
  await saveRostersStateForAccount(accountId, {
    ...currentState,
    rosters: merged,
  });

  return {
    rostersImported: newRosters.length,
    playersImported: totalPlayers,
    leagues: resolvedIds.map((l) => l.key),
  };
}

/* ------------------------------------------------------------------ */
/*  Mappers: TheSportsDB → local types                                 */
/* ------------------------------------------------------------------ */

function mapRoster(
  sdbTeam: SdbTeam,
  category: "Top 14" | "Pro D2" | "W6N",
  players: Player[],
  existing?: Roster
): Roster {
  return {
    // Keep existing data as base, override with fresh SDB data
    ...existing,
    id: `sdb_${sdbTeam.idTeam}`,
    name: sdbTeam.strTeam,
    nickname: sdbTeam.strTeamAlternate || existing?.nickname,
    logo: sdbTeam.strBadge || existing?.logo,
    category,
    founded_in: sdbTeam.intFormedYear
      ? parseInt(sdbTeam.intFormedYear, 10) || existing?.founded_in
      : existing?.founded_in,
    players,
    // Preserve fields that SDB doesn't provide
    color: existing?.color,
    coach: existing?.coach,
    president: existing?.president,
    titles: existing?.titles ?? [],
    seasons: existing?.seasons,
  };
}

function mapPlayer(sdbPlayer: SdbPlayer, clubName: string): Player {
  return {
    id: `sdb_p_${sdbPlayer.idPlayer}`,
    name: sdbPlayer.strPlayer,
    positions: mapPosition(sdbPlayer.strPosition),
    photoUrl: sdbPlayer.strCutout || sdbPlayer.strThumb || undefined,
    nationality: mapNationality(sdbPlayer.strNationality),
    club: clubName,
  };
}

/* ------------------------------------------------------------------ */
/*  Position mapping: English rugby positions → French app positions   */
/* ------------------------------------------------------------------ */

const POSITION_MAP: Record<string, string> = {
  // Front row
  "prop": "première ligne",
  "loosehead prop": "première ligne",
  "tighthead prop": "première ligne",

  // Hooker
  "hooker": "talonneur",

  // Second row / Lock
  "lock": "deuxième ligne",
  "second row": "deuxième ligne",
  "second-row": "deuxième ligne",

  // Back row
  "back row": "troisième ligne",
  "back-row": "troisième ligne",
  "flanker": "troisième ligne",
  "openside flanker": "troisième ligne",
  "blindside flanker": "troisième ligne",
  "number eight": "troisième ligne",
  "no. 8": "troisième ligne",

  // Half-backs
  "scrum-half": "demi de mêlée",
  "scrum half": "demi de mêlée",
  "fly-half": "demi d'ouverture",
  "fly half": "demi d'ouverture",
  "half-back": "demi de mêlée",

  // Centres
  "centre": "centre",
  "center": "centre",
  "inside centre": "centre",
  "outside centre": "centre",
  "inside center": "centre",
  "outside center": "centre",
  "right centre": "centre",
  "left centre": "centre",

  // Wings
  "wing": "ailier",
  "winger": "ailier",
  "left wing": "ailier",
  "right wing": "ailier",

  // Full-back
  "full-back": "arrière",
  "fullback": "arrière",
  "full back": "arrière",
};

function mapPosition(sdbPosition: string | null | undefined): PlayerPosition[] {
  if (!sdbPosition) return [];
  const key = sdbPosition.toLowerCase().trim();
  const mapped = POSITION_MAP[key] as PlayerPosition | undefined;
  return mapped ? [mapped] : [];
}

/* ------------------------------------------------------------------ */
/*  Nationality mapping: country name (EN) → ISO 3166-1 alpha-2       */
/* ------------------------------------------------------------------ */

const NATIONALITY_MAP: Record<string, string> = {
  "france": "fr",
  "england": "gb",
  "scotland": "gb",
  "wales": "gb",
  "ireland": "ie",
  "northern ireland": "ie",
  "south africa": "za",
  "new zealand": "nz",
  "australia": "au",
  "fiji": "fj",
  "samoa": "ws",
  "tonga": "to",
  "argentina": "ar",
  "georgia": "ge",
  "italy": "it",
  "japan": "jp",
  "romania": "ro",
  "spain": "es",
  "portugal": "pt",
  "uruguay": "uy",
  "united states": "us",
  "usa": "us",
  "canada": "ca",
  "namibia": "na",
  "kenya": "ke",
  "zimbabwe": "zw",
  "madagascar": "mg",
  "morocco": "ma",
  "algeria": "dz",
  "tunisia": "tn",
  "cameroon": "cm",
  "senegal": "sn",
  "ivory coast": "ci",
  "belgium": "be",
  "netherlands": "nl",
  "germany": "de",
  "russia": "ru",
  "ukraine": "ua",
  "poland": "pl",
  "czech republic": "cz",
  "croatia": "hr",
  "serbia": "rs",
  "chile": "cl",
  "brazil": "br",
  "colombia": "co",
  "hong kong": "hk",
  "south korea": "kr",
  "philippines": "ph",
  "india": "in",
  "sri lanka": "lk",
  "cook islands": "ck",
  "papua new guinea": "pg",
};

function mapNationality(sdbNationality: string | null | undefined): string | undefined {
  if (!sdbNationality) return undefined;
  const key = sdbNationality.toLowerCase().trim();
  return NATIONALITY_MAP[key];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function resolveLeagueIds(keys: string[]): { key: LeagueKey; id: string }[] {
  const result: { key: LeagueKey; id: string }[] = [];
  for (const k of keys) {
    const upper = k.toUpperCase().replace(/-/g, "_") as LeagueKey;
    if (upper in LEAGUE_IDS) {
      result.push({ key: upper, id: LEAGUE_IDS[upper] });
    }
  }
  return result;
}
