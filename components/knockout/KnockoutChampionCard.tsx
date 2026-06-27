import { Crown } from "lucide-react";
import { Card } from "@/components/ui/Card";

type KnockoutChampionCardProps = {
  champion: string | null;
};

export function KnockoutChampionCard({ champion }: KnockoutChampionCardProps) {
  return (
    <Card className="w-[11rem] border-amber-300/30 bg-amber-300/8 p-4 text-center shadow-sm light:border-amber-300 light:bg-amber-50">
      <div className="flex flex-col items-center gap-2">
        <Crown
          className="text-amber-300 light:text-amber-600"
          size={30}
          aria-hidden="true"
        />
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-200 light:text-amber-700">
            Campeao
          </p>
          <p className="mt-1 truncate text-xl font-black text-slate-50 light:text-slate-950">
            {champion ?? "A definir"}
          </p>
        </div>
      </div>
    </Card>
  );
}
