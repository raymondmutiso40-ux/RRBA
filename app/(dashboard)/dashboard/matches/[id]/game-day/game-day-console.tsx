"use client";

import { useEffect, useMemo, useState } from "react";
import { useActionState } from "react";
import { ArrowLeftRight, BarChart3, ChevronRight, CircleHelp, MoreVertical, Save, Trophy, Undo2 } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { recordMatchResultAction, saveBoxScoreAction } from "@/lib/matches/actions";
import { emptyMatchActionState, type MatchActionState } from "@/lib/matches/action-state";
import { STAT_COLUMNS, statFieldName, type StatKey } from "@/lib/matches/labels";
import type { BoxScoreEntry } from "@/lib/matches/queries";

const STORAGE_PREFIX = "rrba:gameday:v1:";
const QUARTERS = [1, 2, 3, 4] as const;
const CLOCK_SECONDS = 10 * 60;

type StatLine = Record<StatKey, number>;
type GameState = Record<string, StatLine>;
type HistoryEntry = { game: GameState; recordedPlayers: Record<string, boolean>; teamScore: number; opponentScore: number };

type Props = {
  eventId: string;
  teamName: string;
  opponentName: string;
  initialTeamScore: number;
  initialOpponentScore: number;
  initialEntries: BoxScoreEntry[];
};

function blankLine(): StatLine {
  return {
    minutes_played: 0,
    points: 0,
    rebounds: 0,
    assists: 0,
    steals: 0,
    blocks: 0,
    turnovers: 0,
    fouls: 0,
    fg_made: 0,
    fg_attempts: 0,
    three_made: 0,
    three_attempts: 0,
    ft_made: 0,
    ft_attempts: 0,
  };
}

function fromEntry(entry: BoxScoreEntry): StatLine {
  const line = blankLine();
  for (const column of STAT_COLUMNS) {
    const value = entry.stats?.[column.key];
    if (value != null) line[column.key] = value;
  }
  return line;
}

function displayName(entry: BoxScoreEntry) {
  const number = entry.jersey_number == null ? "" : `#${entry.jersey_number} `;
  return `${number}${entry.first_name} ${entry.last_name}`.trim();
}

function percentage(made: number, attempts: number) {
  return attempts > 0 ? `${Math.round((made / attempts) * 100)}%` : "—";
}

