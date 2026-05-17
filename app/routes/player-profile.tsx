import { Link, useParams } from "react-router";
import type { Route } from "./+types/player-profile";
import { useEffect, useMemo, useState } from "react";
import { useTeams } from "~/context/TeamsContext";
import { toShortId, findFullId } from "~/utils/shortId";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft } from "@fortawesome/free-solid-svg-icons";
import { getFlagUrl, getCountryByCode } from "~/utils/countries";
import type { PlayerStats } from "~/types/tracker";

function sanitizeStat(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function sanitizeRate(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function buildStats(playerStats: PlayerStats | undefined, matchs2526: number, titularisations2526: number): PlayerStats {
  return {
    points: sanitizeStat(playerStats?.points),
    essais: sanitizeStat(playerStats?.essais),
    pied: sanitizeStat(playerStats?.pied),
    tauxTransfo: sanitizeRate(playerStats?.tauxTransfo),
    cartons: sanitizeStat(playerStats?.cartons),
    drops: sanitizeStat(playerStats?.drops),
    matchs2526: sanitizeStat(playerStats?.matchs2526 ?? matchs2526),
    titularisations2526: sanitizeStat(playerStats?.titularisations2526 ?? titularisations2526),
  };
}

export function meta({ params }: Route.MetaArgs) {
  const playerId = params.playerId;
  return [{ title: playerId ? "Profil joueur" : "Joueur" }];
}



function getRosterBackPath(rosterId: string | null | undefined): string {
  if (!rosterId) return "/roster";
  return `/r/${rosterId}`;
}

export default function PlayerProfilePage() {
  const { rosterId: shortRosterId, playerId: shortPlayerId } = useParams();
  const { rosters, teams, setRosters } = useTeams();
  
  // Convert short IDs to full IDs
  const rosterId = useMemo(
    () => findFullId(shortRosterId, rosters),
    [shortRosterId, rosters]
  );
  const playerId = useMemo(
    () => findFullId(shortPlayerId, rosters.flatMap(r => r.players)),
    [shortPlayerId, rosters]
  );
  const [isEditingStats, setIsEditingStats] = useState(false);
  const [statsMessage, setStatsMessage] = useState("");
  const [statsDraft, setStatsDraft] = useState<PlayerStats>({
    points: 0,
    essais: 0,
    pied: 0,
    tauxTransfo: 0,
    cartons: 0,
    drops: 0,
    matchs2526: 0,
    titularisations2526: 0,
  });

  const roster = useMemo(
    () => rosters.find((item) => item.id === rosterId) ?? null,
    [rosters, rosterId]
  );

  const player = useMemo(
    () => roster?.players.find((item) => item.id === playerId) ?? null,
    [roster?.players, playerId]
  );

  const playerCompositions = useMemo(() => {
    if (!roster || !player) return [];

    return teams
      .filter((team) => team.rosterId === roster.id)
      .flatMap((team) => {
        const entries = [...team.starters, ...team.substitutes];
        return entries
          .filter((entry) => entry.player.id === player.id)
          .map((entry) => ({
            teamId: team.id,
            teamName: team.name,
            number: entry.number,
            isCaptain: team.captainPlayerId === player.id,
          }));
      })
      .sort((first, second) => first.number - second.number);
  }, [teams, roster, player]);

  const computedMatchs2526 = playerCompositions.length;
  const computedTitularisations2526 = useMemo(
    () => teams.filter((team) => team.rosterId === roster?.id).filter((team) => team.starters.some((entry) => entry.player.id === player?.id)).length,
    [teams, roster?.id, player?.id]
  );

  const effectiveStats = useMemo(
    () => buildStats(player?.stats, computedMatchs2526, computedTitularisations2526),
    [player?.stats, computedMatchs2526, computedTitularisations2526]
  );

  useEffect(() => {
    setStatsDraft(effectiveStats);
  }, [effectiveStats]);

  function updateDraftNumber<K extends keyof PlayerStats>(key: K, value: string) {
    setStatsDraft((current) => ({
      ...current,
      [key]: key === "tauxTransfo" ? sanitizeRate(value) : sanitizeStat(value),
    }));
  }

  function saveStats() {
    if (!roster || !player) return;
    const nextStats = buildStats(statsDraft, computedMatchs2526, computedTitularisations2526);
    const updatedRosters = rosters.map((item) => {
      if (item.id !== roster.id) return item;
      return {
        ...item,
        players: item.players.map((p) => (p.id === player.id ? { ...p, stats: nextStats } : p)),
      };
    });
    setRosters(updatedRosters);
    setStatsMessage("Statistiques mises à jour.");
    setIsEditingStats(false);
  }

  const backPath = getRosterBackPath(rosterId ? toShortId(rosterId) : undefined);

  if (!roster || !player) {
    return (
      <main className="sp-page space-y-4">
        <h1 className="text-2xl font-bold">Profil joueur introuvable</h1>
        <Link to={backPath} className="sp-link-muted">
        <FontAwesomeIcon icon={faArrowLeft} className="text-xs mr-1" />
          Retour à l'effectif
        </Link>
      </main>
    );
  }

  return (
    <main className="sp-page space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">{player.name}</h1>
        <p className="text-sm text-neutral-400">Effectif: {roster.name}</p>
        <Link to={backPath} className="sp-link-muted">
        <FontAwesomeIcon icon={faArrowLeft} className="text-xs mr-1" />
          Retour à l'effectif
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:items-start">
        <section className="sp-panel space-y-3 md:col-span-2">
          <h2 className="font-semibold">Informations</h2>
          <p className="text-sm text-neutral-200">
            <strong>Postes:</strong>{" "}
            {player.positions && player.positions.length > 0
              ? player.positions.join(" / ")
              : "Non renseignés"}
          </p>
          {player.nationality && (() => {
            const country = getCountryByCode(player.nationality);
            return (
              <p className="text-sm text-neutral-200 flex items-center gap-1.5">
                <strong>Nationalité:</strong>
                <img
                  src={getFlagUrl(player.nationality)}
                  alt={country?.name ?? player.nationality}
                  width={16}
                  height={12}
                  className="inline-block"
                />
                {country?.name ?? player.nationality}
              </p>
            );
          })()}
        </section>

        {player.photoUrl && (
          <aside className="md:col-span-1 md:justify-self-end w-full md:w-auto">
            <img
              src={player.photoUrl}
              alt={`Photo de ${player.name}`}
              className="mx-auto md:mx-0 h-auto w-full max-w-[10rem] md:max-w-full rounded-md border border-neutral-700 bg-neutral-900/40 object-cover"
            />
          </aside>
        )}
      </div>

      <section className="sp-panel space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">Stats joueur</h2>
          {!isEditingStats ? (
            <button
              type="button"
              className="sp-button sp-button-xs sp-button-indigo"
              onClick={() => {
                setStatsDraft(effectiveStats);
                setIsEditingStats(true);
                setStatsMessage("");
              }}
            >
              Modifier
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button type="button" className="sp-button sp-button-xs sp-button-blue" onClick={saveStats}>
                Enregistrer
              </button>
              <button
                type="button"
                className="sp-button sp-button-xs sp-button-light"
                onClick={() => {
                  setStatsDraft(effectiveStats);
                  setIsEditingStats(false);
                }}
              >
                Annuler
              </button>
            </div>
          )}
        </div>
        {statsMessage && <p className="text-xs text-emerald-400">{statsMessage}</p>}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="sp-input-shell">
            <label className="sp-input-label" htmlFor="playerStatsPoints">Points</label>
            <input
              id="playerStatsPoints"
              type="number"
              min={0}
              className="sp-input-control"
              value={isEditingStats ? statsDraft.points : effectiveStats.points}
              onChange={(event) => updateDraftNumber("points", event.target.value)}
              disabled={!isEditingStats}
            />
          </div>
          <div className="sp-input-shell">
            <label className="sp-input-label" htmlFor="playerStatsEssais">Essais</label>
            <input
              id="playerStatsEssais"
              type="number"
              min={0}
              className="sp-input-control"
              value={isEditingStats ? statsDraft.essais : effectiveStats.essais}
              onChange={(event) => updateDraftNumber("essais", event.target.value)}
              disabled={!isEditingStats}
            />
          </div>
          <div className="sp-input-shell">
            <label className="sp-input-label" htmlFor="playerStatsPied">Pied</label>
            <input
              id="playerStatsPied"
              type="number"
              min={0}
              className="sp-input-control"
              value={isEditingStats ? statsDraft.pied : effectiveStats.pied}
              onChange={(event) => updateDraftNumber("pied", event.target.value)}
              disabled={!isEditingStats}
            />
          </div>
          <div className="sp-input-shell">
            <label className="sp-input-label" htmlFor="playerStatsTauxTransfo">Taux de transfo (%)</label>
            <input
              id="playerStatsTauxTransfo"
              type="number"
              min={0}
              max={100}
              className="sp-input-control"
              value={isEditingStats ? statsDraft.tauxTransfo : effectiveStats.tauxTransfo}
              onChange={(event) => updateDraftNumber("tauxTransfo", event.target.value)}
              disabled={!isEditingStats}
            />
          </div>
          <div className="sp-input-shell">
            <label className="sp-input-label" htmlFor="playerStatsCartons">Cartons</label>
            <input
              id="playerStatsCartons"
              type="number"
              min={0}
              className="sp-input-control"
              value={isEditingStats ? statsDraft.cartons : effectiveStats.cartons}
              onChange={(event) => updateDraftNumber("cartons", event.target.value)}
              disabled={!isEditingStats}
            />
          </div>
          <div className="sp-input-shell">
            <label className="sp-input-label" htmlFor="playerStatsDrops">Drops</label>
            <input
              id="playerStatsDrops"
              type="number"
              min={0}
              className="sp-input-control"
              value={isEditingStats ? statsDraft.drops : effectiveStats.drops}
              onChange={(event) => updateDraftNumber("drops", event.target.value)}
              disabled={!isEditingStats}
            />
          </div>
          <div className="sp-input-shell">
            <label className="sp-input-label" htmlFor="playerStatsMatchs2526">Matchs 25-26</label>
            <input
              id="playerStatsMatchs2526"
              type="number"
              min={0}
              className="sp-input-control"
              value={isEditingStats ? statsDraft.matchs2526 : effectiveStats.matchs2526}
              onChange={(event) => updateDraftNumber("matchs2526", event.target.value)}
              disabled={!isEditingStats}
            />
          </div>
          <div className="sp-input-shell">
            <label className="sp-input-label" htmlFor="playerStatsTitularisations2526">Titularisations 25-26</label>
            <input
              id="playerStatsTitularisations2526"
              type="number"
              min={0}
              className="sp-input-control"
              value={isEditingStats ? statsDraft.titularisations2526 : effectiveStats.titularisations2526}
              onChange={(event) => updateDraftNumber("titularisations2526", event.target.value)}
              disabled={!isEditingStats}
            />
          </div>
        </div>
        <p className="text-xs text-neutral-500">
          Valeur initiale automatique: Matchs 25-26 et Titularisations 25-26 sont préremplis depuis les compositions, puis restent modifiables manuellement.
        </p>
      </section>

      <section className="sp-panel space-y-3">
        <h2 className="font-semibold">Compositions</h2>
        {playerCompositions.length === 0 ? (
          <p className="text-sm text-neutral-400">Aucune composition pour ce joueur.</p>
        ) : (
          <ul
            className={`space-y-2 ${playerCompositions.length > 4 ? "max-h-56 overflow-y-auto pr-1" : ""}`}
          >
            {playerCompositions.map((entry) => (
              <li key={`${entry.teamId}-${entry.number}`} className="rounded border border-neutral-700 bg-neutral-800/40 px-3 py-2 text-sm text-neutral-200">
                {entry.teamName} - #{entry.number}
                {entry.isCaptain ? " (Capitaine)" : ""}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
