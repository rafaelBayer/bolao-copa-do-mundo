import { pickKey } from "./buildBracket";
import { isKnockoutMatchPickLocked } from "./pickLock";
import type {
  KnockoutCommunityPickOption,
  KnockoutCommunityPicksSummary,
  KnockoutCommunityPickUser,
  KnockoutMatch,
  KnockoutRound,
} from "./types";
import { createAdminClient } from "@/lib/supabase/admin";

type LoadCommunityPicksInput = {
  poolId: string;
  tournamentKey: string;
  currentUserId: string;
  matches: KnockoutMatch[];
};

function percentage(count: number, total: number) {
  return total > 0 ? Math.round((count / total) * 100) : 0;
}

function fallbackName(row: Record<string, unknown>) {
  if (typeof row.name === "string" && row.name.trim()) {
    return row.name;
  }

  if (typeof row.username === "string" && row.username.trim()) {
    return row.username;
  }

  return "Participante";
}

function emptyOption(match: KnockoutMatch, side: "a" | "b"): KnockoutCommunityPickOption {
  return {
    teamName: side === "a" ? match.teamA ?? "Time A" : match.teamB ?? "Time B",
    teamCode: side === "a" ? match.teamACode : match.teamBCode,
    teamFlagUrl: side === "a" ? match.teamAFlagUrl : match.teamBFlagUrl,
    count: 0,
    percentage: 0,
    users: [],
  };
}

export async function loadCommunityPicks(input: LoadCommunityPicksInput) {
  const now = new Date();
  const lockedMatches = input.matches.filter(
    (match) =>
      match.teamA &&
      match.teamB &&
      isKnockoutMatchPickLocked(match, now),
  );
  const lockedMatchByKey = new Map(
    lockedMatches.map((match) => [pickKey(match.round, match.position), match]),
  );

  if (lockedMatches.length === 0) {
    return {
      summaries: new Map<string, KnockoutCommunityPicksSummary>(),
      error: null,
    };
  }

  try {
    const admin = createAdminClient();
    const { data: memberRows, error: membersError } = await admin
      .from("pool_members")
      .select("user_id")
      .eq("pool_id", input.poolId);

    if (membersError) {
      throw membersError;
    }

    const userIds = (memberRows ?? [])
      .map((row) => String(row.user_id))
      .filter(Boolean);

    if (userIds.length === 0) {
      return {
        summaries: new Map<string, KnockoutCommunityPicksSummary>(),
        error: null,
      };
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
        .select("id, user_id")
        .eq("tournament_key", input.tournamentKey)
        .in("user_id", userIds),
    ]);

    if (profilesError) {
      throw profilesError;
    }

    if (bracketsError) {
      throw bracketsError;
    }

    const profileByUserId = new Map(
      ((profileRows ?? []) as Record<string, unknown>[]).map((row) => [
        String(row.id),
        {
          id: String(row.id),
          name: fallbackName(row),
          username: typeof row.username === "string" ? row.username : null,
          avatarUrl:
            typeof row.avatar_url === "string" ? row.avatar_url : null,
        },
      ]),
    );
    const userIdByBracketId = new Map(
      ((bracketRows ?? []) as Record<string, unknown>[]).map((row) => [
        String(row.id),
        String(row.user_id),
      ]),
    );
    const bracketIds = Array.from(userIdByBracketId.keys());
    const { data: pickRows, error: picksError } =
      bracketIds.length > 0
        ? await admin
            .from("user_knockout_picks")
            .select("bracket_id, round, position, selected_team")
            .in("bracket_id", bracketIds)
        : { data: [], error: null };

    if (picksError) {
      throw picksError;
    }

    const summaries = new Map<string, KnockoutCommunityPicksSummary>();

    lockedMatches.forEach((match) => {
      const matchKey = pickKey(match.round, match.position);
      summaries.set(matchKey, {
        matchKey,
        isLocked: true,
        totalPicks: 0,
        userPick: null,
        options: [emptyOption(match, "a"), emptyOption(match, "b")],
      });
    });

    ((pickRows ?? []) as Record<string, unknown>[]).forEach((row) => {
      const round = String(row.round) as KnockoutRound;
      const position = Number(row.position);
      const selectedTeam =
        typeof row.selected_team === "string" ? row.selected_team : "";
      const matchKey = pickKey(round, position);
      const match = lockedMatchByKey.get(matchKey);
      const summary = summaries.get(matchKey);
      const userId = userIdByBracketId.get(String(row.bracket_id));

      if (!match || !summary || !userId) {
        return;
      }

      const option = summary.options.find(
        (item) => item.teamName === selectedTeam,
      );

      if (!option) {
        return;
      }

      const profile = profileByUserId.get(userId);
      const user: KnockoutCommunityPickUser = {
        id: userId,
        name: profile?.name ?? "Participante",
        username: profile?.username ?? null,
        avatarUrl: profile?.avatarUrl ?? null,
        isCurrentUser: userId === input.currentUserId,
      };

      option.count += 1;
      option.users.push(user);
      summary.totalPicks += 1;

      if (user.isCurrentUser) {
        summary.userPick = selectedTeam;
      }
    });

    summaries.forEach((summary) => {
      summary.options = summary.options.map((option) => ({
        ...option,
        percentage: percentage(option.count, summary.totalPicks),
        users: [...option.users].sort((left, right) => {
          if (left.isCurrentUser !== right.isCurrentUser) {
            return left.isCurrentUser ? -1 : 1;
          }

          return left.name.localeCompare(right.name, "pt-BR");
        }),
      }));
    });

    return { summaries, error: null };
  } catch (error) {
    return {
      summaries: new Map<string, KnockoutCommunityPicksSummary>(),
      error: error instanceof Error ? error : new Error("Unknown error"),
    };
  }
}
