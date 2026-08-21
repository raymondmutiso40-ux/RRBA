"use client";

import { useEffect, useMemo, useState } from "react";
import { useActionState } from "react";
import { ArrowLeftRight, BarChart3, ChevronRight, Download, MoreVertical, Save, Trophy, Undo2, UserPlus } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { recordMatchResultAction, saveBoxScoreAction, saveOpponentBoxScoreAction } from "@/lib/matches/actions";
import { emptyMatchActionState, type MatchActionState } from "@/lib/matches/action-state";
import { STAT_COLUMNS, statFieldName, type StatKey } from "@/lib/matches/labels";
import type { BoxScoreEntry, OpponentBoxScoreEntry } from "@/lib/matches/queries";

const STORAGE_PREFIX = "rrba:gameday:v2:";
const QUARTERS = [1, 2, 3, 4] as const;
const CLOCK_SECONDS = 10 * 60;
const DEFAULT_OPPONENT_ROSTER = 12;

type StatLine = Record<StatKey, number>;
type GameState = Record<string, StatLine>;
type OpponentPlayer = { key: string; name: string; jersey: number; stats: StatLine };
type HistoryEntry = {
  game: GameState;
  opponent: OpponentPlayer[];
  recordedPlayers: Record<string, boolean>;
  onCourt: string[];
  opponentOnCourt: string[];
  teamScore: number;
  opponentScore: number;
};

type Props = {
  eventId: string;
  teamName: string;
  opponentName: string;
  initialTeamScore: number;
  initialOpponentScore: number;
  initialEntries: BoxScoreEntry[];
  initialOpponentEntries: OpponentBoxScoreEntry[];
};

