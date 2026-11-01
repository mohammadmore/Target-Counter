import { API_URL, DEFAULT_TARGET } from '../config';

export const CONTACT_TYPES = ['website', 'email', 'phone', 'whatsapp', 'telegram', 'instagram', 'linkedin', 'link'] as const;
export type ContactType = (typeof CONTACT_TYPES)[number];

export interface Contact {
  type: ContactType;
  value: string;
  label: string;
}

/** The studio's own branding, shown in the credit on every page. */
export interface PlatformProfile {
  /** Logo for light backgrounds ("uploads/…" or https). Empty = built-in mark. */
  logoLight: string;
  /** Logo for dark backgrounds. */
  logoDark: string;
  contacts: Contact[];
}

export const EMPTY_PROFILE: PlatformProfile = { logoLight: '', logoDark: '', contacts: [] };

export interface GoalPayload {
  slug: string;
  /** Raw stored config — always pass through normalizeConfig(). null = legacy Kiyan page. */
  config: unknown;
  score: number;
  target: number;
  updatedAt: number;
  /** Unix seconds of the last score change. */
  scoreUpdatedAt: number;
  /** True when this payload shows an unpublished draft (preview link). */
  isDraft: boolean;
  /** Included by the server so the credit needs no extra request. */
  platform?: PlatformProfile;
}

export interface StudioGoal extends GoalPayload {
  draft: { config: unknown; target: number } | null;
  draftToken: string | null;
  published: boolean;
  hasEditorPassword: boolean;
}

export interface GoalSummary {
  slug: string;
  name: string | null;
  score: number;
  target: number;
  updatedAt: number;
  scoreUpdatedAt: number;
  hasEditorPassword: boolean;
  hasDraft: boolean;
  published: boolean;
}

export interface HistoryEntry {
  id: number;
  kind: 'add' | 'set' | 'undo';
  oldScore: number;
  newScore: number;
  actor: 'platform' | 'editor';
  note: string | null;
  reverted: boolean;
  at: number;
}

export interface LoginResult {
  token: string;
  /** Unix seconds */
  expiresAt: number;
  scope: 'platform' | 'editor';
}

export type ScoreUpdate =
  | { mode: 'add'; amount: number; note?: string }
  | { mode: 'set'; score: number; expectedScore?: number; note?: string; target?: number };

export interface SaveGoalInput {
  originalSlug: string | null;
  slug: string;
  config: unknown;
  target: number;
  /** false = save as draft (live page unchanged). */
  publish: boolean;
  /** Only sent when the admin explicitly changed it. */
  score?: number;
  expectedScore?: number;
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
  | 'forbidden'
  | 'invalid_score'
  | 'invalid_target'
  | 'score_exceeds_target'
  | 'below_zero'
  | 'score_changed'
  | 'cannot_undo'
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
  constructor(
    public readonly code: ApiErrorCode,
    public readonly status?: number,
    /** Server-provided extras, e.g. the current score on conflicts. */
    public readonly details: { current?: number } = {},
  ) {
    super(code);
    this.name = 'ApiError';
  }
}

const KNOWN_CODES = new Set<string>([
  'not_configured', 'not_found', 'invalid_password', 'too_many_attempts', 'unauthorized', 'forbidden', 'invalid_score',
  'invalid_target', 'score_exceeds_target', 'below_zero', 'score_changed', 'cannot_undo', 'invalid_slug', 'slug_taken',
  'invalid_config', 'weak_password', 'file_too_large', 'unsupported_file', 'upload_failed', 'server_error',
]);

