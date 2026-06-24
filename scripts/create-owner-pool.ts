import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import {
  getScriptSupabaseConfig,
  loadScriptEnvFiles,
} from "../lib/supabase/scriptEnv";

type SetupDatabase = {
  public: {
    Tables: {
      pools: {
        Row: {
          id: string;
          name: string;
          owner_id: string;
        };
        Insert: {
          name: string;
          owner_id: string;
        };
        Update: Partial<SetupDatabase["public"]["Tables"]["pools"]["Insert"]>;
        Relationships: [];
      };
      pool_members: {
        Row: {
          id: string;
          pool_id: string;
          user_id: string;
          role: "owner" | "member";
        };
        Insert: {
          pool_id: string;
          user_id: string;
          role: "owner" | "member";
        };
        Update: Partial<
          SetupDatabase["public"]["Tables"]["pool_members"]["Insert"]
        >;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

type SetupSupabaseClient = SupabaseClient<SetupDatabase>;

type Args = {
  email?: string;
  userId?: string;
  poolName?: string;
  help?: boolean;
};

type AuthUser = {
  id: string;
  email?: string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function printHelp() {
  console.log(`
Usage:
  npm run setup:owner-pool -- --email dono@example.com --pool-name "Bolao da Copa 2026"
  npm run setup:owner-pool -- --user-id <auth-user-id> --pool-name "Bolao da Copa 2026"

Options:
  --email, --user-email     Auth user email to locate in Supabase Auth.
  --user-id                 Auth user id from auth.users.
  --pool-name, --name       Pool name to create or reuse for this owner.
  --help                    Show this help.
`);
}

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  const positional: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const [key, inlineValue] = arg.split("=", 2);

    if (key === "--help" || key === "-h") {
      args.help = true;
      continue;
    }

    if (key === "--email" || key === "--user-email") {
      args.email = inlineValue ?? argv[index + 1];
      if (!inlineValue) index += 1;
      continue;
    }

    if (key === "--user-id") {
      args.userId = inlineValue ?? argv[index + 1];
      if (!inlineValue) index += 1;
      continue;
    }

    if (key === "--pool-name" || key === "--name") {
      args.poolName = inlineValue ?? argv[index + 1];
      if (!inlineValue) index += 1;
      continue;
    }

    positional.push(arg);
  }

  const [userIdentifier, ...poolNameParts] = positional;

  if (!args.email && !args.userId && userIdentifier) {
    if (UUID_PATTERN.test(userIdentifier)) {
      args.userId = userIdentifier;
    } else {
      args.email = userIdentifier;
    }
  }

  if (!args.poolName && poolNameParts.length > 0) {
    args.poolName = poolNameParts.join(" ");
  }

  return args;
}

async function promptForMissingArgs(args: Args) {
  if ((args.email || args.userId) && args.poolName) {
    return args;
  }

  const readline = createInterface({ input, output });

  try {
    if (!args.email && !args.userId) {
      const userIdentifier = (
        await readline.question("User email ou user id: ")
      ).trim();

      if (UUID_PATTERN.test(userIdentifier)) {
        args.userId = userIdentifier;
      } else {
        args.email = userIdentifier;
      }
    }

    if (!args.poolName) {
      args.poolName = (await readline.question("Nome do bolao: ")).trim();
    }
  } finally {
    readline.close();
  }

  return args;
}

function validateArgs(args: Args) {
  args.email = args.email?.trim();
  args.userId = args.userId?.trim();
  args.poolName = args.poolName?.trim();

  if (args.email && args.userId) {
    throw new Error("Use either --email or --user-id, not both.");
  }

  if (!args.email && !args.userId) {
    throw new Error("Missing user identifier. Use --email or --user-id.");
  }

  if (args.userId && !UUID_PATTERN.test(args.userId)) {
    throw new Error("--user-id must be a valid UUID.");
  }

  if (!args.poolName) {
    throw new Error("Missing pool name. Use --pool-name.");
  }
}

async function findUserByEmail(
  supabase: SetupSupabaseClient,
  email: string,
): Promise<AuthUser> {
  const normalizedEmail = email.toLowerCase();
  let page = 1;
  const perPage = 100;

  while (page <= 1000) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw error;
    }

    const users = data.users ?? [];
    const user = users.find(
      (candidate) => candidate.email?.toLowerCase() === normalizedEmail,
    );

    if (user) {
      return {
        id: user.id,
        email: user.email,
      };
    }

    const nextPage = (data as { nextPage?: number | null }).nextPage;

    if (nextPage) {
      page = nextPage;
      continue;
    }

    if (users.length < perPage) {
      break;
    }

    page += 1;
  }

  throw new Error(`Auth user not found for email: ${email}`);
}

async function findUserById(
  supabase: SetupSupabaseClient,
  userId: string,
): Promise<AuthUser> {
  const { data, error } = await supabase.auth.admin.getUserById(userId);

  if (error) {
    throw error;
  }

  if (!data.user) {
    throw new Error(`Auth user not found for id: ${userId}`);
  }

  return {
    id: data.user.id,
    email: data.user.email,
  };
}

async function findOrCreatePool(
  supabase: SetupSupabaseClient,
  userId: string,
  poolName: string,
) {
  const { data: existingPool, error: findError } = await supabase
    .from("pools")
    .select("id, name, owner_id")
    .eq("owner_id", userId)
    .eq("name", poolName)
    .limit(1)
    .maybeSingle();

  if (findError) {
    throw findError;
  }

  if (existingPool) {
    return {
      pool: existingPool,
      created: false,
    };
  }

  const { data: createdPool, error: createError } = await supabase
    .from("pools")
    .insert({
      name: poolName,
      owner_id: userId,
    })
    .select("id, name, owner_id")
    .single();

  if (createError) {
    throw createError;
  }

  return {
    pool: createdPool,
    created: true,
  };
}

async function ensureOwnerMembership(
  supabase: SetupSupabaseClient,
  poolId: string,
  userId: string,
) {
  const { data: existingMember, error: findError } = await supabase
    .from("pool_members")
    .select("id, pool_id, user_id, role")
    .eq("pool_id", poolId)
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (findError) {
    throw findError;
  }

  if (!existingMember) {
    const { data: createdMember, error: createError } = await supabase
      .from("pool_members")
      .insert({
        pool_id: poolId,
        user_id: userId,
        role: "owner",
      })
      .select("id, pool_id, user_id, role")
      .single();

    if (createError) {
      throw createError;
    }

    return {
      membership: createdMember,
      action: "created",
    };
  }

  if (existingMember.role === "owner") {
    return {
      membership: existingMember,
      action: "already-owner",
    };
  }

  const { data: updatedMember, error: updateError } = await supabase
    .from("pool_members")
    .update({ role: "owner" })
    .eq("id", existingMember.id)
    .select("id, pool_id, user_id, role")
    .single();

  if (updateError) {
    throw updateError;
  }

  return {
    membership: updatedMember,
    action: "updated-to-owner",
  };
}

async function main() {
  const parsedArgs = parseArgs(process.argv.slice(2));

  if (parsedArgs.help) {
    printHelp();
    return;
  }

  const args = await promptForMissingArgs(parsedArgs);
  validateArgs(args);

  loadScriptEnvFiles();

  const supabaseConfig = getScriptSupabaseConfig();

  const supabase = createClient<SetupDatabase>(
    supabaseConfig.url,
    supabaseConfig.serviceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

  console.log("Resolving owner user...");
  const user = args.userId
    ? await findUserById(supabase, args.userId)
    : await findUserByEmail(supabase, args.email as string);
  console.log(`Owner user: ${user.email ?? "(no email)"} (${user.id})`);

  console.log("Creating or reusing pool...");
  const { pool, created: poolCreated } = await findOrCreatePool(
    supabase,
    user.id,
    args.poolName as string,
  );
  console.log(
    `${poolCreated ? "Created" : "Reused"} pool: ${pool.name} (${pool.id})`,
  );

  console.log("Ensuring owner membership...");
  const { membership, action } = await ensureOwnerMembership(
    supabase,
    pool.id,
    user.id,
  );
  console.log(`Membership ${action}: ${membership.id} (${membership.role})`);

  console.log("Done.");
}

main().catch((error: unknown) => {
  console.error("Owner pool setup failed.");
  console.error(error);
  process.exitCode = 1;
});
