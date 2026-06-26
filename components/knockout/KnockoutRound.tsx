import { KNOCKOUT_ROUND_LABELS } from "@/lib/knockout/buildBracket";
import type { KnockoutBracketMatch, KnockoutRound as RoundName } from "@/lib/knockout/types";
import { KnockoutMatchCard } from "./KnockoutMatchCard";

type KnockoutRoundProps = {
  round: RoundName;
  matches: KnockoutBracketMatch[];
  disabled: boolean;
  onSelect: (round: RoundName, position: number, team: string) => void;
};

export function KnockoutRound({
  round,
  matches,
  disabled,
  onSelect,
}: KnockoutRoundProps) {
  return (
    <section className="min-w-[17rem]">
      <h2 className="mb-3 text-sm font-black uppercase tracking-[0.16em] text-slate-400 light:text-slate-500">
        {KNOCKOUT_ROUND_LABELS[round]}
      </h2>
      <div className="space-y-3">
        {matches.map((match) => (
          <KnockoutMatchCard
            key={`${match.round}:${match.position}`}
            match={match}
            disabled={disabled}
            onSelect={(team) => onSelect(match.round, match.position, team)}
          />
        ))}
      </div>
    </section>
  );
}