/** Persian messages for the studio (the score editor has its own fa/ar/en copy). */
export const ERROR_MESSAGES: Record<ApiErrorCode, string> = {
  unavailable: 'ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی کنید.',
  not_configured: 'سرور هنوز پیکربندی نشده است (فایل kiyan-config.php).',
  not_found: 'این صفحه پیدا نشد.',
  invalid_password: 'رمز عبور اشتباه است.',
  too_many_attempts: 'تعداد تلاش‌های ناموفق زیاد بود. ۱۵ دقیقه دیگر دوباره امتحان کنید.',
  unauthorized: 'نشست شما منقضی شده است. لطفاً دوباره وارد شوید.',
  forbidden: 'شما اجازه‌ی این کار را ندارید.',
  invalid_score: 'عدد وارد شده معتبر نیست.',
  invalid_target: 'هدف وارد شده معتبر نیست.',
  score_exceeds_target: 'امتیاز نمی‌تواند بیشتر از هدف باشد.',
  below_zero: 'امتیاز نمی‌تواند کمتر از صفر شود.',
  score_changed: 'در این فاصله امتیاز توسط شخص دیگری تغییر کرده است.',
  cannot_undo: 'این ثبت دیگر قابل برگشت نیست.',
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
  return parseResponse<T>(response);
}

/** Shared with the early prefetch started in index.html. */
export async function parseResponse<T>(response: Response): Promise<T> {
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
    const b = body as { error?: string; current?: number };
    const code = b?.error ?? '';
    throw new ApiError(KNOWN_CODES.has(code) ? (code as ApiErrorCode) : 'unknown', response.status, { current: b?.current });
  }
  return body as T;
}

const post = <T>(payload: Record<string, unknown>, token?: string) =>
  request<T>({
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(payload),
  });

export const goalQuery = (slug: string | null, draftToken?: string | null) => {
  const q = new URLSearchParams();
  if (slug) q.set('goal', slug);
  if (draftToken) q.set('draft', draftToken);
  const s = q.toString();
  return s ? `?${s}` : '';
};

interface Api {
  getGoal(slug: string | null, signal?: AbortSignal, draftToken?: string | null): Promise<GoalPayload>;
  login(password: string, goal?: string, remember?: boolean): Promise<LoginResult>;
  updateScore(token: string, goal: string, update: ScoreUpdate): Promise<GoalPayload & { entryId: number | null }>;
  history(token: string, goal: string): Promise<{ entries: HistoryEntry[]; undoableId: number | null }>;
  undo(token: string, goal: string, entryId: number): Promise<GoalPayload>;
  list(token: string): Promise<{ goals: GoalSummary[]; defaultGoal: string | null; platform?: PlatformProfile }>;
  getPlatform(): Promise<PlatformProfile>;
  savePlatform(token: string, profile: PlatformProfile): Promise<PlatformProfile>;
  getForEdit(token: string, goal: string): Promise<StudioGoal>;
  save(token: string, input: SaveGoalInput): Promise<StudioGoal>;
  discardDraft(token: string, goal: string): Promise<StudioGoal>;
  remove(token: string, goal: string): Promise<void>;
  setDefault(token: string, goal: string): Promise<void>;
  upload(token: string, kind: 'image' | 'font', file: File): Promise<{ url: string }>;
}

