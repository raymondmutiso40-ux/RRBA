"use client";

import { useEffect, useMemo, useState } from "react";
import { useActionState } from "react";
import {
  ArrowLeftRight,
  BarChart3,
  Download,
  MapPin,
  Pause,
  Play,
  Save,
  Trophy,
  Undo2,
  UserPlus,
  X,
} from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { recordMatchResultAction, saveBoxScoreAction, saveOpponentBoxScoreAction } from "@/lib/matches/actions";
import { emptyMatchActionState, type MatchActionState } from "@/lib/matches/action-state";
import {
  STAT_COLUMNS,
  efficiencyRating,
  estimatedPossessions,
  formatDuration,
  formatPercentage,
  statFieldName,
  trueShootingPercentage,
  usageRate,
  type StatKey,
} from "@/lib/matches/labels";
import type { BoxScoreEntry, OpponentBoxScoreEntry } from "@/lib/matches/queries";
import { GameDayReport } from "./game-day-report";

const STORAGE_PREFIX = "rrba:gameday:v4:";
const QUARTERS = [1, 2, 3, 4] as const;
const CLOCK_SECONDS = 10 * 60;
const DEFAULT_OPPONENT_ROSTER = 12;

type StatLine = Record<StatKey, number>;
type GameState = Record<string, StatLine>;
type OpponentPlayer = { key: string; name: string; jersey: number; stats: StatLine };
type SecondsMap = Record<string, number>;
type ShotType = "2PT" | "3PT";
type ShotEvent = {
  id: string;
  quarter: number;
  clock: number;
  side: "home" | "opponent";
  playerKey: string;
  playerName: string;
  type: ShotType;
  made: boolean;
  points: number;
  x: number;
  y: number;
};
type GameEvent = ShotEvent | {
  id: string;
  quarter: number;
  clock: number;
  side: "home" | "opponent";
  playerKey: string;
  playerName: string;
  type: "FT" | "ORB" | "DRB" | "AST" | "BLK" | "STL" | "TO" | "FOUL";
  made?: boolean;
  points?: number;
};
type HistoryEntry = {
  game: GameState;
  opponent: OpponentPlayer[];
  recordedPlayers: Record<string, boolean>;
  onCourt: string[];
  opponentOnCourt: string[];
  teamScore: number;
  opponentScore: number;
  homeSeconds: SecondsMap;
  opponentSeconds: SecondsMap;
  homePlusMinus: SecondsMap;
  opponentPlusMinus: SecondsMap;
  events: GameEvent[];
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
    minutes_played: 0, points: 0, rebounds: 0, offensive_rebounds: 0, defensive_rebounds: 0,
    assists: 0, steals: 0, blocks: 0, turnovers: 0, fouls: 0, fg_made: 0, fg_attempts: 0,
    three_made: 0, three_attempts: 0, ft_made: 0, ft_attempts: 0,
  };
}
function fromEntry(entry: BoxScoreEntry): StatLine {
  const line = blankLine();
  for (const column of STAT_COLUMNS) if (entry.stats?.[column.key] != null) line[column.key] = entry.stats[column.key] as number;
  return line;
}
function fromOpponentEntry(entry: OpponentBoxScoreEntry): StatLine {
  const line = blankLine();
  for (const column of STAT_COLUMNS) if (entry[column.key] != null) line[column.key] = entry[column.key] as number;
  return line;
}
function displayName(entry: BoxScoreEntry) {
  const number = entry.jersey_number == null ? "" : `#${entry.jersey_number} `;
  return `${number}${entry.first_name} ${entry.last_name}`.trim();
}
function percentage(made: number, attempts: number) { return attempts > 0 ? `${Math.round((made / attempts) * 100)}%` : "—"; }
function opponentDefaults(entries: OpponentBoxScoreEntry[]): OpponentPlayer[] {
  if (entries.length) return entries.map((entry, index) => ({ key: entry.player_key || `opp-${index + 1}`, name: entry.player_name, jersey: entry.jersey_number ?? index + 4, stats: fromOpponentEntry(entry) }));
  return Array.from({ length: DEFAULT_OPPONENT_ROSTER }, (_, index) => ({ key: `opp-${index + 1}`, name: `Opponent #${index + 1}`, jersey: index + 4, stats: blankLine() }));
}

