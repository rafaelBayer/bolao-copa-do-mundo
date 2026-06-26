import { Check } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { KnockoutBracketMatch } from "@/lib/knockout/types";

type KnockoutMatchCardProps = {
  match: KnockoutBracketMatch;
  disabled: boolean;
  onSelect: (team: string) => void;
};

function TeamButton({
  label,
  team,
  selected,
  disabled,
  onSelect,
}: {
  label: string;
  team: string | null;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      disabled={!team || disabled}
      onClick={onSelect}
      className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm font-black transition ${
        selected
          ? "border-emerald-400 bg-emerald-400/15 text-emerald-100 light:border-emerald-500 light:bg-emerald-50 light:text-emerald-800"
          : "border-slate-800 bg-slate-950/40 text-slate-100 hover:border-emerald-400/45 light:border-slate-200 light:bg-white light:text-slate-800 light:hover:border-emerald-300"
      } disabled:cursor-not-allowed disabled:opacity-60`}
    >
      <span className="min-w-0 truncate">{team ?? label}</span>
      {selected ? <Check size={16} aria-hidden="true" /> : null}
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
  onSelect,
}: KnockoutMatchCardProps) {
  const canSelect = Boolean(match.teamA.team && match.teamB.team && !disabled);

  return (
    <Card className="p-3">
      <div className="mb-2 flex items-center justify-between gap-2 text-xs font-bold text-slate-500 light:text-slate-500">
        <span>Jogo {match.position}</span>
        <span className="truncate">{formatStartsAt(match.startsAt)}</span>
      </div>
      <div className="space-y-2">
        <TeamButton
          label={match.teamA.label}
          team={match.teamA.team}
          selected={match.selectedTeam === match.teamA.team}
          disabled={!canSelect}
          onSelect={() => match.teamA.team && onSelect(match.teamA.team)}
        />
        <TeamButton
          label={match.teamB.label}
          team={match.teamB.team}
          selected={match.selectedTeam === match.teamB.team}
          disabled={!canSelect}
          onSelect={() => match.teamB.team && onSelect(match.teamB.team)}
        />
      </div>
    </Card>
  );
}
