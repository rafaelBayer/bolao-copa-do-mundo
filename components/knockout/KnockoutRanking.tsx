import { Medal } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { KnockoutRankingEntry } from "@/lib/knockout/types";

type KnockoutRankingProps = {
  entries: KnockoutRankingEntry[];
};

export function KnockoutRanking({ entries }: KnockoutRankingProps) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-black text-slate-50 light:text-slate-950">
        Ranking Mata-mata
      </h2>
      <Card className="overflow-hidden">
        {entries.length === 0 ? (
          <p className="p-4 text-sm font-semibold text-slate-400 light:text-slate-600">
            Ranking indisponivel ate os primeiros resultados oficiais.
          </p>
        ) : (
          <div className="divide-y divide-slate-800 light:divide-slate-200">
            {entries.map((entry, index) => (
              <div
                key={entry.userId}
                className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-950 text-sm font-black text-slate-200 light:bg-slate-100 light:text-slate-700">
                  {index === 0 ? <Medal size={16} aria-hidden="true" /> : index + 1}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-slate-100 light:text-slate-900">
                    {entry.name}
                  </p>
                  <p className="text-xs font-semibold text-slate-500 light:text-slate-500">
                    {entry.correctPicks} acertos oficiais | {entry.picksCount} palpites validos
                  </p>
                  <p className="mt-0.5 text-[11px] font-semibold text-slate-600 light:text-slate-500">
                    16 avos {entry.roundOf32Points} | Oitavas{" "}
                    {entry.roundOf16Points} | Quartas{" "}
                    {entry.quarterfinalPoints} | Semi {entry.semifinalPoints} |
                    Final {entry.finalPoints}
                  </p>
                </div>
                <span className="text-lg font-black text-emerald-300 light:text-emerald-700">
                  {entry.totalPoints}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </section>
  );
}
