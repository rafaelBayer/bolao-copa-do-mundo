import { Card } from "@/components/ui/Card";

export type AdminParticipant = {
  id: string;
  userId: string;
  role: string;
  createdAt: string;
};

type ParticipantsListProps = {
  participants: AdminParticipant[];
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function ParticipantsList({ participants }: ParticipantsListProps) {
  return (
    <Card className="p-5">
      <div className="mb-4">
        <h2 className="text-xl font-black text-slate-50 light:text-slate-950">
          Participantes
        </h2>
        <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
          Lista de membros vinculados a este bolao.
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-800 light:border-slate-200">
        <table className="w-full min-w-[620px] text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wide text-slate-500 light:border-slate-200">
              <th className="px-4 py-3">Usuario</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Entrada</th>
            </tr>
          </thead>
          <tbody>
            {participants.map((participant) => (
              <tr
                key={participant.id}
                className="border-b border-slate-800/70 light:border-slate-200/80"
              >
                <td className="px-4 py-3 font-mono text-xs text-slate-300 light:text-slate-700">
                  {participant.userId}
                </td>
                <td className="px-4 py-3 font-bold text-slate-100 light:text-slate-950">
                  {participant.role}
                </td>
                <td className="px-4 py-3 text-slate-400 light:text-slate-500">
                  {formatDate(participant.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
