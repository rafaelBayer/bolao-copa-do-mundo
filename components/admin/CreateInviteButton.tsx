"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LinkIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

type CreateInviteButtonProps = {
  poolId: string;
  userId: string;
};

function createInviteToken() {
  const randomId =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`;

  return randomId.replace(/[^a-zA-Z0-9]/g, "");
}

export function CreateInviteButton({ poolId, userId }: CreateInviteButtonProps) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "creating" | "created" | "error">(
    "idle",
  );

  async function handleCreateInvite() {
    setStatus("creating");

    const supabase = createClient();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const { error } = await supabase.from("pool_invites").insert({
      pool_id: poolId,
      token: createInviteToken(),
      created_by: userId,
      expires_at: expiresAt.toISOString(),
    });

    if (error) {
      setStatus("error");
      return;
    }

    setStatus("created");
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        type="button"
        onClick={handleCreateInvite}
        disabled={status === "creating"}
      >
        {status === "creating" ? (
          <Loader2 size={17} className="animate-spin" aria-hidden="true" />
        ) : (
          <LinkIcon size={17} aria-hidden="true" />
        )}
        Gerar convite
      </Button>
      {status === "created" ? (
        <span className="text-sm font-bold text-emerald-300 light:text-emerald-700">
          Convite criado.
        </span>
      ) : null}
      {status === "error" ? (
        <span className="text-sm font-bold text-red-300 light:text-red-600">
          Erro ao criar convite.
        </span>
      ) : null}
    </div>
  );
}
