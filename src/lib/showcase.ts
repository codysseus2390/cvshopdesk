/**
 * Browser-side helpers for the temporary Showcase Mode. The flag is only a
 * presentation hint (badge, read-only interface); real access is the Supabase
 * session created by the passcode screen.
 */
import { useEffect, useState } from "react";
import type { PermissionKey } from "@/lib/permissions";

const KEY = "cv-showcase-mode";

export function markShowcase() {
  try {
    sessionStorage.setItem(KEY, "1");
  } catch {
    /* private browsing */
  }
}

export function clearShowcase() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* private browsing */
  }
}

export function isShowcase(): boolean {
  try {
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

/** Read-only tour: look around everywhere, change nothing. */
export const SHOWCASE_PERMISSIONS: PermissionKey[] = [
  "view_dashboard",
  "view_productivity",
  "access_tools",
  "use_assistant",
];

export const SHOWCASE_DISABLED_MESSAGE = "Disabled in Showcase Mode.";

export function useShowcaseMode(): boolean {
  const [showcase, setShowcase] = useState(false);
  useEffect(() => setShowcase(isShowcase()), []);
  return showcase;
}
