import { createClient } from "@supabase/supabase-js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const TARGET_POOL_ID = "f1e55c1a-1ce4-44a3-ad30-328bfb2f45fb";
const APPLY_CHANGES = process.argv.includes("--apply");

function loadEnvFile(path) {
  if (!existsSync(path)) return;

  const content = readFileSync(path, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    process.env[key] ??= rawValue.replace(/^["']|["']$/g, "");
  }
}

function projectRef(url) {
  try {
    return new URL(url).hostname.split(".")[0];
  } catch {
    return "unknown";
  }
}

function byName(a, b) {
  return (a.name || "").localeCompare(b.name || "", "pt-BR", {
    sensitivity: "base",
  });
}

async function fetchAll(supabase, table, select) {
  const pageSize = 1000;
  const rows = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .range(from, from + pageSize - 1);

    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data ?? []));

    if (!data || data.length < pageSize) return rows;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");
loadEnvFile(".env.scores.local");

const url =
  process.env.SCORE_SUPABASE_PRODUCTION_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey =
  process.env.SCORE_SUPABASE_PRODUCTION_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error("Missing production Supabase URL or service role key");
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false },
});

const [pools, poolMembers, profiles] = await Promise.all([
  fetchAll(supabase, "pools", "id,name,type,is_default,owner_id,created_at"),
  fetchAll(supabase, "pool_members", "id,pool_id,user_id,role,created_at"),
  fetchAll(supabase, "profiles", "id,name,username"),
]);

const poolsById = new Map(pools.map((pool) => [pool.id, pool]));
const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
const targetPool = poolsById.get(TARGET_POOL_ID);
const targetMemberships = poolMembers.filter(
  (member) => member.pool_id === TARGET_POOL_ID,
);
const targetUserIds = new Set(targetMemberships.map((member) => member.user_id));
const extraMemberships = poolMembers
  .filter(
    (member) =>
      targetUserIds.has(member.user_id) && member.pool_id !== TARGET_POOL_ID,
  )
  .map((member) => {
    const profile = profilesById.get(member.user_id) ?? {};
    const pool = poolsById.get(member.pool_id) ?? {};

    return {
      membership_id: member.id,
      user_id: member.user_id,
      name: profile.name ?? null,
      username: profile.username ?? null,
      role: member.role,
      other_pool_id: member.pool_id,
      other_pool_name: pool.name ?? null,
      other_pool_type: pool.type ?? null,
      other_pool_is_default: pool.is_default ?? null,
      membership_created_at: member.created_at,
    };
  })
  .sort((a, b) => byName(a, b) || a.other_pool_name.localeCompare(b.other_pool_name));

if (APPLY_CHANGES && extraMemberships.length > 0) {
  mkdirSync("backups", { recursive: true });

  const backupPath = `backups/pool_members_cleanup_${new Date()
    .toISOString()
    .replace(/[:.]/g, "-")}.json`;

  writeFileSync(
    backupPath,
    JSON.stringify(
      {
        target_pool_id: TARGET_POOL_ID,
        extra_memberships_to_remove: extraMemberships,
      },
      null,
      2,
    ),
    "utf8",
  );

  const idsToDelete = extraMemberships.map(
    (membership) => membership.membership_id,
  );
  const { data: deletedRows, error: deleteError } = await supabase
    .from("pool_members")
    .delete()
    .in("id", idsToDelete)
    .select("id,pool_id,user_id,role,created_at");

  if (deleteError) {
    throw new Error(`pool_members cleanup: ${deleteError.message}`);
  }

  console.log(
    JSON.stringify(
      {
        applied: true,
        backup_path: backupPath,
        requested_deletes: idsToDelete.length,
        deleted_rows: deletedRows?.length ?? 0,
      },
      null,
      2,
    ),
  );
}

const targetParticipants = targetMemberships
  .map((member) => {
    const profile = profilesById.get(member.user_id) ?? {};
    return {
      user_id: member.user_id,
      name: profile.name ?? null,
      username: profile.username ?? null,
      role: member.role,
      member_since: member.created_at,
      extra_memberships: extraMemberships.filter(
        (extra) => extra.user_id === member.user_id,
      ).length,
    };
  })
  .sort(byName);

const otherPoolsSummary = new Map();
for (const membership of extraMemberships) {
  const key = `${membership.other_pool_id}|${membership.other_pool_name}`;
  otherPoolsSummary.set(key, (otherPoolsSummary.get(key) ?? 0) + 1);
}

console.log(
  JSON.stringify(
    {
      target: "production",
      project_ref: projectRef(url),
      target_pool: targetPool ?? null,
      target_participants_count: targetParticipants.length,
      extra_memberships_count: extraMemberships.length,
      other_pools_summary: Array.from(otherPoolsSummary.entries()).map(
        ([key, count]) => {
          const [pool_id, pool_name] = key.split("|");
          return { pool_id, pool_name, count };
        },
      ),
      target_participants: targetParticipants,
      extra_memberships_to_remove: extraMemberships,
    },
    null,
    2,
  ),
);
