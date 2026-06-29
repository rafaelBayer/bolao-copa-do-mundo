import { Check, Flame, Lock } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { TeamFlag } from "@/components/groups/TeamFlag";
import { getMatchDisplayScore } from "@/lib/groups/getMatchDisplayScore";
import { knockoutMatchCardId } from "@/lib/knockout/matchDomId";
import {
  isFinalMatchStatus,
  isHalftimeStatus,
  isLiveMatchStatus,
} from "@/lib/scores/liveScoreStatus";
import type {
  KnockoutBracketMatch,
  KnockoutCommunityPicksSummary,
} from "@/lib/knockout/types";

type KnockoutMatchCardProps = {
  match: KnockoutBracketMatch;
  disabled: boolean;
  side?: "left" | "right" | "center";
  showMeta?: boolean;
  isHighlighted?: boolean;
  communityPicks?: KnockoutCommunityPicksSummary;
  onCommunityPicksOpen?: (summary: KnockoutCommunityPicksSummary) => void;
  onSelect: (team: string) => void;
};

function TeamButton({
  label,
  team,
  code,
  flagUrl,
  selected,
  disabled,
  onSelect,
}: {
  label: string;
  team: string | null;
  code: string | null;
  flagUrl: string | null;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const shortLabel = code?.slice(0, 3).toUpperCase() ?? label;

  return (
    <button
      type="button"
      disabled={!team || disabled}
      onClick={onSelect}
      title={team ?? label}
      className={`group flex h-10 w-full items-center justify-between gap-2 rounded-lg border px-2.5 text-left text-xs font-black transition ${
        selected
          ? "border-emerald-300 bg-emerald-400/18 text-emerald-50 shadow-[0_0_0_1px_rgba(52,211,153,0.28)] light:border-emerald-500 light:bg-emerald-50 light:text-emerald-800"
          : "border-slate-800 bg-slate-950/50 text-slate-200 hover:border-emerald-400/45 light:border-slate-200 light:bg-white light:text-slate-800 light:hover:border-emerald-300"
      } disabled:cursor-not-allowed disabled:opacity-55`}
    >
      <span className="flex min-w-0 items-center gap-2">
        {team ? (
          <TeamFlag
            code={code}
            name={team}
            flagUrl={flagUrl}
            className="h-7 w-9 rounded-md"
          />
        ) : (
          <span
            className="flex h-7 w-9 shrink-0 items-center justify-center rounded-md border border-dashed border-slate-700 bg-slate-900/50 text-[10px] font-black text-slate-500 light:border-slate-300 light:bg-slate-50 light:text-slate-400"
            aria-hidden="true"
          >
            ---
          </span>
        )}
        <span className="min-w-0 truncate tracking-normal">
          {shortLabel}
        </span>
      </span>
      {selected ? <Check size={14} aria-hidden="true" /> : null}
    </button>
  );
}

function formatStartsAt(value: string | null) {
  if (!value) {
    return "Data a definir";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function formatLockAt(value: string | null) {
  if (!value) {
    return "Prazo a definir";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function communityPicksLabel(summary: KnockoutCommunityPicksSummary) {
  if (summary.totalPicks === 0) {
    return "Nenhum palpite registrado";
  }

  return summary.options
    .map((option) => {
      const label = option.teamCode?.slice(0, 3).toUpperCase() ?? option.teamName;

      return `${label} ${option.percentage}%`;
    })
    .join(" | ");
}

function showActiveBonusIcon(match: KnockoutBracketMatch) {
  return match.pointsInfo.bonusAvailable && !match.isFinished;
}

export function KnockoutMatchCard({
  match,
  disabled,
  side = "center",
  showMeta = false,
  isHighlighted = false,
  communityPicks,
  onCommunityPicksOpen,
  onSelect,
}: KnockoutMatchCardProps) {
  const hasTeams = Boolean(match.teamA.team && match.teamB.team);
  const canSelect = Boolean(hasTeams && match.canPick && !disabled);
  const isLive = isLiveMatchStatus(match.statusShort);
  const isHalftime = isHalftimeStatus(match.statusShort);
  const isFinal = isFinalMatchStatus(match.statusShort) || match.isFinished;
  const displayScore = getMatchDisplayScore(match);
  const hasDisplayScore =
    displayScore.homeScore !== null && displayScore.awayScore !== null;
  const scoreLabel = hasDisplayScore
    ? `${displayScore.homeScore} x ${displayScore.awayScore}`
    : null;
  const scoreTone = isLive ? "live" : isHalftime ? "halftime" : "final";
  const statusLabel = !hasTeams
    ? "Aguardando definicao dos classificados."
    : match.isFinished
      ? match.isPickCorrect === null
        ? "Resultado oficial disponivel."
        : match.isPickCorrect
          ? `Acertou +${match.pickPoints} pts`
          : "Errou 0 pts"
      : match.isLocked
        ? "Palpite bloqueado"
        : `Aberto ate ${formatLockAt(match.lockAt)}`;

  return (
    <div id={knockoutMatchCardId(match)} className="relative">
      {side === "left" ? (
        <span className="pointer-events-none absolute left-full top-1/2 hidden h-px w-5 bg-slate-700/75 light:bg-slate-300 lg:block" />
      ) : null}
      {side === "right" ? (
        <span className="pointer-events-none absolute right-full top-1/2 hidden h-px w-5 bg-slate-700/75 light:bg-slate-300 lg:block" />
      ) : null}
      {showActiveBonusIcon(match) ? (
        <span
          title="Bonus ativo"
          aria-label="Bonus ativo"
          className="absolute -right-2 -top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-orange-300 bg-orange-500 text-white shadow-lg shadow-orange-950/30 light:border-orange-400 light:bg-orange-500"
        >
          <Flame size={14} aria-hidden="true" fill="currentColor" />
        </span>
      ) : null}
      <Card
        className={`w-[9.25rem] p-2 shadow-sm ${
          isLive
            ? "border-red-400/70 bg-red-500/10 shadow-red-950/30 ring-1 ring-red-500/35 light:border-red-300 light:bg-red-50 light:ring-red-300/70"
            : "border-slate-800/80 bg-slate-950/72 light:border-slate-200 light:bg-white"
        } ${
          isHighlighted
            ? "ring-2 ring-amber-300 ring-offset-2 ring-offset-slate-950 light:ring-amber-500 light:ring-offset-white"
            : ""
        } ${
          match.selectedTeam
            ? "shadow-emerald-950/20 light:shadow-emerald-100"
            : ""
        }`}
      >
        {isHighlighted ? (
          <div className="mb-1.5 rounded-full bg-amber-300 px-2 py-0.5 text-center text-[9px] font-black uppercase tracking-normal text-slate-950 light:bg-amber-400">
            Jogo selecionado
          </div>
        ) : null}
        {showMeta ? (
          <div className="mb-1.5 flex items-center justify-between gap-2 text-[10px] font-bold text-slate-500 light:text-slate-500">
            <span>Jogo {match.position}</span>
            <span className="truncate">{formatStartsAt(match.startsAt)}</span>
          </div>
        ) : null}
        {(isLive || isHalftime || isFinal) && scoreLabel ? (
          <div
            className={`mb-1.5 flex items-center justify-between gap-1.5 rounded-md px-1.5 py-0.5 text-[8px] font-black uppercase leading-3 tracking-normal ${
              scoreTone === "live"
                ? "bg-red-500 text-white shadow-sm shadow-red-950/30"
                : scoreTone === "halftime"
                  ? "bg-amber-400/15 text-amber-200 light:bg-amber-100 light:text-amber-800"
                  : "bg-slate-800 text-slate-300 light:bg-slate-100 light:text-slate-700"
            }`}
          >
            <span className="inline-flex items-center gap-1">
              {isLive ? (
                <span className="h-1 w-1 rounded-full bg-white motion-safe:animate-pulse" />
              ) : null}
              {isLive ? "AO VIVO" : isHalftime ? "Intervalo" : "Encerrado"}
            </span>
            <span className="inline-flex items-center gap-0.5 tabular-nums">
              {isLive && match.elapsed !== null ? (
                <span>{match.elapsed}&apos;</span>
              ) : null}
              <span>{scoreLabel}</span>
            </span>
          </div>
        ) : null}
        <div className="space-y-1.5">
          <TeamButton
            label={match.teamA.label}
            team={match.teamA.team}
            code={match.teamA.code}
            flagUrl={match.teamA.flagUrl}
            selected={match.selectedTeam === match.teamA.team}
            disabled={!canSelect}
            onSelect={() => match.teamA.team && onSelect(match.teamA.team)}
          />
          <TeamButton
            label={match.teamB.label}
            team={match.teamB.team}
            code={match.teamB.code}
            flagUrl={match.teamB.flagUrl}
            selected={match.selectedTeam === match.teamB.team}
            disabled={!canSelect}
            onSelect={() => match.teamB.team && onSelect(match.teamB.team)}
          />
        </div>
        <div className="mt-2 min-h-4 text-[10px] font-bold leading-4 text-slate-500 light:text-slate-500">
          {match.isLocked && hasTeams && !match.isFinished ? (
            <span className="inline-flex items-center gap-1">
              <Lock size={11} aria-hidden="true" />
              {statusLabel}
            </span>
          ) : (
            statusLabel
          )}
        </div>
        {communityPicks ? (
          <button
            type="button"
            onClick={() => onCommunityPicksOpen?.(communityPicks)}
            className="mt-2 w-full rounded-md border border-slate-800 bg-slate-950/45 px-2 py-1.5 text-left transition hover:border-emerald-400/40 light:border-slate-200 light:bg-slate-50 light:hover:border-emerald-300"
          >
            <span className="block text-[9px] font-black uppercase tracking-normal text-slate-400 light:text-slate-500">
              Palpites
            </span>
            <span className="mt-0.5 block truncate text-[10px] font-bold text-slate-200 light:text-slate-800">
              {communityPicksLabel(communityPicks)}
            </span>
            {communityPicks.totalPicks > 0 ? (
              <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-slate-800 light:bg-slate-200">
                <span
                  className="block h-full rounded-full bg-emerald-400 light:bg-emerald-600"
                  style={{
                    width: `${communityPicks.options[0]?.percentage ?? 0}%`,
                  }}
                />
              </span>
            ) : null}
            <span className="mt-1 block text-[9px] font-black text-emerald-300 light:text-emerald-700">
              Ver detalhes
            </span>
          </button>
        ) : null}
        {match.selectedTeam ? (
          <div className="mt-1 text-[10px] font-bold text-emerald-200 light:text-emerald-700">
            Palpite: {match.selectedTeam}
          </div>
        ) : null}
        {match.invalidSelectedTeam ? (
          <div className="mt-1 text-[10px] font-bold text-amber-200 light:text-amber-700">
            Palpite antigo incompativel: {match.invalidSelectedTeam}
          </div>
        ) : null}
        {match.winnerTeam ? (
          <div className="mt-1 text-[10px] font-bold text-slate-300 light:text-slate-700">
            Vencedor: {match.winnerTeam}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
