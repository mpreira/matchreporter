import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { Link, useParams } from "react-router";
import type { Route } from "./+types/roster-detail";
import { useTeams } from "~/context/TeamsContext";
import { toShortId, findFullId } from "~/utils/shortId";
import { PLAYER_POSITIONS, CURRENT_SEASON, type PlayerPosition, type Team } from "~/types/tracker";
import {
    addPlayerToRosterList,
    createPlayerFromNames,
    createTeam,
    addMultiplePlayersToTeam,
    deleteTeamFromList,
    deletePlayerFromRoster,
    deletePlayerFromTeamData,
    updatePlayerInRoster,
    updateTeamInList,
    parsePlayerName,
} from "~/utils/RosterUtils";
import { faCircleCheck, faPlus, faCircleXmark, faAngleRight, faAngleDown, faTrashCan, faPenToSquare, faUser, faCrown, faChevronLeft, faArrowLeft, faEye } from "@fortawesome/free-solid-svg-icons";
import { faPenToSquare as faPenToSquareRegular } from "@fortawesome/free-regular-svg-icons";
import { COUNTRIES, getFlagUrl } from "~/utils/countries";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

export function meta({ params }: Route.MetaArgs) {
    const rosterId = params.rosterId;
    if (!rosterId) {
        return [{ title: "Détail effectif" }];
    }

    return [{ title: "Détail effectif" }];
}

function getSortableFirstName(fullName: string): string {
    const { first, last } = parsePlayerName(fullName.trim());
    return (first || last).trim();
}

const POSITION_PRIORITY: PlayerPosition[] = [
    "première ligne",
    "talonneur",
    "deuxième ligne",
    "troisième ligne",
    "demi de mêlée",
    "demi d'ouverture",
    "centre",
    "ailier",
    "arrière",
];

function getPositionRank(positions?: PlayerPosition[]): number {
    if (!positions || positions.length === 0) return POSITION_PRIORITY.length;
    const rankedPositions = positions
        .map((position) => POSITION_PRIORITY.indexOf(position))
        .filter((index) => index >= 0);
    return rankedPositions.length > 0 ? Math.min(...rankedPositions) : POSITION_PRIORITY.length;
}

function comparePlayersByPositionThenName(
    firstPlayer: { name: string; positions?: PlayerPosition[] },
    secondPlayer: { name: string; positions?: PlayerPosition[] }
): number {
    const firstRank = getPositionRank(firstPlayer.positions);
    const secondRank = getPositionRank(secondPlayer.positions);
    if (firstRank !== secondRank) return firstRank - secondRank;

    const firstFirstName = getSortableFirstName(firstPlayer.name);
    const secondFirstName = getSortableFirstName(secondPlayer.name);
    const firstNameComparison = firstFirstName.localeCompare(secondFirstName, "fr", { sensitivity: "base" });
    if (firstNameComparison !== 0) return firstNameComparison;

    return firstPlayer.name.localeCompare(secondPlayer.name, "fr", { sensitivity: "base" });
}

