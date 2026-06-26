import { Crown } from "lucide-react";
import { Card } from "@/components/ui/Card";

type KnockoutChampionCardProps = {
  champion: string | null;
};

export function KnockoutChampionCard({ champion }: KnockoutChampionCardProps) {
  return (
    <Card className="min-w-[15rem] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500 light:text-slate-500">
            Campeao
          </p>
          <p className="mt-2 truncate text-2xl font-black text-slate-50 light:text-slate-950">
            {champion ?? "A definir"}
          </p>
        </div>
        <Crown
          className="shrink-0 text-amber-300 light:text-amber-600"
          size={32}
          aria-hidden="true"
        />
      </div>
    </Card>
  );
}
