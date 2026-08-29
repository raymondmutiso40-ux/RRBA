"use client";

import { useMemo } from "react";
import { X, Printer } from "lucide-react";
import { STAT_COLUMNS, efficiencyRating, estimatedPossessions, formatDuration, formatPercentage, trueShootingPercentage, usageRate, type StatKey } from "@/lib/matches/labels";

type StatLine = Record<StatKey, number>;
type ReportEntry = { playerKey: string; name: string; stats: StatLine; plusMinus?: number };
type ReportEvent = { id: string; quarter: number; clock: number; side: "home" | "opponent"; playerKey: string; playerName: string; type: string; made?: boolean; points?: number; x?: number; y?: number };

type Props = {
  teamName: string;
  opponentName: string;
  scoreA: number;
  scoreB: number;
  quarter: number;
  teamEntries: ReportEntry[];
  opponentEntries: ReportEntry[];
  teamTotals: StatLine;
  opponentTotals: StatLine;
  events: ReportEvent[];
  onClose: () => void;
};

export function GameDayReport({ teamName, opponentName, scoreA, scoreB, teamEntries, opponentEntries, teamTotals, opponentTotals, events, onClose }: Props) {
  const shotEvents = events.filter((e) => e.x != null && e.y != null);
  const quarterScores = useMemo(() => {
    const a = [0, 0, 0, 0]; const b = [0, 0, 0, 0];
    for (const e of events) {
      if (e.points) {
        const arr = e.side === "home" ? a : b;
        const idx = Math.max(0, Math.min(3, e.quarter - 1));
        arr[idx] = (arr[idx] ?? 0) + e.points;
      }
    }
    return { a, b };
  }, [events]);
  const leaders = useMemo(() => ({
    aPts: best(teamEntries, (e) => e.stats.points), aAst: best(teamEntries, (e) => e.stats.assists), aReb: best(teamEntries, (e) => e.stats.rebounds), aEff: best(teamEntries, (e) => efficiencyRating(e.stats)),
    bPts: best(opponentEntries, (e) => e.stats.points), bAst: best(opponentEntries, (e) => e.stats.assists), bReb: best(opponentEntries, (e) => e.stats.rebounds), bEff: best(opponentEntries, (e) => efficiencyRating(e.stats)),
  }), [teamEntries, opponentEntries]);
  const largestLead = useMemo(() => {
    let a = 0; let b = 0; let sa = 0; let sb = 0;
    for (const e of events) { if (e.points) { if (e.side === "home") sa += e.points; else sb += e.points; const margin = sa - sb; a = Math.max(a, margin); b = Math.max(b, -margin); } }
    return { largest: Math.max(a, b), side: a >= b ? teamName : opponentName };
  }, [events, teamName, opponentName]);
  const print = () => window.print();
  return <div className="rrba-report-modal fixed inset-0 z-[60] overflow-auto bg-black/80 p-2 sm:p-6">
    <div className="mx-auto mb-4 flex max-w-[1200px] justify-end gap-2 print:hidden"><button type="button" onClick={print} className="rounded-lg bg-[#8b101b] px-4 py-2 text-sm font-bold text-white"><Printer className="mr-2 inline size-4" />Save / Print PDF</button><button type="button" onClick={onClose} className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-black"><X className="mr-2 inline size-4" />Close</button></div>
    <div className="rrba-report mx-auto max-w-[1200px] bg-white text-slate-900 shadow-2xl">
      <ReportPage><ReportHeader page="1" /><div className="report-cover"><div className="report-brand">🏀 BASKET STATS</div><div className="report-sub">TRACK. ANALYZE. IMPROVE.</div><div className="report-score"><div><span>{teamName}</span><strong>{scoreA}</strong></div><div className="report-vs">FINAL</div><div><span>{opponentName}</span><strong>{scoreB}</strong></div></div><div className="report-date">GAME DAY PERFORMANCE REPORT</div></div><SummaryCards teamName={teamName} opponentName={opponentName} scoreA={scoreA} scoreB={scoreB} teamTotals={teamTotals} opponentTotals={opponentTotals} quarterScores={quarterScores} leaders={leaders} largestLead={largestLead} /></ReportPage>
      <ReportPage><ReportHeader page="2" /><SectionTitle title="POINTS & POSSESSIONS" /><div className="report-summary-grid"><MiniTable title="POINTS" headers={["", "Q1", "Q2", "Q3", "Q4", "TOTAL"]} rows={[[teamName,...quarterScores.a,scoreA],[opponentName,...quarterScores.b,scoreB]]} /><MiniTable title="POSSESSIONS" headers={["", "Q1", "Q2", "Q3", "Q4", "TOTAL"]} rows={[[teamName,"—","—","—","—",Math.round(estimatedPossessions(teamTotals))],[opponentName,"—","—","—","—",Math.round(estimatedPossessions(opponentTotals))]]} /></div><LeaderTable teamName={teamName} opponentName={opponentName} leaders={leaders} /></ReportPage>
      <ReportPage><ReportHeader page="3" teamName={teamName} /><SectionTitle title={teamName.toUpperCase()} /><BoxScorePrint entries={teamEntries} total={teamTotals} /></ReportPage>
      <ReportPage><ReportHeader page="4" teamName={opponentName} /><SectionTitle title={opponentName.toUpperCase()} /><BoxScorePrint entries={opponentEntries} total={opponentTotals} /></ReportPage>
      <ReportPage><ReportHeader page="5" /><SectionTitle title="LINEUPS & PLAYING TIME" /><LineupTable teamName={teamName} entries={teamEntries} /><LineupTable teamName={opponentName} entries={opponentEntries} /></ReportPage>
      <ReportPage><ReportHeader page="6" /><SectionTitle title="SHOT CHART — MAKES & MISSES" /><ShotChart shotEvents={shotEvents} teamName={teamName} opponentName={opponentName} /><ShotLegend /></ReportPage>
      <ReportPage><ReportHeader page="7" /><SectionTitle title="SHOT BREAKDOWN BY PLAYER" /><ShotPlayerTable entries={teamEntries} events={shotEvents.filter((e) => e.side === "home")} /><ShotPlayerTable entries={opponentEntries} events={shotEvents.filter((e) => e.side === "opponent")} /></ReportPage>
      <ReportPage><ReportHeader page="8" /><SectionTitle title="PLAY-BY-PLAY EVENT LOG" /><EventTable events={events} /></ReportPage>
      <ReportPage><ReportHeader page="9" /><SectionTitle title="ADVANCED PLAYER METRICS" /><AdvancedTable entries={teamEntries} /><AdvancedTable entries={opponentEntries} /></ReportPage>
      <ReportPage><ReportHeader page="10" /><SectionTitle title="GAME SUMMARY" /><div className="summary-final"><div className="big-score">{teamName} {scoreA} — {scoreB} {opponentName}</div><div className="summary-pairs"><div><b>Largest lead</b><span>{largestLead.largest} ({largestLead.side})</span></div><div><b>Final margin</b><span>{Math.abs(scoreA-scoreB)} ({scoreA >= scoreB ? teamName : opponentName})</span></div><div><b>Recorded events</b><span>{events.length}</span></div><div><b>Shot attempts charted</b><span>{shotEvents.length}</span></div></div></div><div className="report-note">This report is generated directly from the Game Day console. Shot markers contain the recorded court coordinates for each 2-point and 3-point attempt, while the box scores retain the complete roster and playing-time information.</div></ReportPage>
    </div>
  </div>;
}

