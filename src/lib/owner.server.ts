// Trusted identity resolution for ownership decisions.
// Never derive ownership from JWT claims: `user_metadata` (and any client-supplied
// email) is user-editable. We look the account up in the auth store instead and
// require a confirmed email address.
export const OWNER_EMAIL = "codysseus2390@gmail.com";

export interface TrustedIdentity {
  /** Confirmed email from the auth store, normalized. Null when unconfirmed/absent. */
  email: string | null;
  emailConfirmed: boolean;
  isOwner: boolean;
}

/** Pure decision logic, exported for tests. */
export function evaluateIdentity(user: {
  email?: string | null;
  email_confirmed_at?: string | null;
}): TrustedIdentity {
  const raw = typeof user.email === "string" ? user.email.trim().toLowerCase() : null;
  const emailConfirmed = Boolean(user.email_confirmed_at);
  return {
    email: raw,
    emailConfirmed,
    isOwner: emailConfirmed && raw === OWNER_EMAIL,
  };
}

/** Reads the account from the auth store using the verified user id from the bearer token. */
export async function trustedIdentity(userId: string): Promise<TrustedIdentity> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error || !data?.user) return { email: null, emailConfirmed: false, isOwner: false };
  return evaluateIdentity(data.user);
}
