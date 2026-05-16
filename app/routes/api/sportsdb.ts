import type { LoaderFunction } from "react-router";
import {
  LEAGUE_IDS,
  getLeague,
  getTeamsByLeague,
  getNextLeagueEvents,
  getPreviousLeagueEvents,
  getSeasonEvents,
  getLeagueTable,
  getSeasons,
  getTeamPlayers,
  lookupTeam,
  type LeagueKey,
} from "~/utils/thesportsdb.server";

const VALID_LEAGUES = new Set(Object.keys(LEAGUE_IDS));

function resolveLeagueId(param: string): string | null {
  const upper = param.toUpperCase().replace(/-/g, "_") as LeagueKey;
  if (upper in LEAGUE_IDS) return LEAGUE_IDS[upper];
  // Also accept raw numeric id
  if (Object.values(LEAGUE_IDS).includes(param as any)) return param;
  return null;
}

// GET /api/sportsdb/leagues
//     → returns info for Top 14 + Pro D2 + W6N
//
// GET /api/sportsdb/leagues?league=top_14
//     → returns info for a single league
//
// GET /api/sportsdb/leagues?league=top_14&include=teams,table,next,previous,seasons
//     → returns league info + requested sub-resources
//
// GET /api/sportsdb/leagues?league=top_14&include=season_events&season=2024-2025
//     → returns all events for a given season
//
// GET /api/sportsdb/teams?id=12345
//     → lookup a single team by thesportsdb ID
//
// GET /api/sportsdb/teams?id=12345&include=players
//     → lookup a team + its players

export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const resource = url.searchParams.get("resource") ?? "leagues";
  const leagueParam = url.searchParams.get("league");
  const includes = new Set(
    (url.searchParams.get("include") ?? "").split(",").filter(Boolean)
  );
  const season = url.searchParams.get("season") ?? undefined;
  const teamId = url.searchParams.get("teamId");

  try {
    /* ---- Team lookup ---- */
    if (resource === "teams") {
      if (!teamId) {
        return Response.json(
          { error: "missing teamId query param" },
          { status: 400 }
        );
      }
      const team = await lookupTeam(teamId);
      if (!team)
        return Response.json({ error: "team not found" }, { status: 404 });
      const result: Record<string, unknown> = { team };
      if (includes.has("players")) {
        result.players = await getTeamPlayers(teamId);
      }
      return Response.json(result, { headers: cacheHeaders() });
    }

    /* ---- League(s) ---- */
    if (leagueParam) {
      const leagueId = resolveLeagueId(leagueParam);
      if (!leagueId) {
        return Response.json(
          {
            error: `unknown league "${leagueParam}". Use one of: ${Object.keys(LEAGUE_IDS).join(", ")}`,
          },
          { status: 400 }
        );
      }
      return Response.json(
        await buildLeagueResponse(leagueId, includes, season),
        { headers: cacheHeaders() }
      );
    }

    // Default: return all leagues
    const [top14, proD2, w6n] = await Promise.all([
      buildLeagueResponse(LEAGUE_IDS.TOP_14, includes, season),
      buildLeagueResponse(LEAGUE_IDS.PRO_D2, includes, season),
      buildLeagueResponse(LEAGUE_IDS.W6N, includes, season),
    ]);
    return Response.json({ top14, proD2, w6n }, { headers: cacheHeaders() });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error("[sportsdb]", message);
    return Response.json(
      { error: "thesportsdb_error", message },
      { status: 502 }
    );
  }
};

/* ---------- helpers ---------- */

async function buildLeagueResponse(
  leagueId: string,
  includes: Set<string>,
  season?: string
) {
  const result: Record<string, unknown> = {};

  // Always fetch league info
  result.league = await getLeague(leagueId);

  const jobs: Promise<void>[] = [];

  if (includes.has("teams")) {
    jobs.push(
      getTeamsByLeague(leagueId).then((t) => {
        result.teams = t;
      })
    );
  }

  if (includes.has("table")) {
    jobs.push(
      getLeagueTable(leagueId, season).then((t) => {
        result.table = t;
      })
    );
  }

  if (includes.has("next")) {
    jobs.push(
      getNextLeagueEvents(leagueId).then((e) => {
        result.nextEvents = e;
      })
    );
  }

  if (includes.has("previous")) {
    jobs.push(
      getPreviousLeagueEvents(leagueId).then((e) => {
        result.previousEvents = e;
      })
    );
  }

  if (includes.has("seasons")) {
    jobs.push(
      getSeasons(leagueId).then((s) => {
        result.seasons = s;
      })
    );
  }

  if (includes.has("season_events") && season) {
    jobs.push(
      getSeasonEvents(leagueId, season).then((e) => {
        result.seasonEvents = e;
      })
    );
  }

  await Promise.all(jobs);
  return result;
}

function cacheHeaders(): HeadersInit {
  // Cache 5 minutes in browser, 15 minutes on CDN
  return {
    "Cache-Control": "public, max-age=300, s-maxage=900, stale-while-revalidate=60",
  };
}
