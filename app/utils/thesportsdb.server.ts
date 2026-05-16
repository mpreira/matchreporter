/**
 * TheSportsDB API client – free tier (key "123", 30 req/min).
 * Focused on French rugby: Top 14 & Pro D2.
 */

const BASE = "https://www.thesportsdb.com/api/v1/json";
const API_KEY = process.env.THESPORTSDB_API_KEY ?? "123";

export const LEAGUE_IDS = {
  TOP_14: "4430",
  PRO_D2: "5172",
  W6N: "6277",
} as const;

export type LeagueKey = keyof typeof LEAGUE_IDS;

/* ---------- low-level fetch with timeout + error handling ---------- */

async function fetchApi<T>(path: string): Promise<T> {
  const url = `${BASE}/${API_KEY}/${path}`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(10_000),
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`TheSportsDB ${res.status}: ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

/* ---------- League ---------- */

export interface SdbLeague {
  idLeague: string;
  strLeague: string;
  strLeagueAlternate: string;
  strSport: string;
  strCountry: string;
  intFormedYear: string;
  strCurrentSeason: string;
  strBadge: string | null;
  strLogo: string | null;
  strBanner: string | null;
  strPoster: string | null;
  strTrophy: string | null;
  strDescriptionEN: string | null;
  strDescriptionFR: string | null;
}

export async function getLeague(leagueId: string): Promise<SdbLeague | null> {
  const data = await fetchApi<{ leagues: SdbLeague[] | null }>(
    `lookupleague.php?id=${leagueId}`
  );
  return data.leagues?.[0] ?? null;
}

/* ---------- Teams ---------- */

export interface SdbTeam {
  idTeam: string;
  strTeam: string;
  strTeamAlternate: string;
  strLeague: string;
  idLeague: string;
  strStadium: string;
  strStadiumThumb: string | null;
  intStadiumCapacity: string;
  strWebsite: string;
  strFacebook: string;
  strInstagram: string;
  intFormedYear: string;
  strDescriptionEN: string | null;
  strDescriptionFR: string | null;
  strCountry: string;
  strBadge: string | null;
  strLogo: string | null;
  strBanner: string | null;
  strFanart1: string | null;
}

export async function getTeamsByLeague(leagueId: string): Promise<SdbTeam[]> {
  const data = await fetchApi<{ teams: SdbTeam[] | null }>(
    `search_all_teams.php?l=${encodeLeagueName(leagueId)}`
  );
  return data.teams ?? [];
}

export async function lookupTeam(teamId: string): Promise<SdbTeam | null> {
  const data = await fetchApi<{ teams: SdbTeam[] | null }>(
    `lookupteam.php?id=${teamId}`
  );
  return data.teams?.[0] ?? null;
}

/* ---------- Events / Schedule ---------- */

export interface SdbEvent {
  idEvent: string;
  strEvent: string;
  strLeague: string;
  idLeague: string;
  strSeason: string;
  strHomeTeam: string;
  strAwayTeam: string;
  idHomeTeam: string;
  idAwayTeam: string;
  intHomeScore: string | null;
  intAwayScore: string | null;
  intRound: string;
  dateEvent: string;
  strTime: string;
  strTimestamp: string;
  strThumb: string | null;
  strVenue: string;
  strStatus: string | null;
  strHomeTeamBadge: string | null;
  strAwayTeamBadge: string | null;
}

export async function getNextLeagueEvents(leagueId: string): Promise<SdbEvent[]> {
  const data = await fetchApi<{ events: SdbEvent[] | null }>(
    `eventsnextleague.php?id=${leagueId}`
  );
  return data.events ?? [];
}

export async function getPreviousLeagueEvents(leagueId: string): Promise<SdbEvent[]> {
  const data = await fetchApi<{ events: SdbEvent[] | null }>(
    `eventspastleague.php?id=${leagueId}`
  );
  return data.events ?? [];
}

export async function getSeasonEvents(
  leagueId: string,
  season: string
): Promise<SdbEvent[]> {
  const data = await fetchApi<{ events: SdbEvent[] | null }>(
    `eventsseason.php?id=${leagueId}&s=${encodeURIComponent(season)}`
  );
  return data.events ?? [];
}

/* ---------- Standings / Table ---------- */
// NOTE: lookuptable is limited to featured soccer leagues on the free tier.
// For rugby it may return an empty response. Keep the function for use with
// a premium API key (set THESPORTSDB_API_KEY env var).

export interface SdbTableEntry {
  idStanding: string;
  intRank: string;
  idTeam: string;
  strTeam: string;
  strTeamBadge: string | null;
  idLeague: string;
  strLeague: string;
  strSeason: string;
  intPlayed: string;
  intWin: string;
  intDraw: string;
  intLoss: string;
  intGoalsFor: string;
  intGoalsAgainst: string;
  intGoalDifference: string;
  intPoints: string;
}

export async function getLeagueTable(
  leagueId: string,
  season?: string
): Promise<SdbTableEntry[]> {
  const qs = season
    ? `lookuptable.php?l=${leagueId}&s=${encodeURIComponent(season)}`
    : `lookuptable.php?l=${leagueId}`;
  const data = await fetchApi<{ table: SdbTableEntry[] | null }>(qs);
  return data.table ?? [];
}

/* ---------- Seasons ---------- */

export interface SdbSeason {
  strSeason: string;
}

export async function getSeasons(leagueId: string): Promise<SdbSeason[]> {
  const data = await fetchApi<{ seasons: SdbSeason[] | null }>(
    `search_all_seasons.php?id=${leagueId}`
  );
  return data.seasons ?? [];
}

/* ---------- Players in a team ---------- */

export interface SdbPlayer {
  idPlayer: string;
  strPlayer: string;
  strNationality: string;
  strPosition: string;
  dateBorn: string;
  strThumb: string | null;
  strCutout: string | null;
  strDescriptionEN: string | null;
}

export async function getTeamPlayers(teamId: string): Promise<SdbPlayer[]> {
  const data = await fetchApi<{ player: SdbPlayer[] | null }>(
    `lookup_all_players.php?id=${teamId}`
  );
  return data.player ?? [];
}

/* ---------- helpers ---------- */

const LEAGUE_NAMES: Record<string, string> = {
  "4430": "French_Top_14",
  "5172": "French_Pro_D2",
};

function encodeLeagueName(leagueId: string): string {
  return LEAGUE_NAMES[leagueId] ?? leagueId;
}
