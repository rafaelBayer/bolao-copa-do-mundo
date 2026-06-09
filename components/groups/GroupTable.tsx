import { calculateGroupTable } from "@/lib/groups/calculateGroupTable";
import { TeamFlag } from "./TeamFlag";
import type { GroupWithTeamsAndMatches } from "@/types/group";

type GroupTableProps = {
  group: GroupWithTeamsAndMatches;
};

export function GroupTable({ group }: GroupTableProps) {
  const rows = calculateGroupTable(group);

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/35 light:border-slate-200 light:bg-slate-50/80">
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wide text-slate-500 light:border-slate-200">
            <th className="w-[44%] py-4 pl-4 pr-3 font-bold">Selecao</th>
            <th className="px-2 py-4 text-center font-bold">P</th>
            <th className="px-2 py-4 text-center font-bold">J</th>
            <th className="px-2 py-4 text-center font-bold">V</th>
            <th className="px-2 py-4 text-center font-bold">E</th>
            <th className="px-2 py-4 text-center font-bold">D</th>
            <th className="px-2 py-4 text-center font-bold">GP</th>
            <th className="px-2 py-4 text-center font-bold">GC</th>
            <th className="px-4 py-4 text-center font-bold">SG</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={row.team.id}
              className="border-b border-slate-800/70 transition hover:bg-slate-800/45 light:border-slate-200/80 light:hover:bg-white"
            >
              <td className="py-3 pl-4 pr-3">
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-black ${
                      index < 2
                        ? "bg-emerald-400 text-slate-950 light:bg-emerald-600 light:text-white"
                        : "bg-slate-800 text-slate-300 light:bg-slate-200 light:text-slate-700"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <TeamFlag
                    code={row.team.code}
                    name={row.team.name}
                    flagUrl={row.team.flagUrl}
                    className="h-7 w-9 rounded-md"
                  />
                  <div>
                    <p className="font-bold text-slate-100 light:text-slate-950">
                      {row.team.name}
                    </p>
                    {row.team.code ? (
                      <span className="mt-1 inline-flex rounded-full border border-slate-700 px-2 py-0.5 text-[0.65rem] font-bold text-slate-400 light:border-slate-200 light:text-slate-500">
                        {row.team.code}
                      </span>
                    ) : null}
                  </div>
                </div>
              </td>
              <td className="px-2 py-3 text-center font-black text-slate-50 light:text-slate-950">
                {row.points}
              </td>
              <td className="px-2 py-3 text-center text-slate-300 light:text-slate-600">
                {row.played}
              </td>
              <td className="px-2 py-3 text-center text-slate-300 light:text-slate-600">
                {row.wins}
              </td>
              <td className="px-2 py-3 text-center text-slate-300 light:text-slate-600">
                {row.draws}
              </td>
              <td className="px-2 py-3 text-center text-slate-300 light:text-slate-600">
                {row.losses}
              </td>
              <td className="px-2 py-3 text-center text-slate-300 light:text-slate-600">
                {row.goalsFor}
              </td>
              <td className="px-2 py-3 text-center text-slate-300 light:text-slate-600">
                {row.goalsAgainst}
              </td>
              <td className="px-4 py-3 text-center font-bold text-slate-100 light:text-slate-700">
                {row.goalDifference}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
