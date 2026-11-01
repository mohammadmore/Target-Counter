import { API_URL, DEFAULT_TARGET } from '../config';

export interface GoalPayload {
  slug: string;
  /** Raw stored config — always pass through normalizeConfig(). null = legacy Kiyan page. */
  config: unknown;
  score: number;
  target: number;
  updatedAt: number;
  hasEditorPassword?: boolean;
}

export interface GoalSummary {
  slug: string;
  name: string | null;
  score: number;
  target: number;
  updatedAt: number;
  hasEditorPassword: boolean;
}

export interface LoginResult {
  token: string;
  /** Unix seconds */
  expiresAt: number;
  scope: 'platform' | 'editor';
}

export interface SaveGoalInput {
  originalSlug: string | null;
  slug: string;
  config: unknown;
  target: number;
  score?: number;
  /** undefined/"" = keep, null = remove, string = set */
  editorPassword?: string | null;
}

export type ApiErrorCode =
  | 'unavailable'
  | 'not_configured'
  | 'not_found'
  | 'invalid_password'
  | 'too_many_attempts'
  | 'unauthorized'
  | 'invalid_score'
  | 'invalid_target'
  | 'score_exceeds_target'
  | 'invalid_slug'
  | 'slug_taken'
  | 'invalid_config'
  | 'weak_password'
  | 'file_too_large'
  | 'unsupported_file'
  | 'upload_failed'
  | 'server_error'
  | 'unknown';

export class ApiError extends Error {
  constructor(public readonly code: ApiErrorCode, public readonly status?: number) {
    super(code);
    this.name = 'ApiError';
  }
}

const KNOWN_CODES = new Set<string>([
  'not_configured', 'not_found', 'invalid_password', 'too_many_attempts', 'unauthorized', 'invalid_score',
  'invalid_target', 'score_exceeds_target', 'invalid_slug', 'slug_taken', 'invalid_config', 'weak_password',
  'file_too_large', 'unsupported_file', 'upload_failed', 'server_error',
]);

export const ERROR_MESSAGES: Record<ApiErrorCode, string> = {
  unavailable: 'ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی کنید.',
  not_configured: 'سرور هنوز پیکربندی نشده است (فایل kiyan-config.php).',
  not_found: 'این صفحه پیدا نشد.',
  invalid_password: 'رمز عبور اشتباه است.',
  too_many_attempts: 'تعداد تلاش‌های ناموفق زیاد بود. ۱۵ دقیقه دیگر دوباره امتحان کنید.',
  unauthorized: 'نشست شما منقضی شده است. لطفاً دوباره وارد شوید.',
  invalid_score: 'امتیاز وارد شده معتبر نیست.',
  invalid_target: 'هدف وارد شده معتبر نیست.',
  score_exceeds_target: 'امتیاز نمی‌تواند بیشتر از هدف باشد.',
  invalid_slug: 'آدرس صفحه فقط می‌تواند حروف کوچک انگلیسی، عدد و خط تیره باشد.',
  slug_taken: 'این آدرس قبلاً برای صفحه‌ی دیگری استفاده شده است.',
  invalid_config: 'تنظیمات صفحه معتبر نیست یا بیش از حد بزرگ است.',
  weak_password: 'رمز ویرایشگر باید حداقل ۶ کاراکتر باشد.',
  file_too_large: 'حجم فایل بیش از حد مجاز است (تصویر ۵ و فونت ۳ مگابایت).',
  unsupported_file: 'نوع فایل پشتیبانی نمی‌شود.',
  upload_failed: 'آپلود فایل ناموفق بود.',
  server_error: 'خطای سرور؛ تغییرات ذخیره نشد.',
  unknown: 'خطای ناشناخته رخ داد.',
};

export const messageFor = (err: unknown) => (err instanceof ApiError ? ERROR_MESSAGES[err.code] : ERROR_MESSAGES.unknown);

async function request<T>(init: RequestInit = {}, query = ''): Promise<T> {
  let response: Response;
  try {
    response = await fetch(API_URL + query, { cache: 'no-store', ...init });
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err;
    throw new ApiError('unavailable');
  }
  // e.g. the Vite dev server answers with index.html because PHP isn't running.
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) throw new ApiError('unavailable', response.status);

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ApiError('unavailable', response.status);
  }
  if (!response.ok) {
    const code = (body as { error?: string })?.error ?? '';
    throw new ApiError(KNOWN_CODES.has(code) ? (code as ApiErrorCode) : 'unknown', response.status);
  }
  return body as T;
}

