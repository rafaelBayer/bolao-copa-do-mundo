import { KNOCKOUT_ROUND_LABELS } from "@/lib/knockout/buildBracket";
import type { KnockoutBracketMatch, KnockoutRound as RoundName } from "@/lib/knockout/types";
import { KnockoutMatchCard } from "./KnockoutMatchCard";

type KnockoutRoundProps = {
  round: RoundName;
  matches: KnockoutBracketMatch[];
  disabled: boolean;
  side?: "left" | "right" | "center";
  className?: string;
  compactTitle?: boolean;
  showMeta?: boolean;
  onSelect: (round: RoundName, position: number, team: string) => void;
};

export function KnockoutRound({
  round,
  matches,
  disabled,
  side = "center",
  className = "",
  compactTitle = false,
  showMeta = false,
  onSelect,
}: KnockoutRoundProps) {
  return (
    <section className={`flex min-w-[9.25rem] flex-col ${className}`}>
      <h2
        className={`mb-3 text-center font-black uppercase text-slate-400 light:text-slate-500 ${
          compactTitle
            ? "text-[10px] tracking-[0.12em]"
            : "text-sm tracking-[0.16em]"
        }`}
      >
        {KNOCKOUT_ROUND_LABELS[round]}
      </h2>
      <div className="flex min-h-0 flex-1 flex-col justify-around gap-3">
        {matches.map((match) => (
          <KnockoutMatchCard
            key={`${match.round}:${match.position}`}
            match={match}
            disabled={disabled}
            side={side}
            showMeta={showMeta}
            onSelect={(team) => onSelect(match.round, match.position, team)}
          />
        ))}
      </div>
    </section>
  );
}
