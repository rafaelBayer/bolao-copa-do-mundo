import { calculateGroupTable } from "@/lib/groups/calculateGroupTable";
import type { GroupWithTeamsAndMatches } from "@/types/group";

type GroupTableProps = {
  group: GroupWithTeamsAndMatches;
};

export function GroupTable({ group }: GroupTableProps) {
  const rows = calculateGroupTable(group);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
            <th className="py-3 pr-3 font-semibold">Selecao</th>
            <th className="px-2 py-3 text-center font-semibold">P</th>
            <th className="px-2 py-3 text-center font-semibold">J</th>
            <th className="px-2 py-3 text-center font-semibold">V</th>
            <th className="px-2 py-3 text-center font-semibold">E</th>
            <th className="px-2 py-3 text-center font-semibold">D</th>
            <th className="px-2 py-3 text-center font-semibold">GP</th>
            <th className="px-2 py-3 text-center font-semibold">GC</th>
            <th className="px-2 py-3 text-center font-semibold">SG</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.team.id} className="border-b border-slate-100">
              <td className="py-3 pr-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-xs font-bold text-emerald-800">
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-semibold text-slate-900">{row.team.name}</p>
                    {row.team.code ? (
                      <p className="text-xs text-slate-500">{row.team.code}</p>
                    ) : null}
                  </div>
                </div>
              </td>
              <td className="px-2 py-3 text-center font-bold">{row.points}</td>
              <td className="px-2 py-3 text-center">{row.played}</td>
              <td className="px-2 py-3 text-center">{row.wins}</td>
              <td className="px-2 py-3 text-center">{row.draws}</td>
              <td className="px-2 py-3 text-center">{row.losses}</td>
              <td className="px-2 py-3 text-center">{row.goalsFor}</td>
              <td className="px-2 py-3 text-center">{row.goalsAgainst}</td>
              <td className="px-2 py-3 text-center">{row.goalDifference}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
