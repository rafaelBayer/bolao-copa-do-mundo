import { logUnexpectedAuthError } from "@/lib/auth/authErrorMessages";
import { getOrCreateBrowserFingerprint } from "@/lib/invites/browserFingerprint";
import { createClient } from "@/lib/supabase/client";

type AcceptInviteInput = {
  inviteToken: string;
  preferredName?: string | null;
};

export async function acceptInviteForCurrentUser({
  inviteToken,
  preferredName = null,
}: AcceptInviteInput) {
  const supabase = createClient();
  const browserFingerprint = getOrCreateBrowserFingerprint();
  const { data: poolId, error: inviteError } = await supabase.rpc(
    "accept_pool_invite",
    {
      invite_token: inviteToken,
      browser_fingerprint: browserFingerprint,
      user_agent: navigator.userAgent,
    },
  );

  if (inviteError) {
    return {
      error: inviteError,
      poolId: null,
    };
  }

  if (typeof poolId === "string") {
    const { error: profileError } = await supabase.rpc(
      "ensure_user_profile_for_pool",
      {
        target_pool_id: poolId,
        preferred_name: preferredName?.trim() || null,
      },
    );

    if (profileError) {
      logUnexpectedAuthError(profileError);
    }
  }

  return {
    error: null,
    poolId: typeof poolId === "string" ? poolId : null,
  };
}