function best(entries: ReportEntry[], getter: (e: ReportEntry) => number) {
  if (entries.length === 0) return null;
  let bestEntry = entries[0] as ReportEntry;
  for (const e of entries) if (getter(e) > getter(bestEntry)) bestEntry = e;
  return bestEntry;
}
function ReportPage({ children }: { children: React.ReactNode }) { return <section className="rrba-report-page">{children}</section>; }
function ReportHeader({ page, teamName }: { page: string; teamName?: string }) { return <div className="report-header"><div><div className="report-logo">🏀 <b>BASKET STATS</b></div><small>TRACK. ANALYZE. IMPROVE.</small></div><div className="report-header-title">{teamName ?? "GAME REPORT"}</div><b>Page {page} of 10</b></div>; }
function SectionTitle({ title }: { title: string }) { return <div className="report-section-title">{title}</div>; }
function SummaryCards({ teamName, opponentName, scoreA, scoreB, teamTotals, opponentTotals, quarterScores, leaders, largestLead }: any) { return <div className="report-summary"><div className="report-summary-title">GAME SUMMARY</div><div className="summary-score-row"><b>{teamName}</b><strong>{scoreA}</strong><span>—</span><strong>{scoreB}</strong><b>{opponentName}</b></div><div className="report-summary-grid"><MiniTable title="POINTS" headers={["", "Q1", "Q2", "Q3", "Q4", "TOTAL"]} rows={[[teamName,...quarterScores.a,scoreA],[opponentName,...quarterScores.b,scoreB]]} /><MiniTable title="TEAM TOTALS" headers={["", "PTS", "REB", "AST", "TO", "FG%", "3P%", "FT%"]} rows={[[teamName,teamTotals.points,teamTotals.rebounds,teamTotals.assists,teamTotals.turnovers,pct(teamTotals.fg_made,teamTotals.fg_attempts),pct(teamTotals.three_made,teamTotals.three_attempts),pct(teamTotals.ft_made,teamTotals.ft_attempts)],[opponentName,opponentTotals.points,opponentTotals.rebounds,opponentTotals.assists,opponentTotals.turnovers,pct(opponentTotals.fg_made,opponentTotals.fg_attempts),pct(opponentTotals.three_made,opponentTotals.three_attempts),pct(opponentTotals.ft_made,opponentTotals.ft_attempts)]]} /></div><LeaderTable teamName={teamName} opponentName={opponentName} leaders={leaders} /><div className="lead-box"><b>LARGEST LEAD</b><span>{largestLead.largest} ({largestLead.side})</span><b>FINAL MARGIN</b><span>{Math.abs(scoreA-scoreB)}</span></div></div>; }
function MiniTable({ title, headers, rows }: { title: string; headers: string[]; rows: (string|number)[][] }) { return <div className="report-card"><h4>{title}</h4><table><thead><tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((row,i)=><tr key={i}>{row.map((v,j)=><td key={j}>{v}</td>)}</tr>)}</tbody></table></div>; }
function LeaderTable({ teamName, opponentName, leaders }: any) { return <table className="leader-table"><thead><tr><th>{teamName}</th><th>TEAM LEADERS</th><th>{opponentName}</th></tr></thead><tbody><tr><td>{labelLeader(leaders.aPts)}</td><td>Points</td><td>{labelLeader(leaders.bPts)}</td></tr><tr><td>{labelLeader(leaders.aAst)}</td><td>Assists</td><td>{labelLeader(leaders.bAst)}</td></tr><tr><td>{labelLeader(leaders.aReb)}</td><td>Rebounds</td><td>{labelLeader(leaders.bReb)}</td></tr><tr><td>{labelLeader(leaders.aEff)}</td><td>Efficiency</td><td>{labelLeader(leaders.bEff)}</td></tr></tbody></table>; }
function labelLeader(e: ReportEntry | null) { return e ? `${e.name} (${e.stats.points || efficiencyRating(e.stats)})` : "—"; }
function BoxScorePrint({ entries, total }: { entries: ReportEntry[]; total: StatLine }) { const cols = ["PLAYER","MIN","PTS","FGM","FGA","FG%","3PM","3PA","3P%","FTM","FTA","FT%","OREB","DREB","REB","AST","TO","STL","BLK","PF","+/-"]; return <table className="box-score"><thead><tr>{cols.map((c)=><th key={c}>{c}</th>)}</tr></thead><tbody>{entries.map((e, index) => <tr key={`${e.playerKey}-${index}`}><td>{e.name}</td><td>{formatDuration(e.stats.minutes_played)}</td><td>{e.stats.points}</td><td>{e.stats.fg_made}</td><td>{e.stats.fg_attempts}</td><td>{pct(e.stats.fg_made,e.stats.fg_attempts)}</td><td>{e.stats.three_made}</td><td>{e.stats.three_attempts}</td><td>{pct(e.stats.three_made,e.stats.three_attempts)}</td><td>{e.stats.ft_made}</td><td>{e.stats.ft_attempts}</td><td>{pct(e.stats.ft_made,e.stats.ft_attempts)}</td><td>{e.stats.offensive_rebounds}</td><td>{e.stats.defensive_rebounds}</td><td>{e.stats.rebounds}</td><td>{e.stats.assists}</td><td>{e.stats.turnovers}</td><td>{e.stats.steals}</td><td>{e.stats.blocks}</td><td>{e.stats.fouls}</td><td>{e.plusMinus == null ? "—" : e.plusMinus > 0 ? `+${e.plusMinus}` : e.plusMinus}</td></tr>)}</tbody><tfoot><tr><th>Total</th><td>—</td><td>{total.points}</td><td>{total.fg_made}</td><td>{total.fg_attempts}</td><td>{pct(total.fg_made,total.fg_attempts)}</td><td>{total.three_made}</td><td>{total.three_attempts}</td><td>{pct(total.three_made,total.three_attempts)}</td><td>{total.ft_made}</td><td>{total.ft_attempts}</td><td>{pct(total.ft_made,total.ft_attempts)}</td><td>{total.offensive_rebounds}</td><td>{total.defensive_rebounds}</td><td>{total.rebounds}</td><td>{total.assists}</td><td>{total.turnovers}</td><td>{total.steals}</td><td>{total.blocks}</td><td>{total.fouls}</td><td>—</td></tr></tfoot></table>; }
function LineupTable({ teamName, entries }: { teamName: string; entries: ReportEntry[] }) { return <div className="lineup-block"><h3>{teamName}</h3><table><thead><tr><th>PLAYER</th><th>MIN</th><th>PTS</th><th>+/-</th><th>FG</th><th>3PT</th><th>FT</th><th>REB</th><th>AST</th><th>STL</th><th>BLK</th><th>TO</th><th>PF</th></tr></thead><tbody>{entries.map((e, index) => <tr key={`${e.playerKey}-${index}`}><td>{e.name}</td><td>{formatDuration(e.stats.minutes_played)}</td><td>{e.stats.points}</td><td>{e.plusMinus == null ? "—" : e.plusMinus > 0 ? `+${e.plusMinus}` : e.plusMinus}</td><td>{e.stats.fg_made}/{e.stats.fg_attempts}</td><td>{e.stats.three_made}/{e.stats.three_attempts}</td><td>{e.stats.ft_made}/{e.stats.ft_attempts}</td><td>{e.stats.rebounds}</td><td>{e.stats.assists}</td><td>{e.stats.steals}</td><td>{e.stats.blocks}</td><td>{e.stats.turnovers}</td><td>{e.stats.fouls}</td></tr>)}</tbody></table><div className="starting-five"><b>STARTING 5</b><span>{entries.slice(0,5).map((e)=>e.name).join(" • ") || "—"}</span></div></div>; }
function ShotChart({ shotEvents, teamName, opponentName }: { shotEvents: ReportEvent[]; teamName: string; opponentName: string }) { return <div className="shot-chart-wrap"><svg viewBox="0 0 100 56" className="shot-chart"><rect x="1" y="1" width="98" height="54" rx="3" fill="#f8fafc" stroke="#7b0e18" strokeWidth=".7"/><line x1="50" y1="1" x2="50" y2="55" stroke="#cbd5e1" strokeWidth=".5"/><circle cx="50" cy="28" r="7" fill="none" stroke="#cbd5e1"/><rect x="1" y="16" width="18" height="24" fill="none" stroke="#cbd5e1"/><rect x="81" y="16" width="18" height="24" fill="none" stroke="#cbd5e1"/><path d="M1 9 A20 20 0 0 1 25 28 A20 20 0 0 1 1 47" fill="none" stroke="#cbd5e1"/><path d="M99 9 A20 20 0 0 0 75 28 A20 20 0 0 0 99 47" fill="none" stroke="#cbd5e1"/>{shotEvents.map((e)=><g key={e.id}><circle cx={e.x} cy={e.y} r="1.35" fill={e.made ? "#15803d" : "#dc2626"} stroke="#fff" strokeWidth=".45"/><text x={(e.x ?? 0)+2} y={(e.y ?? 0)+.8} fontSize="1.9" fill="#334155">{e.side === "home" ? "A" : "B"}</text></g>)}</svg><div className="shot-chart-caption">A = {teamName} · B = {opponentName} · green = made · red = missed · {shotEvents.length} charted attempts</div></div>; }
function ShotLegend() { return <div className="legend"><span><i className="dot made"/> Made</span><span><i className="dot missed"/> Missed</span><span>Markers preserve the exact court location selected during Game Day.</span></div>; }
function ShotPlayerTable({ entries, events }: { entries: ReportEntry[]; events: ReportEvent[] }) { return <div className="shot-player-block"><table><thead><tr><th>PLAYER</th><th>2PT M/A</th><th>3PT M/A</th><th>2PT%</th><th>3PT%</th><th>MADE</th><th>MISSED</th></tr></thead><tbody>{entries.map((e, index)=><tr key={`${e.playerKey}-${index}`}>{(() => { const s2=events.filter((x)=>x.playerKey===e.playerKey && x.type==="2PT"); const s3=events.filter((x)=>x.playerKey===e.playerKey && x.type==="3PT"); const m2=s2.filter((x)=>x.made).length; const m3=s3.filter((x)=>x.made).length; return <><td>{e.name}</td><td>{m2}/{s2.length}</td><td>{m3}/{s3.length}</td><td>{pct(m2,s2.length)}</td><td>{pct(m3,s3.length)}</td><td>{m2+m3}</td><td>{s2.length+s3.length-m2-m3}</td></>; })()}</tr>)}</tbody></table></div>; }
function EventTable({ events }: { events: ReportEvent[] }) { return <table className="event-table"><thead><tr><th>Q</th><th>TIME</th><th>TEAM</th><th>PLAYER</th><th>ACTION</th><th>RESULT</th><th>LOCATION</th></tr></thead><tbody>{events.map((e)=><tr key={e.id}><td>Q{e.quarter}</td><td>{formatClock(e.clock)}</td><td>{e.side === "home" ? "A" : "B"}</td><td>{e.playerName}</td><td>{e.type}</td><td>{e.x != null ? e.made ? `MADE +${e.points}` : "MISSED" : e.made === false ? "MISSED" : e.points ? `+${e.points}` : "RECORDED"}</td><td>{e.x != null ? `${Math.round(e.x)}%, ${Math.round(e.y ?? 0)}%` : "—"}</td></tr>)}</tbody></table>; }
function AdvancedTable({ entries }: { entries: ReportEntry[] }) { return <div className="advanced-block"><table><thead><tr><th>PLAYER</th><th>TS%</th><th>USG%</th><th>EFF</th><th>MIN</th><th>PTS</th><th>REB</th><th>AST</th><th>TO</th></tr></thead><tbody>{entries.map((e, index)=><tr key={`${e.playerKey}-${index}`}><td>{e.name}</td><td>{formatPercentage(trueShootingPercentage(e.stats.points,e.stats.fg_attempts,e.stats.ft_attempts))}</td><td>{usageRate(e.stats, estimatedPossessions(sumEntries(entries))) == null ? "—" : `${Math.round(usageRate(e.stats, estimatedPossessions(sumEntries(entries))) as number)}%`}</td><td>{efficiencyRating(e.stats)}</td><td>{formatDuration(e.stats.minutes_played)}</td><td>{e.stats.points}</td><td>{e.stats.rebounds}</td><td>{e.stats.assists}</td><td>{e.stats.turnovers}</td></tr>)}</tbody></table></div>; }
function sumEntries(entries: ReportEntry[]) { const total = {...entries[0]?.stats}; for (const c of STAT_COLUMNS) total[c.key] = entries.reduce((s,e)=>s+(e.stats[c.key]??0),0); return total as StatLine; }
function pct(made:number, attempts:number){ return attempts ? `${Math.round((made/attempts)*100)}%` : "—"; }
function formatClock(seconds:number){ return `${String(Math.floor(seconds/60)).padStart(2,"0")}:${String(seconds%60).padStart(2,"0")}`; }