export function GameDayConsole({
  eventId,
  teamName,
  opponentName,
  initialTeamScore,
  initialOpponentScore,
  initialEntries,
}: Props) {
  const [selectedId, setSelectedId] = useState(initialEntries[0]?.player_id ?? "");
  const [quarter, setQuarter] = useState<(typeof QUARTERS)[number]>(1);
  const [clock, setClock] = useState(CLOCK_SECONDS);
  const [clockRunning, setClockRunning] = useState(false);
  const [teamScore, setTeamScore] = useState(initialTeamScore);
  const [opponentScore, setOpponentScore] = useState(initialOpponentScore);
  const [game, setGame] = useState<GameState>(() =>
    Object.fromEntries(initialEntries.map((entry) => [entry.player_id, fromEntry(entry)])),
  );
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [recordedPlayers, setRecordedPlayers] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(initialEntries.map((entry) => [entry.player_id, entry.stats !== null])),
  );
  const [hydrated, setHydrated] = useState(false);
  const [saveState, saveAction, savePending] = useActionState<MatchActionState, FormData>(
    saveBoxScoreAction,
    emptyMatchActionState,
  );
  const [resultState, resultAction, resultPending] = useActionState<MatchActionState, FormData>(
    recordMatchResultAction,
    emptyMatchActionState,
  );

  const storageKey = `${STORAGE_PREFIX}${eventId}`;

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<{
          game: GameState;
          recordedPlayers: Record<string, boolean>;
          teamScore: number;
          opponentScore: number;
          quarter: number;
          clock: number;
        }>;
        if (saved.game) setGame(saved.game);
        if (saved.recordedPlayers) setRecordedPlayers(saved.recordedPlayers);
        if (typeof saved.teamScore === "number") setTeamScore(saved.teamScore);
        if (typeof saved.opponentScore === "number") setOpponentScore(saved.opponentScore);
        if (saved.quarter === 1 || saved.quarter === 2 || saved.quarter === 3 || saved.quarter === 4) {
          setQuarter(saved.quarter);
        }
        if (typeof saved.clock === "number" && saved.clock >= 0 && saved.clock <= CLOCK_SECONDS) {
          setClock(saved.clock);
        }
      }
    } catch {
      // A corrupt local draft should never block the official page.
    } finally {
      setHydrated(true);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ game, recordedPlayers, teamScore, opponentScore, quarter, clock }),
    );
  }, [clock, game, hydrated, opponentScore, quarter, recordedPlayers, storageKey, teamScore]);

  useEffect(() => {
    if (!clockRunning) return;
    const timer = window.setInterval(() => {
      setClock((current) => {
        if (current <= 1) {
          setClockRunning(false);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [clockRunning]);

  const selected = initialEntries.find((entry) => entry.player_id === selectedId) ?? initialEntries[0];
  const selectedStats = selected ? game[selected.player_id] ?? blankLine() : blankLine();

  const totals = useMemo(() => {
    const total = blankLine();
    for (const line of Object.values(game)) {
      for (const key of STAT_COLUMNS.map((column) => column.key)) total[key] += line[key] ?? 0;
    }
    return total;
  }, [game]);

  function pushHistory() {
    setHistory((current) => [...current.slice(-30), { game, recordedPlayers, teamScore, opponentScore }]);
  }

  function updateSelected(mutator: (line: StatLine) => StatLine, scoreDelta = 0) {
    if (!selected) return;
    pushHistory();
    setGame((current) => ({
      ...current,
      [selected.player_id]: mutator({ ...(current[selected.player_id] ?? blankLine()) }),
    }));
    setRecordedPlayers((current) => ({ ...current, [selected.player_id]: true }));
    if (scoreDelta) setTeamScore((score) => Math.max(0, score + scoreDelta));
  }

  function addTwo() {
    updateSelected((line) => ({ ...line, points: line.points + 2, fg_made: line.fg_made + 1, fg_attempts: line.fg_attempts + 1 }), 2);
  }

  function addThree() {
    updateSelected((line) => ({ ...line, points: line.points + 3, fg_made: line.fg_made + 1, fg_attempts: line.fg_attempts + 1, three_made: line.three_made + 1, three_attempts: line.three_attempts + 1 }), 3);
  }

  function missTwo() {
    updateSelected((line) => ({ ...line, fg_attempts: line.fg_attempts + 1 }));
  }

  function missThree() {
    updateSelected((line) => ({ ...line, fg_attempts: line.fg_attempts + 1, three_attempts: line.three_attempts + 1 }));
  }

  function addFreeThrow() {
    updateSelected((line) => ({ ...line, points: line.points + 1, ft_made: line.ft_made + 1, ft_attempts: line.ft_attempts + 1 }), 1);
  }

  function missFreeThrow() {
    updateSelected((line) => ({ ...line, ft_attempts: line.ft_attempts + 1 }));
  }

  function addStat(key: Exclude<StatKey, "minutes_played" | "points" | "fg_made" | "fg_attempts" | "three_made" | "three_attempts" | "ft_made" | "ft_attempts">) {
    updateSelected((line) => ({ ...line, [key]: line[key] + 1 }));
  }

  function undo() {
    const previous = history[history.length - 1];
    if (!previous) return;
    setGame(previous.game);
    setRecordedPlayers(previous.recordedPlayers);
    setTeamScore(previous.teamScore);
    setOpponentScore(previous.opponentScore);
    setHistory((current) => current.slice(0, -1));
  }

  function resetDraft() {
    if (!window.confirm("Reset the Game Day draft on this device? Saved database statistics will not be deleted.")) return;
    const clean = Object.fromEntries(initialEntries.map((entry) => [entry.player_id, blankLine()]));
    setGame(clean);
    setTeamScore(0);
    setOpponentScore(0);
    setQuarter(1);
    setClock(CLOCK_SECONDS);
    setClockRunning(false);
    setHistory([]);
    setRecordedPlayers(Object.fromEntries(initialEntries.map((entry) => [entry.player_id, false])));
    window.localStorage.removeItem(storageKey);
  }

  const clockText = `${String(Math.floor(clock / 60)).padStart(2, "0")}:${String(clock % 60).padStart(2, "0")}`;

  return (
    <div className="flex flex-col gap-3">
      <Card className="overflow-hidden border-0 bg-[var(--color-ink-900)] text-white shadow-lg">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-4 sm:px-8">
          <ScoreTeam name={teamName} score={teamScore} stats={totals} align="left" />
          <div className="text-center">
            <div className="text-xs font-semibold tracking-[0.2em] text-white/60 uppercase">Q{quarter}</div>
            <button
              type="button"
              onClick={() => setClockRunning((running) => !running)}
              className="mt-1 rounded-xl px-3 py-1 text-4xl font-semibold tabular-nums tracking-tight hover:bg-white/10 sm:text-5xl"
              aria-label={clockRunning ? "Pause game clock" : "Start game clock"}
            >
              {clockText}
            </button>
            <div className="text-xs text-white/60">{clockRunning ? "LIVE" : "PAUSED"}</div>
          </div>
          <ScoreTeam name={opponentName} score={opponentScore} stats={undefined} align="right" />
        </div>
        <div className="flex items-center justify-center gap-2 border-t border-white/10 px-4 py-2">
          <button type="button" className="rounded-lg px-3 py-1.5 text-xs font-medium text-white/80 hover:bg-white/10" onClick={() => setQuarter((q) => (q === 4 ? 1 : (q + 1) as 1 | 2 | 3 | 4))}>
            Next quarter <ChevronRight className="ml-1 inline size-3" />
          </button>
          <span className="text-white/30">·</span>
          <button type="button" className="rounded-lg px-3 py-1.5 text-xs font-medium text-white/80 hover:bg-white/10" onClick={() => setOpponentScore((score) => Math.max(0, score - 1))}>
            − opponent point
          </button>
          <button type="button" className="rounded-lg px-3 py-1.5 text-xs font-medium text-white/80 hover:bg-white/10" onClick={() => setOpponentScore((score) => score + 1)}>
            + opponent point
          </button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-[var(--border-color)] bg-[var(--surface-muted)] px-3 py-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {initialEntries.map((entry) => {
              const active = entry.player_id === selectedId;
              const stats = game[entry.player_id] ?? blankLine();
              return (
                <button
                  key={entry.player_id}
                  type="button"
                  onClick={() => setSelectedId(entry.player_id)}
                  className={`min-w-24 shrink-0 rounded-xl border px-3 py-2 text-left transition ${active ? "border-[var(--primary)] bg-[var(--surface)] shadow-sm" : "border-transparent hover:border-[var(--border-color)]"}`}
                >
                  <div className="text-xs font-medium text-[var(--foreground-muted)]">
                    {entry.jersey_number == null ? "—" : `#${entry.jersey_number}`}
                  </div>
                  <div className="truncate text-sm font-semibold">{entry.first_name}</div>
                  <div className="text-xs tabular-nums text-[var(--foreground-muted)]">{stats.points} PTS</div>
                </button>
              );
            })}
          </div>
        </div>

        {selected ? (
          <div className="p-3 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-medium tracking-wide text-[var(--foreground-muted)] uppercase">Selected player</div>
                <h2 className="text-xl font-semibold">{displayName(selected)}</h2>
              </div>
              <div className="text-right">
                <div className="text-3xl font-semibold tabular-nums">{selectedStats.points}</div>
                <div className="text-xs text-[var(--foreground-muted)]">PTS</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <ActionButton label="+3" tone="primary" onClick={addThree} />
              <ActionButton label="+2" tone="primary" onClick={addTwo} />
              <ActionButton label="+FT" tone="primary" onClick={addFreeThrow} />
              <ActionButton label="MISS 3" tone="danger" onClick={missThree} />
              <ActionButton label="MISS 2" tone="danger" onClick={missTwo} />
              <ActionButton label="MISS FT" tone="danger" onClick={missFreeThrow} />
              <ActionButton label="ORB" tone="info" onClick={() => addStat("rebounds")} />
              <ActionButton label="DRB" tone="info" onClick={() => addStat("rebounds")} />
              <ActionButton label="AST" tone="info" onClick={() => addStat("assists")} />
              <ActionButton label="BLK" tone="info" onClick={() => addStat("blocks")} />
              <ActionButton label="STL" tone="info" onClick={() => addStat("steals")} />
              <ActionButton label="TO" tone="info" onClick={() => addStat("turnovers")} />
              <ActionButton label="FOUL" tone="info" onClick={() => addStat("fouls")} />
              <button
                type="button"
                onClick={undo}
                disabled={history.length === 0}
                className="flex min-h-20 items-center justify-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--surface-muted)] text-sm font-semibold disabled:opacity-40 sm:min-h-24"
              >
                <Undo2 className="size-5" /> Undo
              </button>
              <button
                type="button"
                onClick={() => setSelectedId(initialEntries[(Math.max(0, initialEntries.findIndex((entry) => entry.player_id === selectedId)) + 1) % initialEntries.length]?.player_id ?? selectedId)}
                className="flex min-h-20 items-center justify-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--surface-muted)] text-sm font-semibold sm:min-h-24"
              >
                <ArrowLeftRight className="size-5" /> Next player
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <MiniStat label="REB" value={selectedStats.rebounds} />
              <MiniStat label="AST" value={selectedStats.assists} />
              <MiniStat label="STL" value={selectedStats.steals} />
              <MiniStat label="BLK" value={selectedStats.blocks} />
              <MiniStat label="TO" value={selectedStats.turnovers} />
              <MiniStat label="PF" value={selectedStats.fouls} />
              <MiniStat label="FG" value={`${selectedStats.fg_made}/${selectedStats.fg_attempts} · ${percentage(selectedStats.fg_made, selectedStats.fg_attempts)}`} />
              <MiniStat label="3PT" value={`${selectedStats.three_made}/${selectedStats.three_attempts} · ${percentage(selectedStats.three_made, selectedStats.three_attempts)}`} />
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-[var(--foreground-muted)]">No players are available for this fixture.</div>
        )}
      </Card>

      {saveState.message ? <Alert tone={saveState.ok ? "success" : "danger"}>{saveState.message}</Alert> : null}
      {resultState.message ? <Alert tone={resultState.ok ? "success" : "danger"}>{resultState.message}</Alert> : null}

      <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold">Save live statistics</h3>
              <p className="text-sm text-[var(--foreground-muted)]">Save progress without ending the game. Only players you have touched or previously recorded are written.</p>
            </div>
            <Save className="size-5 text-[var(--foreground-muted)]" />
          </div>
          <form action={saveAction} className="mt-4">
            <input type="hidden" name="eventId" value={eventId} />
            {initialEntries.filter((entry) => recordedPlayers[entry.player_id]).map((entry) => (
              <div key={entry.player_id}>
                <input type="hidden" name="playerId" value={entry.player_id} />
                {STAT_COLUMNS.map((column) => (
                  <input key={column.key} type="hidden" name={statFieldName(entry.player_id, column.key)} value={game[entry.player_id]?.[column.key] ?? 0} />
                ))}
              </div>
            ))}
            <Button type="submit" loading={savePending} className="w-full sm:w-auto">Save stats</Button>
          </form>
        </Card>

        <Card className="border-[var(--primary)]/30 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold">Finalize game</h3>
              <p className="text-sm text-[var(--foreground-muted)]">Publishes the final score and marks the fixture completed.</p>
            </div>
            <Trophy className="size-5 text-[var(--foreground-muted)]" />
          </div>
          <form action={resultAction} className="mt-4 flex flex-col gap-3">
            <input type="hidden" name="eventId" value={eventId} />
            <div className="grid grid-cols-2 gap-2">
              <label className="rounded-lg border border-[var(--border-color)] p-2">
                <span className="block text-xs text-[var(--foreground-muted)]">{teamName}</span>
                <input name="finalScoreTeam" type="number" min={0} max={500} value={teamScore} onChange={(event) => setTeamScore(Number(event.target.value) || 0)} className="mt-1 w-full bg-transparent text-2xl font-semibold tabular-nums outline-none" />
              </label>
              <label className="rounded-lg border border-[var(--border-color)] p-2">
                <span className="block text-xs text-[var(--foreground-muted)]">{opponentName}</span>
                <input name="finalScoreOpp" type="number" min={0} max={500} value={opponentScore} onChange={(event) => setOpponentScore(Number(event.target.value) || 0)} className="mt-1 w-full bg-transparent text-2xl font-semibold tabular-nums outline-none" />
              </label>
            </div>
            <Button type="submit" loading={resultPending}>Finalize game</Button>
          </form>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <FooterButton icon={<MoreVertical />} label="More" onClick={resetDraft} />
        <FooterButton icon={<ArrowLeftRight />} label="Swap" onClick={() => {
          if (!selected) return;
          const index = initialEntries.findIndex((entry) => entry.player_id === selected.player_id);
          setSelectedId(initialEntries[(index + 1) % initialEntries.length]?.player_id ?? selected.player_id);
        }} />
        <FooterButton icon={<Undo2 />} label="Undo" onClick={undo} disabled={history.length === 0} />
        <FooterButton icon={<BarChart3 />} label="Stats" onClick={() => document.getElementById("gameday-stat-board")?.scrollIntoView({ behavior: "smooth" })} />
      </div>

      <Card id="gameday-stat-board" className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--border-color)] px-4 py-3">
          <div>
            <h3 className="font-semibold">Live team box score</h3>
            <p className="text-xs text-[var(--foreground-muted)]">Updates instantly as you record actions.</p>
          </div>
          <CircleHelp className="size-4 text-[var(--foreground-muted)]" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-[var(--surface-muted)] text-xs text-[var(--foreground-muted)] uppercase">
              <tr>
                <th className="px-3 py-2 text-left">Player</th>
                {(["points", "rebounds", "assists", "steals", "blocks", "turnovers", "fouls"] as const).map((key) => (
                  <th key={key} className="px-2 py-2 text-center">{key === "points" ? "PTS" : key === "rebounds" ? "REB" : key === "assists" ? "AST" : key === "steals" ? "STL" : key === "blocks" ? "BLK" : key === "turnovers" ? "TO" : "PF"}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {initialEntries.map((entry) => {
                const line = game[entry.player_id] ?? blankLine();
                return (
                  <tr key={entry.player_id}>
                    <th className="px-3 py-2 text-left font-medium">{displayName(entry)}</th>
                    <td className="px-2 py-2 text-center tabular-nums">{line.points}</td>
                    <td className="px-2 py-2 text-center tabular-nums">{line.rebounds}</td>
                    <td className="px-2 py-2 text-center tabular-nums">{line.assists}</td>
                    <td className="px-2 py-2 text-center tabular-nums">{line.steals}</td>
                    <td className="px-2 py-2 text-center tabular-nums">{line.blocks}</td>
                    <td className="px-2 py-2 text-center tabular-nums">{line.turnovers}</td>
                    <td className="px-2 py-2 text-center tabular-nums">{line.fouls}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t-2 border-[var(--border-color)] font-semibold">
              <tr>
                <th className="px-3 py-2 text-left">Team total</th>
                <td className="px-2 py-2 text-center tabular-nums">{totals.points}</td>
                <td className="px-2 py-2 text-center tabular-nums">{totals.rebounds}</td>
                <td className="px-2 py-2 text-center tabular-nums">{totals.assists}</td>
                <td className="px-2 py-2 text-center tabular-nums">{totals.steals}</td>
                <td className="px-2 py-2 text-center tabular-nums">{totals.blocks}</td>
                <td className="px-2 py-2 text-center tabular-nums">{totals.turnovers}</td>
                <td className="px-2 py-2 text-center tabular-nums">{totals.fouls}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  );
}

function ScoreTeam({ name, score, stats, align }: { name: string; score: number; stats?: StatLine; align: "left" | "right" }) {
  return (
    <div className={align === "right" ? "text-right" : "text-left"}>
      <div className="truncate text-sm font-semibold sm:text-base">{name}</div>
      <div className="text-5xl font-semibold tabular-nums sm:text-6xl">{score}</div>
      {stats ? (
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-white/60">
          <span>REB {stats.rebounds}</span><span>AST {stats.assists}</span><span>TO {stats.turnovers}</span><span>FOUL {stats.fouls}</span>
        </div>
      ) : <div className="mt-1 text-[11px] text-white/60">Opponent</div>}
    </div>
  );
}

function ActionButton({ label, onClick, tone }: { label: string; onClick: () => void; tone: "primary" | "danger" | "info" }) {
  const classes = tone === "primary"
    ? "bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90"
    : tone === "danger"
      ? "bg-[var(--color-danger)] text-white hover:opacity-90"
      : "bg-[var(--surface-muted)] text-[var(--foreground)] hover:bg-[var(--color-ink-200)]";
  return <button type="button" onClick={onClick} className={`min-h-20 rounded-xl px-2 text-lg font-semibold transition sm:min-h-24 sm:text-xl ${classes}`}>{label}</button>;
}

function MiniStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--border-color)] px-3 py-2">
      <div className="text-[10px] font-medium tracking-wide text-[var(--foreground-muted)] uppercase">{label}</div>
      <div className="mt-0.5 truncate text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function FooterButton({ icon, label, onClick, disabled }: { icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--surface)] text-sm font-medium hover:bg-[var(--surface-muted)] disabled:opacity-40">
      <span className="[&_svg]:size-4">{icon}</span>{label}
    </button>
  );
}