export function GameDayConsole({ eventId, teamName, opponentName, initialTeamScore, initialOpponentScore, initialEntries: rawInitialEntries, initialOpponentEntries }: Props) {
  const initialEntries = useMemo(
    () => Array.from(new Map(rawInitialEntries.map((entry) => [entry.player_id, entry])).values()),
    [rawInitialEntries]
  );
  const ownIds = initialEntries.map((entry) => entry.player_id);
  const initialStarting = Array.from(new Set(ownIds)).slice(0, 5);
  const [selectedId, setSelectedId] = useState(initialStarting[0] ?? ownIds[0] ?? "");
  const [selectedSide, setSelectedSide] = useState<"home" | "opponent">("home");
  const [selectedOpponentKey, setSelectedOpponentKey] = useState("opp-1");
  const [onCourt, setOnCourt] = useState<string[]>(initialStarting);
  const [opponentOnCourt, setOpponentOnCourt] = useState<string[]>(Array.from(new Set(opponentDefaults(initialOpponentEntries).map((p) => p.key))).slice(0, 5));
  const [quarter, setQuarter] = useState<(typeof QUARTERS)[number]>(1);
  const [clock, setClock] = useState(CLOCK_SECONDS);
  const [clockRunning, setClockRunning] = useState(false);
  const [teamScore, setTeamScore] = useState(initialTeamScore);
  const [opponentScore, setOpponentScore] = useState(initialOpponentScore);
  const [game, setGame] = useState<GameState>(() => Object.fromEntries(initialEntries.map((entry) => [entry.player_id, fromEntry(entry)])));
  const [opponent, setOpponent] = useState<OpponentPlayer[]>(() => opponentDefaults(initialOpponentEntries));
  const [homeSeconds, setHomeSeconds] = useState<SecondsMap>(() => Object.fromEntries(initialEntries.map((entry) => [entry.player_id, (entry.stats?.minutes_played ?? 0) * 60])));
  const [opponentSeconds, setOpponentSeconds] = useState<SecondsMap>(() => Object.fromEntries(initialOpponentEntries.map((entry) => [entry.player_key, (entry.minutes_played ?? 0) * 60])));
  const [homePlusMinus, setHomePlusMinus] = useState<SecondsMap>({});
  const [opponentPlusMinus, setOpponentPlusMinus] = useState<SecondsMap>({});
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [recordedPlayers, setRecordedPlayers] = useState<Record<string, boolean>>(() => Object.fromEntries(initialEntries.map((entry) => [entry.player_id, entry.stats !== null])));
  const [hydrated, setHydrated] = useState(false);
  const [pendingShot, setPendingShot] = useState<{ type: ShotType; made: boolean; points: number } | null>(null);
  const [showReport, setShowReport] = useState(false);

  const [saveState, saveAction, savePending] = useActionState<MatchActionState, FormData>(saveBoxScoreAction, emptyMatchActionState);
  const [opponentSaveState, opponentSaveAction, opponentSavePending] = useActionState<MatchActionState, FormData>(saveOpponentBoxScoreAction, emptyMatchActionState);
  const [resultState, resultAction, resultPending] = useActionState<MatchActionState, FormData>(recordMatchResultAction, emptyMatchActionState);
  const storageKey = `${STORAGE_PREFIX}${eventId}`;

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<{
          game: GameState; opponent: OpponentPlayer[]; recordedPlayers: Record<string, boolean>; onCourt: string[]; opponentOnCourt: string[];
          teamScore: number; opponentScore: number; quarter: number; clock: number; homeSeconds: SecondsMap; opponentSeconds: SecondsMap;
          homePlusMinus: SecondsMap; opponentPlusMinus: SecondsMap; events: GameEvent[];
        }>;
        if (saved.game) setGame(saved.game);
        if (saved.opponent) setOpponent(saved.opponent);
        if (saved.recordedPlayers) setRecordedPlayers(saved.recordedPlayers);
        if (saved.onCourt) setOnCourt(Array.from(new Set(saved.onCourt)).slice(0, 5));
        if (saved.opponentOnCourt) setOpponentOnCourt(Array.from(new Set(saved.opponentOnCourt)).slice(0, 5));
        if (typeof saved.teamScore === "number") setTeamScore(saved.teamScore);
        if (typeof saved.opponentScore === "number") setOpponentScore(saved.opponentScore);
        if (saved.quarter && QUARTERS.includes(saved.quarter as 1 | 2 | 3 | 4)) setQuarter(saved.quarter as 1 | 2 | 3 | 4);
        if (typeof saved.clock === "number") setClock(Math.max(0, Math.min(CLOCK_SECONDS, saved.clock)));
        if (saved.homeSeconds) setHomeSeconds(saved.homeSeconds);
        if (saved.opponentSeconds) setOpponentSeconds(saved.opponentSeconds);
        if (saved.homePlusMinus) setHomePlusMinus(saved.homePlusMinus);
        if (saved.opponentPlusMinus) setOpponentPlusMinus(saved.opponentPlusMinus);
        if (saved.events) setEvents(saved.events);
      }
    } catch { /* keep defaults */ }
    setHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(storageKey, JSON.stringify({ game, opponent, recordedPlayers, onCourt, opponentOnCourt, teamScore, opponentScore, quarter, clock, homeSeconds, opponentSeconds, homePlusMinus, opponentPlusMinus, events }));
  }, [clock, events, game, homePlusMinus, homeSeconds, hydrated, opponent, opponentOnCourt, opponentPlusMinus, opponentScore, opponentSeconds, onCourt, quarter, recordedPlayers, storageKey, teamScore]);

  useEffect(() => {
    if (!clockRunning) return;
    const timer = window.setInterval(() => {
      setClock((current) => {
        if (current <= 1) { setClockRunning(false); return 0; }
        return current - 1;
      });
      setHomeSeconds((current) => {
        const next = { ...current }; for (const id of onCourt) next[id] = (next[id] ?? 0) + 1; return next;
      });
      setOpponentSeconds((current) => {
        const next = { ...current }; for (const key of opponentOnCourt) next[key] = (next[key] ?? 0) + 1; return next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [clockRunning, onCourt, opponentOnCourt]);

  useEffect(() => {
    if (onCourt.length !== 5 && ownIds.length >= 5) setOnCourt((current) => Array.from(new Set([...current, ...ownIds])).slice(0, 5));
    if (opponentOnCourt.length !== 5) setOpponentOnCourt((current) => Array.from(new Set([...current, ...opponent.map((p) => p.key)])).slice(0, 5));
  }, [onCourt.length, opponentOnCourt.length, ownIds, opponent]);

  const selected = initialEntries.find((entry) => entry.player_id === selectedId);
  const selectedStats = selected ? game[selected.player_id] ?? blankLine() : blankLine();
  const selectedOpponent = opponent.find((player) => player.key === selectedOpponentKey) ?? opponent[0];
  const activeOpponent = opponentOnCourt.slice(0, 5);
  const gameLive = useMemo(() => Object.fromEntries(initialEntries.map((entry) => [entry.player_id, { ...(game[entry.player_id] ?? blankLine()), minutes_played: homeSeconds[entry.player_id] ?? 0 }])), [game, homeSeconds, initialEntries]) as GameState;
  const opponentLive = useMemo(() => opponent.map((player) => ({ ...player, stats: { ...player.stats, minutes_played: opponentSeconds[player.key] ?? 0 } })), [opponent, opponentSeconds]);
  const totals = useMemo(() => sumLines(Object.values(gameLive)), [gameLive]);
  const opponentTotals = useMemo(() => sumLines(opponentLive.map((p) => p.stats)), [opponentLive]);
  const clockText = `${String(Math.floor(clock / 60)).padStart(2, "0")}:${String(clock % 60).padStart(2, "0")}`;

  function pushHistory() {
    setHistory((current) => [...current.slice(-39), { game, opponent, recordedPlayers, onCourt, opponentOnCourt, teamScore, opponentScore, homeSeconds, opponentSeconds, homePlusMinus, opponentPlusMinus, events }]);
  }
  function applyPlusMinus(scoringSide: "home" | "opponent", delta: number) {
    if (!delta) return;
    setHomePlusMinus((current) => { const next = { ...current }; for (const id of onCourt) next[id] = (next[id] ?? 0) + (scoringSide === "home" ? delta : -delta); return next; });
    setOpponentPlusMinus((current) => { const next = { ...current }; for (const key of opponentOnCourt) next[key] = (next[key] ?? 0) + (scoringSide === "opponent" ? delta : -delta); return next; });
  }
  function selectedPlayerInfo() {
    if (selectedSide === "home") return selected ? { key: selected.player_id, name: displayName(selected) } : null;
    return selectedOpponent ? { key: selectedOpponent.key, name: `#${selectedOpponent.jersey} ${selectedOpponent.name}` } : null;
  }
  function addEvent(event: GameEvent) { setEvents((current) => [...current, event]); }
  function updatePlayer(mutator: (line: StatLine) => StatLine, scoreDelta = 0, event?: GameEvent) {
    const info = selectedPlayerInfo(); if (!info) return;
    pushHistory();
    if (selectedSide === "home") {
      setGame((current) => ({ ...current, [info.key]: mutator({ ...(current[info.key] ?? blankLine()) }) }));
      setRecordedPlayers((current) => ({ ...current, [info.key]: true }));
    } else setOpponent((current) => current.map((player) => player.key === info.key ? { ...player, stats: mutator({ ...player.stats }) } : player));
    if (scoreDelta) { if (selectedSide === "home") setTeamScore((s) => Math.max(0, s + scoreDelta)); else setOpponentScore((s) => Math.max(0, s + scoreDelta)); applyPlusMinus(selectedSide, scoreDelta); }
    if (event) addEvent(event);
  }
  function shotAction(type: ShotType, made: boolean, points: number) { setPendingShot({ type, made, points }); }
  function recordShot(x: number, y: number) {
    if (!pendingShot) return;
    const info = selectedPlayerInfo(); if (!info) return;
    const shot = pendingShot;
    const event: ShotEvent = { id: crypto.randomUUID(), quarter, clock, side: selectedSide, playerKey: info.key, playerName: info.name, type: shot.type, made: shot.made, points: shot.made ? shot.points : 0, x, y };
    updatePlayer((l) => {
      const next = { ...l, fg_attempts: l.fg_attempts + 1 };
      if (shot.type === "3PT") next.three_attempts += 1;
      if (shot.made) { next.fg_made += 1; next.points += shot.points; if (shot.type === "3PT") next.three_made += 1; }
      return next;
    }, shot.made ? shot.points : 0, event);
    setPendingShot(null);
  }
  function actionFor(label: string) {
    if (label === "+3") return shotAction("3PT", true, 3);
    if (label === "+2") return shotAction("2PT", true, 2);
    if (label === "MISS 3") return shotAction("3PT", false, 0);
    if (label === "MISS 2") return shotAction("2PT", false, 0);
    const info = selectedPlayerInfo(); if (!info) return;
    if (label === "+FT") return updatePlayer((l) => ({ ...l, points: l.points + 1, ft_made: l.ft_made + 1, ft_attempts: l.ft_attempts + 1 }), 1, { id: crypto.randomUUID(), quarter, clock, side: selectedSide, playerKey: info.key, playerName: info.name, type: "FT", made: true, points: 1 });
    if (label === "MISS FT") return updatePlayer((l) => ({ ...l, ft_attempts: l.ft_attempts + 1 }), 0, { id: crypto.randomUUID(), quarter, clock, side: selectedSide, playerKey: info.key, playerName: info.name, type: "FT", made: false, points: 0 });
    const statMap: Record<string, StatKey> = { ORB: "offensive_rebounds", DRB: "defensive_rebounds", AST: "assists", BLK: "blocks", STL: "steals", TO: "turnovers", FOUL: "fouls" };
    const key = statMap[label];
    if (key) return updatePlayer((l) => ({ ...l, [key]: l[key] + 1, ...(key === "offensive_rebounds" || key === "defensive_rebounds" ? { rebounds: l.rebounds + 1 } : {}) }), 0, { id: crypto.randomUUID(), quarter, clock, side: selectedSide, playerKey: info.key, playerName: info.name, type: key === "offensive_rebounds" ? "ORB" : key === "defensive_rebounds" ? "DRB" : key.toUpperCase() as GameEvent["type"] });
  }
  function substitute(side: "home" | "opponent", outId: string, inId: string) {
    if (outId === inId) return;
    pushHistory();
    const setter = side === "home" ? setOnCourt : setOpponentOnCourt;
    setter((current) => Array.from(new Set(current.map((id) => id === outId ? inId : id))).slice(0, 5));
    if (side === "home") setSelectedId(inId); else setSelectedOpponentKey(inId);
  }
  function undo() {
    const previous = history[history.length - 1]; if (!previous) return;
    setGame(previous.game); setOpponent(previous.opponent); setRecordedPlayers(previous.recordedPlayers); setOnCourt(previous.onCourt.slice(0, 5)); setOpponentOnCourt(previous.opponentOnCourt.slice(0, 5)); setTeamScore(previous.teamScore); setOpponentScore(previous.opponentScore); setHomeSeconds(previous.homeSeconds); setOpponentSeconds(previous.opponentSeconds); setHomePlusMinus(previous.homePlusMinus); setOpponentPlusMinus(previous.opponentPlusMinus); setEvents(previous.events); setHistory((current) => current.slice(0, -1));
  }
  function resetDraft() {
    if (!window.confirm("Reset the Game Day draft on this device? Saved database statistics will not be deleted.")) return;
    setGame(Object.fromEntries(initialEntries.map((entry) => [entry.player_id, blankLine()]))); setOpponent(opponentDefaults([])); setTeamScore(0); setOpponentScore(0); setQuarter(1); setClock(CLOCK_SECONDS); setClockRunning(false); setHistory([]); setEvents([]); setOnCourt(initialStarting); setOpponentOnCourt(opponentDefaults([]).slice(0, 5).map((p) => p.key)); setRecordedPlayers(Object.fromEntries(initialEntries.map((entry) => [entry.player_id, false]))); setHomeSeconds(Object.fromEntries(initialEntries.map((entry) => [entry.player_id, 0]))); setOpponentSeconds({}); setHomePlusMinus({}); setOpponentPlusMinus({}); window.localStorage.removeItem(storageKey);
  }
  function saveHomeValue(playerId: string, key: StatKey) { return key === "minutes_played" ? Math.round((homeSeconds[playerId] ?? 0) / 60) : game[playerId]?.[key] ?? 0; }
  function saveOpponentValue(player: OpponentPlayer, key: StatKey) { return key === "minutes_played" ? Math.round((opponentSeconds[player.key] ?? 0) / 60) : player.stats[key] ?? 0; }
  function downloadJpeg() {
    const rows = [...initialEntries.map((e) => [displayName(e), gameLive[e.player_id]?.points ?? 0]), ...opponentLive.map((p) => [`#${p.jersey} ${p.name}`, p.stats.points])];
    const canvas = document.createElement("canvas"); canvas.width = 1500; canvas.height = 180 + rows.length * 58; const ctx = canvas.getContext("2d"); if (!ctx) return;
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = "#720b16"; ctx.fillRect(0, 0, canvas.width, 88); ctx.fillStyle = "#ffffff"; ctx.font = "bold 36px Arial"; ctx.fillText(`${teamName} ${teamScore}  —  ${opponentScore} ${opponentName}`, 40, 56); ctx.fillStyle = "#111827"; ctx.font = "bold 22px Arial"; ctx.fillText("PLAYER", 40, 130); ctx.fillText("PTS", 1320, 130); rows.forEach(([name, points], i) => { const y = 174 + i * 58; ctx.font = "20px Arial"; ctx.fillText(String(name).slice(0, 55), 40, y); ctx.fillText(String(points), 1320, y); ctx.strokeStyle = "#e5e7eb"; ctx.beginPath(); ctx.moveTo(30, y + 16); ctx.lineTo(1470, y + 16); ctx.stroke(); }); const link = document.createElement("a"); link.download = `RRBA-${teamName}-vs-${opponentName}-stats.jpg`; link.href = canvas.toDataURL("image/jpeg", .95); link.click();
  }

  return (
    <>
      <div className="flex flex-col gap-4 print:hidden">
        <Card className="overflow-hidden border-0 bg-[#111827] text-white shadow-xl">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-4 sm:px-7">
            <ScoreTeam name={teamName} score={teamScore} stats={totals} align="left" />
            <div className="text-center"><div className="text-[11px] font-bold tracking-[0.25em] text-white/60">Q{quarter}</div><button type="button" onClick={() => setClockRunning((v) => !v)} className="mt-1 rounded-xl px-3 text-4xl font-black tabular-nums hover:bg-white/10 sm:text-5xl">{clockText}</button><div className="text-[10px] font-bold text-white/50">{clockRunning ? "CLOCK RUNNING" : "CLOCK PAUSED"}</div></div>
            <ScoreTeam name={opponentName} score={opponentScore} stats={opponentTotals} align="right" />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 border-t border-white/10 px-3 py-2">
            {QUARTERS.map((q) => <button key={q} type="button" onClick={() => { setQuarter(q); setClock(CLOCK_SECONDS); setClockRunning(false); }} className={`rounded-md px-3 py-1.5 text-xs font-bold ${quarter === q ? "bg-[#8b101b]" : "bg-white/10 hover:bg-white/15"}`}>Q{q}</button>)}
            <button type="button" onClick={() => setClockRunning((v) => !v)} className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-bold">{clockRunning ? <Pause className="mr-1 inline size-3" /> : <Play className="mr-1 inline size-3" />}{clockRunning ? "Pause" : "Start"}</button>
            <button type="button" onClick={() => setShowReport(true)} className="rounded-md bg-[#8b101b] px-3 py-1.5 text-xs font-bold"><Download className="mr-1 inline size-3" /> Download PDF</button>
            <button type="button" onClick={downloadJpeg} className="rounded-md bg-white/10 px-3 py-1.5 text-xs font-bold">JPEG</button>
          </div>
        </Card>

        <div className="grid gap-4 lg:grid-cols-[220px_minmax(420px,1fr)_220px]">
          <SideRoster title={teamName} players={onCourt.map((id) => initialEntries.find((e) => e.player_id === id)).filter(Boolean) as BoxScoreEntry[]} selectedId={selectedSide === "home" ? selectedId : ""} onSelect={(id) => { setSelectedSide("home"); setSelectedId(id); }} />
          <Card className="overflow-hidden border-[#263247] bg-[#101827] text-white">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3"><div><div className="text-xs font-bold tracking-widest text-white/50 uppercase">Live shot court</div><div className="text-sm text-white/70">Select a player, then choose a shot action. The next tap on the court records the exact location.</div></div><MapPin className="size-5 text-amber-400" /></div>
            <div className="p-3"><BasketballCourt onShotLocation={recordShot} disabled={!pendingShot} /><div className="mt-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-center text-xs text-white/60">{pendingShot ? `${pendingShot.made ? "Made" : "Missed"} ${pendingShot.type} — tap the court where the shot happened` : selectedPlayerInfo() ? `Selected: ${selectedPlayerInfo()?.name}` : "Select a player from either roster"}</div></div>
          </Card>
          <SideRoster title={opponentName} players={activeOpponent.map((id) => opponent.find((p) => p.key === id)).filter(Boolean) as OpponentPlayer[]} selectedId={selectedSide === "opponent" ? selectedOpponentKey : ""} opponent onSelect={(id) => { setSelectedSide("opponent"); setSelectedOpponentKey(id); }} />
        </div>

        <Card className="border-0 bg-[#172033] p-3 text-white shadow-lg">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><div className="text-xs font-bold tracking-widest text-white/45 uppercase">Selected player</div><h2 className="text-lg font-black">{selectedPlayerInfo()?.name ?? "Choose a player"}</h2></div><div className="rounded-lg bg-white/5 px-4 py-2 text-right"><div className="text-2xl font-black tabular-nums">{selectedSide === "home" ? selectedStats.points : selectedOpponent?.stats.points ?? 0}</div><div className="text-[10px] text-white/50">POINTS</div></div></div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-8">
            {(["+3", "+2", "+FT", "MISS 3", "MISS 2", "MISS FT", "ORB", "DRB", "AST", "STL", "BLK", "TO", "FOUL"] as const).map((label) => <ActionButton key={label} label={label} onClick={() => actionFor(label)} />)}
            <button type="button" onClick={undo} disabled={!history.length} className="min-h-16 rounded-lg border border-white/10 bg-white/5 text-sm font-bold disabled:opacity-30"><Undo2 className="mx-auto mb-1 size-4" />Undo</button>
          </div>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <RosterSwapPanel title={`${teamName} — exactly 5 on court`} onCourt={onCourt.map((id) => { const e = initialEntries.find((x) => x.player_id === id); return { id, label: e ? displayName(e) : id }; })} fullList={initialEntries.map((e) => ({ id: e.player_id, label: displayName(e) }))} onSub={(a, b) => substitute("home", a, b)} />
          <RosterSwapPanel title={`${opponentName} — exactly 5 on court`} onCourt={activeOpponent.map((id) => { const p = opponent.find((x) => x.key === id); return { id, label: p ? `#${p.jersey} ${p.name}` : id }; })} fullList={opponent.map((p) => ({ id: p.key, label: `#${p.jersey} ${p.name}` }))} onSub={(a, b) => substitute("opponent", a, b)} />
        </div>

        <Card className="p-3"><div className="flex items-center justify-between"><div><h3 className="font-semibold">Opponent roster</h3><p className="text-xs text-[var(--foreground-muted)]">Names and jersey numbers used in the live console and final report.</p></div><UserPlus className="size-5" /></div><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{opponent.map((player) => <div key={player.key} className="grid grid-cols-[60px_1fr] gap-2"><input aria-label="Jersey number" value={player.jersey} onChange={(e) => setOpponent((current) => current.map((p) => p.key === player.key ? { ...p, jersey: Number(e.target.value) || 0 } : p))} className="rounded-lg border border-[var(--border-color)] bg-transparent px-2 py-2 text-sm" /><input aria-label="Opponent player name" value={player.name} onChange={(e) => setOpponent((current) => current.map((p) => p.key === player.key ? { ...p, name: e.target.value } : p))} className="rounded-lg border border-[var(--border-color)] bg-transparent px-2 py-2 text-sm" /></div>)}</div></Card>

        <div className="grid gap-3 lg:grid-cols-3">
          <Card className="p-4"><div className="flex items-center justify-between"><div><h3 className="font-semibold">Save RRBA stats</h3><p className="text-xs text-[var(--foreground-muted)]">Save touched players to the match.</p></div><Save className="size-5" /></div><form action={saveAction} className="mt-3"><input type="hidden" name="eventId" value={eventId} />{initialEntries.filter((e) => recordedPlayers[e.player_id]).map((e) => <div key={e.player_id}><input type="hidden" name="playerId" value={e.player_id} />{STAT_COLUMNS.map((c) => <input key={c.key} type="hidden" name={statFieldName(e.player_id, c.key)} value={saveHomeValue(e.player_id, c.key)} />)}</div>)}<Button type="submit" loading={savePending} className="w-full">Save RRBA stats</Button></form></Card>
          <Card className="p-4"><div className="flex items-center justify-between"><div><h3 className="font-semibold">Save opponent stats</h3><p className="text-xs text-[var(--foreground-muted)]">Save the opponent roster and box score.</p></div><Save className="size-5" /></div><form action={opponentSaveAction} className="mt-3"><input type="hidden" name="eventId" value={eventId} />{opponent.map((player) => <div key={player.key}><input type="hidden" name="opponentPlayerKey" value={player.key} /><input type="hidden" name={`opponentName_${player.key}`} value={player.name} /><input type="hidden" name={`opponentJersey_${player.key}`} value={player.jersey} />{STAT_COLUMNS.map((c) => <input key={c.key} type="hidden" name={`opponent_${player.key}_${c.key}`} value={saveOpponentValue(player, c.key)} />)}</div>)}<Button type="submit" loading={opponentSavePending} className="w-full">Save opponent stats</Button></form></Card>
          <Card className="border-[var(--primary)]/30 p-4"><div className="flex items-center justify-between"><div><h3 className="font-semibold">Finalize game</h3><p className="text-xs text-[var(--foreground-muted)]">Publish the final score after recording is complete.</p></div><Trophy className="size-5" /></div><form action={resultAction} className="mt-3 flex flex-col gap-3"><input type="hidden" name="eventId" value={eventId} /><div className="grid grid-cols-2 gap-2"><ScoreInput label={teamName} value={teamScore} onChange={setTeamScore} /><ScoreInput label={opponentName} value={opponentScore} onChange={setOpponentScore} /></div><Button type="submit" loading={resultPending}>Finalize game</Button></form></Card>
        </div>
        {saveState.message ? <Alert tone={saveState.ok ? "success" : "danger"}>{saveState.message}</Alert> : null}{opponentSaveState.message ? <Alert tone={opponentSaveState.ok ? "success" : "danger"}>{opponentSaveState.message}</Alert> : null}{resultState.message ? <Alert tone={resultState.ok ? "success" : "danger"}>{resultState.message}</Alert> : null}

        <Card className="overflow-hidden"><div className="flex items-center justify-between border-b border-[var(--border-color)] px-4 py-3"><div><h3 className="font-semibold">Live event log</h3><p className="text-xs text-[var(--foreground-muted)]">Every shot location and recorded action is retained for the report.</p></div><BarChart3 className="size-4" /></div><div className="max-h-80 overflow-auto">{events.length ? [...events].reverse().map((event) => <div key={event.id} className="grid grid-cols-[55px_1fr_auto] gap-3 border-b border-[var(--border-color)] px-4 py-2 text-sm"><span className="font-mono text-xs text-[var(--foreground-muted)]">Q{event.quarter} {formatClock(event.clock)}</span><span><strong>{event.playerName}</strong> · {event.type}{"x" in event ? ` · ${event.made ? "MADE" : "MISSED"} ${event.type} at ${Math.round(event.x)}%, ${Math.round(event.y)}%` : event.made === false ? " · MISSED" : ""}</span><span className="font-semibold tabular-nums">{event.points ? `+${event.points}` : ""}</span></div>) : <div className="px-4 py-8 text-center text-sm text-[var(--foreground-muted)]">No events recorded yet.</div>}</div></Card>

        <Card className="overflow-hidden"><div className="flex items-center justify-between border-b border-[var(--border-color)] px-4 py-3"><div><h3 className="font-semibold">Full live box score</h3><p className="text-xs text-[var(--foreground-muted)]">Full roster, including substituted players, ready for the final report.</p></div><BarChart3 className="size-4" /></div><BoxTable title={teamName} entries={initialEntries.map((e) => ({ name: displayName(e), stats: gameLive[e.player_id] ?? blankLine(), plusMinus: homePlusMinus[e.player_id] }))} total={totals} teamPossessions={estimatedPossessions(totals)} /><BoxTable title={opponentName} entries={opponentLive.map((p) => ({ name: `#${p.jersey} ${p.name}`, stats: p.stats, plusMinus: opponentPlusMinus[p.key] }))} total={opponentTotals} teamPossessions={estimatedPossessions(opponentTotals)} /></Card>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><FooterButton label="Reset" onClick={resetDraft} /><FooterButton label="Undo" onClick={undo} disabled={!history.length} /><FooterButton label="PDF report" onClick={() => setShowReport(true)} /><FooterButton label="JPEG" onClick={downloadJpeg} /></div>
      </div>

      {pendingShot ? <ShotLocationModal teamName={selectedSide === "home" ? teamName : opponentName} playerName={selectedPlayerInfo()?.name ?? "Player"} shot={pendingShot} onClose={() => setPendingShot(null)} onPick={recordShot} /> : null}
      {showReport ? <GameDayReport teamName={teamName} opponentName={opponentName} scoreA={teamScore} scoreB={opponentScore} quarter={quarter} teamEntries={initialEntries.map((e) => ({ name: displayName(e), stats: gameLive[e.player_id] ?? blankLine(), plusMinus: homePlusMinus[e.player_id] }))} opponentEntries={opponentLive.map((p) => ({ name: `#${p.jersey} ${p.name}`, stats: p.stats, plusMinus: opponentPlusMinus[p.key] }))} teamTotals={totals} opponentTotals={opponentTotals} events={events} onClose={() => setShowReport(false)} /> : null}
    </>
  );
}

function sumLines(lines: StatLine[]) { const total = blankLine(); for (const line of lines) for (const column of STAT_COLUMNS) total[column.key] += line[column.key] ?? 0; return total; }
function formatClock(seconds: number) { return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`; }
function ScoreTeam({ name, score, stats, align }: { name: string; score: number; stats?: StatLine; align: "left" | "right" }) { return <div className={align === "right" ? "text-right" : "text-left"}><div className="truncate text-sm font-bold sm:text-base">{name}</div><div className="text-5xl font-black tabular-nums sm:text-6xl">{score}</div>{stats ? <div className="mt-1 flex flex-wrap gap-x-3 text-[10px] text-white/55"><span>REB {stats.rebounds}</span><span>AST {stats.assists}</span><span>TO {stats.turnovers}</span><span>PF {stats.fouls}</span></div> : null}</div>; }
function ActionButton({ label, onClick }: { label: string; onClick: () => void }) { const shot = label.includes("3") || label.includes("2"); return <button type="button" onClick={onClick} className={`min-h-16 rounded-lg px-2 text-sm font-black transition hover:brightness-110 ${label.startsWith("MISS") ? "bg-red-600" : label.startsWith("+") ? "bg-[#8b101b]" : "bg-slate-700"}`}>{shot ? <MapPin className="mx-auto mb-1 size-4" /> : null}{label}</button>; }
function FooterButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) { return <button type="button" onClick={onClick} disabled={disabled} className="min-h-12 rounded-xl border border-[var(--border-color)] bg-[var(--surface)] text-sm font-semibold hover:bg-[var(--surface-muted)] disabled:opacity-40">{label}</button>; }
function ScoreInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) { return <label className="rounded-lg border border-[var(--border-color)] p-2"><span className="block text-xs text-[var(--foreground-muted)]">{label}</span><input type="number" min={0} max={500} value={value} onChange={(e) => onChange(Number(e.target.value) || 0)} className="mt-1 w-full bg-transparent text-2xl font-semibold outline-none" /></label>; }

function SideRoster({ title, players, selectedId, onSelect, opponent }: { title: string; players: (BoxScoreEntry | OpponentPlayer)[]; selectedId: string; onSelect: (id: string) => void; opponent?: boolean }) {
  return <Card className="border-[#263247] bg-[#111a2a] p-2 text-white"><div className="border-b border-white/10 px-2 py-2"><div className="text-sm font-black">{title}</div><div className="text-[10px] font-bold tracking-widest text-emerald-400">ON COURT • 5 / 5</div></div><div className="space-y-2 p-1">{players.map((player) => { const id = opponent ? (player as OpponentPlayer).key : (player as BoxScoreEntry).player_id; const name = opponent ? `#${(player as OpponentPlayer).jersey} ${(player as OpponentPlayer).name}` : displayName(player as BoxScoreEntry); const stats = opponent ? (player as OpponentPlayer).stats : blankLine(); return <button key={id} type="button" onClick={() => onSelect(id)} className={`w-full rounded-lg border p-2 text-left ${selectedId === id ? "border-amber-400 bg-amber-400/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"}`}><div className="truncate text-xs font-bold">{name}</div><div className="mt-1 flex justify-between text-[10px] text-white/50"><span>PTS <b className="text-white">{stats.points}</b></span><span>{formatDuration(opponent ? (player as OpponentPlayer).stats.minutes_played : 0)}</span></div></button>; })}</div></Card>;
}

function BasketballCourt({ onShotLocation, disabled }: { onShotLocation: (x: number, y: number) => void; disabled: boolean }) {
  function click(e: React.MouseEvent<SVGSVGElement>) { if (disabled) return; const rect = e.currentTarget.getBoundingClientRect(); onShotLocation(Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)), Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100))); }
  return <div className={`rounded-xl border border-white/10 bg-[#121c2c] p-2 ${disabled ? "opacity-80" : "cursor-crosshair"}`}><svg viewBox="0 0 100 56" className="h-auto w-full" onClick={click} role="img" aria-label="Basketball shot location court"><rect x="1" y="1" width="98" height="54" rx="3" fill="#142033" stroke="#5d687b" strokeWidth=".7"/><line x1="50" y1="1" x2="50" y2="55" stroke="#465165" strokeWidth=".6"/><circle cx="50" cy="28" r="7" fill="none" stroke="#465165" strokeWidth=".6"/><rect x="1" y="16" width="18" height="24" fill="none" stroke="#465165" strokeWidth=".6"/><rect x="81" y="16" width="18" height="24" fill="none" stroke="#465165" strokeWidth=".6"/><path d="M1 9 A20 20 0 0 1 25 28 A20 20 0 0 1 1 47" fill="none" stroke="#465165" strokeWidth=".6"/><path d="M99 9 A20 20 0 0 0 75 28 A20 20 0 0 0 99 47" fill="none" stroke="#465165" strokeWidth=".6"/><circle cx="8" cy="28" r="1.2" fill="none" stroke="#f59e0b" strokeWidth=".6"/><circle cx="92" cy="28" r="1.2" fill="none" stroke="#f59e0b" strokeWidth=".6"/><line x1="0" y1="12" x2="0" y2="44" stroke="#f59e0b" strokeWidth="1"/>
    {!disabled ? <text x="50" y="52" textAnchor="middle" fill="#94a3b8" fontSize="2.5">TAP SHOT LOCATION</text> : <text x="50" y="52" textAnchor="middle" fill="#64748b" fontSize="2.5">SELECT +2 / +3 / MISS 2 / MISS 3 FIRST</text>}
  </svg></div>;
}

