import { Link, useParams } from "react-router";
import type { Route } from "./+types/player-profile";
import { useEffect, useMemo, useState } from "react";
import { useTeams } from "~/context/TeamsContext";
import { toShortId, findFullId } from "~/utils/shortId";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faPenToSquare } from "@fortawesome/free-solid-svg-icons";
import { getFlagUrl, getCountryByCode } from "~/utils/countries";
import type { PlayerStats } from "~/types/tracker";
import { getCompetitionGender, getCompetitionScope } from "~/types/tracker";
import { TOP14_CLUBS_2025_2026, PROD2_CLUBS_2025_2026, ELITE1_CLUBS_2025_2026 } from "~/utils/clubs";
import { updatePlayerInRoster, addPlayerToRosterList } from "~/utils/RosterUtils";

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
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [infoClubDraft, setInfoClubDraft] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [selectedNationalRosterId, setSelectedNationalRosterId] = useState("");
  const [nationalRosterMessage, setNationalRosterMessage] = useState("");
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

  const isInternational = getCompetitionScope(roster?.category) === 'international';
  const rosterGender = roster ? getCompetitionGender(roster.category) : 'masculine';

  // National rosters compatible with this player's gender (for club selector)
  const nationalClubRosters = useMemo(() => {
    if (!roster) return [];
    return rosters.filter((r) =>
      r.id !== roster.id &&
      r.category &&
      getCompetitionScope(r.category) === 'national' &&
      (getCompetitionGender(r.category) === 'mixed' || getCompetitionGender(r.category) === rosterGender)
    ).sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));
  }, [rosters, roster, rosterGender]);

  // State stores the roster ID (not name) for reliable matching
  const [infoClubRosterId, setInfoClubRosterId] = useState("");

  // National roster matching the player's club (gender-aware)
  const clubLinkedNationalRoster = useMemo(() => {
    if (!player?.club || !roster) return null;
    const club = player.club.trim();
    // For international rosters: find the national roster with this name, filtered by gender
    if (isInternational) {
      return rosters.find((r) =>
        r.name === club &&
        r.id !== rosterId &&
        getCompetitionScope(r.category) === 'national' &&
        (getCompetitionGender(r.category) === rosterGender || getCompetitionGender(r.category) === 'mixed')
      ) ?? null;
    }
    return null;
  }, [rosters, player?.club, roster, rosterId, isInternational, rosterGender]);

  const isAlreadyInClubRoster = clubLinkedNationalRoster
    ? clubLinkedNationalRoster.players.some((p) => p.id === player?.id)
    : false;

  function syncToClubRoster() {
    if (!player || !clubLinkedNationalRoster || isAlreadyInClubRoster) return;
    const updatedRoster = addPlayerToRosterList(clubLinkedNationalRoster, { ...player });
    setRosters((prev) => prev.map((r) => r.id === updatedRoster.id ? updatedRoster : r));
    setNationalRosterMessage(`${player.name} ajouté·e à ${clubLinkedNationalRoster.name}.`);
  }

  const availableInternationalRosters = useMemo(() => {
    if (!player || isInternational) return [];
    return rosters.filter((r) =>
      r.id !== rosterId &&
      r.category &&
      getCompetitionScope(r.category) === 'international' &&
      (getCompetitionGender(r.category) === 'mixed' || getCompetitionGender(r.category) === rosterGender) &&
      !r.players.some((p) => p.id === player.id)
    ).sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));
  }, [rosters, player, rosterId, rosterGender, isInternational]);

  function addToInternationalRoster() {
    if (!player || !selectedNationalRosterId) return;
    const targetRoster = rosters.find((r) => r.id === selectedNationalRosterId);
    if (!targetRoster) return;
    const updatedRoster = addPlayerToRosterList(targetRoster, { ...player });
    setRosters((prev) => prev.map((r) => r.id === updatedRoster.id ? updatedRoster : r));
    setSelectedNationalRosterId("");
    setNationalRosterMessage(`${player.name} ajouté·e à ${targetRoster.name}.`);
  }

  function saveInfo() {
    if (!roster || !player) return;
    const updatedRoster = updatePlayerInRoster(roster, player.id, {
      name: player.name,
      positions: player.positions,
      photoUrl: player.photoUrl,
      nationality: player.nationality,
      club: infoClubDraft || undefined,
    });
    const playerWithClub = updatedRoster.players.find(p => p.id === player.id);
    const newClub = infoClubDraft.trim();
    // Gender-aware: only match national roster with same name AND compatible gender
    const matchingNationalRoster = isInternational && newClub && playerWithClub
      ? rosters.find((r) =>
          r.id !== roster.id &&
          r.name === newClub &&
          getCompetitionScope(r.category) === 'national' &&
          (getCompetitionGender(r.category) === rosterGender || getCompetitionGender(r.category) === 'mixed') &&
          !r.players.some((p) => p.id === player.id)
        )
      : null;
    setRosters((prev) => prev.map((r) => {
      if (r.id === roster.id) return updatedRoster;
      if (matchingNationalRoster && r.id === matchingNationalRoster.id && playerWithClub) {
        return addPlayerToRosterList(r, playerWithClub);
      }
      return r;
    }));
    setIsEditingInfo(false);
    setInfoMessage(matchingNationalRoster
      ? `Club mis à jour. ${player.name} ajouté·e à l’effectif ${matchingNationalRoster.name}.`
      : "Club mis à jour."
    );
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
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">Informations</h2>
            {!isEditingInfo ? (
              <button
                type="button"
                className="sp-button sp-button-xs sp-button-indigo"
                onClick={() => {
                  // Pre-select the current club roster if one matches
                  const currentClubRoster = nationalClubRosters.find(r => r.name === player.club);
                  setInfoClubRosterId(currentClubRoster?.id ?? "");
                  setInfoClubDraft(player.club ?? "");
                  setIsEditingInfo(true);
                  setInfoMessage("");
                }}
              >
                <FontAwesomeIcon icon={faPenToSquare} className="mr-1" />
                Modifier
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button type="button" className="sp-button sp-button-xs sp-button-blue" onClick={saveInfo}>
                  Enregistrer
                </button>
                <button
                  type="button"
                  className="sp-button sp-button-xs sp-button-light"
                  onClick={() => setIsEditingInfo(false)}
                >
                  Annuler
                </button>
              </div>
            )}
          </div>
          {infoMessage && <p className="text-xs text-emerald-400">{infoMessage}</p>}
          {isInternational && (
            <div className="space-y-1">
              <p className="text-sm font-semibold text-neutral-300">Sélection :</p>
              <p className="text-sm text-neutral-200">{roster.name}</p>
            </div>
          )}
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
          <div className="space-y-1">
            <p className="text-sm font-semibold text-neutral-300">Club :</p>
            {isEditingInfo && isInternational ? (
              <select
                className="sp-input-control"
                value={infoClubRosterId}
                onChange={(e) => {
                  setInfoClubRosterId(e.target.value);
                  const r = nationalClubRosters.find(r => r.id === e.target.value);
                  setInfoClubDraft(r?.name ?? "");
                }}
              >
                <option value="">— Non renseigné —</option>
                {nationalClubRosters.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}{r.category && r.category !== roster.category ? ` (${r.category})` : ""}</option>
                ))}
              </select>
            ) : isEditingInfo ? (
              <input
                className="sp-input-control"
                value={infoClubDraft}
                onChange={(e) => setInfoClubDraft(e.target.value)}
                placeholder="Nom du club"
              />
            ) : (
              <p className="text-sm text-neutral-200">
                {player.club ?? <span className="text-neutral-500 italic">Non renseigné</span>}
              </p>
            )}
          </div>
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

      {isInternational && clubLinkedNationalRoster && !isAlreadyInClubRoster && (
        <section className="sp-panel space-y-3 border-amber-700/50">
          <h2 className="font-semibold text-amber-300">Synchronisation effectif club</h2>
          <p className="text-sm text-neutral-300">
            Le club <strong>{player.club}</strong> est renseigné mais{" "}
            <strong>{player.name}</strong> ne figure pas encore dans l&apos;effectif{" "}
            <strong>{clubLinkedNationalRoster.name}</strong>.
          </p>
          {nationalRosterMessage && (
            <p className="text-xs text-emerald-400">{nationalRosterMessage}</p>
          )}
          <button
            type="button"
            className="sp-button sp-button-sm sp-button-blue"
            onClick={syncToClubRoster}
          >
            Ajouter à {clubLinkedNationalRoster.name}
          </button>
        </section>
      )}

      {!isInternational && availableInternationalRosters.length > 0 && (
        <section className="sp-panel space-y-3">
          <h2 className="font-semibold">Ajouter à une sélection internationale</h2>
          {nationalRosterMessage && (
            <p className="text-xs text-emerald-400">{nationalRosterMessage}</p>
          )}
          <div className="flex items-end gap-2 flex-wrap">
            <div className="sp-input-shell flex-1 min-w-[12rem]">
              <label className="sp-input-label" htmlFor="nationalRosterSelect">Sélection</label>
              <select
                id="nationalRosterSelect"
                className="sp-input-control"
                value={selectedNationalRosterId}
                onChange={(e) => {
                  setSelectedNationalRosterId(e.target.value);
                  setNationalRosterMessage("");
                }}
              >
                <option value="">— Choisir une sélection —</option>
                {availableInternationalRosters.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}{r.category ? ` (${r.category})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="sp-button sp-button-sm sp-button-blue"
              disabled={!selectedNationalRosterId}
              onClick={addToInternationalRoster}
            >
              Ajouter
            </button>
          </div>
        </section>
      )}

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