function blankLine(): StatLine {
  return {
    minutes_played: 0, points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0,
    turnovers: 0, fouls: 0, fg_made: 0, fg_attempts: 0, three_made: 0,
    three_attempts: 0, ft_made: 0, ft_attempts: 0,
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

function fromOpponentEntry(entry: OpponentBoxScoreEntry): StatLine {
  const line = blankLine();
  for (const column of STAT_COLUMNS) {
    const value = entry[column.key];
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

function opponentDefaults(entries: OpponentBoxScoreEntry[]): OpponentPlayer[] {
  if (entries.length) return entries.map((entry, index) => ({
    key: entry.player_key || `opp-${index + 1}`,
    name: entry.player_name,
    jersey: entry.jersey_number ?? index + 4,
    stats: fromOpponentEntry(entry),
  }));
  return Array.from({ length: DEFAULT_OPPONENT_ROSTER }, (_, index) => ({
    key: `opp-${index + 1}`,
    name: `Opponent #${index + 1}`,
    jersey: index + 4,
    stats: blankLine(),
  }));
}

export function GameDayConsole({
  eventId, teamName, opponentName, initialTeamScore, initialOpponentScore, initialEntries, initialOpponentEntries,
}: Props) {
  const ownIds = initialEntries.map((entry) => entry.player_id);
  const initialStarting = ownIds.slice(0, 5);
  const [selectedId, setSelectedId] = useState(initialStarting[0] ?? ownIds[0] ?? "");
  const [selectedSide, setSelectedSide] = useState<"home" | "opponent">("home");
  const [selectedOpponentKey, setSelectedOpponentKey] = useState("opp-1");
  const [onCourt, setOnCourt] = useState<string[]>(initialStarting);
  const [opponentOnCourt, setOpponentOnCourt] = useState<string[]>([]);
  const [quarter, setQuarter] = useState<(typeof QUARTERS)[number]>(1);
  const [clock, setClock] = useState(CLOCK_SECONDS);
  const [clockRunning, setClockRunning] = useState(false);
  const [teamScore, setTeamScore] = useState(initialTeamScore);
  const [opponentScore, setOpponentScore] = useState(initialOpponentScore);
  const [game, setGame] = useState<GameState>(() => Object.fromEntries(initialEntries.map((entry) => [entry.player_id, fromEntry(entry)])));
  const [opponent, setOpponent] = useState<OpponentPlayer[]>(() => opponentDefaults(initialOpponentEntries));
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [recordedPlayers, setRecordedPlayers] = useState<Record<string, boolean>>(() => Object.fromEntries(initialEntries.map((entry) => [entry.player_id, entry.stats !== null])));
  const [hydrated, setHydrated] = useState(false);

  const [saveState, saveAction, savePending] = useActionState<MatchActionState, FormData>(saveBoxScoreAction, emptyMatchActionState);
  const [opponentSaveState, opponentSaveAction, opponentSavePending] = useActionState<MatchActionState, FormData>(saveOpponentBoxScoreAction, emptyMatchActionState);
  const [resultState, resultAction, resultPending] = useActionState<MatchActionState, FormData>(recordMatchResultAction, emptyMatchActionState);
  const storageKey = `${STORAGE_PREFIX}${eventId}`;

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<{
          game: GameState; opponent: OpponentPlayer[]; recordedPlayers: Record<string, boolean>;
          onCourt: string[]; opponentOnCourt: string[]; teamScore: number; opponentScore: number; quarter: number; clock: number;
        }>;
        if (saved.game) setGame(saved.game);
        if (saved.opponent) setOpponent(saved.opponent);
        if (saved.recordedPlayers) setRecordedPlayers(saved.recordedPlayers);
        if (saved.onCourt?.length) setOnCourt(saved.onCourt.slice(0, 5));
        if (saved.opponentOnCourt?.length) setOpponentOnCourt(saved.opponentOnCourt.slice(0, 5));
        if (typeof saved.teamScore === "number") setTeamScore(saved.teamScore);
        if (typeof saved.opponentScore === "number") setOpponentScore(saved.opponentScore);
        if (saved.quarter && [1, 2, 3, 4].includes(saved.quarter)) setQuarter(saved.quarter as 1 | 2 | 3 | 4);
        if (typeof saved.clock === "number" && saved.clock >= 0 && saved.clock <= CLOCK_SECONDS) setClock(saved.clock);
      }
    } catch { /* Ignore corrupt local draft. */ }
    setHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(storageKey, JSON.stringify({ game, opponent, recordedPlayers, onCourt, opponentOnCourt, teamScore, opponentScore, quarter, clock }));
  }, [clock, game, hydrated, opponent, opponentOnCourt, opponentScore, onCourt, quarter, recordedPlayers, storageKey, teamScore]);

  useEffect(() => {
    if (!clockRunning) return;
    const timer = window.setInterval(() => setClock((current) => {
      if (current <= 1) { setClockRunning(false); return 0; }
      return current - 1;
    }), 1000);
    return () => window.clearInterval(timer);
  }, [clockRunning]);

  const selected = initialEntries.find((entry) => entry.player_id === selectedId);
  const selectedStats = selected ? game[selected.player_id] ?? blankLine() : blankLine();
  const selectedOpponent = opponent.find((player) => player.key === selectedOpponentKey) ?? opponent[0];
  const activeOpponent = opponentOnCourt.length ? opponentOnCourt : opponent.slice(0, 5).map((p) => p.key);

  useEffect(() => {
    if (!opponentOnCourt.length) setOpponentOnCourt(opponent.slice(0, 5).map((p) => p.key));
  }, [opponent, opponentOnCourt.length]);

  const totals = useMemo(() => {
    const total = blankLine();
    for (const line of Object.values(game)) for (const key of STAT_COLUMNS.map((column) => column.key)) total[key] += line[key] ?? 0;
    return total;
  }, [game]);

  const opponentTotals = useMemo(() => {
    const total = blankLine();
    for (const player of opponent) for (const key of STAT_COLUMNS.map((column) => column.key)) total[key] += player.stats[key] ?? 0;
    return total;
  }, [opponent]);

  function pushHistory() {
    setHistory((current) => [...current.slice(-30), { game, opponent, recordedPlayers, onCourt, opponentOnCourt, teamScore, opponentScore }]);
  }

  function updateHome(mutator: (line: StatLine) => StatLine, scoreDelta = 0) {
    if (!selected) return;
    pushHistory();
    setGame((current) => ({ ...current, [selected.player_id]: mutator({ ...(current[selected.player_id] ?? blankLine()) }) }));
    setRecordedPlayers((current) => ({ ...current, [selected.player_id]: true }));
    if (scoreDelta) setTeamScore((score) => Math.max(0, score + scoreDelta));
  }

  function updateOpponent(mutator: (line: StatLine) => StatLine, scoreDelta = 0) {
    if (!selectedOpponent) return;
    pushHistory();
    setOpponent((current) => current.map((player) => player.key === selectedOpponent.key ? { ...player, stats: mutator({ ...player.stats }) } : player));
    if (scoreDelta) setOpponentScore((score) => Math.max(0, score + scoreDelta));
  }

  function actionFor(label: string) {
    const fn = (update: (line: StatLine) => StatLine, score = 0) => selectedSide === "home" ? updateHome(update, score) : updateOpponent(update, score);
    if (label === "+3") return fn((l) => ({ ...l, points: l.points + 3, fg_made: l.fg_made + 1, fg_attempts: l.fg_attempts + 1, three_made: l.three_made + 1, three_attempts: l.three_attempts + 1 }), 3);
    if (label === "+2") return fn((l) => ({ ...l, points: l.points + 2, fg_made: l.fg_made + 1, fg_attempts: l.fg_attempts + 1 }), 2);
    if (label === "+FT") return fn((l) => ({ ...l, points: l.points + 1, ft_made: l.ft_made + 1, ft_attempts: l.ft_attempts + 1 }), 1);
    if (label === "MISS 3") return fn((l) => ({ ...l, fg_attempts: l.fg_attempts + 1, three_attempts: l.three_attempts + 1 }));
    if (label === "MISS 2") return fn((l) => ({ ...l, fg_attempts: l.fg_attempts + 1 }));
    if (label === "MISS FT") return fn((l) => ({ ...l, ft_attempts: l.ft_attempts + 1 }));
    const statMap: Record<string, Exclude<StatKey, "minutes_played" | "points" | "fg_made" | "fg_attempts" | "three_made" | "three_attempts" | "ft_made" | "ft_attempts">> = { ORB: "rebounds", DRB: "rebounds", AST: "assists", BLK: "blocks", STL: "steals", TO: "turnovers", FOUL: "fouls" };
    const key = statMap[label];
    return key ? fn((l) => ({ ...l, [key]: l[key] + 1 })) : undefined;
  }

  function substitute(side: "home" | "opponent", outId: string, inId: string) {
    pushHistory();
    const setter = side === "home" ? setOnCourt : setOpponentOnCourt;
    setter((current) => current.map((id) => id === outId ? inId : id).slice(0, 5));
    if (side === "home") setSelectedId(inId); else setSelectedOpponentKey(inId);
  }

  function undo() {
    const previous = history[history.length - 1];
    if (!previous) return;
    setGame(previous.game); setOpponent(previous.opponent); setRecordedPlayers(previous.recordedPlayers);
    setOnCourt(previous.onCourt); setOpponentOnCourt(previous.opponentOnCourt);
    setTeamScore(previous.teamScore); setOpponentScore(previous.opponentScore);
    setHistory((current) => current.slice(0, -1));
  }

  function resetDraft() {
    if (!window.confirm("Reset the Game Day draft on this device? Saved database statistics will not be deleted.")) return;
    setGame(Object.fromEntries(initialEntries.map((entry) => [entry.player_id, blankLine()])));
    setOpponent(opponentDefaults([])); setTeamScore(0); setOpponentScore(0); setQuarter(1); setClock(CLOCK_SECONDS); setClockRunning(false);
    setHistory([]); setOnCourt(initialStarting); setOpponentOnCourt(opponent.slice(0, 5).map((p) => p.key));
    setRecordedPlayers(Object.fromEntries(initialEntries.map((entry) => [entry.player_id, false]))); window.localStorage.removeItem(storageKey);
  }

  function downloadJpeg() {
    const canvas = document.createElement("canvas");
    const width = 1800;
    const rowH = 54;
    const ownRows = initialEntries.length;
    const oppRows = opponent.length;
    canvas.width = width;
    canvas.height = 420 + (ownRows + oppRows + 8) * rowH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, width, canvas.height); ctx.fillStyle = "#111827";
    ctx.font = "700 44px Arial"; ctx.fillText(`${teamName} ${teamScore}  -  ${opponentScore} ${opponentName}`, 70, 75);
    ctx.font = "24px Arial"; ctx.fillStyle = "#4b5563"; ctx.fillText(`RRBA Game Day • Q${quarter} • ${clockText}`, 70, 120);
    let y = 180;
    const drawSection = (title: string, rows: { name: string; stats: StatLine }[]) => {
      ctx.fillStyle = "#111827"; ctx.font = "700 28px Arial"; ctx.fillText(title, 70, y); y += 42;
      ctx.fillStyle = "#f3f4f6"; ctx.fillRect(50, y - 30, width - 100, 42);
      ctx.fillStyle = "#111827"; ctx.font = "700 18px Arial";
      ["PLAYER", "PTS", "REB", "AST", "STL", "BLK", "TO", "PF", "FG", "3PT", "FT"].forEach((h, i) => ctx.fillText(h, [70, 620, 730, 840, 950, 1060, 1170, 1280, 1390, 1530, 1650][i], y - 4));
      y += 38; ctx.font = "20px Arial";
      for (const row of rows) {
        ctx.fillStyle = "#111827"; ctx.fillText(row.name.slice(0, 38), 70, y);
        const values = [row.stats.points, row.stats.rebounds, row.stats.assists, row.stats.steals, row.stats.blocks, row.stats.turnovers, row.stats.fouls, `${row.stats.fg_made}/${row.stats.fg_attempts}`, `${row.stats.three_made}/${row.stats.three_attempts}`, `${row.stats.ft_made}/${row.stats.ft_attempts}`];
        values.forEach((v, i) => ctx.fillText(String(v), [620, 730, 840, 950, 1060, 1170, 1280, 1390, 1530, 1650][i], y));
        y += rowH;
      }
      y += 25;
    };
    drawSection(teamName, initialEntries.map((e) => ({ name: displayName(e), stats: game[e.player_id] ?? blankLine() })));
    drawSection(opponentName, opponent.map((p) => ({ name: `#${p.jersey} ${p.name}`, stats: p.stats })));
    ctx.fillStyle = "#6b7280"; ctx.font = "18px Arial"; ctx.fillText("Generated by RRBA", 70, canvas.height - 35);
    const link = document.createElement("a"); link.download = `RRBA-${teamName.replace(/[^a-z0-9]+/gi, "-")}-vs-${opponentName.replace(/[^a-z0-9]+/gi, "-")}-stats.jpg`; link.href = canvas.toDataURL("image/jpeg", 0.94); link.click();
  }

  const clockText = `${String(Math.floor(clock / 60)).padStart(2, "0")}:${String(clock % 60).padStart(2, "0")}`;
  const homeBench = initialEntries.filter((entry) => !onCourt.includes(entry.player_id));
  const opponentBench = opponent.filter((player) => !activeOpponent.includes(player.key));
  const opponentFormPlayers = opponent;

  return (
    <div className="flex flex-col gap-3">
      <Card className="overflow-hidden border-0 bg-[var(--color-ink-900)] text-white shadow-lg">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-4 sm:px-8">
          <ScoreTeam name={teamName} score={teamScore} stats={totals} align="left" />
          <div className="text-center"><div className="text-xs font-semibold tracking-[0.2em] text-white/60 uppercase">Q{quarter}</div><button type="button" onClick={() => setClockRunning((running) => !running)} className="mt-1 rounded-xl px-3 py-1 text-4xl font-semibold tabular-nums hover:bg-white/10 sm:text-5xl">{clockText}</button><div className="text-xs text-white/60">{clockRunning ? "LIVE" : "PAUSED"}</div></div>
          <ScoreTeam name={opponentName} score={opponentScore} stats={opponentTotals} align="right" />
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 border-t border-white/10 px-4 py-2">
          <button type="button" className="rounded-lg px-3 py-1.5 text-xs font-medium text-white/80 hover:bg-white/10" onClick={() => setQuarter((q) => q === 4 ? 1 : (q + 1) as 1 | 2 | 3 | 4)}>Next quarter <ChevronRight className="ml-1 inline size-3" /></button>
          <button type="button" className="rounded-lg px-3 py-1.5 text-xs font-medium text-white/80 hover:bg-white/10" onClick={() => setOpponentScore((score) => Math.max(0, score - 1))}>− opponent point</button>
          <button type="button" className="rounded-lg px-3 py-1.5 text-xs font-medium text-white/80 hover:bg-white/10" onClick={() => setOpponentScore((score) => score + 1)}>+ opponent point</button>
          <button type="button" className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/15" onClick={downloadJpeg}><Download className="mr-1 inline size-3" /> Download JPEG</button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex border-b border-[var(--border-color)] bg-[var(--surface-muted)]">
          <button type="button" onClick={() => { setSelectedSide("home"); setSelectedId(onCourt[0] ?? ownIds[0] ?? ""); }} className={`flex-1 px-4 py-3 text-sm font-semibold ${selectedSide === "home" ? "border-b-2 border-[var(--primary)]" : "text-[var(--foreground-muted)]"}`}>{teamName} • On Court</button>
          <button type="button" onClick={() => { setSelectedSide("opponent"); setSelectedOpponentKey(activeOpponent[0] ?? opponent[0]?.key ?? ""); }} className={`flex-1 px-4 py-3 text-sm font-semibold ${selectedSide === "opponent" ? "border-b-2 border-[var(--primary)]" : "text-[var(--foreground-muted)]"}`}>{opponentName} • On Court</button>
        </div>
        <div className="p-3">
          <div className="mb-2 text-xs font-semibold tracking-wide text-[var(--foreground-muted)] uppercase">Starting 5 / players currently on court</div>
          <div className="grid grid-cols-5 gap-2">
            {(selectedSide === "home" ? onCourt.map((id) => initialEntries.find((e) => e.player_id === id)).filter(Boolean) as BoxScoreEntry[] : activeOpponent.map((key) => opponent.find((p) => p.key === key)).filter(Boolean) as OpponentPlayer[]).map((player) => {
              const id = selectedSide === "home" ? (player as BoxScoreEntry).player_id : (player as OpponentPlayer).key;
              const label = selectedSide === "home" ? displayName(player as BoxScoreEntry) : `#${(player as OpponentPlayer).jersey} ${(player as OpponentPlayer).name}`;
              const points = selectedSide === "home" ? game[id]?.points ?? 0 : (player as OpponentPlayer).stats.points;
              const active = selectedSide === "home" ? selectedId === id : selectedOpponentKey === id;
              return <button key={id} type="button" onClick={() => selectedSide === "home" ? setSelectedId(id) : setSelectedOpponentKey(id)} className={`min-h-20 rounded-xl border px-2 text-left ${active ? "border-[var(--primary)] bg-[var(--surface-muted)]" : "border-[var(--border-color)]"}`}><div className="truncate text-xs font-semibold">{label}</div><div className="mt-2 text-2xl font-bold tabular-nums">{points}</div><div className="text-[10px] text-[var(--foreground-muted)]">PTS</div></button>;
            })}
          </div>
        </div>
      </Card>

      <Card className="p-3 sm:p-5">
        <div className="mb-4 flex items-center justify-between"><div><div className="text-xs font-medium tracking-wide text-[var(--foreground-muted)] uppercase">Recording</div><h2 className="text-xl font-semibold">{selectedSide === "home" ? (selected ? displayName(selected) : "Select a player") : (selectedOpponent ? `#${selectedOpponent.jersey} ${selectedOpponent.name}` : "Select opponent")}</h2></div><div className="text-right"><div className="text-3xl font-semibold tabular-nums">{selectedSide === "home" ? selectedStats.points : selectedOpponent?.stats.points ?? 0}</div><div className="text-xs text-[var(--foreground-muted)]">PTS</div></div></div>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {["+3", "+2", "+FT", "MISS 3", "MISS 2", "MISS FT", "ORB", "DRB", "AST", "BLK", "STL", "TO", "FOUL"].map((label) => <ActionButton key={label} label={label} tone={label.startsWith("MISS") ? "danger" : label.startsWith("+") ? "primary" : "info"} onClick={() => actionFor(label)?.()} />)}
          <button type="button" onClick={undo} disabled={!history.length} className="flex min-h-20 items-center justify-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--surface-muted)] text-sm font-semibold disabled:opacity-40"><Undo2 className="size-5" /> Undo</button>
        </div>
      </Card>

      <Card className="p-3">
        <div className="flex items-center justify-between"><div><h3 className="font-semibold">Substitutions</h3><p className="text-xs text-[var(--foreground-muted)]">Only 5 players are active. Stats remain with players when they leave the court.</p></div><ArrowLeftRight className="size-5 text-[var(--foreground-muted)]" /></div>
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          <SubstitutionPanel title={`${teamName} bench`} bench={homeBench.map((e) => ({ id: e.player_id, label: displayName(e) }))} onCourt={onCourt} onSub={(outId, inId) => substitute("home", outId, inId)} />
          <SubstitutionPanel title={`${opponentName} bench`} bench={opponentBench.map((p) => ({ id: p.key, label: `#${p.jersey} ${p.name}` }))} onCourt={activeOpponent} onSub={(outId, inId) => substitute("opponent", outId, inId)} />
        </div>
      </Card>

      <Card className="p-3">
        <div className="flex items-center justify-between"><div><h3 className="font-semibold">Opponent roster</h3><p className="text-xs text-[var(--foreground-muted)]">Enter the opponent's names and jersey numbers once, then record their live stats.</p></div><UserPlus className="size-5 text-[var(--foreground-muted)]" /></div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {opponent.map((player) => <div key={player.key} className="grid grid-cols-[60px_1fr] gap-2"><input aria-label="Jersey number" value={player.jersey} onChange={(e) => setOpponent((current) => current.map((p) => p.key === player.key ? { ...p, jersey: Number(e.target.value) || 0 } : p))} className="rounded-lg border border-[var(--border-color)] bg-transparent px-2 py-2 text-sm" /><input aria-label="Opponent player name" value={player.name} onChange={(e) => setOpponent((current) => current.map((p) => p.key === player.key ? { ...p, name: e.target.value } : p))} className="rounded-lg border border-[var(--border-color)] bg-transparent px-2 py-2 text-sm" /></div>)}
        </div>
      </Card>

      {saveState.message ? <Alert tone={saveState.ok ? "success" : "danger"}>{saveState.message}</Alert> : null}
      {opponentSaveState.message ? <Alert tone={opponentSaveState.ok ? "success" : "danger"}>{opponentSaveState.message}</Alert> : null}
      {resultState.message ? <Alert tone={resultState.ok ? "success" : "danger"}>{resultState.message}</Alert> : null}

      <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr]">
        <Card className="p-4"><div className="flex items-center justify-between"><div><h3 className="font-semibold">Save RRBA stats</h3><p className="text-sm text-[var(--foreground-muted)]">Save every RRBA player whose stats have been touched.</p></div><Save className="size-5" /></div><form action={saveAction} className="mt-4"><input type="hidden" name="eventId" value={eventId} />{initialEntries.filter((entry) => recordedPlayers[entry.player_id]).map((entry) => <div key={entry.player_id}><input type="hidden" name="playerId" value={entry.player_id} />{STAT_COLUMNS.map((column) => <input key={column.key} type="hidden" name={statFieldName(entry.player_id, column.key)} value={game[entry.player_id]?.[column.key] ?? 0} />)}</div>)}<Button type="submit" loading={savePending} className="w-full">Save RRBA stats</Button></form></Card>
        <Card className="p-4"><div className="flex items-center justify-between"><div><h3 className="font-semibold">Save opponent stats</h3><p className="text-sm text-[var(--foreground-muted)]">Opponent player names, roster and box scores are stored with this match.</p></div><Save className="size-5" /></div><form action={opponentSaveAction} className="mt-4"><input type="hidden" name="eventId" value={eventId} />{opponentFormPlayers.map((player) => <div key={player.key}><input type="hidden" name="opponentPlayerKey" value={player.key} /><input type="hidden" name={`opponentName_${player.key}`} value={player.name} /><input type="hidden" name={`opponentJersey_${player.key}`} value={player.jersey} />{STAT_COLUMNS.map((column) => <input key={column.key} type="hidden" name={`opponent_${player.key}_${column.key}`} value={player.stats[column.key] ?? 0} />)}</div>)}<Button type="submit" loading={opponentSavePending} className="w-full">Save opponent stats</Button></form></Card>
        <Card className="border-[var(--primary)]/30 p-4"><div className="flex items-center justify-between"><div><h3 className="font-semibold">Finalize game</h3><p className="text-sm text-[var(--foreground-muted)]">Publishes the final score and completes the fixture.</p></div><Trophy className="size-5" /></div><form action={resultAction} className="mt-4 flex flex-col gap-3"><input type="hidden" name="eventId" value={eventId} /><div className="grid grid-cols-2 gap-2"><ScoreInput label={teamName} value={teamScore} onChange={setTeamScore} /><ScoreInput label={opponentName} value={opponentScore} onChange={setOpponentScore} /></div><Button type="submit" loading={resultPending}>Finalize game</Button></form></Card>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><FooterButton icon={<MoreVertical />} label="Reset" onClick={resetDraft} /><FooterButton icon={<ArrowLeftRight />} label="Swap" onClick={() => { if (selectedSide === "home" && onCourt.length) setSelectedId(onCourt[(onCourt.indexOf(selectedId) + 1) % onCourt.length]); if (selectedSide === "opponent" && activeOpponent.length) setSelectedOpponentKey(activeOpponent[(activeOpponent.indexOf(selectedOpponentKey) + 1) % activeOpponent.length]); }} /><FooterButton icon={<Undo2 />} label="Undo" onClick={undo} disabled={!history.length} /><FooterButton icon={<Download />} label="JPEG" onClick={downloadJpeg} /></div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--border-color)] px-4 py-3"><div><h3 className="font-semibold">Full match box score</h3><p className="text-xs text-[var(--foreground-muted)]">Both teams, including players who have been substituted out.</p></div><BarChart3 className="size-4 text-[var(--foreground-muted)]" /></div>
        <BoxTable title={teamName} entries={initialEntries.map((entry) => ({ name: displayName(entry), stats: game[entry.player_id] ?? blankLine() }))} total={totals} />
        <BoxTable title={opponentName} entries={opponent.map((player) => ({ name: `#${player.jersey} ${player.name}`, stats: player.stats }))} total={opponentTotals} />
      </Card>
    </div>
  );
}

