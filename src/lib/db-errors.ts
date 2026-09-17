/**
 * Turns raw database errors into messages that are safe and meaningful to show
 * a teacher. Raw Postgres/PostgREST text ("permission denied for table
 * worksheet_versions", constraint names, column lists) leaks schema details and
 * means nothing to the user, so the details are logged server-side and a plain
 * sentence is thrown instead.
 */
export interface DbErrorLike {
  message?: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
}

const BY_CODE: Record<string, string> = {
  "23505": "That item already exists.",
  "23503": "That item is still linked to something else and can't be changed.",
  "23502": "Some required information is missing.",
  "22001": "One of the fields is too long.",
  "42501": "You don't have permission to do that.",
  PGRST116: "We couldn't find that item.",
  PGRST301: "Your session expired. Please sign in again.",
};

/**
 * @param err      the Supabase/Postgres error object (may be null)
 * @param fallback user-facing sentence used when the code isn't recognised
 * @param where    short tag for the server log, e.g. "saveWorksheet"
 */
export function dbError(err: DbErrorLike | null | undefined, fallback: string, where?: string): Error {
  if (err) {
    // Server-side only: full detail for debugging, never sent to the browser.
    console.error(`[db${where ? `:${where}` : ""}]`, {
      code: err.code,
      message: err.message,
      details: err.details,
      hint: err.hint,
    });
  }
  const friendly = (err?.code && BY_CODE[err.code]) || fallback;
  return new Error(friendly);
}
