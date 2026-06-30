import { Card } from "@/components/ui/Card";

export type AdminParticipant = {
  id: string;
  userId: string;
  role: string;
  createdAt: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
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

function shortUserId(userId: string) {
  return userId.slice(0, 8);
}

function participantLabel(participant: AdminParticipant) {
  return participant.name || participant.email || shortUserId(participant.userId);
}

function participantInitial(participant: AdminParticipant) {
  return participantLabel(participant).trim().charAt(0).toUpperCase() || "U";
}

export function ParticipantsList({ participants }: ParticipantsListProps) {
  return (
    <Card className="p-5">
      <div className="mb-4">
        <h2 className="text-xl font-black text-slate-50 light:text-slate-950">
          Participantes
        </h2>
        <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
          Lista de membros vinculados a este bolão.
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-800 light:border-slate-200">
        <table className="w-full min-w-[620px] text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wide text-slate-500 light:border-slate-200">
              <th className="px-4 py-3">Usuário</th>
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
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-700 bg-slate-900 text-sm font-black text-slate-200 light:border-slate-200 light:bg-white light:text-slate-700">
                      {participant.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={participant.avatarUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        participantInitial(participant)
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-100 light:text-slate-950">
                        {participantLabel(participant)}
                      </p>
                      {participant.name && participant.email ? (
                        <p className="mt-0.5 break-all text-xs text-slate-500 light:text-slate-500">
                          {participant.email}
                        </p>
                      ) : (
                        <p className="mt-0.5 font-mono text-xs text-slate-500 light:text-slate-500">
                          {shortUserId(participant.userId)}
                        </p>
                      )}
                    </div>
                  </div>
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