export default function RosterDetailPage() {
    const { rosterId: shortRosterId } = useParams();
    const {
        rosters,
        teams,
        setRosters,
        setTeams,
        setActiveRosterId,
        matchDay,
    } = useTeams();

    const [showAddPlayerForm, setShowAddPlayerForm] = useState(false);
    const [newPlayerFirst, setNewPlayerFirst] = useState("");
    const [newPlayerLast, setNewPlayerLast] = useState("");
    const [newPlayerPositions, setNewPlayerPositions] = useState<PlayerPosition[]>([]);
    const [newPlayerPhotoUrl, setNewPlayerPhotoUrl] = useState("");
    const [newPlayerNationality, setNewPlayerNationality] = useState("");
    const [compositionMessage, setCompositionMessage] = useState("");
    const [playerMessage, setPlayerMessage] = useState("");
    const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
    const [editingPlayerFirst, setEditingPlayerFirst] = useState("");
    const [editingPlayerLast, setEditingPlayerLast] = useState("");
    const [editingPlayerPositions, setEditingPlayerPositions] = useState<PlayerPosition[]>([]);
    const [editingPlayerPhotoUrl, setEditingPlayerPhotoUrl] = useState("");
    const [editingPlayerNationality, setEditingPlayerNationality] = useState("");
    const [newPlayerFirstError, setNewPlayerFirstError] = useState("");
    const [newPlayerLastError, setNewPlayerLastError] = useState("");
    const [editingPlayerFirstError, setEditingPlayerFirstError] = useState("");
    const [editingPlayerLastError, setEditingPlayerLastError] = useState("");
    const [compositionEditTeamId, setCompositionEditTeamId] = useState<string | null>(null);
    const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<string>>(new Set());
    const [playerNumbers, setPlayerNumbers] = useState<Record<string, number>>({});
    const [selectedCaptainPlayerId, setSelectedCaptainPlayerId] = useState<string | null>(null);
    const [compositionEditMessage, setCompositionEditMessage] = useState("");
    const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
    const [isRosterPlayersExpanded, setIsRosterPlayersExpanded] = useState(false);
    const [isEditingCoach, setIsEditingCoach] = useState(false);
    const [coachInput, setCoachInput] = useState("");

    function saveCoach() {
        if (!roster) return;
        const updatedRoster = { ...roster, coach: coachInput.trim() || undefined };
        const synced = syncRosterCurrentSeason(updatedRoster);
        setRosters(rosters.map((r) => (r.id === roster.id ? synced : r)));
        setIsEditingCoach(false);
    }

    function syncRosterCurrentSeason(r: typeof rosters[number]) {
        return {
            ...r,
            seasons: {
                ...r.seasons,
                [CURRENT_SEASON]: {
                    players: r.players,
                    coach: r.coach,
                },
            },
        };
    }

    // Convert short ID to full ID
    const rosterId = useMemo(
        () => findFullId(shortRosterId, rosters),
        [shortRosterId, rosters]
    );

    const roster = useMemo(
        () => rosters.find((r) => r.id === rosterId) ?? null,
        [rosters, rosterId]
    );

    const rosterTeams = useMemo(
        () => (teams || []).filter((team) => team.rosterId === roster?.id),
        [teams, roster?.id]
    );

    const compositionEditTeam = useMemo(
        () => rosterTeams.find((team) => team.id === compositionEditTeamId) ?? null,
        [rosterTeams, compositionEditTeamId]
    );

    const editingPlayer = useMemo(
        () => roster?.players.find((player) => player.id === editingPlayerId) ?? null,
        [roster?.players, editingPlayerId]
    );

    const sortedRosterPlayers = useMemo(() => {
        if (!roster) return [];

        return [...roster.players].sort(comparePlayersByPositionThenName);
    }, [roster]);

    const compositionName = matchDay ? `${roster?.name} J${matchDay}` : null;
    const hasCompositionForDay = Boolean(
        compositionName && rosterTeams.some((team) => team.name === compositionName)
    );

    function formatName(value: string) {
        const cleaned = value.replace(/\s+/g, " ");
        if (!cleaned) return "";
        const lowered = cleaned.toLowerCase();
        return lowered.replace(/(^|[- ])[A-Za-zÀ-ÖØ-öø-ÿ]/g, (match) => {
            if (match.length === 1) return match.toUpperCase();
            return `${match.slice(0, -1)}${match.slice(-1).toUpperCase()}`;
        });
    }

    function validateName(value: string) {
        const normalized = value.trim();
        if (!normalized) return "";
        const valid = /^[A-Za-zÀ-ÖØ-öø-ÿ]+(?:[-'][A-Za-zÀ-ÖØ-öø-ÿ]+)*(?: [A-Za-zÀ-ÖØ-öø-ÿ]+(?:[-'][A-Za-zÀ-ÖØ-öø-ÿ]+)*)?$/.test(normalized);
        return valid
            ? ""
            : "Utilise uniquement des lettres (y compris accentuees), un trait d'union, une apostrophe et au maximum un espace.";
    }

    async function readImageAsDataUrl(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const result = typeof reader.result === "string" ? reader.result : "";
                resolve(result);
            };
            reader.onerror = () => reject(new Error("Impossible de lire l'image."));
            reader.readAsDataURL(file);
        });
    }

    function togglePositionSelection(position: PlayerPosition, target: "new" | "edit") {
        if (target === "new") {
            setNewPlayerPositions((prev) =>
                prev.includes(position) ? prev.filter((item) => item !== position) : [...prev, position]
            );
            return;
        }

        setEditingPlayerPositions((prev) =>
            prev.includes(position) ? prev.filter((item) => item !== position) : [...prev, position]
        );
    }

    function removePosition(position: PlayerPosition, target: "new" | "edit") {
        if (target === "new") {
            setNewPlayerPositions((prev) => prev.filter((item) => item !== position));
            return;
        }
        setEditingPlayerPositions((prev) => prev.filter((item) => item !== position));
    }

    async function handlePlayerPhotoUpload(
        event: ChangeEvent<HTMLInputElement>,
        target: "new" | "edit"
    ) {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const dataUrl = await readImageAsDataUrl(file);
            if (target === "new") {
                setNewPlayerPhotoUrl(dataUrl);
            } else {
                setEditingPlayerPhotoUrl(dataUrl);
            }
        } catch {
            setPlayerMessage("Impossible de televerser la photo du joueur.");
        } finally {
            event.target.value = "";
        }
    }

    function getPlayerProfilePath(playerId: string): string {
        if (!rosterId) return "/roster";
        return `/r/${toShortId(rosterId)}/p/${toShortId(playerId)}`;
    }

    function getRosterProfilePath(): string {
        if (!rosterId) return "/roster";
        return `/r/${toShortId(rosterId)}/team`;
    }

    function addTeam() {
        if (!roster) return;
        const name = `${roster.name}${matchDay ? ` J${matchDay}` : ""}`;
        const newTeam = createTeam(name, roster.id, roster.nickname, roster.color, roster.logo);
        setTeams([...(teams || []), newTeam]);
        setCompositionMessage("");
    }

    function deleteTeam(teamToDelete: Team) {
        const confirmed = window.confirm(
            `Supprimer la composition "${teamToDelete.name}" ?`
        );
        if (!confirmed) return;
        setTeams(deleteTeamFromList(teams || [], teamToDelete.id));
        setCompositionMessage("Composition supprimée.");
    }

    function openCompositionEditor(teamId: string) {
        setCompositionEditTeamId(teamId);
        setSelectedPlayerIds(new Set());
        setPlayerNumbers({});
        setSelectedCaptainPlayerId(null);
        setCompositionEditMessage("");
        setExpandedTeams((prev) => {
            const next = new Set(prev);
            next.add(teamId);
            return next;
        });
    }

    function closeCompositionEditor() {
        setCompositionEditTeamId(null);
        setSelectedPlayerIds(new Set());
        setPlayerNumbers({});
        setSelectedCaptainPlayerId(null);
        setCompositionEditMessage("");
    }

    function toggleTeamExpanded(teamId: string) {
        setExpandedTeams((prev) => {
            const next = new Set(prev);
            if (next.has(teamId)) {
                next.delete(teamId);
            } else {
                next.add(teamId);
            }
            return next;
        });
    }

    function togglePlayerSelection(playerId: string) {
        setSelectedPlayerIds((prev) => {
            const next = new Set(prev);
            if (next.has(playerId)) {
                next.delete(playerId);
                setPlayerNumbers((numbers) => {
                    const { [playerId]: _removed, ...rest } = numbers;
                    return rest;
                });
                setSelectedCaptainPlayerId((currentCaptainId) =>
                    currentCaptainId === playerId ? null : currentCaptainId
                );
            } else {
                next.add(playerId);
            }
            return next;
        });
    }

    function updatePlayerNumber(playerId: string, value: number | null) {
        if (value === null || Number.isNaN(value)) {
            setPlayerNumbers((prev) => {
                const { [playerId]: _removed, ...rest } = prev;
                return rest;
            });
            return;
        }

        const clamped = Math.min(23, Math.max(1, value));
        setPlayerNumbers((prev) => ({ ...prev, [playerId]: clamped }));
    }

    function addPlayersToComposition(team: Team) {
        if (!roster) return;
        if (selectedPlayerIds.size === 0) {
            setCompositionEditMessage("Sélectionne au moins un joueur.");
            return;
        }

        const allEntries = [...team.starters, ...team.substitutes];
        const existingPlayerIds = new Set(allEntries.map((entry) => entry.player.id));
        const selectedPlayers = roster.players.filter(
            (player) => selectedPlayerIds.has(player.id) && !existingPlayerIds.has(player.id)
        );

        if (selectedPlayers.length === 0) {
            setCompositionEditMessage("Tous les joueurs sélectionnés sont déjà dans la composition.");
            return;
        }

        for (const player of selectedPlayers) {
            const number = playerNumbers[player.id];
            if (number === undefined) {
                setCompositionEditMessage("Renseigne un numéro pour chaque joueur sélectionné.");
                return;
            }
            if (number < 1 || number > 23) {
                setCompositionEditMessage("Les numéros doivent être compris entre 1 et 23.");
                return;
            }
        }

        const updatedTeam = addMultiplePlayersToTeam(team, selectedPlayers, playerNumbers);
        const teamWithCaptain = selectedCaptainPlayerId
            ? {
                ...updatedTeam,
                captainPlayerId: selectedCaptainPlayerId,
            }
            : updatedTeam;

        setTeams(updateTeamInList(teams || [], teamWithCaptain));
        setCompositionEditMessage("Joueurs ajoutés à la composition.");
        setSelectedPlayerIds(new Set());
        setPlayerNumbers({});
        setSelectedCaptainPlayerId(null);
    }

    function removePlayerFromComposition(team: Team, playerId: string) {
        const teamEntries = [...team.starters, ...team.substitutes];
        const playerName = teamEntries.find((entry) => entry.player.id === playerId)?.player.name ?? "ce joueur";
        const confirmed = window.confirm(
            `Retirer "${playerName}" de la composition "${team.name}" ?`
        );
        if (!confirmed) return;

        const updatedTeam = deletePlayerFromTeamData(team, playerId);
        setTeams(updateTeamInList(teams || [], updatedTeam));
    }

    function addPlayerToRoster() {
        if (!roster) return;
        const formattedFirst = formatName(newPlayerFirst).trim();
        const formattedLast = formatName(newPlayerLast).trim();
        const firstError = validateName(formattedFirst);
        const lastError = validateName(formattedLast);
        setNewPlayerFirstError(firstError);
        setNewPlayerLastError(lastError);
        if (firstError || lastError) return;
        if (!newPlayerFirst && !newPlayerLast) return;

        const player = createPlayerFromNames(
            formattedFirst,
            formattedLast,
            newPlayerPositions,
            newPlayerPhotoUrl,
            newPlayerNationality || undefined
        );
        const updatedRoster = addPlayerToRosterList(roster, player);

        setRosters(rosters.map((r) => (r.id === roster.id ? syncRosterCurrentSeason(updatedRoster) : r)));
        closeAddPlayerForm();
        setPlayerMessage("Joueur ajouté à l'effectif.");
    }

    function closeAddPlayerForm() {
        setShowAddPlayerForm(false);
        setNewPlayerFirst("");
        setNewPlayerLast("");
        setNewPlayerPositions([]);
        setNewPlayerPhotoUrl("");
        setNewPlayerNationality("");
        setNewPlayerFirstError("");
        setNewPlayerLastError("");
    }

    function startEditPlayer(player: { id: string; name: string; positions?: PlayerPosition[]; photoUrl?: string; nationality?: string }) {
        const { first, last } = parsePlayerName(player.name);
        const formattedFirst = formatName(first);
        const formattedLast = formatName(last);
        setEditingPlayerId(player.id);
        setEditingPlayerFirst(formattedFirst);
        setEditingPlayerLast(formattedLast);
        setEditingPlayerPositions(player.positions ?? []);
        setEditingPlayerPhotoUrl(player.photoUrl ?? "");
        setEditingPlayerNationality(player.nationality ?? "");
        setEditingPlayerFirstError(validateName(formattedFirst));
        setEditingPlayerLastError(validateName(formattedLast));
        setPlayerMessage("");
    }

    function cancelEditPlayer() {
        setEditingPlayerId(null);
        setEditingPlayerFirst("");
        setEditingPlayerLast("");
        setEditingPlayerPositions([]);
        setEditingPlayerPhotoUrl("");
        setEditingPlayerNationality("");
        setEditingPlayerFirstError("");
        setEditingPlayerLastError("");
    }

    function saveEditPlayer() {
        if (!roster || !editingPlayerId) return;
        const formattedFirst = formatName(editingPlayerFirst).trim();
        const formattedLast = formatName(editingPlayerLast).trim();
        const firstError = validateName(formattedFirst);
        const lastError = validateName(formattedLast);
        setEditingPlayerFirstError(firstError);
        setEditingPlayerLastError(lastError);
        if (firstError || lastError) return;
        if (!editingPlayerFirst && !editingPlayerLast) return;
        const newName = `${formattedFirst} ${formattedLast}`.trim();
        const updatedRoster = updatePlayerInRoster(roster, editingPlayerId, {
            name: newName,
            positions: editingPlayerPositions,
            photoUrl: editingPlayerPhotoUrl,
            nationality: editingPlayerNationality || undefined,
        });
        setRosters(rosters.map((r) => (r.id === roster.id ? syncRosterCurrentSeason(updatedRoster) : r)));
        cancelEditPlayer();
        setPlayerMessage("Joueur modifié.");
    }

    function deletePlayer(playerId: string, playerName: string) {
        if (!roster) return;
        const confirmed = window.confirm(
            `Supprimer le joueur "${playerName}" de l'effectif ?`
        );
        if (!confirmed) return;
        const updatedRoster = deletePlayerFromRoster(roster, playerId);
        setRosters(rosters.map((r) => (r.id === roster.id ? syncRosterCurrentSeason(updatedRoster) : r)));
        if (editingPlayerId === playerId) {
            cancelEditPlayer();
        }
        setPlayerMessage("Joueur supprimé.");
    }

    if (!roster) {
        return (
            <main className="w-full max-w-screen-md mx-auto px-4 py-6 space-y-4 overflow-x-hidden">
                <p className="text-sm text-gray-700">Effectif introuvable.</p>
                <Link to="/roster" className="inline-flex items-center gap-2 text-white">
                    <FontAwesomeIcon icon={faChevronLeft} />
                    Retour aux effectifs
                </Link>
            </main>
        );
    }

    useEffect(() => {
        setActiveRosterId(roster.id);
    }, [roster.id, setActiveRosterId]);

    // Migrate: populate seasons from players if not present
    useEffect(() => {
        if (!roster.seasons || !roster.seasons[CURRENT_SEASON]) {
            const migrated = syncRosterCurrentSeason(roster);
            setRosters((prev) => prev.map((r) => (r.id === roster.id ? migrated : r)));
        }
    }, [roster.id]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        document.title = roster.name;
    }, [roster.name]);

    return (
        <main className="w-full max-w-screen-md mx-auto px-4 py-6 space-y-6 text-base md:text-lg overflow-x-hidden">
            <div className="space-y-1">
                <h1 className="leading-[0.95] font-bold tracking-[-0.03em] text-4xl text-center text-white">{roster.name}</h1>
                <p className="text-foreground max-w-3xl text-base font-light text-white text-balance sm:text-lg text-center mx-auto mb-8">Championnat : {roster.category || "N/A"}</p>
                
                <Link to="/roster" className="inline-flex items-center gap-2 text-white text-sm">
                    <FontAwesomeIcon icon={faArrowLeft} />
                    Retour aux effectifs
                </Link>
                <div>
                    <Link
                        className="sp-button sp-button-sm sp-button-indigo mt-4"
                        to={getRosterProfilePath()}
                        aria-label={`Voir le détail de l'effectif ${roster.name}`}
                    >
                        <FontAwesomeIcon icon={faEye} className="mr-1" />
                        Détail
                    </Link>
                </div>
            </div>

            <section className="space-y-2">
                <h2 className="font-semibold">Compositions</h2>
                <p className="text-sm font-light text-white">
                    Entraineur : {roster.coach || "Non renseigné"}
                </p>
                {compositionEditTeamId && compositionEditTeam && roster && (
                    <div
                        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4 py-4 pb-28 md:py-8 md:pb-10"
                        onClick={closeCompositionEditor}
                    >
                        <div
                            className="w-full max-w-2xl max-h-[calc(100dvh-8rem)] overflow-y-auto space-y-3 border-neutral-700 bg-neutral-900 text-neutral-300 rounded p-3"
                            onClick={(event) => event.stopPropagation()}
                        >
                            <div className="flex items-center justify-between">
                                <h3 className="font-semibold">Ajouter des joueurs - {compositionEditTeam.name}</h3>
                                <button
                                    className="sp-button sp-button-neutral sp-button-icon"
                                    onClick={closeCompositionEditor}
                                >
                                    <FontAwesomeIcon icon={faCircleXmark} />
                                </button>
                            </div>

                            {(() => {
                                const allEntries = [...compositionEditTeam.starters, ...compositionEditTeam.substitutes];
                                const existingIds = new Set(allEntries.map((entry) => entry.player.id));
                                const availablePlayers = roster.players
                                    .filter((player) => !existingIds.has(player.id))
                                    .sort(comparePlayersByPositionThenName);

                                if (availablePlayers.length === 0) {
                                    return (
                                        <div className="space-y-2">
                                            <p className="text-sm text-gray-600">
                                                Aucun joueur disponible pour cette composition.
                                            </p>
                                        </div>
                                    );
                                }

                                return (
                                    <div className="space-y-2 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 transition-shadow focus-within:border-sky-500/70 focus-within:shadow-md focus-within:shadow-sky-500/30">
                                        <div className="grid grid-cols-[minmax(0,1fr)_8rem_6rem] items-center gap-3 border-b border-neutral-700 pb-2 text-xs font-semibold text-gray-400">
                                            <span>Joueur</span>
                                            <span className="text-center">Capitaine</span>
                                            <span className="text-right">Numéro</span>
                                        </div>
                                        <ul className="space-y-2">
                                        {availablePlayers.map((player) => (
                                            <li key={player.id} className="grid grid-cols-[minmax(0,1fr)_8rem_6rem] items-center gap-3">
                                                <label className="flex min-w-0 items-center gap-2 text-left">
                                                    <input
                                                        className="h-4 w-4 min-w-0 border-0 bg-transparent p-0 shadow-none focus:ring-0 focus:border-0"
                                                        type="checkbox"
                                                        checked={selectedPlayerIds.has(player.id)}
                                                        onChange={() => togglePlayerSelection(player.id)}
                                                    />
                                                    <span className="truncate">{player.name}</span>
                                                </label>
                                                <label className="flex items-center justify-center gap-1 text-xs text-gray-400">
                                                    <input
                                                        type="radio"
                                                        name={`captain-${compositionEditTeam.id}`}
                                                        className="h-4 w-4"
                                                        checked={selectedCaptainPlayerId === player.id}
                                                        onChange={() => {
                                                            if (!selectedPlayerIds.has(player.id)) {
                                                                togglePlayerSelection(player.id);
                                                            }
                                                            setSelectedCaptainPlayerId(player.id);
                                                        }}
                                                        disabled={!selectedPlayerIds.has(player.id)}
                                                    />
                                                    Capitaine
                                                </label>
                                                <input
                                                    type="number"
                                                    min={1}
                                                    max={23}
                                                    className="h-auto w-20 min-w-[5rem] border-0 bg-transparent p-0 text-right text-sm md:text-base font-light leading-none shadow-none focus:ring-0 focus:border-0"
                                                    value={playerNumbers[player.id] ?? ""}
                                                    onChange={(e) => {
                                                        const raw = e.target.value;
                                                        updatePlayerNumber(player.id, raw === "" ? null : Number(raw));
                                                    }}
                                                    placeholder="-"
                                                    disabled={!selectedPlayerIds.has(player.id)}
                                                />
                                            </li>
                                        ))}
                                        </ul>
                                    </div>
                                );
                            })()}

                            <button
                                className="sp-button sp-button-sm sp-button-indigo"
                                onClick={() => addPlayersToComposition(compositionEditTeam)}
                            >
                                <FontAwesomeIcon icon={faPlus} className="mr-1" />
                                Ajouter
                            </button>

                            {compositionEditMessage && (
                                <p className="text-sm text-green-700">
                                    <FontAwesomeIcon icon={faCircleCheck} className="mr-1" />
                                    {compositionEditMessage}
                                </p>
                            )}
                        </div>
                    </div>
                )}
                {rosterTeams.length === 0 ? (
                    <p className="text-sm text-gray-600">Aucune composition disponible</p>
                ) : (
                    <ul className="space-y-1">
                        {rosterTeams.map((team: Team) => (
                            <li key={team.id} className="p-2 space-y-2 py-2">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <button
                                            className="px-2 py-1 text-sm font-bold"
                                            onClick={() => toggleTeamExpanded(team.id)}
                                            aria-label={expandedTeams.has(team.id) ? "Réduire la composition" : "Afficher la composition"}
                                        >
                                            {expandedTeams.has(team.id) ? <FontAwesomeIcon icon={faAngleDown} /> : <FontAwesomeIcon icon={faAngleRight} />}
                                        </button>
                                        <span className="text-white font-semibold uppercase">{team.name}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            className="sp-button sp-button-xs sp-button-blue h-8"
                                            onClick={() =>
                                                compositionEditTeamId === team.id
                                                    ? closeCompositionEditor()
                                                    : openCompositionEditor(team.id)
                                            }
                                        >
                                            <FontAwesomeIcon icon={faPlus} /> <FontAwesomeIcon icon={faUser} />
                                        </button>
                                        <button
                                            className="sp-button sp-button-red sp-button-icon"
                                            onClick={() => deleteTeam(team)}
                                        >
                                            <FontAwesomeIcon icon={faTrashCan} />
                                        </button>
                                    </div>
                                </div>

                                {expandedTeams.has(team.id) && (
                                    <>
                                        {team.starters.length + team.substitutes.length > 0 ? (
                                            <div className="space-y-2">
                                                <h4 className="font-semibold text-sm">Composition actuelle</h4>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    <div>
                                                        <p className="text-xs font-semibold text-gray-600 mb-1">Titulaires (1-15)</p>
                                                        <ul className="space-y-1 text-base">
                                                            {[...team.starters]
                                                                .sort((firstEntry, secondEntry) => firstEntry.number - secondEntry.number)
                                                                .map((entry) => (
                                                                <li key={entry.player.id} className="flex items-center gap-2">
                                                                    <span className="font-bold text-white w-6">{entry.number}</span>
                                                                    <span className="flex-1 inline-flex items-center gap-1">
                                                                        {entry.player.name}
                                                                        {team.captainPlayerId === entry.player.id && (
                                                                            <FontAwesomeIcon icon={faCrown} className="text-sky-400" />
                                                                        )}
                                                                    </span>
                                                                    <button
                                                                        className="sp-button sp-button-xs sp-button-neutral"
                                                                        onClick={() => removePlayerFromComposition(team, entry.player.id)}
                                                                    >
                                                                        <FontAwesomeIcon icon={faTrashCan} />
                                                                    </button>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-semibold text-gray-600 mb-1">Remplaçants (16-23)</p>
                                                        <ul className="space-y-1 text-base">
                                                            {[...team.substitutes]
                                                                .sort((firstEntry, secondEntry) => firstEntry.number - secondEntry.number)
                                                                .map((entry) => (
                                                                <li key={entry.player.id} className="flex items-center gap-2">
                                                                    <span className="font-bold text-white w-6">{entry.number}</span>
                                                                    <span className="flex-1 inline-flex items-center gap-1">
                                                                        {entry.player.name}
                                                                        {team.captainPlayerId === entry.player.id && (
                                                                            <FontAwesomeIcon icon={faCrown} className="text-sky-400" />
                                                                        )}
                                                                    </span>
                                                                    <button
                                                                        className="sp-button sp-button-xs sp-button-neutral"
                                                                        onClick={() => removePlayerFromComposition(team, entry.player.id)}
                                                                    >
                                                                        <FontAwesomeIcon icon={faTrashCan} />
                                                                    </button>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-sm text-gray-600">aucun joueur dans la composition.</p>
                                        )}
                                    </>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
                {!hasCompositionForDay && (
                    <button
                        className="sp-button sp-button-sm sp-button-blue"
                        onClick={addTeam}
                        disabled={!matchDay}
                    >
                        <FontAwesomeIcon icon={faPlus} className="mr-2" />
                        Créer « {roster.name} {matchDay && `J${matchDay}`} »
                    </button>
                )}
                {compositionMessage && (
                    <p className="text-sm text-green-700">
                        <FontAwesomeIcon icon={faCircleCheck} className="mr-1" />
                        {compositionMessage}
                    </p>
                )}
            </section>

            <section className="space-y-2">
                <div className="flex items-center gap-2">
                    <button
                        className="px-2 py-1 text-sm font-bold"
                        onClick={() => setIsRosterPlayersExpanded((value) => !value)}
                        aria-label={isRosterPlayersExpanded ? "Masquer la liste des joueurs" : "Afficher la liste des joueurs"}
                    >
                        {isRosterPlayersExpanded ? <FontAwesomeIcon icon={faAngleDown} /> : <FontAwesomeIcon icon={faAngleRight} />}
                    </button>
                    <h2 className="font-semibold">Effectif</h2>
                </div>
                {showAddPlayerForm && (
                    <div
                        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4 py-4 pb-28 md:py-8 md:pb-10"
                        onClick={closeAddPlayerForm}
                    >
                        <div
                            className="w-full max-w-lg max-h-[calc(100dvh-8rem)] overflow-y-auto flex flex-col items-stretch gap-3 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2"
                            onClick={(event) => event.stopPropagation()}
                        >
                            <div className="sp-input-shell">
                                <label className="sp-input-label" htmlFor="newPlayerFirst">Prénom</label>
                                <input
                                    id="newPlayerFirst"
                                    className="sp-input-control"
                                    placeholder="ex. Jean"
                                    value={newPlayerFirst}
                                    onChange={(e) => {
                                        const formatted = formatName(e.target.value);
                                        setNewPlayerFirst(formatted);
                                        setNewPlayerFirstError(validateName(formatted));
                                    }}
                                />
                            </div>
                            {newPlayerFirstError && (
                                <p className="text-sm text-red-400">{newPlayerFirstError}</p>
                            )}
                            <div className="sp-input-shell">
                                <label className="sp-input-label" htmlFor="newPlayerLast">Nom</label>
                                <input
                                    id="newPlayerLast"
                                    className="sp-input-control"
                                    placeholder="ex. Dupont"
                                    value={newPlayerLast}
                                    onChange={(e) => {
                                        const formatted = formatName(e.target.value);
                                        setNewPlayerLast(formatted);
                                        setNewPlayerLastError(validateName(formatted));
                                    }}
                                />
                            </div>
                            {newPlayerLastError && (
                                <p className="text-sm text-red-400">{newPlayerLastError}</p>
                            )}
                            <div className="sp-input-shell">
                                <p className="sp-input-label">Postes (facultatif)</p>
                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                    {PLAYER_POSITIONS.map((position) => {
                                        const checked = newPlayerPositions.includes(position);
                                        return (
                                            <label key={`new-checkbox-${position}`} className="flex items-center gap-2 text-sm text-neutral-200 font-normal">
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() => togglePositionSelection(position, "new")}
                                                    className="h-4 w-4"
                                                />
                                                <span>{position}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                            {newPlayerPositions.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {newPlayerPositions.map((position) => (
                                        <button
                                            key={`new-${position}`}
                                            type="button"
                                            className="sp-button sp-button-xs sp-button-neutral"
                                            onClick={() => removePosition(position, "new")}
                                            title="Retirer ce poste"
                                        >
                                            {position} x
                                        </button>
                                    ))}
                                </div>
                            )}
                            <div className="sp-input-shell">
                                <label className="sp-input-label" htmlFor="newPlayerPhotoUrl">Photo (URL ou upload)</label>
                                <input
                                    id="newPlayerPhotoUrl"
                                    className="sp-input-control"
                                    placeholder="https://..."
                                    value={newPlayerPhotoUrl}
                                    onChange={(event) => setNewPlayerPhotoUrl(event.target.value)}
                                />
                            </div>
                            <div className="sp-input-shell">
                                <label className="sp-input-label" htmlFor="newPlayerPhotoFile">Televerser une photo</label>
                                <input
                                    id="newPlayerPhotoFile"
                                    type="file"
                                    accept="image/*"
                                    className="sp-input-control"
                                    onChange={(event) => {
                                        void handlePlayerPhotoUpload(event, "new");
                                    }}
                                />
                            </div>
                            <div className="sp-input-shell">
                                <label className="sp-input-label" htmlFor="newPlayerNationality">Nationalité</label>
                                <select
                                    id="newPlayerNationality"
                                    className="sp-input-control"
                                    value={newPlayerNationality}
                                    onChange={(event) => setNewPlayerNationality(event.target.value)}
                                >
                                    <option value="">— Non renseignée —</option>
                                    {COUNTRIES.map((c) => (
                                        <option key={c.code} value={c.code}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex items-center justify-center gap-2">
                                <button
                                    className="sp-button sp-button-sm sp-button-blue"
                                    onClick={addPlayerToRoster}
                                    disabled={!newPlayerFirst && !newPlayerLast}
                                >
                                    Valider
                                </button>
                                <button
                                    className="sp-button sp-button-sm sp-button-light"
                                    onClick={closeAddPlayerForm}
                                >
                                    Annuler
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                {editingPlayerId && editingPlayer && (
                    <div
                        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4 py-4 pb-28 md:py-8 md:pb-10"
                        onClick={cancelEditPlayer}
                    >
                        <div
                            className="w-full max-w-lg max-h-[calc(100dvh-8rem)] overflow-y-auto flex flex-col items-stretch gap-3 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2"
                            onClick={(event) => event.stopPropagation()}
                        >
                            <div className="flex items-center justify-between">
                                <h3 className="font-semibold">Modifier {editingPlayer.name}</h3>
                                <button
                                    className="sp-button sp-button-neutral sp-button-icon"
                                    onClick={cancelEditPlayer}
                                >
                                    <FontAwesomeIcon icon={faCircleXmark} />
                                </button>
                            </div>
                            <div className="sp-input-shell">
                                <label className="sp-input-label" htmlFor="editingPlayerFirst">Prénom</label>
                                <input
                                    id="editingPlayerFirst"
                                    className="sp-input-control"
                                    placeholder="Prénom"
                                    value={editingPlayerFirst}
                                    onChange={(e) => {
                                        const formatted = formatName(e.target.value);
                                        setEditingPlayerFirst(formatted);
                                        setEditingPlayerFirstError(validateName(formatted));
                                    }}
                                />
                            </div>
                            {editingPlayerFirstError && (
                                <p className="text-sm text-red-400">{editingPlayerFirstError}</p>
                            )}
                            <div className="sp-input-shell">
                                <label className="sp-input-label" htmlFor="editingPlayerLast">Nom</label>
                                <input
                                    id="editingPlayerLast"
                                    className="sp-input-control"
                                    placeholder="Nom"
                                    value={editingPlayerLast}
                                    onChange={(e) => {
                                        const formatted = formatName(e.target.value);
                                        setEditingPlayerLast(formatted);
                                        setEditingPlayerLastError(validateName(formatted));
                                    }}
                                />
                            </div>
                            {editingPlayerLastError && (
                                <p className="text-sm text-red-400">{editingPlayerLastError}</p>
                            )}
                            <div className="sp-input-shell">
                                <p className="sp-input-label">Postes (facultatif)</p>
                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                    {PLAYER_POSITIONS.map((position) => {
                                        const checked = editingPlayerPositions.includes(position);
                                        return (
                                            <label key={`edit-checkbox-${position}`} className="flex items-center gap-2 text-sm text-neutral-200 font-normal">
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() => togglePositionSelection(position, "edit")}
                                                    className="h-4 w-4"
                                                />
                                                <span>{position}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                            {editingPlayerPositions.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {editingPlayerPositions.map((position) => (
                                        <button
                                            key={`edit-${position}`}
                                            type="button"
                                            className="sp-button sp-button-xs sp-button-neutral"
                                            onClick={() => removePosition(position, "edit")}
                                            title="Retirer ce poste"
                                        >
                                            {position} x
                                        </button>
                                    ))}
                                </div>
                            )}
                            <div className="sp-input-shell">
                                <label className="sp-input-label" htmlFor="editingPlayerPhotoUrl">Photo (URL ou upload)</label>
                                <input
                                    id="editingPlayerPhotoUrl"
                                    className="sp-input-control"
                                    placeholder="https://..."
                                    value={editingPlayerPhotoUrl}
                                    onChange={(event) => setEditingPlayerPhotoUrl(event.target.value)}
                                />
                            </div>
                            <div className="sp-input-shell">
                                <label className="sp-input-label" htmlFor="editingPlayerPhotoFile">Televerser une photo</label>
                                <input
                                    id="editingPlayerPhotoFile"
                                    type="file"
                                    accept="image/*"
                                    className="sp-input-control"
                                    onChange={(event) => {
                                        void handlePlayerPhotoUpload(event, "edit");
                                    }}
                                />
                            </div>
                            <div className="sp-input-shell">
                                <label className="sp-input-label" htmlFor="editingPlayerNationality">Nationalité</label>
                                <select
                                    id="editingPlayerNationality"
                                    className="sp-input-control"
                                    value={editingPlayerNationality}
                                    onChange={(event) => setEditingPlayerNationality(event.target.value)}
                                >
                                    <option value="">— Non renseignée —</option>
                                    {COUNTRIES.map((c) => (
                                        <option key={c.code} value={c.code}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex items-center justify-center gap-2">
                                <button
                                    className="sp-button sp-button-sm sp-button-blue h-36px"
                                    onClick={saveEditPlayer}
                                    disabled={!editingPlayerFirst && !editingPlayerLast}
                                >
                                    Valider
                                </button>
                                <button
                                    className="sp-button sp-button-sm sp-button-light"
                                    onClick={cancelEditPlayer}
                                >
                                    Annuler
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                {isRosterPlayersExpanded && (
                    <>
                        {sortedRosterPlayers.length === 0 ? (
                            <p className="text-sm text-gray-600">Aucun joueur dans cet effectif.</p>
                        ) : (
                            <ul className="space-y-4 mt-6">
                                {sortedRosterPlayers.map((player) => (
                                    <li key={player.id} className="bg-neutral-900 border border-neutral-800 text-base font-semibold w-5/6 mx-auto px-4 space-y-6 mb-2 py-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="min-w-0">
                                                <Link to={getPlayerProfilePath(player.id)} className="text-white font-semibold hover:underline">
                                                    {player.name}
                                                </Link>
                                                {player.positions && player.positions.length > 0 && (
                                                    <p className="text-xs text-neutral-400 font-normal mt-1">
                                                        {player.positions.join(" / ")}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    className="sp-button sp-button-yellow sp-button-icon"
                                                    onClick={() => startEditPlayer(player)}
                                                >
                                                    <FontAwesomeIcon icon={faPenToSquare} />
                                                </button>
                                                <button
                                                    className="sp-button sp-button-red sp-button-icon"
                                                    onClick={() => deletePlayer(player.id, player.name)}
                                                >
                                                    <FontAwesomeIcon icon={faTrashCan} />
                                                </button>
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </>
                )}
                <button
                    className="sp-button sp-button-sm sp-button-indigo mt-6"
                    onClick={() => setShowAddPlayerForm((value) => !value)}
                >
                    <FontAwesomeIcon icon={faPlus} className="mr-2" />
                    Ajouter un joueur à l'effectif
                </button>
                {playerMessage && (
                    <p className="text-sm text-green-700">
                        <FontAwesomeIcon icon={faCircleCheck} className="mr-1" />
                        {playerMessage}
                    </p>
                )}
            </section>
        </main>
    );
}