const realApi: Api = {
  getGoal: (slug, signal, draftToken) => request<GoalPayload>({ signal }, goalQuery(slug, draftToken)),
  login: (password, goal, remember) => post<LoginResult>({ action: 'login', password, remember: !!remember, ...(goal ? { goal } : {}) }),
  updateScore: (token, goal, update) => post({ action: 'update', goal, ...update }, token),
  history: (token, goal) => post({ action: 'history', goal }, token),
  undo: (token, goal, entryId) => post({ action: 'undo', goal, entryId }, token),
  list: (token) => post({ action: 'list' }, token),
  getPlatform: () => request<PlatformProfile>({}, '?platform'),
  savePlatform: (token, profile) => post({ action: 'savePlatform', profile }, token),
  getForEdit: (token, goal) => post({ action: 'get', goal }, token),
  save: (token, input) => post({ action: 'save', ...input }, token),
  discardDraft: (token, goal) => post({ action: 'discardDraft', goal }, token),
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
// running). Mirrors the PHP semantics in localStorage. Never used in production.
// ---------------------------------------------------------------------------
interface DevGoal {
  config: unknown;
  score: number;
  target: number;
  updatedAt: number;
  scoreUpdatedAt: number;
  editorPassword: string | null;
  draft: { config: unknown; target: number } | null;
  draftToken: string;
  published: boolean;
}
interface DevDb {
  goals: Record<string, DevGoal>;
  aliases: Record<string, string>;
  log: (HistoryEntry & { slug: string })[];
  defaultGoal: string | null;
  platform?: PlatformProfile;
}
const DEV_KEY = 'goal_platform_dev_db_v2';
const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/;
const now = () => Math.floor(Date.now() / 1000);

function devDb(): DevDb {
  try {
    const db = JSON.parse(localStorage.getItem(DEV_KEY) ?? 'null');
    if (db?.goals) return db;
  } catch { /* ignore */ }
  return {
    goals: {
      kiyan: { config: null, score: 0, target: DEFAULT_TARGET, updatedAt: now(), scoreUpdatedAt: now(), editorPassword: null, draft: null, draftToken: 'dev-kiyan', published: true },
    },
    aliases: {},
    log: [],
    defaultGoal: 'kiyan',
  };
}
const devSave = (db: DevDb) => localStorage.setItem(DEV_KEY, JSON.stringify(db));
const devResolve = (db: DevDb, slug: string | null) => {
  const key = slug && db.goals[slug] ? slug : slug ? db.aliases[slug] : db.defaultGoal;
  if (!key || !db.goals[key]) throw new ApiError('not_found', 404);
  return key;
};
const devPublic = (slug: string, g: DevGoal, draft = false): GoalPayload => ({
  slug,
  config: draft && g.draft ? g.draft.config : g.config,
  score: g.score,
  target: draft && g.draft ? g.draft.target : g.target,
  updatedAt: g.updatedAt,
  scoreUpdatedAt: g.scoreUpdatedAt,
  isDraft: draft,
});
const devStudio = (slug: string, g: DevGoal): StudioGoal => ({
  ...devPublic(slug, g),
  draft: g.draft,
  draftToken: g.draftToken,
  published: g.published,
  hasEditorPassword: !!g.editorPassword,
});
const devAuth = (token: string) => {
  if (!token.startsWith('dev-')) throw new ApiError('unauthorized', 401);
};
const devLog = (db: DevDb, slug: string, kind: HistoryEntry['kind'], oldScore: number, newScore: number, note: string | null) => {
  const id = (db.log.at(-1)?.id ?? 0) + 1;
  db.log.push({ id, slug, kind, oldScore, newScore, actor: 'platform', note, reverted: false, at: now() });
  return id;
};

const devApi: Api = {
  async getGoal(slug, _signal, draftToken) {
    const db = devDb();
    const key = devResolve(db, slug);
    const g = db.goals[key];
    const previewing = !!draftToken && draftToken === g.draftToken;
    if (!g.published && !previewing) throw new ApiError('not_found', 404);
    return { ...devPublic(key, g, previewing), platform: db.platform ?? EMPTY_PROFILE };
  },
  async getPlatform() {
    return devDb().platform ?? EMPTY_PROFILE;
  },
  async savePlatform(token, profile) {
    devAuth(token);
    const db = devDb();
    db.platform = { ...profile, contacts: profile.contacts.filter((c) => c.value.trim()).slice(0, 12) };
    devSave(db);
    return db.platform;
  },
  async login(password) {
    if (!password) throw new ApiError('invalid_password', 401);
    return { token: 'dev-platform', expiresAt: now() + 43_200, scope: 'platform' };
  },
  async updateScore(token, slug, update) {
    devAuth(token);
    const db = devDb();
    const key = devResolve(db, slug);
    const g = db.goals[key];
    const old = g.score;
    const target = update.mode === 'set' && update.target !== undefined ? update.target : g.target;
    let next: number;
    if (update.mode === 'add') next = old + update.amount;
    else {
      if (update.expectedScore !== undefined && update.expectedScore !== old) throw new ApiError('score_changed', 409, { current: old });
      next = update.score;
    }
    if (next < 0) throw new ApiError('below_zero', 400, { current: old });
    if (next > target) throw new ApiError('score_exceeds_target', 400, { current: old });
    g.target = target;
    let entryId: number | null = null;
    if (next !== old) {
      g.score = next;
      g.scoreUpdatedAt = now();
      entryId = devLog(db, key, update.mode, old, next, update.note?.trim() || null);
    }
    devSave(db);
    return { ...devPublic(key, g), entryId };
  },
  async history(token, slug) {
    devAuth(token);
    const db = devDb();
    const key = devResolve(db, slug);
    const entries = db.log.filter((e) => e.slug === key).reverse().slice(0, 30);
    const latest = entries[0];
    const undoableId = latest && latest.kind !== 'undo' && !latest.reverted && latest.newScore === db.goals[key].score ? latest.id : null;
    return { entries, undoableId };
  },
  async undo(token, slug, entryId) {
    const { undoableId } = await devApi.history(token, slug);
    if (undoableId !== entryId) throw new ApiError('cannot_undo', 409);
    const db = devDb();
    const key = devResolve(db, slug);
    const entry = db.log.find((e) => e.id === entryId)!;
    entry.reverted = true;
    const g = db.goals[key];
    devLog(db, key, 'undo', g.score, entry.oldScore, `#${entryId}`);
    g.score = entry.oldScore;
    g.scoreUpdatedAt = now();
    devSave(db);
    return devPublic(key, g);
  },
  async list(token) {
    devAuth(token);
    const db = devDb();
    const goals = Object.entries(db.goals)
      .map(([slug, g]) => ({
        slug,
        name: ((g.draft?.config ?? g.config) as { name?: string } | null)?.name ?? null,
        score: g.score,
        target: g.target,
        updatedAt: g.updatedAt,
        scoreUpdatedAt: g.scoreUpdatedAt,
        hasEditorPassword: !!g.editorPassword,
        hasDraft: !!g.draft,
        published: g.published,
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
    return { goals, defaultGoal: db.defaultGoal, platform: db.platform ?? EMPTY_PROFILE };
  },
  async getForEdit(token, slug) {
    devAuth(token);
    const db = devDb();
    const key = devResolve(db, slug);
    return devStudio(key, db.goals[key]);
  },
  async save(token, input) {
    devAuth(token);
    const db = devDb();
    if (!SLUG.test(input.slug)) throw new ApiError('invalid_slug', 400);
    const existing = input.originalSlug ? db.goals[input.originalSlug] : undefined;
    if (input.originalSlug && !existing) throw new ApiError('not_found', 404);
    if (input.slug !== input.originalSlug && db.goals[input.slug]) throw new ApiError('slug_taken', 409);
    const oldScore = existing?.score ?? 0;
    let score = oldScore;
    if (input.score !== undefined) {
      if (existing && input.expectedScore !== undefined && input.expectedScore !== oldScore) throw new ApiError('score_changed', 409, { current: oldScore });
      score = input.score;
    }
    const liveTarget = existing && !input.publish ? existing.target : input.target;
    if (score > liveTarget) throw new ApiError('score_exceeds_target', 400, { current: oldScore });
    let editorPassword = existing?.editorPassword ?? null;
    if (input.editorPassword === null) editorPassword = null;
    else if (input.editorPassword) {
      if (input.editorPassword.length < 6) throw new ApiError('weak_password', 400);
      editorPassword = input.editorPassword;
    }
    const goal: DevGoal = input.publish
      ? { ...(existing as DevGoal), config: input.config, target: input.target, draft: null, published: true }
      : {
          ...(existing as DevGoal),
          config: existing ? existing.config : input.config,
          target: existing ? existing.target : input.target,
          draft: { config: input.config, target: input.target },
          published: existing?.published ?? false,
        };
    Object.assign(goal, {
      score,
      editorPassword,
      updatedAt: now(),
      scoreUpdatedAt: score !== oldScore ? now() : existing?.scoreUpdatedAt ?? now(),
      draftToken: existing?.draftToken ?? `dev-${Math.random().toString(36).slice(2)}`,
    });
    if (input.originalSlug && input.originalSlug !== input.slug) {
      delete db.goals[input.originalSlug];
      for (const k of Object.keys(db.aliases)) if (db.aliases[k] === input.originalSlug) db.aliases[k] = input.slug;
      db.aliases[input.originalSlug] = input.slug;
      db.log.forEach((e) => e.slug === input.originalSlug && (e.slug = input.slug));
      if (db.defaultGoal === input.originalSlug) db.defaultGoal = input.slug;
    }
    delete db.aliases[input.slug];
    db.goals[input.slug] = goal;
    if (score !== oldScore) devLog(db, input.slug, 'set', oldScore, score, 'studio');
    if (goal.published) db.defaultGoal ??= input.slug;
    devSave(db);
    return devStudio(input.slug, goal);
  },
  async discardDraft(token, slug) {
    devAuth(token);
    const db = devDb();
    const key = devResolve(db, slug);
    db.goals[key].draft = null;
    devSave(db);
    return devStudio(key, db.goals[key]);
  },
  async remove(token, slug) {
    devAuth(token);
    const db = devDb();
    delete db.goals[slug];
    db.log = db.log.filter((e) => e.slug !== slug);
    for (const k of Object.keys(db.aliases)) if (db.aliases[k] === slug) delete db.aliases[k];
    if (db.defaultGoal === slug) db.defaultGoal = Object.keys(db.goals).find((k) => db.goals[k].published) ?? null;
    devSave(db);
  },
  async setDefault(token, slug) {
    devAuth(token);
    const db = devDb();
    if (!db.goals[slug]?.published) throw new ApiError('not_found', 404);
    db.defaultGoal = slug;
    devSave(db);
  },
  async upload(token, _kind, file) {
    devAuth(token);
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
  getGoal: (slug, signal, draftToken) => withFallback((a) => a.getGoal(slug, signal, draftToken)),
  login: (password, goal, remember) => withFallback((a) => a.login(password, goal, remember)),
  updateScore: (token, goal, update) => withFallback((a) => a.updateScore(token, goal, update)),
  history: (token, goal) => withFallback((a) => a.history(token, goal)),
  undo: (token, goal, entryId) => withFallback((a) => a.undo(token, goal, entryId)),
  list: (token) => withFallback((a) => a.list(token)),
  getPlatform: () => withFallback((a) => a.getPlatform()),
  savePlatform: (token, profile) => withFallback((a) => a.savePlatform(token, profile)),
  getForEdit: (token, goal) => withFallback((a) => a.getForEdit(token, goal)),
  save: (token, input) => withFallback((a) => a.save(token, input)),
  discardDraft: (token, goal) => withFallback((a) => a.discardDraft(token, goal)),
  remove: (token, goal) => withFallback((a) => a.remove(token, goal)),
  setDefault: (token, goal) => withFallback((a) => a.setDefault(token, goal)),
  upload: (token, kind, file) => withFallback((a) => a.upload(token, kind, file)),
};

// ---------------------------------------------------------------------------
// Token storage. "Remember me" keeps the token in localStorage (survives new
// tabs and restarts); otherwise sessionStorage (cleared with the tab).
// ---------------------------------------------------------------------------
const tokenKey = (scope: string) => `goal_token_${scope}`;

export function loadToken(scope: 'platform' | string): string | null {
  for (const store of [sessionStorage, localStorage]) {
    try {
      const stored = JSON.parse(store.getItem(tokenKey(scope)) ?? 'null');
      if (stored?.token && stored.expiresAt * 1000 > Date.now()) return stored.token;
    } catch { /* ignore */ }
    store.removeItem(tokenKey(scope));
  }
  return null;
}

export function storeToken(scope: 'platform' | string, result: LoginResult, remember = false) {
  clearToken(scope);
  (remember ? localStorage : sessionStorage).setItem(tokenKey(scope), JSON.stringify({ token: result.token, expiresAt: result.expiresAt }));
}

export function clearToken(scope: 'platform' | string) {
  sessionStorage.removeItem(tokenKey(scope));
  localStorage.removeItem(tokenKey(scope));
}

/** Whether this device has a saved login that can edit this goal. */
export const canEditOnThisDevice = (slug: string) => !!(loadToken('platform') || loadToken(slug));
