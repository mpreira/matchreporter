import type { ActionFunction } from "react-router";
import { resolveDataScopeFromRequest } from "~/utils/account.server";
import { importTeamsFromSportsDb } from "~/utils/thesportsdb-import.server";

// POST /api/sportsdb-import
// Body: { leagues: ["top_14","pro_d2"] }   (default: both)
//
// Fetches teams + players from TheSportsDB and upserts them
// into stored_rosters, players, and competitions tables.
// Requires an authenticated account (not anonymous).
export const action: ActionFunction = async ({ request }) => {
  if (request.method !== "POST") {
    return Response.json({ error: "method-not-allowed" }, { status: 405 });
  }

  const scope = await resolveDataScopeFromRequest(request);
  if (scope.isAnonymous) {
    return Response.json(
      { error: "auth_required", message: "You must be logged in to import data." },
      { status: 401 }
    );
  }
  const body = await request.json().catch(() => ({}));
  const leagues: string[] = Array.isArray(body.leagues)
    ? body.leagues
    : ["top_14", "pro_d2"];

  try {
    const result = await importTeamsFromSportsDb(scope.scopeId, leagues);
    return Response.json(result, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error("[sportsdb-import]", message);
    return Response.json(
      { error: "import_failed", message },
      { status: 502 }
    );
  }
};
