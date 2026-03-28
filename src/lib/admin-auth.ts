export const ADMIN_ID_PATTERN = /^[a-z0-9._-]{3,32}$/;

export function normalizeAdminId(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

/** Synthetic auth email used for admin control-room accounts. */
export function adminEmailFromId(adminId: string) {
  return `${adminId}@admin.driveforgood.local`;
}

interface CreateAdminAccountInput {
  adminId: string;
  password: string;
  fullName: string;
}

export async function createAdminAccount(
  supabaseAdmin: {
    auth: {
      admin: {
        createUser: (args: {
          email: string;
          password: string;
          email_confirm: boolean;
          user_metadata?: Record<string, unknown>;
        }) => Promise<{ data: { user: { id: string } | null }; error: { message: string } | null }>;
        deleteUser: (userId: string) => Promise<unknown>;
      };
    };
    from: (table: string) => {
      insert: (values: Record<string, unknown>) => PromiseLike<{ error: { message: string } | null }>;
    };
  },
  input: CreateAdminAccountInput
) {
  const email = adminEmailFromId(input.adminId);

  const { data: createdAuth, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.fullName },
  });

  if (createAuthError || !createdAuth.user) {
    return {
      error: createAuthError?.message ?? "Unable to create admin auth credentials.",
      authUserId: null,
      email,
    };
  }

  const { error: insertError } = await supabaseAdmin.from("users").insert({
    auth_user_id: createdAuth.user.id,
    email,
    full_name: input.fullName,
    role: "admin",
  });

  if (insertError) {
    await supabaseAdmin.auth.admin.deleteUser(createdAuth.user.id);
    return {
      error: insertError.message,
      authUserId: null,
      email,
    };
  }

  return {
    error: null,
    authUserId: createdAuth.user.id,
    email,
  };
}
