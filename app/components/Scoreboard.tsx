import React from "react";
import type { Team } from "~/types/tracker";

interface Props {
  teams: Team[];
  scores: number[];
  bonuses?: string[];
  mainTimerText?: string;
  secondaryTimerText?: string;
}

export default function Scoreboard({
  teams,
  scores,
  bonuses,
  mainTimerText,
  secondaryTimerText,
}: Props) {
  const displayScore = (idx: number) => scores[idx] || 0;
  const displayBonus = (idx: number) => bonuses?.[idx] || "";

  const getTeamColor = (team: Team | undefined): string | undefined => {
    const color = team?.color?.trim();
    if (!color) return undefined;
    return /^#[0-9A-Fa-f]{6}$/.test(color) ? color : undefined;
  };

  const displayTeamName = (team?: Team) => {
    if (!team) return "";
    return team.nickname || team.name.replace(/\s+J\d+$/, "");
  };

  const leftTeamColor = getTeamColor(teams[0]);
  const rightTeamColor = getTeamColor(teams[1]);

  return (
    <div className="shadow-lg rounded-lg overflow-hidden flex flex-row items-stretch">
      {/* left team*/}
      <div
        className={`flex-1 text-white p-3 sm:p-6 flex flex-col items-center justify-center ${leftTeamColor ? "" : "bg-blue-700"}`}
        style={leftTeamColor ? { backgroundColor: leftTeamColor } : undefined}
      >
        {teams[0] ? (
          <>
            <div className="text-sm sm:text-lg font-semibold mb-1">{displayTeamName(teams[0])}</div>
            <div className="text-4xl sm:text-6xl font-bold leading-none">{displayScore(0)}</div>
            {displayBonus(0) && (
              <div className="mt-2 rounded bg-black/20 px-2 py-1 text-xs font-bold tracking-wide">{displayBonus(0)}</div>
            )}
          </>
        ) : (
          <div className="text-lg italic">Aucune équipe</div>
        )}
      </div>

      {/* timer / center */}
      <div className="bg-gray-900 text-white flex flex-col items-center justify-center px-3 sm:px-8 py-3 sm:py-6 gap-1 sm:gap-2">
        {mainTimerText && (
          <div className="text-xl sm:text-5xl font-mono font-bold text-center break-words leading-none">{mainTimerText}</div>
        )}
        {secondaryTimerText && (
          <div className="text-sm sm:text-2xl font-mono text-yellow-300 text-center break-words">{secondaryTimerText}</div>
        )}
      </div>

      {/* right team */}
      <div
        className={`flex-1 text-white p-3 sm:p-6 flex flex-col items-center justify-center ${rightTeamColor ? "" : "bg-red-700"}`}
        style={rightTeamColor ? { backgroundColor: rightTeamColor } : undefined}
      >
        {teams[1] ? (
          <>
            <div className="text-sm sm:text-lg font-semibold mb-1">{displayTeamName(teams[1])}</div>
            <div className="text-4xl sm:text-6xl font-bold leading-none">{displayScore(1)}</div>
            {displayBonus(1) && (
              <div className="mt-2 rounded bg-black/20 px-2 py-1 text-xs font-bold tracking-wide">{displayBonus(1)}</div>
            )}
          </>
        ) : (
          <div className="text-lg italic">Aucune équipe</div>
        )}
      </div>
    </div>
  );
}
