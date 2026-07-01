import { useCallback, useEffect, useState, useMemo, useRef } from "react";
import type { Route } from "./+types/tracker";
import type { Event } from "~/types/tracker";
import type { LiveSnapshot } from "~/types/live";

import TimerControls from "~/components/TimerControls";
import CommandPanel from "~/components/CommandPanel";
import EventForm from "~/components/EventForm";
import EventsList from "~/components/EventsList";
import TrackerStatsPanel from "~/components/TrackerStatsPanel";
import TrackerTeamsPanel from "~/components/TrackerTeamsPanel";
import Summary from "~/components/Summary";
import Scoreboard from "~/components/Scoreboard";
import TrackerSetupWizard from "~/components/TrackerSetupWizard";
import TrackerMatchInfoEditor from "~/components/TrackerMatchInfoEditor";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRotateLeft, faChartLine, faListCheck, faPenToSquare, faTrophy, faUsers } from "@fortawesome/free-solid-svg-icons";
import { useTeams } from "~/context/TeamsContext";
import { useAccount } from "~/context/AccountContext";
import { useTrackerClock } from "~/hooks/useTrackerClock";
import { useTrackerEvents } from "~/hooks/useTrackerEvents";
import { useTrackerStats } from "~/hooks/useTrackerStats";
import { useTrackerSetup } from "~/hooks/useTrackerSetup";
import { useLiveBroadcast } from "~/hooks/useLiveBroadcast";
import { getTimelineMomentFromClock } from "~/utils/TimeUtils";
import { Top14_Stadiums_2025_2026 } from "~/utils/stadiums";
import TrackerNotesPanel from "~/components/TrackerNotesPanel";
import { faCalendarDays, faClipboard, faHouse, faUser, faEye, faCircleStop } from "@fortawesome/free-regular-svg-icons";

export function meta({}: Route.MetaArgs) {
    return [{ title: "Match Reporter" }];
}

const COMMAND_TYPES = [
    "Essai",
    "Transformation",
    "Transformation manquée",
    "Pénalité réussie",
    "Drop",
    "Essai de pénalité",
    "Pénalité manquée",
    "Carton jaune",
    "Carton rouge",
    "Carton orange",
    "Changement",
    "Saignement",
    "Blessure",
    "Arbitrage Vidéo",
];

