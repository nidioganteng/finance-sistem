/**
 * Auth helpers — static-export version.
 * NextAuth is no longer used; authentication is handled via AuthContext (localStorage JWT).
 */

/** Backward-compatibility stub — ID sudah ada di AuthContext user */
export async function resolveStaffId(_userId?: string, _userEmail?: string | null): Promise<string> {
  return _userId ?? "";
}
