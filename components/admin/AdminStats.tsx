import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

type AdminStatsProps = {
  poolName: string;
  participantsCount: number;
  availableInvitesCount: number;
  inviteUsesCount: number;
};

export function AdminStats({
  poolName,
  participantsCount,
  availableInvitesCount,
  inviteUsesCount,
}: AdminStatsProps) {
  const stats = [
    { label: "participantes", value: participantsCount },
    { label: "links ativos", value: availableInvitesCount },
    { label: "usos de convite", value: inviteUsesCount },
  ];

  return (
    <Card className="p-5 sm:p-7">
      <Badge tone="emerald">Administracao</Badge>
      <div className="mt-4 grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <h1 className="text-3xl font-black text-slate-50 light:text-slate-950">
            {poolName}
          </h1>
          <p className="mt-2 text-sm text-slate-400 light:text-slate-500">
            Gere convites e acompanhe os participantes do bolao.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 sm:min-w-[30rem]">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4 light:border-slate-200 light:bg-slate-50"
            >
              <p className="text-2xl font-black text-slate-50 light:text-slate-950">
                {stat.value}
              </p>
              <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-400 light:text-slate-500">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