function SubstitutionPanel({ title, bench, onCourt, onSub }: { title: string; bench: { id: string; label: string }[]; onCourt: string[]; onSub: (outId: string, inId: string) => void }) {
  const [outId, setOutId] = useState(onCourt[0] ?? "");
  return <div className="rounded-xl border border-[var(--border-color)] p-3"><div className="mb-2 text-sm font-semibold">{title}</div><select value={outId} onChange={(e) => setOutId(e.target.value)} className="w-full rounded-lg border border-[var(--border-color)] bg-transparent px-3 py-2 text-sm"><option value="">Select player leaving</option>{onCourt.map((id) => <option key={id} value={id}>{id}</option>)}</select><div className="mt-2 grid grid-cols-2 gap-2">{bench.map((player) => <button key={player.id} type="button" disabled={!outId} onClick={() => { onSub(outId, player.id); setOutId(player.id); }} className="rounded-lg border border-[var(--border-color)] px-3 py-2 text-left text-xs font-semibold disabled:opacity-40 hover:bg-[var(--surface-muted)]"><ArrowLeftRight className="mr-1 inline size-3" /> {player.label}</button>)}</div></div>;
}

function BoxTable({ title, entries, total }: { title: string; entries: { name: string; stats: StatLine }[]; total: StatLine }) {
  return <div className="overflow-x-auto border-b border-[var(--border-color)] last:border-0"><div className="px-4 py-2 text-sm font-semibold">{title}</div><table className="w-full min-w-[720px] text-sm"><thead className="bg-[var(--surface-muted)] text-xs text-[var(--foreground-muted)] uppercase"><tr>{["Player", "PTS", "REB", "AST", "STL", "BLK", "TO", "PF", "FG", "3PT", "FT"].map((h) => <th key={h} className="px-2 py-2 text-center first:text-left">{h}</th>)}</tr></thead><tbody className="divide-y divide-[var(--border-color)]">{entries.map((entry) => <tr key={entry.name}><th className="px-3 py-2 text-left font-medium">{entry.name}</th><td className="px-2 py-2 text-center">{entry.stats.points}</td><td className="px-2 py-2 text-center">{entry.stats.rebounds}</td><td className="px-2 py-2 text-center">{entry.stats.assists}</td><td className="px-2 py-2 text-center">{entry.stats.steals}</td><td className="px-2 py-2 text-center">{entry.stats.blocks}</td><td className="px-2 py-2 text-center">{entry.stats.turnovers}</td><td className="px-2 py-2 text-center">{entry.stats.fouls}</td><td className="px-2 py-2 text-center">{entry.stats.fg_made}/{entry.stats.fg_attempts}</td><td className="px-2 py-2 text-center">{entry.stats.three_made}/{entry.stats.three_attempts}</td><td className="px-2 py-2 text-center">{entry.stats.ft_made}/{entry.stats.ft_attempts}</td></tr>)}</tbody><tfoot className="border-t-2 border-[var(--border-color)] font-semibold"><tr><th className="px-3 py-2 text-left">Total</th>{[total.points,total.rebounds,total.assists,total.steals,total.blocks,total.turnovers,total.fouls,`${total.fg_made}/${total.fg_attempts}`,`${total.three_made}/${total.three_attempts}`,`${total.ft_made}/${total.ft_attempts}`].map((v,i)=><td key={i} className="px-2 py-2 text-center">{v}</td>)}</tr></tfoot></table></div>;
}

