import { API_URL, DEFAULT_TARGET } from '../config';

export interface ScoreData {
  score: number;
  target: number;
}

export interface LoginResult {
  token: string;
  /** Unix seconds */
  expiresAt: number;
}

export type ApiErrorCode =
  | 'unavailable'
  | 'not_configured'
  | 'invalid_password'
  | 'too_many_attempts'
  | 'unauthorized'
  | 'invalid_score'
  | 'invalid_target'
  | 'score_exceeds_target'
  | 'server_error'
  | 'unknown';

export class ApiError extends Error {
  constructor(public readonly code: ApiErrorCode, public readonly status?: number) {
    super(code);
    this.name = 'ApiError';
  }
}

const KNOWN_CODES = new Set<ApiErrorCode>([
  'not_configured', 'invalid_password', 'too_many_attempts', 'unauthorized',
  'invalid_score', 'invalid_target', 'score_exceeds_target', 'server_error',
]);

function isScoreData(value: unknown): value is ScoreData {
  const v = value as ScoreData;
  return !!v && Number.isFinite(v.score) && Number.isFinite(v.target);
}

async function request<T>(init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(API_URL, { cache: 'no-store', ...init });
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err;
    throw new ApiError('unavailable');
  }

  // e.g. the Vite dev server answers with index.html because PHP isn't running.
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new ApiError('unavailable', response.status);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ApiError('unavailable', response.status);
  }

  if (!response.ok) {
    const code = (body as { error?: string })?.error as ApiErrorCode;
    throw new ApiError(KNOWN_CODES.has(code) ? code : 'unknown', response.status);
  }
  return body as T;
}

const realApi = {
  async getScore(signal?: AbortSignal): Promise<ScoreData> {
    const data = await request<unknown>({ signal });
    if (!isScoreData(data)) throw new ApiError('unavailable');
    return { score: data.score, target: data.target };
  },

  login(password: string): Promise<LoginResult> {
    return request<LoginResult>({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'login', password }),
    });
  },

  async updateScore(token: string, update: ScoreData): Promise<ScoreData> {
    const data = await request<unknown>({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: 'update', ...update }),
    });
    if (!isScoreData(data)) throw new ApiError('unavailable');
    return data;
  },
};

/**
 * Development-only stand-in used when PHP isn't available (Vite dev server,
 * AI Studio preview). Never included in production behaviour.
 */
const DEV_STORAGE_KEY = 'kiyan_dev_score';
const devApi: typeof realApi = {
  async getScore() {
    try {
      const stored = JSON.parse(localStorage.getItem(DEV_STORAGE_KEY) ?? 'null');
      if (isScoreData(stored)) return stored;
    } catch { /* ignore */ }
    return { score: 0, target: DEFAULT_TARGET };
  },
  async login(password) {
    if (!password) throw new ApiError('invalid_password', 401);
    return { token: 'dev-token', expiresAt: Math.floor(Date.now() / 1000) + 43_200 };
  },
  async updateScore(_token, update) {
    if (update.score > update.target) throw new ApiError('score_exceeds_target', 400);
    localStorage.setItem(DEV_STORAGE_KEY, JSON.stringify(update));
    return update;
  },
};

let useDevApi = false;

async function withDevFallback<T>(call: (api: typeof realApi) => Promise<T>): Promise<T> {
  if (useDevApi) return call(devApi);
  try {
    return await call(realApi);
  } catch (err) {
    if (import.meta.env.DEV && err instanceof ApiError && err.code === 'unavailable') {
      console.info('[api] PHP backend not reachable — using local dev storage.');
      useDevApi = true;
      return call(devApi);
    }
    throw err;
  }
}

export const api = {
  getScore: (signal?: AbortSignal) => withDevFallback((a) => a.getScore(signal)),
  login: (password: string) => withDevFallback((a) => a.login(password)),
  updateScore: (token: string, update: ScoreData) => withDevFallback((a) => a.updateScore(token, update)),
};