const post = <T>(payload: Record<string, unknown>, token?: string) =>
  request<T>({
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(payload),
  });

interface Api {
  getGoal(slug: string | null, signal?: AbortSignal): Promise<GoalPayload>;
  login(password: string, goal?: string): Promise<LoginResult>;
  updateScore(token: string, goal: string, update: { score: number; target?: number }): Promise<GoalPayload>;
  list(token: string): Promise<{ goals: GoalSummary[]; defaultGoal: string | null }>;
  getForEdit(token: string, goal: string): Promise<GoalPayload>;
  save(token: string, input: SaveGoalInput): Promise<GoalPayload>;
  remove(token: string, goal: string): Promise<void>;
  setDefault(token: string, goal: string): Promise<void>;
  upload(token: string, kind: 'image' | 'font', file: File): Promise<{ url: string }>;
}

const realApi: Api = {
  getGoal: (slug, signal) => request<GoalPayload>({ signal }, slug ? `?goal=${encodeURIComponent(slug)}` : ''),
  login: (password, goal) => post<LoginResult>({ action: 'login', password, ...(goal ? { goal } : {}) }),
  updateScore: (token, goal, update) => post<GoalPayload>({ action: 'update', goal, ...update }, token),
  list: (token) => post({ action: 'list' }, token),
  getForEdit: (token, goal) => post({ action: 'get', goal }, token),
  save: (token, input) => post({ action: 'save', ...input }, token),
  remove: async (token, goal) => {
    await post({ action: 'delete', goal }, token);
  },
  setDefault: async (token, goal) => {
    await post({ action: 'setDefault', goal }, token);
  },
  upload: (token, kind, file) => {
    const form = new FormData();
    form.append('action', 'upload');
    form.append('kind', kind);
    form.append('file', file);
    return request({ method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  },
};

// ---------------------------------------------------------------------------
// Development stand-in (Vite dev server / AI Studio preview, where PHP isn't
// running). Stores everything in localStorage. Never used in production builds.
// ---------------------------------------------------------------------------
interface DevGoal {
  config: unknown;
  score: number;
  target: number;
  updatedAt: number;
  editorPassword: string | null;
}
interface DevDb {
  goals: Record<string, DevGoal>;
  defaultGoal: string | null;
}
const DEV_KEY = 'goal_platform_dev_db';
const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/;

function devDb(): DevDb {
  try {
    const db = JSON.parse(localStorage.getItem(DEV_KEY) ?? 'null');
    if (db?.goals) return db;
  } catch { /* ignore */ }
  return { goals: { kiyan: { config: null, score: 0, target: DEFAULT_TARGET, updatedAt: Date.now() / 1000, editorPassword: null } }, defaultGoal: 'kiyan' };
}
const devSave = (db: DevDb) => localStorage.setItem(DEV_KEY, JSON.stringify(db));
const devPayload = (slug: string, g: DevGoal): GoalPayload => ({
  slug,
  config: g.config,
  score: g.score,
  target: g.target,
  updatedAt: g.updatedAt,
  hasEditorPassword: !!g.editorPassword,
});
const devToken = (token: string) => {
  if (!token.startsWith('dev-')) throw new ApiError('unauthorized', 401);
};

const devApi: Api = {
  async getGoal(slug) {
    const db = devDb();
    const key = slug ?? db.defaultGoal;
    const goal = key ? db.goals[key] : undefined;
    if (!key || !goal) throw new ApiError('not_found', 404);
    return devPayload(key, goal);
  },
  async login(password) {
    if (!password) throw new ApiError('invalid_password', 401);
    return { token: 'dev-platform', expiresAt: Math.floor(Date.now() / 1000) + 43_200, scope: 'platform' };
  },
  async updateScore(token, slug, update) {
    devToken(token);
    const db = devDb();
    const goal = db.goals[slug];
    if (!goal) throw new ApiError('not_found', 404);
    const target = update.target ?? goal.target;
    if (update.score > target) throw new ApiError('score_exceeds_target', 400);
    Object.assign(goal, { score: update.score, target, updatedAt: Date.now() / 1000 });
    devSave(db);
    return devPayload(slug, goal);
  },
  async list(token) {
    devToken(token);
    const db = devDb();
    const goals = Object.entries(db.goals)
      .map(([slug, g]) => ({
        slug,
        name: (g.config as { name?: string } | null)?.name ?? null,
        score: g.score,
        target: g.target,
        updatedAt: g.updatedAt,
        hasEditorPassword: !!g.editorPassword,
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
    return { goals, defaultGoal: db.defaultGoal };
  },
  async getForEdit(token, slug) {
    devToken(token);
    return devApi.getGoal(slug);
  },
  async save(token, input) {
    devToken(token);
    const db = devDb();
    if (!SLUG.test(input.slug)) throw new ApiError('invalid_slug', 400);
    const existing = input.originalSlug ? db.goals[input.originalSlug] : undefined;
    if (input.originalSlug && !existing) throw new ApiError('not_found', 404);
    if (input.slug !== input.originalSlug && db.goals[input.slug]) throw new ApiError('slug_taken', 409);
    const score = input.score ?? existing?.score ?? 0;
    if (score > input.target) throw new ApiError('score_exceeds_target', 400);
    let editorPassword = existing?.editorPassword ?? null;
    if (input.editorPassword === null) editorPassword = null;
    else if (input.editorPassword) {
      if (input.editorPassword.length < 6) throw new ApiError('weak_password', 400);
      editorPassword = input.editorPassword;
    }
    if (input.originalSlug && input.originalSlug !== input.slug) {
      delete db.goals[input.originalSlug];
      if (db.defaultGoal === input.originalSlug) db.defaultGoal = input.slug;
    }
    db.goals[input.slug] = { config: input.config, score, target: input.target, updatedAt: Date.now() / 1000, editorPassword };
    db.defaultGoal ??= input.slug;
    devSave(db);
    return devPayload(input.slug, db.goals[input.slug]);
  },
  async remove(token, slug) {
    devToken(token);
    const db = devDb();
    delete db.goals[slug];
    if (db.defaultGoal === slug) db.defaultGoal = Object.keys(db.goals)[0] ?? null;
    devSave(db);
  },
  async setDefault(token, slug) {
    devToken(token);
    const db = devDb();
    if (!db.goals[slug]) throw new ApiError('not_found', 404);
    db.defaultGoal = slug;
    devSave(db);
  },
  async upload(token, _kind, file) {
    devToken(token);
    // No server to store files: keep it in memory for this browser session.
    return { url: URL.createObjectURL(file) };
  },
};

let useDevApi = false;

async function withFallback<T>(call: (api: Api) => Promise<T>): Promise<T> {
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

export const isDevStorage = () => useDevApi;

export const api: Api = {
  getGoal: (slug, signal) => withFallback((a) => a.getGoal(slug, signal)),
  login: (password, goal) => withFallback((a) => a.login(password, goal)),
  updateScore: (token, goal, update) => withFallback((a) => a.updateScore(token, goal, update)),
  list: (token) => withFallback((a) => a.list(token)),
  getForEdit: (token, goal) => withFallback((a) => a.getForEdit(token, goal)),
  save: (token, input) => withFallback((a) => a.save(token, input)),
  remove: (token, goal) => withFallback((a) => a.remove(token, goal)),
  setDefault: (token, goal) => withFallback((a) => a.setDefault(token, goal)),
  upload: (token, kind, file) => withFallback((a) => a.upload(token, kind, file)),
};

// ---------------------------------------------------------------------------
// Token storage (sessionStorage; cleared when the browser tab closes)
// ---------------------------------------------------------------------------
const tokenKey = (scope: string) => `goal_token_${scope}`;

export function loadToken(scope: 'platform' | string): string | null {
  try {
    const stored = JSON.parse(sessionStorage.getItem(tokenKey(scope)) ?? 'null');
    if (stored?.token && stored.expiresAt * 1000 > Date.now()) return stored.token;
  } catch { /* ignore */ }
  sessionStorage.removeItem(tokenKey(scope));
  return null;
}

export function storeToken(scope: 'platform' | string, result: LoginResult) {
  sessionStorage.setItem(tokenKey(scope), JSON.stringify({ token: result.token, expiresAt: result.expiresAt }));
}

export function clearToken(scope: 'platform' | string) {
  sessionStorage.removeItem(tokenKey(scope));
}