const TRACKER_ACTION_TAB_STORAGE_KEY = "sidepitcher.tracker.actionTab";
export default function Tracker() {
    const { account } = useAccount();
    const {
        time,
        setTime,
        running,
        setRunning,
        currentHalf,
        setCurrentHalf,
        manualTimeInput,
        setManualTimeInput,
        matchEnded,
        setMatchEnded,
        formatTime,
        getDisplayTimes,
        adjustTime,
        applyManualTime,
        resetClock,
    } = useTrackerClock();
    const { rosters, teams, activeRosterId, matchDay, championship, sport } = useTeams();
    const normalizedMatchDay = matchDay.trim();
    const parsedMatchDay = normalizedMatchDay.match(/^J?\s*(\d+)$/i);
    const matchDayLabel = parsedMatchDay ? `J${parsedMatchDay[1]}` : normalizedMatchDay;
    
    const activeRoster = useMemo(() => rosters.find((r) => r.id === activeRosterId) ?? null, [rosters, activeRosterId]);
    
    const rosterNicknameById = useMemo(
        () => new Map(rosters.map((roster) => [roster.id, roster.nickname || ""])),
        [rosters]
    );
    
    // Si un contexte de match est sélectionné, on filtre les équipes sur ce libellé (ex: J3 ou Bordeaux)
    // puis on y injecte le surnom de l'effectif associé.
    const teamsForDay = useMemo(
        () => matchDayLabel
            ? teams
                .filter((t) => t.name.includes(matchDayLabel))
                .map((team) => ({ ...team, nickname: team.nickname || rosterNicknameById.get(team.rosterId) || undefined }))
            : teams.map((team) => ({ ...team, nickname: team.nickname || rosterNicknameById.get(team.rosterId) || undefined })),
        [teams, matchDayLabel, rosterNicknameById]
    );
    
    const [activeCommand, setActiveCommand] = useState<string | null>(null);
    const [actionTab, setActionTab] = useState<"events" | "stats" | "teams"| "notes" >("events");
    const [savedTrackingSignature, setSavedTrackingSignature] = useState<string | null>(null);
    const contextInitializedRef = useRef(false);
    const prevContextRef = useRef<{ matchDay: string | number; championship: string; sport: string } | null>(null);

    const {
      team1Id,
      setTeam1Id,
      team2Id,
      setTeam2Id,
      field,
      fieldInput,
      setFieldInput,
      matchDate,
      matchDateInput,
      setMatchDateInput,
      referee,
      refereeInput,
      setRefereeInput,
      showMatchInfoEditor,
      setShowMatchInfoEditor,
      saveMessage,
      isTrackerReady,
      setIsTrackerReady,
      setupCanSubmit,
      applyMatchInfo,
      syncRefereeFromEvent,
      handleSetupSubmit,
      resetMatchInfo,
      resetPreparationState,
    } = useTrackerSetup({
      championship,
      matchDay,
    });

    const selectedTeams = useMemo(
        () => [
            teamsForDay.find((t) => t.id === team1Id),
            teamsForDay.find((t) => t.id === team2Id),
        ].filter(Boolean) as typeof teams,
        [teamsForDay, team1Id, team2Id]
    );

    const selectedTeamIds = useMemo(() => [team1Id, team2Id], [team1Id, team2Id]);
    const top14StadiumOptions = useMemo(() => {
      if (!fieldInput || Top14_Stadiums_2025_2026.includes(fieldInput as (typeof Top14_Stadiums_2025_2026)[number])) {
        return Top14_Stadiums_2025_2026;
      }
      return [fieldInput, ...Top14_Stadiums_2025_2026] as const;
    }, [fieldInput]);

    const {
        events,
        addEvent,
        removeEvent,
        resetEvents,
        matchFactsEvents,
        computeScores,
        computeBonuses,
    } = useTrackerEvents({
        selectedTeamIds,
        selectedTeamsCount: selectedTeams.length,
    });

    // Retourne le surnom de l'équipe s'il existe, sinon le nom sans le suffixe de journée (ex: " J3").
    function getDisplayTeamLabel(team: { name: string; nickname?: string }): string {
        return team.nickname || team.name.replace(/\s+J\d+$/, "");
    }

    const {
        teamPenalties,
        manualPenaltyAdjustments,
        teamEnAvant,
        manualEnAvantAdjustments,
        teamTouchePerdue,
        teamMeleePerdue,
        teamTurnover,
        teamJeuAuPied,
        adjustPenalties,
        adjustEnAvant,
        adjustTouchePerdue,
        adjustMeleePerdue,
        adjustTurnover,
        adjustJeuAuPied,
        getDisplayedPenalties,
        getDisplayedEnAvant,
        resetStats,
        hasStatsContent,
    } = useTrackerStats(events, selectedTeamIds);

    useEffect(() => {
        const storedTab = window.localStorage.getItem(TRACKER_ACTION_TAB_STORAGE_KEY);
        if (storedTab === "events" || storedTab === "stats" || storedTab === "teams") {
            setActionTab(storedTab);
        }
    }, []);

    useEffect(() => {
        window.localStorage.setItem(TRACKER_ACTION_TAB_STORAGE_KEY, actionTab);
    }, [actionTab]);

    useEffect(() => {
        const knownRef = events.find((event) => event.ref)?.ref;
      if (knownRef) {
        syncRefereeFromEvent(knownRef);
      }
    }, [events, syncRefereeFromEvent]);

    function resetTrackerInfos() {
        resetEvents();
        resetClock();
        setActiveCommand(null);
        resetStats();
        clearLiveState();
        setSavedTrackingSignature(null);
      resetMatchInfo();
    }

    // Détecte un changement de contexte (championnat / journée / sport) après le premier rendu.
    // On utilise des refs pour comparer les valeurs précédentes sans déclencher de boucle.
    // Si le contexte change, on remet à zéro tous les événements, la minuterie et les stats.
    // On ignore la transition initiale (valeurs par défaut → valeurs chargées du serveur)
    // pour ne pas effacer les données persistées en localStorage (ex. arbitre).
    useEffect(() => {
        if (!contextInitializedRef.current) {
            // Premier rendu : on mémorise le contexte initial sans réinitialiser
            contextInitializedRef.current = true;
            prevContextRef.current = { matchDay, championship, sport };
            return;
        }

        const prev = prevContextRef.current;
        if (!prev) {
            prevContextRef.current = { matchDay, championship, sport };
            return;
        }

        const contextChanged =
            prev.matchDay !== matchDay ||
            prev.championship !== championship ||
            prev.sport !== sport;

        // Si matchDay précédent est vide, c'est le chargement initial depuis le serveur,
        // pas un vrai changement de contexte de l'utilisateur.
        if (contextChanged && prev.matchDay !== "") {
            resetTrackerInfos();
        }

        prevContextRef.current = { matchDay, championship, sport };
    }, [matchDay, championship, sport]);

// timer interval
    useEffect(() => {
        let handle: number;
        if (running) {
            handle = window.setInterval(() => setTime((t) => t + 1), 1000);
        }
        return () => {
            if (handle) window.clearInterval(handle);
        };
    }, [running]);

    function handleAddEvent(event: Event) {
        addEvent({ ...event, ref: referee.trim() || undefined });
        setActiveCommand(null);
    }

    function addStatsSummary(halfLabel: string) {
        if (selectedTeams.length !== 2) return;
        const summaryMoment = getTimelineMomentFromClock(time, currentHalf);
        const team1Name = getDisplayTeamLabel(selectedTeams[0]);
        const team2Name = getDisplayTeamLabel(selectedTeams[1]);
        const displayedPenalties = getDisplayedPenalties();
        const displayedEnAvant = getDisplayedEnAvant();
        const statRows = [
            { label: "Pénalités", left: displayedPenalties[0] || 0, right: displayedPenalties[1] || 0 },
            { label: "En-avants", left: displayedEnAvant[0] || 0, right: displayedEnAvant[1] || 0 },
            { label: "Touches perdues", left: teamTouchePerdue[0] || 0, right: teamTouchePerdue[1] || 0 },
            { label: "Mêlées perdues", left: teamMeleePerdue[0] || 0, right: teamMeleePerdue[1] || 0 },
            { label: "Turnovers", left: teamTurnover[0] || 0, right: teamTurnover[1] || 0 },
            { label: "Jeu au pied", left: teamJeuAuPied[0] || 0, right: teamJeuAuPied[1] || 0 },
        ];
        const summary = `${halfLabel} : ${team1Name} : ${displayedPenalties[0]} pénalités, ${displayedEnAvant[0]} en-avants, ${teamTouchePerdue[0] || 0} touches perdues, ${teamMeleePerdue[0] || 0} mêlées perdues, ${teamTurnover[0] || 0} turnovers, ${teamJeuAuPied[0] || 0} jeux au pied / ${team2Name} : ${displayedPenalties[1]} pénalités, ${displayedEnAvant[1]} en-avants, ${teamTouchePerdue[1] || 0} touches perdues, ${teamMeleePerdue[1] || 0} mêlées perdues, ${teamTurnover[1] || 0} turnovers, ${teamJeuAuPied[1] || 0} jeux au pied`;
        
        const summaryEvent: Event = {
            type: "Récapitulatif",
            time: time,
            timelineHalf: summaryMoment.half,
            timelineMinute: summaryMoment.minute,
            timelineAdditionalMinute: summaryMoment.additionalMinute,
            timelineSecond: summaryMoment.second,
            summary: summary,
            summaryTable: {
                halfLabel,
                teams: [
                    {
                        teamName: team1Name,
                        stats: statRows.map((row) => ({ label: row.label, value: row.left })),
                    },
                    {
                        teamName: team2Name,
                        stats: statRows.map((row) => ({ label: row.label, value: row.right })),
                    },
                ],
            },
        };

        handleAddEvent(summaryEvent);
    }

    const hasTrackingContent =
        time !== 0 ||
        running ||
        currentHalf !== 1 ||
        matchEnded ||
        events.length > 0 ||
        field.trim().length > 0 ||
        referee.trim().length > 0 ||
        hasStatsContent;

    const getTrackingSignature = useCallback(() => {
        return JSON.stringify({
            time,
            running,
            currentHalf,
            matchEnded,
            events,
            field,
            referee,
            matchDate,
            teamPenalties,
            manualPenaltyAdjustments,
            teamEnAvant,
            manualEnAvantAdjustments,
            teamTouchePerdue,
            teamMeleePerdue,
            teamTurnover,
            teamJeuAuPied,
        });
    }, [
        time,
        running,
        currentHalf,
        matchEnded,
        events,
        field,
        referee,
        matchDate,
        teamPenalties,
        manualPenaltyAdjustments,
        teamEnAvant,
        manualEnAvantAdjustments,
        teamTouchePerdue,
        teamMeleePerdue,
        teamTurnover,
        teamJeuAuPied,
    ]);

    function handleResetTracker() {
        const currentSignature = getTrackingSignature();
        const hasUnsavedSynthesis = hasTrackingContent && savedTrackingSignature !== currentSignature;

        if (hasUnsavedSynthesis) {
            const confirmed = window.confirm(
                "La synthèse n'est pas sauvegardée. Voulez-vous réinitialiser quand même ?"
            );
            if (!confirmed) return;
        }

        // Match user expectation: fully reinitialize the page state.
        window.location.reload();
    }

    const buildLiveSnapshot = useCallback((): LiveSnapshot => {
        const displayedPenalties = getDisplayedPenalties();
        const displayedEnAvant = getDisplayedEnAvant();

        return {
            currentTime: time,
            running,
            currentHalf,
            matchEnded,
            events,
            teams: selectedTeams.map((team) => ({ id: team.id, name: team.name, nickname: team.nickname })),
            team1Id,
            team2Id,
            scores: computeScores(),
            penalties: displayedPenalties,
            enAvant: displayedEnAvant,
            touchePerdue: teamTouchePerdue,
            meleePerdue: teamMeleePerdue,
            turnover: teamTurnover,
            jeuAuPied: teamJeuAuPied,
        };
    }, [
        currentHalf,
        events,
        matchEnded,
        running,
        selectedTeams,
        team1Id,
        team2Id,
        teamEnAvant,
        teamMeleePerdue,
        teamPenalties,
        teamTouchePerdue,
        teamTurnover,
        teamJeuAuPied,
        time,
        manualEnAvantAdjustments,
        manualPenaltyAdjustments,
    ]);

    const {
        canPublishLive,
        liveBusy,
        liveMessage,
        livePublicSlug,
        liveViewerUrl,
        activateLivePublic,
        copyLiveViewerUrl,
        closeLivePublic,
        clearLiveState,
    } = useLiveBroadcast({
        selectedTeamsCount: selectedTeams.length,
        team1Id,
        team2Id,
        championship,
        matchDay,
        buildLiveSnapshot,
    });

    function handleTeam1Change(nextTeamId: string) {
        if (nextTeamId !== team1Id) {
            resetTrackerInfos();
        }
        setTeam1Id(nextTeamId);
    }

    function handleTeam2Change(nextTeamId: string) {
        if (nextTeamId !== team2Id) {
            resetTrackerInfos();
        }
        setTeam2Id(nextTeamId);
    }

    function handleResetToInitialState() {
      const confirmed = window.confirm(
        "Revenir à l'état initial ? Cela effacera la préparation et les données du tracker en cours."
      );
      if (!confirmed) return;

      resetTrackerInfos();
      resetPreparationState();
    }

    const formattedMatchDate = matchDate
        ? new Date(`${matchDate}T00:00:00`).toLocaleDateString("fr-FR")
        : "";

    if (!isTrackerReady) {
        return (
          <TrackerSetupWizard
            championship={championship}
            matchDayLabel={matchDayLabel}
            hasActiveRoster={!!activeRoster}
            teamsForDay={teamsForDay}
            team1Id={team1Id}
            team2Id={team2Id}
            matchDateInput={matchDateInput}
            fieldInput={fieldInput}
            refereeInput={refereeInput}
            top14StadiumOptions={top14StadiumOptions}
            setupCanSubmit={setupCanSubmit}
            saveMessage={saveMessage}
            onSubmit={handleSetupSubmit}
            onTeam1Change={handleTeam1Change}
            onTeam2Change={handleTeam2Change}
            onMatchDateInputChange={setMatchDateInput}
            onFieldInputChange={setFieldInput}
            onRefereeInputChange={setRefereeInput}
            getDisplayTeamLabel={getDisplayTeamLabel}
          />
        );
    }

    return (
      <main className="sp-page min-h-0 space-y-6 pb-40 xl:pb-10">
        <h1 className="leading-[0.95] font-bold tracking-[-0.03em] text-4xl text-center text-white">
          Feuille de match
        </h1>
        <p className="text-foreground max-w-3xl text-base font-light text-white text-balance sm:text-lg text-center mx-auto">
          <FontAwesomeIcon icon={faTrophy} className="sm:mr-1 mr-2" />
          {championship} {matchDayLabel && <> — {matchDayLabel}</>}
          <FontAwesomeIcon
            icon={faCalendarDays}
            className="sm:ml-2 sm:mr-1 ml-4 mr-2"
          />{" "}
          {formattedMatchDate || ""}
          <FontAwesomeIcon
            icon={faHouse}
            className="sm:ml-2 sm:mr-1 ml-4 mr-2"
          />{" "}
          {field || "—"}
          <FontAwesomeIcon
            icon={faUser}
            className="sm:ml-2 sm:mr-1 ml-4 mr-2"
          />{" "}
          {referee || "—"}
          <button
            type="button"
            className="group sp-button sp-button-md sp-button-yellow ml-4 md:ml-2"
            onClick={() => setIsTrackerReady(false)}
            aria-label="Modifier la préparation"
            title="Modifier la préparation"
          >
            <FontAwesomeIcon icon={faPenToSquare} className="sm:mr-2" />
            <span className="hidden sm:inline">Modifier</span>
          </button>
          <button
            type="button"
            className="group sp-button sp-button-md sp-button-red ml-2"
            onClick={handleResetToInitialState}
            aria-label="Réinitialiser"
            title="Réinitialiser"
          >
            <FontAwesomeIcon icon={faArrowRotateLeft} className="sm:mr-2" />
            <span className="hidden sm:inline">Réinitialiser</span>
          </button>
        </p>
        <div className="max-w-3xl mx-auto mb-8"></div>

        <TrackerMatchInfoEditor
          isOpen={showMatchInfoEditor}
          matchDateInput={matchDateInput}
          fieldInput={fieldInput}
          refereeInput={refereeInput}
          stadiumOptions={top14StadiumOptions}
          onClose={() => setShowMatchInfoEditor(false)}
          onSave={() => applyMatchInfo()}
          onMatchDateInputChange={setMatchDateInput}
          onFieldInputChange={setFieldInput}
          onRefereeInputChange={setRefereeInput}
        />

        {account && (
          <section className="sp-panel-compact space-y-2">
            <p className="text-sm text-neutral-300">
              Diffusion externe en lecture seule
            </p>
            {!livePublicSlug ? (
              <button
                className="sp-button sp-button-md sp-button-full sp-button-indigo"
                onClick={activateLivePublic}
                disabled={!canPublishLive || liveBusy}
              >
                <FontAwesomeIcon icon={faEye} className="sm:mr-2" />
                {liveBusy ? "Activation..." : "Activer le live public"}
              </button>
            ) : (
              <>
                <p className="text-xs break-all text-neutral-200">
                  {liveViewerUrl}
                </p>
                <button
                  className="sp-button sp-button-md sp-button-full sp-button-blue"
                  onClick={copyLiveViewerUrl}
                >
                  <FontAwesomeIcon icon={faClipboard} className="sm:mr-2" />
                  Copier le lien spectateur
                </button>
                <button
                  className="sp-button sp-button-md sp-button-full sp-button-red"
                  onClick={closeLivePublic}
                  disabled={liveBusy}
                >
                  <FontAwesomeIcon icon={faCircleStop} className="sm:mr-2" />
                  Arrêter le live
                </button>
              </>
            )}
            {!canPublishLive && !livePublicSlug && (
              <p className="text-xs text-neutral-400">
                Sélectionne deux équipes différentes pour activer le live.
              </p>
            )}
            {liveMessage && (
              <p className="text-sm text-green-700">{liveMessage}</p>
            )}
          </section>
        )}

        {/* scoreboard showing teams, computed score and timers */}
        {(() => {
          const times = getDisplayTimes();
          const mainTimerText = matchEnded
            ? "Match terminé"
            : formatTime(times.mainTime);
          const secondaryTimerText =
            matchEnded || times.secondaryTime === null
              ? undefined
              : formatTime(times.secondaryTime);
          const scores = computeScores();
          return (
            <Scoreboard
              teams={selectedTeams}
              scores={scores}
              bonuses={computeBonuses(scores)}
              mainTimerText={mainTimerText}
              secondaryTimerText={secondaryTimerText}
            />
          );
        })()}

        <TimerControls
          time={time}
          running={running}
          onStartStop={() => setRunning((r) => !r)}
          onAdjust={adjustTime}
          onReset={handleResetTracker}
          manualTimeInput={manualTimeInput}
          onManualTimeInputChange={setManualTimeInput}
          onApplyManualTime={applyManualTime}
          currentHalf={currentHalf}
          matchEnded={matchEnded}
          onSetFirstHalf={() => {
            setCurrentHalf(1);
            setTime(0);
            setRunning(false);
          }}
          onSetSecondHalf={() => {
            addStatsSummary("MT1");
            setCurrentHalf(2);
            setTime(40 * 60);
            setRunning(false);
          }}
          onEndMatch={() => {
            addStatsSummary("MT2");
            setMatchEnded(true);
            setRunning(false);
          }}
        />
        {/* onglets */}
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <button
              className={`px-2 sm:px-3 py-2 rounded border text-sm font-medium transition-colors ${
                actionTab === "events"
                  ? "border-blue-500 bg-blue-500/20 text-blue-300"
                  : "border-neutral-700 bg-neutral-900 text-neutral-300 hover:bg-neutral-800"
              }`}
              onClick={() => setActionTab("events")}
            >
              <FontAwesomeIcon icon={faListCheck} className="sm:mr-1" />
              <span className="hidden sm:inline"> Événements</span>
            </button>
            <button
              className={`px-2 sm:px-3 py-2 rounded border text-sm font-medium transition-colors ${
                actionTab === "stats"
                  ? "border-blue-500 bg-blue-500/20 text-blue-300"
                  : "border-neutral-700 bg-neutral-900 text-neutral-300 hover:bg-neutral-800"
              }`}
              onClick={() => {
                setActionTab("stats");
                setActiveCommand(null);
              }}
            >
              <FontAwesomeIcon icon={faChartLine} className="sm:mr-1" />
              <span className="hidden sm:inline"> Statistiques</span>
            </button>
            <button
              className={`px-2 sm:px-3 py-2 rounded border text-sm font-medium transition-colors ${
                actionTab === "teams"
                  ? "border-blue-500 bg-blue-500/20 text-blue-300"
                  : "border-neutral-700 bg-neutral-900 text-neutral-300 hover:bg-neutral-800"
              }`}
              onClick={() => {
                setActionTab("teams");
                setActiveCommand(null);
              }}
            >
              <FontAwesomeIcon icon={faUsers} className="sm:mr-1" />
              <span className="hidden sm:inline"> Équipes</span>
            </button>
            <button
              className={`px-2 sm:px-3 py-2 rounded border text-sm font-medium transition-colors ${
                actionTab === "notes"
                  ? "border-blue-500 bg-blue-500/20 text-blue-300"
                  : "border-neutral-700 bg-neutral-900 text-neutral-300 hover:bg-neutral-800"
              }`}
              onClick={() => {
                setActionTab("notes");
                setActiveCommand(null);
              }}
            >
              <FontAwesomeIcon icon={faClipboard} className="sm:mr-1" />
              <span className="hidden sm:inline"> Notes</span>
            </button>
          </div>
        </section>
        {/* toggle des onglets */}
        {actionTab === "teams" && (
          <section className="space-y-3">
            <TrackerTeamsPanel
              selectedTeams={selectedTeams}
              events={events}
              getDisplayTeamLabel={getDisplayTeamLabel}
            />
          </section>
        )}

        {actionTab === "notes" && (
          <section className="space-y-3">
            <TrackerNotesPanel />
          </section>
        )}

        {actionTab === "stats" && (
          <section className="space-y-3">
            <h3 className="font-semibold text-center">Statistiques</h3>
            {selectedTeams.length !== 2 ? (
              <p className="text-sm text-gray-500 text-center">
                Sélectionne et valide deux équipes pour afficher les
                statistiques.
              </p>
            ) : (
              <TrackerStatsPanel
                selectedTeams={selectedTeams}
                getDisplayTeamLabel={getDisplayTeamLabel}
                displayedPenalties={getDisplayedPenalties()}
                displayedEnAvant={getDisplayedEnAvant()}
                teamTouchePerdue={teamTouchePerdue}
                teamMeleePerdue={teamMeleePerdue}
                teamTurnover={teamTurnover}
                teamJeuAuPied={teamJeuAuPied}
                adjustPenalties={adjustPenalties}
                adjustEnAvant={adjustEnAvant}
                adjustTouchePerdue={adjustTouchePerdue}
                adjustMeleePerdue={adjustMeleePerdue}
                adjustTurnover={adjustTurnover}
                adjustJeuAuPied={adjustJeuAuPied}
              />
            )}
          </section>
        )}

        {actionTab === "events" && (
          <>
            <CommandPanel
              types={COMMAND_TYPES}
              onSelect={(type) => setActiveCommand(type)}
            />

            {activeCommand && team1Id && team2Id && team1Id !== team2Id && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
                onClick={() => setActiveCommand(null)}
              >
                <div onClick={(event) => event.stopPropagation()}>
                  <EventForm
                    type={activeCommand}
                    teams={selectedTeams}
                    currentTime={time}
                    currentHalf={currentHalf}
                    onSubmit={handleAddEvent}
                    onCancel={() => setActiveCommand(null)}
                  />
                </div>
              </div>
            )}
            {activeCommand && (!team1Id || !team2Id || team1Id === team2Id) && (
              <p className="text-sm text-red-600">
                Sélectionne deux équipes différentes pour enregistrer un
                événement.
              </p>
            )}
          </>
        )}

        <section className="space-y-2">
          <h2 className="font-semibold">Faits de match</h2>
          <div className="max-h-[28rem] overflow-y-auto pr-1">
            <EventsList
              events={matchFactsEvents}
              remove={(displayIndex) =>
                removeEvent(events.length - 1 - displayIndex)
              }
            />
          </div>
        </section>

        <Summary
          events={events}
          currentTime={time}
          teams={selectedTeams}
          matchDay={typeof matchDay === "number" ? matchDay : undefined}
          matchDate={matchDate || undefined}
          matchField={field || undefined}
          matchReferee={referee || undefined}
          onSaved={() => setSavedTrackingSignature(getTrackingSignature())}
        />
      </main>
    );
}
