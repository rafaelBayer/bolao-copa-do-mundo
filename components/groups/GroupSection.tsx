import { GroupMatches } from "./GroupMatches";
import { GroupTable } from "./GroupTable";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import type { GroupWithTeamsAndMatches } from "@/types/group";
import type { Prediction } from "@/types/prediction";

type GroupSectionProps = {
  group: GroupWithTeamsAndMatches;
  predictions: Prediction[];
  poolId: string;
  userId: string;
};

export function GroupSection({
  group,
  predictions,
  poolId,
  userId,
}: GroupSectionProps) {
  return (
    <Card className="overflow-hidden p-4 md:p-5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-300 light:text-amber-600">
            Grupo
          </p>
          <h2 className="mt-1 text-2xl font-black text-slate-50 light:text-slate-950">
            {group.name}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="emerald">{group.teams.length} selecoes</Badge>
          <Badge tone="amber">{group.matches.length} jogos</Badge>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 lg:col-span-8">
          <GroupTable group={group} />
        </div>
        <aside className="col-span-12 border-t border-slate-800 pt-5 light:border-slate-200 lg:col-span-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
          <GroupMatches
            poolId={poolId}
            userId={userId}
            matches={group.matches}
            predictions={predictions}
          />
        </aside>
      </div>
    </Card>
  );
}