function ShotLocationModal({ teamName, playerName, shot, onClose, onPick }: { teamName: string; playerName: string; shot: { type: ShotType; made: boolean; points: number }; onClose: () => void; onPick: (x: number, y: number) => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm"><div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-[#0d1625] p-4 text-white shadow-2xl"><div className="mb-3 flex items-start justify-between"><div><div className="text-xs font-bold tracking-widest text-amber-400 uppercase">Shot location</div><h2 className="text-xl font-black">{playerName}</h2><p className="text-sm text-white/55">{teamName} · {shot.made ? "Made" : "Missed"} {shot.type}</p></div><button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-white/10"><X /></button></div><BasketballCourt onShotLocation={onPick} disabled={false} /><p className="mt-3 text-center text-xs text-white/55">Tap the exact place on the court where the attempt was taken. The point is saved with the player, quarter and game clock.</p><button type="button" onClick={onClose} className="mt-3 w-full rounded-lg border border-white/10 py-2 text-sm font-bold">Cancel</button></div></div>;
}

function RosterSwapPanel({ title, onCourt, fullList, onSub }: { title: string; onCourt: { id: string; label: string }[]; fullList: { id: string; label: string }[]; onSub: (outId: string, inId: string) => void }) {
  const [outId, setOutId] = useState<string | null>(null);
  return <Card className="p-3"><div className="flex items-center justify-between"><div><h3 className="font-semibold">{title}</h3><p className="text-[11px] text-[var(--foreground-muted)]">There can never be more than 5 active players.</p></div><ArrowLeftRight className="size-4" /></div><div className="mt-3 grid grid-cols-5 gap-1">{onCourt.map((p) => <button key={p.id} type="button" onClick={() => setOutId(outId === p.id ? null : p.id)} className={`min-w-0 rounded-lg border px-1 py-2 text-[10px] font-bold ${outId === p.id ? "border-[var(--primary)] bg-[var(--primary)]/10" : "border-[var(--border-color)]"}`}><span className="block truncate">{p.label}</span></button>)}</div><div className="mt-3 grid max-h-44 grid-cols-2 gap-1 overflow-auto sm:grid-cols-3">{fullList.map((p) => { const active = onCourt.some((c) => c.id === p.id); return <button key={p.id} type="button" disabled={active || !outId} onClick={() => { if (outId) { onSub(outId, p.id); setOutId(null); } }} className="rounded-lg border border-[var(--border-color)] px-2 py-2 text-left text-[10px] font-semibold disabled:cursor-not-allowed disabled:opacity-35">{p.label}{active ? " • ON" : ""}</button>; })}</div></Card>;
}

function BoxTable({ title, entries, total, teamPossessions }: { title: string; entries: { playerKey: string; name: string; stats: StatLine; plusMinus?: number }[]; total: StatLine; teamPossessions: number }) {
  return <div className="overflow-x-auto border-b border-[var(--border-color)] last:border-0"><div className="px-4 py-2 text-sm font-semibold">{title}</div><table className="w-full min-w-[1050px] text-xs"><thead className="bg-[var(--surface-muted)] text-[10px] uppercase text-[var(--foreground-muted)]"><tr>{["Player", "MIN", "PTS", "REB", "ORB", "DRB", "AST", "STL", "BLK", "TO", "PF", "FG", "3PT", "FT", "TS%", "USG%", "EFF", "+/-"].map((h) => <th key={h} className="px-2 py-2 text-center first:text-left">{h}</th>)}</tr></thead><tbody className="divide-y divide-[var(--border-color)]">{entries.map((entry, index) => { const ts = trueShootingPercentage(entry.stats.points, entry.stats.fg_attempts, entry.stats.ft_attempts); const usg = usageRate(entry.stats, teamPossessions); const eff = efficiencyRating(entry.stats); const pm = entry.plusMinus; return <tr key={`${entry.name}-${index}`}><th className="px-3 py-2 text-left font-medium">{entry.name}</th><td className="px-2 text-center">{formatDuration(entry.stats.minutes_played)}</td><td className="px-2 text-center">{entry.stats.points}</td><td className="px-2 text-center">{entry.stats.rebounds}</td><td className="px-2 text-center">{entry.stats.offensive_rebounds}</td><td className="px-2 text-center">{entry.stats.defensive_rebounds}</td><td className="px-2 text-center">{entry.stats.assists}</td><td className="px-2 text-center">{entry.stats.steals}</td><td className="px-2 text-center">{entry.stats.blocks}</td><td className="px-2 text-center">{entry.stats.turnovers}</td><td className="px-2 text-center">{entry.stats.fouls}</td><td className="px-2 text-center">{entry.stats.fg_made}/{entry.stats.fg_attempts}</td><td className="px-2 text-center">{entry.stats.three_made}/{entry.stats.three_attempts}</td><td className="px-2 text-center">{entry.stats.ft_made}/{entry.stats.ft_attempts}</td><td className="px-2 text-center">{formatPercentage(ts)}</td><td className="px-2 text-center">{usg == null ? "—" : `${Math.round(usg)}%`}</td><td className="px-2 text-center">{eff}</td><td className="px-2 text-center">{pm == null ? "—" : pm > 0 ? `+${pm}` : pm}</td></tr>; })}</tbody><tfoot className="border-t-2 border-[var(--border-color)] font-bold"><tr><th className="px-3 py-2 text-left">Total · POSS ~{Math.round(teamPossessions)}</th><td></td>{[total.points,total.rebounds,total.offensive_rebounds,total.defensive_rebounds,total.assists,total.steals,total.blocks,total.turnovers,total.fouls,`${total.fg_made}/${total.fg_attempts}`,`${total.three_made}/${total.three_attempts}`,`${total.ft_made}/${total.ft_attempts}`,formatPercentage(trueShootingPercentage(total.points,total.fg_attempts,total.ft_attempts)),"—","—","—"].map((v,i)=><td key={i} className="px-2 py-2 text-center">{v}</td>)}</tr></tfoot></table></div>;
}
