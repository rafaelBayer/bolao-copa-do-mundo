import { TeamFlag } from "./TeamFlag";
import type { GroupStandingRow } from "@/lib/groups/calculateGroupStandings";

type GroupTableProps = {
  rows: GroupStandingRow[];
  countedMatches: number;
  emptyMessage: string;
};

function positionClass(index: number) {
  if (index < 2) {
    return "bg-emerald-400 text-slate-950 light:bg-emerald-600 light:text-white";
  }

  if (index === 2) {
    return "bg-amber-400 text-slate-950 light:bg-amber-500 light:text-slate-950";
  }

  return "bg-slate-800 text-slate-300 light:bg-slate-200 light:text-slate-700";
}

export function GroupTable({
  rows,
  countedMatches,
  emptyMessage,
}: GroupTableProps) {
  return (
    <div>
      {countedMatches === 0 ? (
        <div className="mb-3 rounded-2xl border border-amber-400/25 bg-amber-400/10 p-4 text-sm font-medium text-amber-100 light:border-amber-200 light:bg-amber-50 light:text-amber-800">
          {emptyMessage}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/35 light:border-slate-200 light:bg-slate-50/80">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wide text-slate-500 light:border-slate-200">
              <th className="w-[44%] py-4 pl-4 pr-3 font-bold">Seleção</th>
              <th className="px-2 py-4 text-center font-bold">Pts</th>
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
                key={row.teamId}
                className="border-b border-slate-800/70 transition hover:bg-slate-800/45 light:border-slate-200/80 light:hover:bg-white"
              >
                <td className="py-3 pl-4 pr-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-black ${positionClass(
                        index,
                      )}`}
                    >
                      {index + 1}
                    </span>
                    <TeamFlag
                      code={row.teamCode}
                      name={row.teamName}
                      flagUrl={row.flagUrl}
                      className="h-7 w-9 rounded-md"
                    />
                    <div className="min-w-0">
                      <p className="whitespace-normal break-words font-bold text-slate-100 light:text-slate-950">
                        {row.teamName}
                      </p>
                      {row.teamCode ? (
                        <span className="mt-1 inline-flex rounded-full border border-slate-700 px-2 py-0.5 text-[0.65rem] font-bold text-slate-400 light:border-slate-200 light:text-slate-500">
                          {row.teamCode}
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

      <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-slate-400 light:text-slate-500">
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-emerald-400 light:bg-emerald-600" />
          1º e 2º: classificação direta
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-amber-400 light:bg-amber-500" />
          3º: possível classificação
        </span>
      </div>
    </div>
  );
}
