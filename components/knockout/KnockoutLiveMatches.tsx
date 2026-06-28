"use client";

import { Card } from "@/components/ui/Card";
import { TeamFlag } from "@/components/groups/TeamFlag";
import { getMatchDisplayScore } from "@/lib/groups/getMatchDisplayScore";
import {
  KNOCKOUT_ROUND_LABELS,
  KNOCKOUT_ROUNDS,
} from "@/lib/knockout/buildBracket";
import {
  isHalftimeStatus,
  isLiveMatchStatus,
} from "@/lib/scores/liveScoreStatus";
import type { KnockoutMatch } from "@/lib/knockout/types";

type KnockoutLiveMatchesProps = {
  matches: KnockoutMatch[];
  onMatchSelect: (match: KnockoutMatch) => void;
};

function isConcreteSide(team: string | null, source: string | null) {
  return Boolean(team?.trim()) && !source?.trim();
}

function liveScoreLabel(match: KnockoutMatch) {
  const displayScore = getMatchDisplayScore(match);

  if (displayScore.homeScore === null || displayScore.awayScore === null) {
    return "- x -";
  }

  return `${displayScore.homeScore} x ${displayScore.awayScore}`;
}

function liveStatusLabel(match: KnockoutMatch) {
  if (isHalftimeStatus(match.statusShort)) {
    return "Intervalo";
  }

  return match.elapsed !== null ? `AO VIVO ${match.elapsed}'` : "AO VIVO";
}

function LiveMatchButton({
  match,
  onSelect,
}: {
  match: KnockoutMatch;
  onSelect: (match: KnockoutMatch) => void;
}) {
  const teamAName = match.teamA ?? "A definir";
  const teamBName = match.teamB ?? "A definir";

  return (
    <button
      type="button"
      onClick={() => onSelect(match)}
      className="w-full rounded-xl border border-slate-800 bg-slate-950/35 p-3 text-left transition hover:border-emerald-400/45 hover:bg-slate-900/70 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:ring-offset-2 focus:ring-offset-slate-950 light:border-slate-200 light:bg-slate-50 light:hover:border-emerald-300 light:hover:bg-white light:focus:ring-emerald-600 light:focus:ring-offset-white"
      aria-label={`Ir para ${teamAName} contra ${teamBName}`}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="truncate text-xs font-black uppercase tracking-wide text-slate-400 light:text-slate-500">
          {KNOCKOUT_ROUND_LABELS[match.round]}
        </span>
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.68rem] font-black uppercase tracking-wide ${
            isLiveMatchStatus(match.statusShort)
              ? "bg-red-500 text-white"
              : "bg-amber-400/15 text-amber-200 light:bg-amber-100 light:text-amber-800"
          }`}
        >
          {isLiveMatchStatus(match.statusShort) ? (
            <span className="h-1.5 w-1.5 rounded-full bg-white motion-safe:animate-pulse" />
          ) : null}
          {liveStatusLabel(match)}
        </span>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
        <span className="flex min-w-0 items-center gap-2 text-sm font-bold text-slate-100 light:text-slate-800">
          <TeamFlag
            code={match.teamACode}
            flagUrl={match.teamAFlagUrl}
            name={teamAName}
          />
          <span className="min-w-0 truncate">{teamAName}</span>
        </span>
        <span className="rounded-lg bg-slate-950/45 px-3 py-1 text-center text-sm font-black tabular-nums text-slate-50 light:bg-white light:text-slate-950">
          {liveScoreLabel(match)}
        </span>
        <span className="flex min-w-0 items-center justify-end gap-2 text-right text-sm font-bold text-slate-100 light:text-slate-800">
          <span className="min-w-0 truncate">{teamBName}</span>
          <TeamFlag
            code={match.teamBCode}
            flagUrl={match.teamBFlagUrl}
            name={teamBName}
          />
        </span>
      </div>
    </button>
  );
}

export function KnockoutLiveMatches({
  matches,
  onMatchSelect,
}: KnockoutLiveMatchesProps) {
  const liveMatches = matches.filter(
    (match) =>
      (isLiveMatchStatus(match.statusShort) ||
        isHalftimeStatus(match.statusShort)) &&
      KNOCKOUT_ROUNDS.includes(match.round) &&
      isConcreteSide(match.teamA, match.teamASource) &&
      isConcreteSide(match.teamB, match.teamBSource),
  );

  if (liveMatches.length === 0) {
    return null;
  }

  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-3">
        <h2 className="text-lg font-black text-slate-50 light:text-slate-950">
          Jogos ao vivo
        </h2>
        <p className="mt-1 text-xs text-slate-400 light:text-slate-500">
          Clique em uma partida para ir ao card na chave.
        </p>
      </div>

      <div className="grid gap-2 lg:grid-cols-2">
        {liveMatches.map((match) => (
          <LiveMatchButton
            key={`${match.round}:${match.position}`}
            match={match}
            onSelect={onMatchSelect}
          />
        ))}
      </div>
    </Card>
  );
}
