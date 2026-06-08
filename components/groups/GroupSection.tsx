import { GroupMatches } from "./GroupMatches";
import { GroupTable } from "./GroupTable";
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
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:p-5">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-slate-950">{group.name}</h2>
      </div>

      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 lg:col-span-8">
          <GroupTable group={group} />
        </div>
        <aside className="col-span-12 border-t border-slate-200 pt-5 lg:col-span-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
          <GroupMatches
            poolId={poolId}
            userId={userId}
            matches={group.matches}
            predictions={predictions}
          />
        </aside>
      </div>
    </section>
  );
}
