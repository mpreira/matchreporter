import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import type { Team, Player, Roster, Title } from "~/types/tracker";
import { toShortId } from "~/utils/shortId";
import { useTeams } from "~/context/TeamsContext";
import {
    createNewRoster,
    deleteRosterFromList,
    deleteTeamsFromRoster,
    addPlayerToRosterList,
    deletePlayerFromRoster,
    updatePlayerInRoster,
    createPlayerFromNames,
    parsePlayerName,
    createTeam,
    deleteTeamFromList,
    updateTeamInList,
    deletePlayerFromTeamData,
    importTeamFromJSON,
    getTeamPlayers,
} from "~/utils/RosterUtils";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleCheck, faPlus, faPenToSquare, faTrashCan } from "@fortawesome/free-solid-svg-icons";

interface Props {
    rosters: Roster[];
    teams: Team[];
    activeRosterId: string | null;
    setRosters: React.Dispatch<React.SetStateAction<Roster[]>>;
    setTeams: React.Dispatch<React.SetStateAction<Team[]>>;
    setActiveRosterId: React.Dispatch<React.SetStateAction<string | null>>;
}

export default function RosterManager({
    rosters,
    teams,
    activeRosterId,
    setRosters,
    setTeams,
    setActiveRosterId,
}: Props) {
    const navigate = useNavigate();
    const [jsonInput, setJsonInput] = useState("");
    const [teamName, setTeamName] = useState("");
    const [newRosterName, setNewRosterName] = useState("");
    const [newRosterNickname, setNewRosterNickname] = useState("");
    const [newRosterColor, setNewRosterColor] = useState("");
    const [newRosterLogo, setNewRosterLogo] = useState("");
    const [newRosterCoach, setNewRosterCoach] = useState("");
    const [newRosterPresident, setNewRosterPresident] = useState("");
    const [newRosterFoundedIn, setNewRosterFoundedIn] = useState("");
    const [newRosterTitles, setNewRosterTitles] = useState<Title[]>([{ competition: "", ranking: "Champion.ne", year: new Date().getFullYear() }]);
    const [newRosterCategory, setNewRosterCategory] = useState<'Top 14' | 'Pro D2' | 'W6N'>('Top 14');
    const championshipOptions = ['Top 14', 'Pro D2', 'W6N'] as const;
    const titleCompetitionOptions: Title["competition"][] = ['Top 14', 'Pro D2', "Women's Six Nations", 'Six Nations', "Coupe d'Europe", 'Challenge Cup'];
    const titleRankingOptions: Title["ranking"][] = ['Champion.ne', 'Vice-Champion.ne', '3e'];
    const [showCreateRosterForm, setShowCreateRosterForm] = useState(false);
    const [activeCategoryTab, setActiveCategoryTab] = useState<'Top 14' | 'Pro D2' | 'W6N'>('Top 14');
    const [rosterFeedbackMessage, setRosterFeedbackMessage] = useState("");
    const [newPlayerFirst, setNewPlayerFirst] = useState("");
    const [newPlayerLast, setNewPlayerLast] = useState("");
    const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
    const [editingPlayerFirst, setEditingPlayerFirst] = useState("");
    const [editingPlayerLast, setEditingPlayerLast] = useState("");
    const [selectedRosterForPlayer, setSelectedRosterForPlayer] = useState<string | null>(null);
    const [viewTeamId, setViewTeamId] = useState<string | null>(null);
    const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
    const [editingRosterId, setEditingRosterId] = useState<string | null>(null);
    const [editingRosterName, setEditingRosterName] = useState("");
    const [editingRosterNickname, setEditingRosterNickname] = useState("");
    const [editingRosterColor, setEditingRosterColor] = useState("");
    const [editingRosterLogo, setEditingRosterLogo] = useState("");
    const [editingRosterCoach, setEditingRosterCoach] = useState("");
    const [editingRosterPresident, setEditingRosterPresident] = useState("");
    const [editingRosterFoundedIn, setEditingRosterFoundedIn] = useState("");
    const [editingRosterTitles, setEditingRosterTitles] = useState<Title[]>([{ competition: "", ranking: "Champion.ne", year: new Date().getFullYear() }]);
    const [rosterFormError, setRosterFormError] = useState("");

    const activeRoster = rosters.find((r) => r.id === activeRosterId);
    const activeTeams = (teams || []).filter((t) => t.rosterId === activeRosterId);
    const rosterViewPlayers = viewTeamId
        ? getTeamPlayers(activeTeams.find(t => t.id === viewTeamId) || { id: "", name: "", rosterId: "", starters: [], substitutes: [] })
        : activeRoster?.players || []; 

    function normalizeNickname(value: string): string {
        return value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
    }

    function validateNickname(value: string): string {
        if (!value) return "";
        return /^[A-Z]{2,4}$/.test(value)
            ? ""
            : "Le surnom doit contenir entre 2 et 4 lettres majuscules (ex: SR, TOU ou TOUL).";
    }

    function normalizeColor(value: string): string {
        return value.trim().toUpperCase();
    }

    function normalizeLogo(value: string): string {
        return value.trim();
    }

    function normalizeCoach(value: string): string {
        return value.trim();
    }

    function createEmptyTitle(): Title {
        return { competition: "", ranking: "Champion.ne", year: new Date().getFullYear() };
    }

    function isW6NCompetition(value: string): boolean {
        const normalized = value.trim().toLowerCase();
        return normalized === 'w6n' || normalized === "women's six nations" || normalized === 'womens six nations';
    }

    function normalizeTitles(titles: Title[]): Title[] {
        return titles
            .filter((title) => title.competition.trim() && title.year > 0)
            .map((title) => ({
                ...title,
                grandSlam: isW6NCompetition(title.competition) && title.ranking === 'Champion.ne'
                    ? title.grandSlam
                    : undefined,
            }));
    }

    function addTitleRow(target: 'new' | 'edit') {
        if (target === 'new') {
            setNewRosterTitles((prev) => [...prev, createEmptyTitle()]);
            return;
        }
        setEditingRosterTitles((prev) => [...prev, createEmptyTitle()]);
    }

    function removeTitleRow(target: 'new' | 'edit', index: number) {
        if (target === 'new') {
            setNewRosterTitles((prev) => {
                const next = prev.filter((_, currentIndex) => currentIndex !== index);
                return next.length > 0 ? next : [createEmptyTitle()];
            });
            return;
        }
        setEditingRosterTitles((prev) => {
            const next = prev.filter((_, currentIndex) => currentIndex !== index);
            return next.length > 0 ? next : [createEmptyTitle()];
        });
    }

    function updateTitleRow(target: 'new' | 'edit', index: number, field: keyof Title, value: string | number | boolean | undefined) {
        const applyUpdate = (titles: Title[]) => titles.map((title, currentIndex) => {
            if (currentIndex !== index) return title;

            const updatedTitle = { ...title, [field]: value };
            if (!isW6NCompetition(updatedTitle.competition) || updatedTitle.ranking !== 'Champion.ne') {
                updatedTitle.grandSlam = undefined;
            } else if (updatedTitle.grandSlam !== true) {
                updatedTitle.grandSlam = false;
            }
            return updatedTitle;
        });

        if (target === 'new') {
            setNewRosterTitles(applyUpdate);
            return;
        }
        setEditingRosterTitles(applyUpdate);
    }

    function renderTitlesEditor(target: 'new' | 'edit', titles: Title[]) {
        return (
            <div className="space-y-2">
                {titles.map((title, index) => {
                    const showGrandSlam = isW6NCompetition(title.competition) && title.ranking === 'Champion.ne';

                    return (
                        <div key={`${target}-title-${index}`} className="flex items-center gap-2">
                            <select
                                className="sp-input-control min-w-0 flex-1 text-sm"
                                value={title.competition}
                                onChange={(event) => updateTitleRow(target, index, 'competition', event.target.value)}
                            >
                                <option value="">Compétition</option>
                                {titleCompetitionOptions.map((option) => (
                                    <option key={option} value={option}>{option}</option>
                                ))}
                            </select>
                            <select
                                className="sp-input-control w-32 shrink-0 text-sm"
                                value={title.ranking}
                                onChange={(event) => updateTitleRow(target, index, 'ranking', event.target.value)}
                            >
                                {titleRankingOptions.map((option) => (
                                    <option key={option} value={option}>{option}</option>
                                ))}
                            </select>
                            <input
                                type="number"
                                className="sp-input-control w-24 shrink-0 text-sm"
                                placeholder="Année"
                                value={title.year || ''}
                                onChange={(event) => updateTitleRow(target, index, 'year', parseInt(event.target.value, 10) || 0)}
                            />
                            <label className={`flex h-10 items-center gap-2 rounded-md border border-neutral-700 bg-neutral-950/60 px-2 text-xs whitespace-nowrap ${showGrandSlam ? 'text-neutral-200' : 'text-neutral-500'}`}>
                                <input
                                    type="checkbox"
                                    checked={title.grandSlam === true}
                                    disabled={!showGrandSlam}
                                    onChange={(event) => updateTitleRow(target, index, 'grandSlam', event.target.checked)}
                                />
                                Grand Chelem
                            </label>
                            <button
                                type="button"
                                className="sp-button sp-button-red sp-button-icon shrink-0"
                                onClick={() => removeTitleRow(target, index)}
                                aria-label="Supprimer cette ligne de palmarès"
                            >
                                <FontAwesomeIcon icon={faTrashCan} />
                            </button>
                        </div>
                    );
                })}
                <button
                    type="button"
                    className="sp-button sp-button-xs sp-button-neutral"
                    onClick={() => addTitleRow(target)}
                >
                    <FontAwesomeIcon icon={faPlus} className="mr-1" />
                    Ajouter une ligne
                </button>
            </div>
        );
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

    async function handleRosterLogoUpload(event: React.ChangeEvent<HTMLInputElement>, target: "new" | "edit") {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const dataUrl = await readImageAsDataUrl(file);
            if (target === "new") {
                setNewRosterLogo(dataUrl);
            } else {
                setEditingRosterLogo(dataUrl);
            }
            setRosterFormError("");
        } catch {
            setRosterFormError("Impossible de televerser le logo.");
        } finally {
            event.target.value = "";
        }
    }

    function validateColor(value: string): string {
        if (!value) return "";
        return /^#[0-9A-F]{6}$/.test(value)
            ? ""
            : "La couleur doit être au format hexadécimal #RRGGBB.";
    }

    function createRoster() {
        const trimmedName = newRosterName.trim();
        const nickname = normalizeNickname(newRosterNickname);
        const color = normalizeColor(newRosterColor);
        const logo = normalizeLogo(newRosterLogo);
        const coach = normalizeCoach(newRosterCoach);
        const nicknameError = validateNickname(nickname);
        const colorError = validateColor(color);
        if (!trimmedName) return;
        if (nicknameError) {
            setRosterFormError(nicknameError);
            return;
        }
        if (colorError) {
            setRosterFormError(colorError);
            return;
        }

        const president = newRosterPresident.trim();
        const foundedIn = newRosterFoundedIn.trim() ? parseInt(newRosterFoundedIn.trim(), 10) : undefined;
        const titles = normalizeTitles(newRosterTitles);
        const newRoster = createNewRoster(
            trimmedName,
            newRosterCategory,
            nickname || undefined,
            color || undefined,
            logo || undefined,
            coach || undefined,
            president || undefined,
            !isNaN(foundedIn as number) ? foundedIn : undefined,
            titles.length > 0 ? titles : undefined
        );
        setRosters([...rosters, newRoster]);
        setActiveRosterId(newRoster.id);
        setRosterFeedbackMessage("Effectif créé avec succès.");
        setRosterFormError("");
        closeCreateRosterForm();
    }

    function closeCreateRosterForm() {
        setShowCreateRosterForm(false);
        setNewRosterName("");
        setNewRosterNickname("");
        setNewRosterColor("");
        setNewRosterLogo("");
        setNewRosterCoach("");
        setNewRosterPresident("");
        setNewRosterFoundedIn("");
        setNewRosterTitles([createEmptyTitle()]);
        setNewRosterCategory('Top 14');
        setRosterFormError("");
    }

    function openEditRosterForm(roster: Roster) {
        setEditingRosterId(roster.id);
        setEditingRosterName(roster.name);
        setEditingRosterNickname(roster.nickname || "");
        setEditingRosterColor(roster.color || "");
        setEditingRosterLogo(roster.logo || "");
        setEditingRosterCoach(roster.coach || "");
        setEditingRosterPresident(roster.president || "");
        setEditingRosterFoundedIn(roster.founded_in ? String(roster.founded_in) : "");
        setEditingRosterTitles(roster.titles && roster.titles.length > 0 ? roster.titles.map((title) => ({ ...title })) : [createEmptyTitle()]);
        setRosterFormError("");
    }

    function closeEditRosterForm() {
        setEditingRosterId(null);
        setEditingRosterName("");
        setEditingRosterNickname("");
        setEditingRosterColor("");
        setEditingRosterLogo("");
        setEditingRosterCoach("");
        setEditingRosterPresident("");
        setEditingRosterFoundedIn("");
        setEditingRosterTitles([createEmptyTitle()]);
        setRosterFormError("");
    }

    function saveEditedRoster() {
        if (!editingRosterId) return;
        const trimmedName = editingRosterName.trim();
        const nickname = normalizeNickname(editingRosterNickname);
        const color = normalizeColor(editingRosterColor);
        const logo = normalizeLogo(editingRosterLogo);
        const coach = normalizeCoach(editingRosterCoach);
        const president = editingRosterPresident.trim();
        const foundedIn = editingRosterFoundedIn.trim() ? parseInt(editingRosterFoundedIn.trim(), 10) : undefined;
        const titles = normalizeTitles(editingRosterTitles);
        const nicknameError = validateNickname(nickname);
        const colorError = validateColor(color);
        if (!trimmedName) return;
        if (nicknameError) {
            setRosterFormError(nicknameError);
            return;
        }
        if (colorError) {
            setRosterFormError(colorError);
            return;
        }

        setRosters((prev) => prev.map((roster) =>
            roster.id === editingRosterId
                ? {
                    ...roster,
                    name: trimmedName,
                    nickname: nickname || undefined,
                    color: color || undefined,
                    logo: logo || undefined,
                    coach: coach || undefined,
                    president: president || undefined,
                    founded_in: !isNaN(foundedIn as number) ? foundedIn : undefined,
                    titles: titles.length > 0 ? titles : undefined,
                }
                : roster
        ));
        setTeams((prev) => prev.map((team) =>
            team.rosterId === editingRosterId
                ? { ...team, nickname: nickname || undefined, color: color || undefined, logo: logo || undefined }
                : team
        ));
        setRosterFeedbackMessage("Effectif modifié.");
        closeEditRosterForm();
    }

    function deleteRoster(id: string) {
        const rosterToDelete = rosters.find((r) => r.id === id);
        const label = rosterToDelete?.name ?? "cet effectif";
        const confirmed = window.confirm(`Confirmer la suppression de ${label} ?`);
        if (!confirmed) return;

        setRosters(deleteRosterFromList(rosters, id));
        setTeams(deleteTeamsFromRoster(teams, id));
        if (activeRosterId === id) {
            setActiveRosterId(null);
        }
        if (editingRosterId === id) {
            closeEditRosterForm();
        }
        setRosterFeedbackMessage("Effectif supprimé.");
    }

    function addPlayerToRoster() {
        const targetRoster = selectedRosterForPlayer 
            ? rosters.find(r => r.id === selectedRosterForPlayer)
            : activeRoster;
        if (!targetRoster) return;
        if (!newPlayerFirst && !newPlayerLast) return;
        
        const player = createPlayerFromNames(newPlayerFirst, newPlayerLast);
        const updated = addPlayerToRosterList(targetRoster, player);
        setRosters(rosters.map(r => r.id === targetRoster.id ? updated : r));

        setNewPlayerFirst("");
        setNewPlayerLast("");
        setSelectedRosterForPlayer(null);
    }

    function deletePlayer(playerId: string) {
        if (!activeRoster) return;
        const updated = deletePlayerFromRoster(activeRoster, playerId);
        setRosters(rosters.map(r => r.id === activeRoster.id ? updated : r));
    }

    function deletePlayerFromTeam(teamId: string, playerId: string) {
        const team = teams.find(t => t.id === teamId);
        if (!team) return;
        const updatedTeam = deletePlayerFromTeamData(team, playerId);
        updateTeam(updatedTeam);
    }

    function removePlayerFromView(playerId: string) {
        if (viewTeamId) {
            deletePlayerFromTeam(viewTeamId, playerId);
        } else {
            deletePlayer(playerId);
        }
    }



    function startEditPlayer(player: Player) {
        const { first, last } = parsePlayerName(player.name);
        setEditingPlayerId(player.id);
        setEditingPlayerFirst(first);
        setEditingPlayerLast(last);
    }

    function saveEditPlayer() {
        if (!activeRoster || !editingPlayerId) return;
        if (!editingPlayerFirst && !editingPlayerLast) return;
        const newName = `${editingPlayerFirst} ${editingPlayerLast}`.trim();
        const updated = updatePlayerInRoster(activeRoster, editingPlayerId, { name: newName });
        setRosters(rosters.map(r => r.id === activeRoster.id ? updated : r));
        setEditingPlayerId(null);
        setEditingPlayerFirst("");
        setEditingPlayerLast("");
    }

    function cancelEditPlayer() {
        setEditingPlayerId(null);
        setEditingPlayerFirst("");
        setEditingPlayerLast("");
    }

    function addTeam() {
        if (!activeRoster) return;
        const name = `${activeRoster.name}${matchDay ? ` J${matchDay}` : ""}`;
        const newTeam = createTeam(name, activeRoster.id, activeRoster.nickname, activeRoster.color, activeRoster.logo);
        setTeams([...(teams || []), newTeam]);
    }

    function importTeam() {
        if (!activeRoster) return;
        try {
            const newTeam = importTeamFromJSON(
                jsonInput,
                activeRoster.id,
                activeRoster.name,
                matchDay ? parseInt(matchDay) : undefined,
                activeRoster.nickname,
                activeRoster.color,
                activeRoster.logo
            );
            const withNickname = { ...newTeam, nickname: activeRoster.nickname, color: activeRoster.color, logo: activeRoster.logo };
            setTeams([...(teams || []), withNickname]);
            setJsonInput("");
        } catch (e) {
            alert(e instanceof Error ? e.message : "Erreur de parsing JSON");
        }
    }

    function deleteTeam(teamToDelete: Team) {
        setTeams(deleteTeamFromList(teams || [], teamToDelete.id));
    }

    function updateTeam(updatedTeam: Team) {
        setTeams(updateTeamInList(teams || [], updatedTeam));
    }

    function getRosterPath(roster: Roster) {
        return `/r/${toShortId(roster.id)}`;
    }

    const { matchDay, championship } = useTeams();

    useEffect(() => {
        setActiveCategoryTab(championship);
    }, [championship]);

    const filteredRosters = rosters
        .filter((r) => r.category === activeCategoryTab)
        .sort((firstRoster, secondRoster) =>
            firstRoster.name.localeCompare(secondRoster.name, "fr", { sensitivity: "base" })
        );

    return (
        <section className="space-y-4 max-w-screen-md mx-auto px-4">
            <div className="flex items-center gap-2">
                <button
                    className={`px-3 py-2 rounded border text-sm font-medium transition-colors ${
                        activeCategoryTab === 'Top 14'
                            ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                            : 'border-neutral-700 bg-neutral-900 text-neutral-300 hover:bg-neutral-800'
                    }`}
                    onClick={() => setActiveCategoryTab('Top 14')}
                >
                    Top 14
                </button>
                <button
                    className={`px-3 py-2 rounded border text-sm font-medium transition-colors ${
                        activeCategoryTab === 'Pro D2'
                            ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                            : 'border-neutral-700 bg-neutral-900 text-neutral-300 hover:bg-neutral-800'
                    }`}
                    onClick={() => setActiveCategoryTab('Pro D2')}
                >
                    Pro D2
                </button>
                <button
                    className={`px-3 py-2 rounded border text-sm font-medium transition-colors ${
                        activeCategoryTab === 'W6N'
                            ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                            : 'border-neutral-700 bg-neutral-900 text-neutral-300 hover:bg-neutral-800'
                    }`}
                    onClick={() => setActiveCategoryTab('W6N')}
                >
                    Women's 6 Nations
                </button>
            </div>
            <button
                className="sp-button sp-button-sm sp-button-indigo"
                onClick={() => {
                    setShowCreateRosterForm((value) => !value);
                    setRosterFeedbackMessage("");
                }}
            >
                <FontAwesomeIcon icon={faPlus} className="mr-1 text-white" />
                Créer un effectif
            </button>

            {showCreateRosterForm && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 px-4 py-8"
                    onClick={closeCreateRosterForm}
                >
                    <div
                        className="w-full max-w-lg flex flex-col items-stretch gap-3 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 transition-shadow focus-within:border-sky-500/70 focus-within:shadow-md focus-within:shadow-sky-500/30 my-auto"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="sp-input-shell">
                            <label className="sp-input-label" htmlFor="newRosterCategory">Championnat</label>
                            <select
                                id="newRosterCategory"
                                className="sp-input-control"
                                value={newRosterCategory}
                                onChange={(e) => setNewRosterCategory(e.target.value as 'Top 14' | 'Pro D2' | 'W6N')}
                            >
                                {championshipOptions.map((option) => (
                                    <option key={option} value={option}>
                                        {option}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="sp-input-shell">
                            <label className="sp-input-label" htmlFor="newRosterName">Nom de l'effectif</label>
                            <input
                                id="newRosterName"
                                className="sp-input-control"
                                placeholder="Nom de l'effectif"
                                value={newRosterName}
                                onChange={(e) => setNewRosterName(e.target.value)}
                            />
                        </div>
                        <div className="sp-input-shell">
                            <label className="sp-input-label" htmlFor="newRosterNickname">Surnom</label>
                            <input
                                id="newRosterNickname"
                                className="sp-input-control"
                                placeholder="ex: TOUL"
                                value={newRosterNickname}
                                onChange={(e) => {
                                    setNewRosterNickname(normalizeNickname(e.target.value));
                                    setRosterFormError("");
                                }}
                            />
                        </div>
                        <div className="sp-input-shell">
                            <label className="sp-input-label" htmlFor="newRosterColor">Couleur</label>
                            <input
                                id="newRosterColor"
                                className="sp-input-control"
                                placeholder="optionnel, ex: #1E3A8A"
                                value={newRosterColor}
                                onChange={(e) => {
                                    setNewRosterColor(e.target.value);
                                    setRosterFormError("");
                                }}
                            />
                        </div>
                        <div className="sp-input-shell">
                            <label className="sp-input-label" htmlFor="newRosterLogo">Logo (optionnel)</label>
                            <input
                                id="newRosterLogo"
                                className="sp-input-control"
                                placeholder="URL du logo"
                                value={newRosterLogo}
                                onChange={(e) => setNewRosterLogo(e.target.value)}
                            />
                        </div>
                        <div className="sp-input-shell">
                            <label className="sp-input-label" htmlFor="newRosterLogoFile">Televerser un logo</label>
                            <input
                                id="newRosterLogoFile"
                                type="file"
                                accept="image/*"
                                className="sp-input-control"
                                onChange={(event) => {
                                    void handleRosterLogoUpload(event, "new");
                                }}
                            />
                        </div>
                        <div className="sp-input-shell">
                            <label className="sp-input-label" htmlFor="newRosterCoach">Coach (optionnel)</label>
                            <input
                                id="newRosterCoach"
                                className="sp-input-control"
                                placeholder="Nom du coach"
                                value={newRosterCoach}
                                onChange={(e) => setNewRosterCoach(e.target.value)}
                            />
                        </div>
                        <div className="sp-input-shell">
                            <label className="sp-input-label" htmlFor="newRosterPresident">Président (optionnel)</label>
                            <input
                                id="newRosterPresident"
                                className="sp-input-control"
                                placeholder="Nom du président"
                                value={newRosterPresident}
                                onChange={(e) => setNewRosterPresident(e.target.value)}
                            />
                        </div>
                        <div className="sp-input-shell">
                            <label className="sp-input-label" htmlFor="newRosterFoundedIn">Année de création (optionnel)</label>
                            <input
                                id="newRosterFoundedIn"
                                className="sp-input-control"
                                placeholder="ex: 1907"
                                value={newRosterFoundedIn}
                                onChange={(e) => setNewRosterFoundedIn(e.target.value.replace(/\D/g, "").slice(0, 4))}
                            />
                        </div>
                        <div className="sp-input-shell">
                            <label className="sp-input-label">Palmarès (optionnel)</label>
                            {renderTitlesEditor('new', newRosterTitles)}
                        </div>
                        
                        <div className="flex items-center justify-center gap-2">
                            <button
                                className="sp-button sp-button-sm sp-button-blue"
                                onClick={createRoster}
                            >
                                Valider
                            </button>
                            <button
                                className="sp-button sp-button-sm sp-button-light"
                                onClick={closeCreateRosterForm}
                            >
                                Annuler
                            </button>
                        </div>
                        {rosterFormError && <p className="text-sm text-red-400">{rosterFormError}</p>}
                    </div>
                </div>
            )}

            {editingRosterId && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 px-4 py-8"
                    onClick={closeEditRosterForm}
                >
                    <div
                        className="w-full max-w-lg flex flex-col items-stretch gap-3 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 my-auto"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="sp-input-shell">
                            <label className="sp-input-label" htmlFor="editingRosterName">Nom de l'effectif</label>
                            <input
                                id="editingRosterName"
                                className="sp-input-control"
                                placeholder="Nom de l'effectif"
                                value={editingRosterName}
                                onChange={(e) => setEditingRosterName(e.target.value)}
                            />
                        </div>
                        <div className="sp-input-shell">
                            <label className="sp-input-label" htmlFor="editingRosterNickname">Surnom</label>
                            <input
                                id="editingRosterNickname"
                                className="sp-input-control"
                                placeholder="ex: TOUL"
                                value={editingRosterNickname}
                                onChange={(e) => {
                                    setEditingRosterNickname(normalizeNickname(e.target.value));
                                    setRosterFormError("");
                                }}
                            />
                        </div>
                        <div className="sp-input-shell">
                            <label className="sp-input-label" htmlFor="editingRosterColor">Couleur</label>
                            <input
                                id="editingRosterColor"
                                className="sp-input-control"
                                placeholder="optionnel, ex: #1E3A8A"
                                value={editingRosterColor}
                                onChange={(e) => {
                                    setEditingRosterColor(e.target.value);
                                    setRosterFormError("");
                                }}
                            />
                        </div>
                        <div className="sp-input-shell">
                            <label className="sp-input-label" htmlFor="editingRosterLogo">Logo (optionnel)</label>
                            <input
                                id="editingRosterLogo"
                                className="sp-input-control"
                                placeholder="URL du logo"
                                value={editingRosterLogo}
                                onChange={(e) => setEditingRosterLogo(e.target.value)}
                            />
                        </div>
                        <div className="sp-input-shell">
                            <label className="sp-input-label" htmlFor="editingRosterLogoFile">Téléverser un logo</label>
                            <input
                                id="editingRosterLogoFile"
                                type="file"
                                accept="image/*"
                                className="sp-input-control"
                                onChange={(event) => {
                                    void handleRosterLogoUpload(event, "edit");
                                }}
                            />
                        </div>
                        <div className="sp-input-shell">
                            <label className="sp-input-label" htmlFor="editingRosterFoundedIn">Année de création (optionnel)</label>
                            <input
                                id="editingRosterFoundedIn"
                                className="sp-input-control"
                                placeholder="ex: 1907"
                                value={editingRosterFoundedIn}
                                onChange={(e) => setEditingRosterFoundedIn(e.target.value.replace(/\D/g, "").slice(0, 4))}
                            />
                        </div>
                        <div className="sp-input-shell">
                            <label className="sp-input-label" htmlFor="editingRosterCoach">Coach (optionnel)</label>
                            <input
                                id="editingRosterCoach"
                                className="sp-input-control"
                                placeholder="Nom du coach"
                                value={editingRosterCoach}
                                onChange={(e) => setEditingRosterCoach(e.target.value)}
                            />
                        </div>
                        <div className="sp-input-shell">
                            <label className="sp-input-label" htmlFor="editingRosterPresident">Président (optionnel)</label>
                            <input
                                id="editingRosterPresident"
                                className="sp-input-control"
                                placeholder="Nom du président"
                                value={editingRosterPresident}
                                onChange={(e) => setEditingRosterPresident(e.target.value)}
                            />
                        </div>
                        
                        <div className="sp-input-shell">
                            <label className="sp-input-label">Palmarès (optionnel)</label>
                            {renderTitlesEditor('edit', editingRosterTitles)}
                        </div>
                        
                        <div className="flex items-center justify-center gap-2">
                            <button
                                className="sp-button sp-button-sm sp-button-blue h-[36px]"
                                onClick={saveEditedRoster}
                            >
                                Valider
                            </button>
                            <button
                                className="sp-button sp-button-sm sp-button-light"
                                onClick={closeEditRosterForm}
                            >
                                Annuler
                            </button>
                            <button
                                className="sp-button sp-button-sm sp-button-red"
                                onClick={() => editingRosterId && deleteRoster(editingRosterId)}
                            >
                                <FontAwesomeIcon icon={faTrashCan} className="mr-1" />
                                Supprimer l'effectif
                            </button>
                        </div>
                        
                        {rosterFormError && <p className="text-sm text-red-400">{rosterFormError}</p>}
                    </div>
                </div>
            )}

            {rosters.length === 0 ? (
                <p className="text-sm text-gray-600">Aucun effectif existant</p>
            ) : filteredRosters.length === 0 ? (
                <p className="text-sm text-gray-600">Aucun effectif dans {activeCategoryTab}</p>
            ) : (
                <div className="grid grid-cols-2 gap-2 mt-6 md:grid-cols-3">
                    {filteredRosters.map((r) => (
                        <div key={r.id} className="flex items-center justify-between gap-2 rounded bg-neutral-900 border border-neutral-700 hover:bg-neutral-800 py-2 px-4">
                            <button
                                className="text-white font-semibold text-base md:text-lg w-full text-left"
                                onClick={() => {
                                    setActiveRosterId(r.id);
                                    navigate(getRosterPath(r));
                                }}
                            >
                                <span>{r.name}</span>
                                {r.nickname && <span className="block text-xs text-sky-300">{r.nickname}</span>}
                            </button>
                            <button
                                className="sp-button sp-button-yellow sp-button-icon"
                                onClick={() => openEditRosterForm(r)}
                                aria-label={`Modifier ${r.name}`}
                            >
                                <FontAwesomeIcon icon={faPenToSquare} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {rosterFeedbackMessage && (
                <p className="flex items-center gap-2 text-sm text-green-400 mt-6">
                    <FontAwesomeIcon icon={faCircleCheck} />
                    {rosterFeedbackMessage}
                </p>
            )}
        </section>
    );
}
