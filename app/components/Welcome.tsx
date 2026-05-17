import { useTeams } from "~/context/TeamsContext";
import { useAccount } from "~/context/AccountContext";
import logoSP from "~/assets/images/logo match reporter.png";
import { useState } from "react";
import { Link } from "react-router";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleUser } from "@fortawesome/free-solid-svg-icons";

export function Welcome() {
  const { account, connected, logout } = useAccount();
  const { matchDay, season, sport, championship, setMatchDay, setSeason, setSport, setChampionship } = useTeams();
  const [successMessage, setSuccessMessage] = useState("");
  const [accountMessage, setAccountMessage] = useState("");

  const sportOptions = ["Rugby", "Football"] as const;
  const championshipOptions = ["Top 14", "Pro D2"] as const;
  const seasonOptions = ["2025/2026", "2024/2025", "2023/2024"] as const;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSuccessMessage("Formulaire validé avec succès.");
  }

  async function handleLogout() {
    try {
      await logout();
      setAccountMessage("Déconnexion effectuée.");
    } catch {
      setAccountMessage("Impossible de se déconnecter.");
    }
  }

  return (
    <main className="relative flex h-full min-h-0 w-full items-center justify-center py-4">
      <div className="absolute inset-x-4 top-4 z-20 flex flex-row items-start justify-between gap-2">
        {!connected && (
          <p className="w-fit max-w-[55%] rounded border border-amber-700/60 bg-amber-900/40 px-3 py-1 text-[11px] text-amber-200">
            Mode invité: les données sont conservées 24h.
          </p>
        )}
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {connected && account ? (
              <button
                type="button"
                onClick={handleLogout}
                className="sp-button sp-button-xs sp-button-red"
              >
                Déconnexion
              </button>
          ) : (
            <>
              <Link
                to="/account#switch-account"
                className="sp-button sp-button-xs sp-button-blue"
              >
                Se connecter
              </Link>
              <Link
                to="/account#create-account"
                className="sp-button sp-button-xs sp-button-green"
              >
                <FontAwesomeIcon icon={faCircleUser} className="sm:mr-2" />
                Créer un compte
              </Link>
            </>
          )}
        </div>
      </div>
      <div className="flex w-full flex-1 flex-col items-center gap-16 min-h-0">
        <header className="flex w-full flex-col items-center gap-9">
            <div className="mx-auto w-full max-w-[1100px] px-2">
            <img
              src={logoSP}
              alt="Sidepitcher Logo"
              className="mx-auto block w-full max-h-[38vh] object-contain"
            />
          </div>
          {/* reglages de journee/championnat */}
          <form className="mx-auto w-5/6 max-w-sm space-y-3 text-left mb-8 lg:mb-16 md:w-full" onSubmit={handleSubmit}>
            <div className="sp-input-shell">
              <label className="sp-input-label" htmlFor="sportSelect">Sport</label>
              <select
                id="sportSelect"
                className="sp-input-control"
                value={sport}
                onChange={(e) =>
                  setSport(e.target.value as "Rugby" | "Football")
                }
              >
                {sportOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div className="sp-input-shell">
              <label className="sp-input-label" data-slot="label" htmlFor="matchDayInput">Journée</label>
              <input
                id="matchDayInput"
                type="text"
                className="sp-input-control"
                value={matchDay}
                onChange={(e) => setMatchDay(e.target.value)}
                placeholder="ex. J1"
              />
            </div>
            <div className="sp-input-shell">
              <label className="sp-input-label" htmlFor="championshipSelect">Championnat</label>
              <select
                id="championshipSelect"
                className="sp-input-control"
                value={championship}
                onChange={(e) =>
                  setChampionship(e.target.value as "Top 14" | "Pro D2")
                }
              >
                {championshipOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div className="sp-input-shell">
              <label className="sp-input-label" htmlFor="seasonSelect">Saison</label>
              <select
                id="seasonSelect"
                className="sp-input-control"
                value={season}
                onChange={(e) => setSeason(e.target.value)}
              >
                {seasonOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="sp-button sp-button-md sp-button-full sp-button-blue"
            >
              Valider
            </button>
            {successMessage && <p className="text-sm text-green-400">{successMessage}</p>}
            {accountMessage && <p className="text-sm text-neutral-300">{accountMessage}</p>}
          </form>
        </header>
      </div>
    </main>
  );
};
