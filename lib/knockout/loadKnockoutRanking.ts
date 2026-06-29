import { buildKnockoutRanking } from "./buildKnockoutRanking";
import type {
  KnockoutMatch,
  KnockoutPick,
  KnockoutRankingEntry,
  KnockoutRound,
} from "./types";
import { createAdminClient } from "@/lib/supabase/admin";

type LoadPoolKnockoutRankingInput = {
  poolId: string;
  tournamentKey: string;
  matches: KnockoutMatch[];
};

type LoadPoolKnockoutRankingResult = {
  entries: KnockoutRankingEntry[];
  error: Error | null;
};

function mapPick(row: Record<string, unknown>): KnockoutPick & { bracketId: string } {
  return {
    bracketId: String(row.bracket_id),
    id: typeof row.id === "string" ? row.id : undefined,
    round: String(row.round) as KnockoutRound,
    position: Number(row.position),
    selectedTeam: typeof row.selected_team === "string" ? row.selected_team : "",
    createdAt: typeof row.created_at === "string" ? row.created_at : undefined,
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : undefined,
  };
}

export async function loadPoolKnockoutRanking({
  poolId,
  tournamentKey,
  matches,
}: LoadPoolKnockoutRankingInput): Promise<LoadPoolKnockoutRankingResult> {
  try {
    const admin = createAdminClient();
    const { data: memberRows, error: membersError } = await admin
      .from("pool_members")
      .select("user_id")
      .eq("pool_id", poolId);

    if (membersError) {
      throw membersError;
    }

    const userIds = (memberRows ?? [])
      .map((row) => String(row.user_id))
      .filter(Boolean);

    if (userIds.length === 0) {
      return { entries: [], error: null };
    }

    const [
      { data: profileRows, error: profilesError },
      { data: bracketRows, error: bracketsError },
    ] = await Promise.all([
      admin
        .from("profiles")
        .select("id, name, username, avatar_url")
        .in("id", userIds),
      admin
        .from("user_knockout_brackets")
        .select("id, user_id, submitted_at, completed_at")
        .eq("tournament_key", tournamentKey)
        .in("user_id", userIds),
    ]);

    if (profilesError) {
      throw profilesError;
    }

    if (bracketsError) {
      throw bracketsError;
    }

    const bracketIds = (bracketRows ?? [])
      .map((row) => String(row.id))
      .filter(Boolean);
    const { data: pickRows, error: picksError } =
      bracketIds.length > 0
        ? await admin
            .from("user_knockout_picks")
            .select("id, bracket_id, round, position, selected_team, created_at, updated_at")
            .in("bracket_id", bracketIds)
        : { data: [], error: null };

    if (picksError) {
      throw picksError;
    }

    return {
      entries: buildKnockoutRanking({
        members: userIds.map((userId) => ({ userId })),
        profiles: (profileRows ?? []).map((row) => ({
          id: String(row.id),
          name: typeof row.name === "string" ? row.name : null,
          username: typeof row.username === "string" ? row.username : null,
          avatarUrl: typeof row.avatar_url === "string" ? row.avatar_url : null,
        })),
        brackets: (bracketRows ?? []).map((row) => ({
          id: String(row.id),
          userId: String(row.user_id),
          submittedAt:
            typeof row.submitted_at === "string" ? row.submitted_at : null,
          completedAt:
            typeof row.completed_at === "string" ? row.completed_at : null,
        })),
        picks: ((pickRows ?? []) as Record<string, unknown>[]).map(mapPick),
        matches,
      }),
      error: null,
    };
  } catch (error) {
    return {
      entries: [],
      error: error instanceof Error ? error : new Error("Unknown error"),
    };
  }
}
