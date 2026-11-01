/** Fallback target used until the server answers (the real value lives in the database). */
export const DEFAULT_TARGET = 60_000_000;

/** Score/target are edited with 8 digit wheels, so this is the largest storable value. */
export const MAX_DIGITS = 8;
export const MAX_VALUE = 10 ** MAX_DIGITS - 1;

/** How often viewers refresh the score from the server. */
export const POLL_INTERVAL_MS = 5_000;

export const API_URL = './api.php';
