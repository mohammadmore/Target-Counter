/** Fallback target used until the server answers (the real value lives in the database). */
export const DEFAULT_TARGET = 60_000_000;

/** Largest score/target the server accepts (15 digits keeps JS numbers exact). */
export const MAX_DIGITS = 15;
export const MAX_VALUE = 10 ** MAX_DIGITS - 1;

/** How often viewers refresh the score from the server. */
export const POLL_INTERVAL_MS = 5_000;

export const API_URL = './api.php';
