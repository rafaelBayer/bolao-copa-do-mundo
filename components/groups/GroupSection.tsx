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
    <Card className="overflow-hidden p-4 md:p-5 xl:p-6">
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

      <div className="grid gap-6 2xl:grid-cols-[minmax(760px,1.15fr)_minmax(600px,0.85fr)]">
        <div className="min-w-0">
          <GroupTable group={group} />
        </div>
        <aside className="min-w-0 border-t border-slate-800 pt-5 light:border-slate-200 2xl:border-l 2xl:border-t-0 2xl:pl-6 2xl:pt-0">
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