function ScoreTeam({ name, score, stats, align }: { name: string; score: number; stats?: StatLine; align: "left" | "right" }) { return <div className={align === "right" ? "text-right" : "text-left"}><div className="truncate text-sm font-semibold sm:text-base">{name}</div><div className="text-5xl font-semibold tabular-nums sm:text-6xl">{score}</div>{stats ? <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-white/60"><span>REB {stats.rebounds}</span><span>AST {stats.assists}</span><span>TO {stats.turnovers}</span><span>FOUL {stats.fouls}</span></div> : null}</div>; }
function ActionButton({ label, onClick, tone }: { label: string; onClick: () => void; tone: "primary" | "danger" | "info" }) { const classes = tone === "primary" ? "bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90" : tone === "danger" ? "bg-[var(--color-danger)] text-white hover:opacity-90" : "bg-[var(--surface-muted)] text-[var(--foreground)] hover:bg-[var(--color-ink-200)]"; return <button type="button" onClick={onClick} className={`min-h-20 rounded-xl px-2 text-lg font-semibold transition sm:min-h-24 sm:text-xl ${classes}`}>{label}</button>; }
function FooterButton({ icon, label, onClick, disabled }: { icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }) { return <button type="button" onClick={onClick} disabled={disabled} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--surface)] text-sm font-medium hover:bg-[var(--surface-muted)] disabled:opacity-40"><span className="[&_svg]:size-4">{icon}</span>{label}</button>; }
function ScoreInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) { return <label className="rounded-lg border border-[var(--border-color)] p-2"><span className="block text-xs text-[var(--foreground-muted)]">{label}</span><input type="number" min={0} max={500} value={value} onChange={(e) => onChange(Number(e.target.value) || 0)} className="mt-1 w-full bg-transparent text-2xl font-semibold tabular-nums outline-none" /></label>; }
