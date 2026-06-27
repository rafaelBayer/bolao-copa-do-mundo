import { Check } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { TeamFlag } from "@/components/groups/TeamFlag";
import type { KnockoutBracketMatch } from "@/lib/knockout/types";

type KnockoutMatchCardProps = {
  match: KnockoutBracketMatch;
  disabled: boolean;
  side?: "left" | "right" | "center";
  showMeta?: boolean;
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
  const shortLabel = code?.slice(0, 3).toUpperCase() ?? "---";

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

export function KnockoutMatchCard({
  match,
  disabled,
  side = "center",
  showMeta = false,
  onSelect,
}: KnockoutMatchCardProps) {
  const canSelect = Boolean(match.teamA.team && match.teamB.team && !disabled);

  return (
    <div className="relative">
      {side === "left" ? (
        <span className="pointer-events-none absolute left-full top-1/2 hidden h-px w-5 bg-slate-700/75 light:bg-slate-300 lg:block" />
      ) : null}
      {side === "right" ? (
        <span className="pointer-events-none absolute right-full top-1/2 hidden h-px w-5 bg-slate-700/75 light:bg-slate-300 lg:block" />
      ) : null}
      <Card
        className={`w-[9.25rem] border-slate-800/80 bg-slate-950/72 p-2 shadow-sm light:border-slate-200 light:bg-white ${
          match.selectedTeam
            ? "shadow-emerald-950/20 light:shadow-emerald-100"
            : ""
        }`}
      >
        {showMeta ? (
          <div className="mb-1.5 flex items-center justify-between gap-2 text-[10px] font-bold text-slate-500 light:text-slate-500">
            <span>Jogo {match.position}</span>
            <span className="truncate">{formatStartsAt(match.startsAt)}</span>
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
      </Card>
    </div>
  );
}
