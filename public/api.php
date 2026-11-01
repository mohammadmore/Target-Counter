<?php
/**
 * Goal platform API (PHP 7.4+ / MySQL, mysqlnd).
 *
 * Public
 *   GET  api.php?platform               -> studio profile {logoLight, logoDark, contacts[]}
 *   GET  api.php?goal=<slug>[&draft=<token>]
 *        -> {slug, config, score, target, updatedAt, scoreUpdatedAt, isDraft, platform}
 *        (no slug = default goal; renamed slugs resolve through aliases;
 *         unpublished goals and drafts need the draft preview token)
 *
 * Auth
 *   POST {"action":"login","password","goal"?,"remember"?:bool}
 *        platform password -> platform token; a goal's editor password -> editor token
 *        remember=true issues a 30-day token instead of 12 hours.
 *
 * Editor (own goal) or platform
 *   POST {"action":"update","goal","mode":"add","amount":int,"note"?}      atomic +/- change
 *   POST {"action":"update","goal","mode":"set","score":int,"expectedScore"?:int,"note"?}
 *        expectedScore → 409 score_changed if someone else changed it meanwhile
 *        ("target" is accepted from the platform only)
 *   POST {"action":"history","goal"}            -> {entries:[…], undoableId}
 *   POST {"action":"undo","goal","entryId"}     reverts the latest entry
 *
 * Platform only
 *   POST {"action":"list"} | {"action":"get","goal"}
 *   POST {"action":"save","originalSlug"?,"slug","config","target","publish":bool,
 *         "score"?,"expectedScore"?,"editorPassword"?: string|null}
 *        publish=false stores a draft (live page unchanged) and returns a preview token
 *   POST {"action":"discardDraft","goal"} | {"action":"delete","goal"} | {"action":"setDefault","goal"}
 *   POST {"action":"savePlatform","profile":{logoLight, logoDark, contacts:[{type,value,label}]}}
 *   POST multipart/form-data action=upload kind=image|font file=<file>
 *
 * Secrets live in kiyan-config.php (see server/kiyan-config.example.php).
 */

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store, max-age=0');
header('X-Content-Type-Options: nosniff');

const MAX_VALUE = 999999999999999;   // 15 digits — safe for JS numbers
const DEFAULT_TARGET = 60000000;
const TOKEN_TTL = 43200;             // 12 hours
const REMEMBER_TTL = 2592000;        // 30 days
const MAX_FAILED_LOGINS = 8;
const LOCKOUT_SECONDS = 900;
const MAX_CONFIG_BYTES = 200000;
const MAX_NOTE_CHARS = 200;
const HISTORY_LIMIT = 30;
const SCHEMA_VERSION = 2;
const SLUG_PATTERN = '/^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/';
const UPLOAD_DIR = 'uploads';
const CONTACT_TYPES = ['website', 'email', 'phone', 'whatsapp', 'telegram', 'instagram', 'linkedin', 'link'];
const MAX_CONTACTS = 12;

function respond($status, $body)
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function fail($status, $code, $extra = [])
{
    respond($status, ['error' => $code] + $extra);
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
$config = null;
foreach ([dirname(__DIR__) . '/kiyan-config.php', __DIR__ . '/kiyan-config.php'] as $path) {
    if (is_file($path)) {
        $config = require $path;
        break;
    }
}
if (!is_array($config) || empty($config['db_user']) || empty($config['db_name']) || empty($config['token_secret'])
    || (empty($config['admin_password_hash']) && empty($config['admin_password']))) {
    fail(500, 'not_configured');
}

// CORS only for an explicit allow-list (same-origin needs nothing).
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
$allowedOrigins = isset($config['allowed_origins']) && is_array($config['allowed_origins']) ? $config['allowed_origins'] : [];
if ($origin !== '' && in_array($origin, $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Vary: Origin');
}

$method = isset($_SERVER['REQUEST_METHOD']) ? $_SERVER['REQUEST_METHOD'] : 'GET';
if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
function read_int($value, $min, $max)
{
    if (is_float($value) && floor($value) == $value) {
        $value = (string)(int)$value;
    }
    $int = filter_var($value, FILTER_VALIDATE_INT);
    if ($int === false || $int < $min || $int > $max) {
        return null;
    }
    return $int;
}

function read_slug($value)
{
    return is_string($value) && preg_match(SLUG_PATTERN, $value) ? $value : null;
}

function read_note($data)
{
    if (!isset($data['note']) || !is_string($data['note'])) {
        return null;
    }
    $note = trim($data['note']);
    if ($note === '') {
        return null;
    }
    return function_exists('mb_substr') ? mb_substr($note, 0, MAX_NOTE_CHARS) : substr($note, 0, MAX_NOTE_CHARS * 2);
}

function clip($value, $max)
{
    $value = trim((string)$value);
    return function_exists('mb_substr') ? mb_substr($value, 0, $max) : substr($value, 0, $max);
}

function safe_asset($value)
{
    $value = is_string($value) ? trim($value) : '';
    if ($value === '' || preg_match('#^uploads/[A-Za-z0-9._-]+$#', $value) || preg_match('#^https://[^\s"\'()<>\\\\]+$#', $value)) {
        return $value;
    }
    return '';
}

/** The studio's own branding shown in every page's credit (Asva logos + contact links). */
function platform_profile($conn)
{
    $raw = json_decode((string)get_setting($conn, 'platform_profile'), true);
    return sanitize_profile(is_array($raw) ? $raw : []);
}

function sanitize_profile($raw)
{
    $contacts = [];
    if (isset($raw['contacts']) && is_array($raw['contacts'])) {
        foreach ($raw['contacts'] as $c) {
            if (!is_array($c) || !isset($c['type'], $c['value']) || !in_array($c['type'], CONTACT_TYPES, true)) {
                continue;
            }
            $value = clip($c['value'], 200);
            if ($value === '') {
                continue;
            }
            $contacts[] = ['type' => $c['type'], 'value' => $value, 'label' => clip(isset($c['label']) ? $c['label'] : '', 60)];
            if (count($contacts) >= MAX_CONTACTS) {
                break;
            }
        }
    }
    return [
        'logoLight' => safe_asset(isset($raw['logoLight']) ? $raw['logoLight'] : ''),
        'logoDark' => safe_asset(isset($raw['logoDark']) ? $raw['logoDark'] : ''),
        'contacts' => $contacts,
    ];
}

// ---------------------------------------------------------------------------
// Database & schema migrations
// ---------------------------------------------------------------------------
function db_connect($config)
{
    mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
    $conn = new mysqli(
        isset($config['db_host']) ? $config['db_host'] : 'localhost',
        $config['db_user'],
        isset($config['db_pass']) ? $config['db_pass'] : '',
        $config['db_name']
    );
    $conn->set_charset('utf8mb4');
    ensure_schema($conn);
    return $conn;
}

/** One cheap query per request; creates/migrates tables when needed. */
function ensure_schema($conn)
{
    $version = null;
    try {
        $row = $conn->query("SELECT value FROM settings WHERE name = 'schema_version'")->fetch_assoc();
        $version = $row ? (int)$row['value'] : 1; // installs from before versioning
    } catch (mysqli_sql_exception $e) {
        if ($e->getCode() !== 1146) {
            throw $e;
        }
        create_base_schema($conn);
        $version = 1;
    }
    if ($version >= SCHEMA_VERSION) {
        return;
    }
    if ($version < 2) {
        $conn->query('CREATE TABLE IF NOT EXISTS score_log (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            slug VARCHAR(48) NOT NULL,
            kind VARCHAR(10) NOT NULL,
            old_score BIGINT NOT NULL,
            new_score BIGINT NOT NULL,
            actor VARCHAR(10) NOT NULL,
            note VARCHAR(255) NULL,
            reverted TINYINT NOT NULL DEFAULT 0,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            KEY slug_id (slug, id)
        ) DEFAULT CHARSET=utf8mb4');
        $conn->query('CREATE TABLE IF NOT EXISTS slug_aliases (
            old_slug VARCHAR(48) NOT NULL PRIMARY KEY,
            slug VARCHAR(48) NOT NULL
        ) DEFAULT CHARSET=utf8mb4');
        $columns = [];
        $result = $conn->query('SHOW COLUMNS FROM goals');
        while ($c = $result->fetch_assoc()) {
            $columns[$c['Field']] = true;
        }
        $add = [
            'score_updated_at' => 'ADD COLUMN score_updated_at TIMESTAMP NULL DEFAULT NULL',
            'draft_config' => 'ADD COLUMN draft_config MEDIUMTEXT NULL',
            'draft_token' => 'ADD COLUMN draft_token VARCHAR(40) NULL',
            'published' => 'ADD COLUMN published TINYINT NOT NULL DEFAULT 1',
        ];
        $alters = [];
        foreach ($add as $name => $sql) {
            if (!isset($columns[$name])) {
                $alters[] = $sql;
            }
        }
        if ($alters) {
            $conn->query('ALTER TABLE goals ' . implode(', ', $alters));
        }
        $conn->query('UPDATE goals SET score_updated_at = updated_at WHERE score_updated_at IS NULL');
    }
    set_setting($conn, 'schema_version', (string)SCHEMA_VERSION);
}

function create_base_schema($conn)
{
    $conn->query('CREATE TABLE IF NOT EXISTS goals (
        slug VARCHAR(48) NOT NULL PRIMARY KEY,
        config MEDIUMTEXT NULL,
        score BIGINT NOT NULL DEFAULT 0,
        target BIGINT NOT NULL DEFAULT ' . DEFAULT_TARGET . ',
        editor_password_hash VARCHAR(255) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) DEFAULT CHARSET=utf8mb4');
    $conn->query('CREATE TABLE IF NOT EXISTS settings (
        name VARCHAR(64) NOT NULL PRIMARY KEY,
        value TEXT NULL
    ) DEFAULT CHARSET=utf8mb4');

    // Legacy single-page install: carry the existing score over as goal "kiyan".
    try {
        $legacy = $conn->query('SELECT score, target FROM kiyan_score WHERE id = 1')->fetch_assoc();
    } catch (mysqli_sql_exception $e) {
        $legacy = null;
    }
    if ($legacy) {
        $stmt = $conn->prepare("INSERT IGNORE INTO goals (slug, config, score, target) VALUES ('kiyan', NULL, ?, ?)");
        $score = (int)$legacy['score'];
        $target = (int)$legacy['target'];
        $stmt->bind_param('ii', $score, $target);
        $stmt->execute();
        set_setting($conn, 'default_goal', 'kiyan');
    }
}

function get_setting($conn, $name)
{
    $stmt = $conn->prepare('SELECT value FROM settings WHERE name = ?');
    $stmt->bind_param('s', $name);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    return $row ? $row['value'] : null;
}

function set_setting($conn, $name, $value)
{
    $stmt = $conn->prepare('REPLACE INTO settings (name, value) VALUES (?, ?)');
    $stmt->bind_param('ss', $name, $value);
    $stmt->execute();
}

const GOAL_COLUMNS = 'slug, config, score, target, editor_password_hash, draft_config, draft_token, published,
    UNIX_TIMESTAMP(updated_at) AS updated, UNIX_TIMESTAMP(score_updated_at) AS score_updated';

function db_goal($conn, $slug, $lock = false)
{
    if (!$slug) {
        return null;
    }
    $stmt = $conn->prepare('SELECT ' . GOAL_COLUMNS . ' FROM goals WHERE slug = ?' . ($lock ? ' FOR UPDATE' : ''));
    $stmt->bind_param('s', $slug);
    $stmt->execute();
    return $stmt->get_result()->fetch_assoc() ?: null;
}

/** Looks a goal up by its slug or by a former slug (renamed goals keep old links working). */
function resolve_goal($conn, $slug)
{
    $goal = db_goal($conn, $slug);
    if ($goal || !$slug) {
        return $goal;
    }
    $stmt = $conn->prepare('SELECT slug FROM slug_aliases WHERE old_slug = ?');
    $stmt->bind_param('s', $slug);
    $stmt->execute();
    $alias = $stmt->get_result()->fetch_assoc();
    return $alias ? db_goal($conn, $alias['slug']) : null;
}

function decode_json($text)
{
    return $text === null ? null : json_decode($text, true);
}

function public_goal($row, $useDraft = false)
{
    $config = decode_json($row['config']);
    $target = (int)$row['target'];
    $draft = $useDraft ? decode_json($row['draft_config']) : null;
    if (is_array($draft)) {
        $config = isset($draft['config']) ? $draft['config'] : $config;
        $target = isset($draft['target']) ? (int)$draft['target'] : $target;
    }
    return [
        'slug' => $row['slug'],
        'config' => $config,
        'score' => (int)$row['score'],
        'target' => $target,
        'updatedAt' => (int)$row['updated'],
        'scoreUpdatedAt' => (int)($row['score_updated'] ?: $row['updated']),
        'isDraft' => $useDraft,
    ];
}

function studio_goal($row)
{
    $goal = public_goal($row);
    $draft = decode_json($row['draft_config']);
    $goal['draft'] = is_array($draft) ? $draft : null;
    $goal['draftToken'] = $row['draft_token'];
    $goal['published'] = (bool)$row['published'];
    $goal['hasEditorPassword'] = !empty($row['editor_password_hash']);
    return $goal;
}

function log_score($conn, $slug, $kind, $old, $new, $actor, $note)
{
    $stmt = $conn->prepare('INSERT INTO score_log (slug, kind, old_score, new_score, actor, note) VALUES (?, ?, ?, ?, ?, ?)');
    $stmt->bind_param('ssiiss', $slug, $kind, $old, $new, $actor, $note);
    $stmt->execute();
    return $conn->insert_id;
}

function set_score($conn, $slug, $score)
{
    $stmt = $conn->prepare('UPDATE goals SET score = ?, score_updated_at = CURRENT_TIMESTAMP WHERE slug = ?');
    $stmt->bind_param('is', $score, $slug);
    $stmt->execute();
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
function platform_marker($config)
{
    return !empty($config['admin_password_hash']) ? $config['admin_password_hash'] : hash('sha256', $config['admin_password']);
}

/** $scope is "platform" or "goal:<slug>"; $marker ties the token to the current password. */
function sign_token($config, $scope, $exp, $marker)
{
    return hash_hmac('sha256', $scope . '|' . $exp . '|' . $marker, $config['token_secret']);
}

function issue_token($config, $scope, $marker, $ttl)
{
    $exp = time() + $ttl;
    $scopeB64 = rtrim(strtr(base64_encode($scope), '+/', '-_'), '=');
    return [$exp . '.' . $scopeB64 . '.' . sign_token($config, $scope, $exp, $marker), $exp];
}

/**
 * Returns ['platform', null], ['editor', <current slug>] or null.
 * Editor tokens keep working after the goal is renamed.
 */
function read_token($config, $conn)
{
    $header = '';
    if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $header = $_SERVER['HTTP_AUTHORIZATION'];
    } elseif (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        $header = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    } elseif (function_exists('apache_request_headers')) {
        foreach (apache_request_headers() as $name => $value) {
            if (strcasecmp($name, 'Authorization') === 0) {
                $header = $value;
            }
        }
    }
    if (!preg_match('/^Bearer\s+(\d+)\.([A-Za-z0-9_-]+)\.([a-f0-9]{64})$/', $header, $m)) {
        return null;
    }
    $exp = (int)$m[1];
    if ($exp < time()) {
        return null;
    }
    $scope = base64_decode(strtr($m[2], '-_', '+/'));
    if ($scope === 'platform') {
        return hash_equals(sign_token($config, $scope, $exp, platform_marker($config)), $m[3]) ? ['platform', null] : null;
    }
    if (is_string($scope) && strpos($scope, 'goal:') === 0) {
        $goal = resolve_goal($conn, substr($scope, 5));
        if (!$goal || empty($goal['editor_password_hash'])) {
            return null;
        }
        return hash_equals(sign_token($config, $scope, $exp, $goal['editor_password_hash']), $m[3]) ? ['editor', $goal['slug']] : null;
    }
    return null;
}

function require_platform($config, $conn)
{
    $auth = read_token($config, $conn);
    if (!$auth || $auth[0] !== 'platform') {
        fail(401, 'unauthorized');
    }
}

/** Platform, or an editor of exactly this goal. Returns 'platform' | 'editor'. */
function require_goal_access($config, $conn, $slug)
{
    $auth = read_token($config, $conn);
    if ($auth && ($auth[0] === 'platform' || $auth[1] === $slug)) {
        return $auth[0];
    }
    fail(401, 'unauthorized');
}

function check_platform_password($config, $password)
{
    if (!is_string($password) || $password === '') {
        return false;
    }
    if (!empty($config['admin_password_hash'])) {
        return password_verify($password, $config['admin_password_hash']);
    }
    return hash_equals((string)$config['admin_password'], $password);
}

function throttle_file()
{
    $ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : 'unknown';
    return sys_get_temp_dir() . '/kiyan_login_' . hash('sha256', $ip);
}

function throttle_state()
{
    $state = ['count' => 0, 'since' => time()];
    $file = throttle_file();
    if (is_file($file)) {
        $data = json_decode((string)@file_get_contents($file), true);
        if (is_array($data) && isset($data['count'], $data['since'])) {
            $state = $data;
        }
    }
    if (time() - (int)$state['since'] > LOCKOUT_SECONDS) {
        $state = ['count' => 0, 'since' => time()];
    }
    return $state;
}

// ---------------------------------------------------------------------------
// Uploads
// ---------------------------------------------------------------------------
function handle_upload()
{
    $kind = isset($_POST['kind']) ? $_POST['kind'] : '';
    if (!isset($_FILES['file']) || !is_array($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
        fail(400, 'upload_failed');
    }
    $tmp = $_FILES['file']['tmp_name'];
    $size = (int)$_FILES['file']['size'];
    $head = (string)file_get_contents($tmp, false, null, 0, 16);

    if ($kind === 'image') {
        if ($size > 5 * 1024 * 1024) {
            fail(413, 'file_too_large');
        }
        $info = @getimagesize($tmp);
        $types = [IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png', IMAGETYPE_WEBP => 'webp', IMAGETYPE_GIF => 'gif'];
        if (!$info || !isset($types[$info[2]])) {
            fail(415, 'unsupported_file');
        }
        $ext = $types[$info[2]];
    } elseif ($kind === 'font') {
        if ($size > 3 * 1024 * 1024) {
            fail(413, 'file_too_large');
        }
        $magic = substr($head, 0, 4);
        $fonts = ['wOF2' => 'woff2', 'wOFF' => 'woff', "\x00\x01\x00\x00" => 'ttf', 'true' => 'ttf', 'OTTO' => 'otf'];
        if (!isset($fonts[$magic])) {
            fail(415, 'unsupported_file');
        }
        $ext = $fonts[$magic];
    } else {
        fail(400, 'invalid_request');
    }

    $dir = __DIR__ . '/' . UPLOAD_DIR;
    if (!is_dir($dir) && !mkdir($dir, 0755, true)) {
        fail(500, 'server_error');
    }
    // Never let anything in the upload folder execute.
    if (!is_file($dir . '/.htaccess')) {
        file_put_contents($dir . '/.htaccess', implode("\n", [
            'Options -Indexes',
            'RemoveHandler .php .phtml .php3 .php4 .php5 .php7 .phps',
            'RemoveType .php .phtml .php3 .php4 .php5 .php7 .phps',
            '<FilesMatch "\\.(?i:php|phtml|phps|php[0-9])$">',
            '  <IfModule mod_authz_core.c>',
            '    Require all denied',
            '  </IfModule>',
            '</FilesMatch>',
            '<IfModule mod_headers.c>',
            '  Header set X-Content-Type-Options nosniff',
            '</IfModule>',
            '',
        ]));
    }
    $name = $kind . '-' . bin2hex(random_bytes(12)) . '.' . $ext;
    if (!move_uploaded_file($tmp, $dir . '/' . $name)) {
        fail(500, 'server_error');
    }
    @chmod($dir . '/' . $name, 0644);
    respond(200, ['url' => UPLOAD_DIR . '/' . $name]);
}

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------
try {
    if ($method === 'GET') {
        $conn = db_connect($config);
        if (isset($_GET['platform'])) {
            respond(200, platform_profile($conn));
        }
        $slug = isset($_GET['goal']) && $_GET['goal'] !== '' ? read_slug($_GET['goal']) : get_setting($conn, 'default_goal');
        $row = resolve_goal($conn, $slug);
        if (!$row) {
            fail(404, 'not_found');
        }
        $draftToken = isset($_GET['draft']) ? (string)$_GET['draft'] : '';
        $previewing = $draftToken !== '' && !empty($row['draft_token']) && hash_equals($row['draft_token'], $draftToken);
        if (!$row['published'] && !$previewing) {
            fail(404, 'not_found');
        }
        respond(200, public_goal($row, $previewing) + ['platform' => platform_profile($conn)]);
    }

    if ($method !== 'POST') {
        fail(405, 'method_not_allowed');
    }

    $contentType = isset($_SERVER['CONTENT_TYPE']) ? $_SERVER['CONTENT_TYPE'] : '';

    if (stripos($contentType, 'multipart/form-data') === 0) {
        if ((isset($_POST['action']) ? $_POST['action'] : '') !== 'upload') {
            fail(400, 'invalid_action');
        }
        $conn = db_connect($config);
        require_platform($config, $conn);
        handle_upload();
    }

    if (stripos($contentType, 'application/json') !== 0) {
        fail(415, 'unsupported_media_type');
    }
    $data = json_decode((string)file_get_contents('php://input'), true);
    if (!is_array($data)) {
        fail(400, 'invalid_request');
    }
    $action = isset($data['action']) ? $data['action'] : '';
    $conn = db_connect($config);

    switch ($action) {
        case 'login':
            $state = throttle_state();
            if ($state['count'] >= MAX_FAILED_LOGINS) {
                fail(429, 'too_many_attempts');
            }
            $password = isset($data['password']) ? $data['password'] : '';
            $ttl = !empty($data['remember']) ? REMEMBER_TTL : TOKEN_TTL;
            $scope = null;
            $marker = null;
            if (check_platform_password($config, $password)) {
                $scope = 'platform';
                $marker = platform_marker($config);
            } elseif (isset($data['goal']) && ($goal = resolve_goal($conn, read_slug($data['goal'])))) {
                if (!empty($goal['editor_password_hash']) && is_string($password) && $password !== ''
                    && password_verify($password, $goal['editor_password_hash'])) {
                    $scope = 'goal:' . $goal['slug'];
                    $marker = $goal['editor_password_hash'];
                }
            }
            if ($scope === null) {
                $state['count']++;
                @file_put_contents(throttle_file(), json_encode($state), LOCK_EX);
                sleep(1);
                fail(401, 'invalid_password');
            }
            @unlink(throttle_file());
            list($token, $exp) = issue_token($config, $scope, $marker, $ttl);
            respond(200, ['token' => $token, 'expiresAt' => $exp, 'scope' => $scope === 'platform' ? 'platform' : 'editor']);

        case 'update':
            $goal = resolve_goal($conn, read_slug(isset($data['goal']) ? $data['goal'] : null));
            if (!$goal) {
                fail(404, 'not_found');
            }
            $slug = $goal['slug'];
            $role = require_goal_access($config, $conn, $slug);
            $note = read_note($data);
            $mode = isset($data['mode']) ? $data['mode'] : 'set';

            if (array_key_exists('target', $data) && $role !== 'platform') {
                fail(403, 'forbidden'); // only the studio may move the goalposts
            }

            $conn->begin_transaction();
            $goal = db_goal($conn, $slug, true);
            $old = (int)$goal['score'];
            $target = (int)$goal['target'];

            if (array_key_exists('target', $data)) {
                $target = read_int($data['target'], 1, MAX_VALUE);
                if ($target === null) {
                    $conn->rollback();
                    fail(400, 'invalid_target');
                }
            }

            if ($mode === 'add') {
                $amount = read_int(isset($data['amount']) ? $data['amount'] : null, -MAX_VALUE, MAX_VALUE);
                if ($amount === null || $amount === 0) {
                    $conn->rollback();
                    fail(400, 'invalid_score');
                }
                $new = $old + $amount;
                $kind = 'add';
            } elseif ($mode === 'set') {
                $new = read_int(isset($data['score']) ? $data['score'] : null, 0, MAX_VALUE);
                if ($new === null) {
                    $conn->rollback();
                    fail(400, 'invalid_score');
                }
                if (array_key_exists('expectedScore', $data) && $data['expectedScore'] !== null && (int)$data['expectedScore'] !== $old) {
                    $conn->rollback();
                    fail(409, 'score_changed', ['current' => $old]);
                }
                $kind = 'set';
            } else {
                $conn->rollback();
                fail(400, 'invalid_request');
            }

            if ($new < 0) {
                $conn->rollback();
                fail(400, 'below_zero', ['current' => $old]);
            }
            if ($new > $target) {
                $conn->rollback();
                fail(400, 'score_exceeds_target', ['current' => $old]);
            }
            if ($target !== (int)$goal['target']) {
                $stmt = $conn->prepare('UPDATE goals SET target = ? WHERE slug = ?');
                $stmt->bind_param('is', $target, $slug);
                $stmt->execute();
            }
            $entryId = null;
            if ($new !== $old) {
                set_score($conn, $slug, $new);
                $entryId = log_score($conn, $slug, $kind, $old, $new, $role, $note);
            }
            $conn->commit();
            respond(200, public_goal(db_goal($conn, $slug)) + ['entryId' => $entryId]);

        case 'history':
            $goal = resolve_goal($conn, read_slug(isset($data['goal']) ? $data['goal'] : null));
            if (!$goal) {
                fail(404, 'not_found');
            }
            require_goal_access($config, $conn, $goal['slug']);
            $stmt = $conn->prepare('SELECT id, kind, old_score, new_score, actor, note, reverted, UNIX_TIMESTAMP(created_at) AS at
                FROM score_log WHERE slug = ? ORDER BY id DESC LIMIT ' . HISTORY_LIMIT);
            $stmt->bind_param('s', $goal['slug']);
            $stmt->execute();
            $result = $stmt->get_result();
            $entries = [];
            while ($r = $result->fetch_assoc()) {
                $entries[] = [
                    'id' => (int)$r['id'],
                    'kind' => $r['kind'],
                    'oldScore' => (int)$r['old_score'],
                    'newScore' => (int)$r['new_score'],
                    'actor' => $r['actor'],
                    'note' => $r['note'],
                    'reverted' => (bool)$r['reverted'],
                    'at' => (int)$r['at'],
                ];
            }
            $latest = $entries ? $entries[0] : null;
            $undoable = $latest && $latest['kind'] !== 'undo' && !$latest['reverted'] && $latest['newScore'] === (int)$goal['score'] ? $latest['id'] : null;
            respond(200, ['entries' => $entries, 'undoableId' => $undoable]);

        case 'undo':
            $goal = resolve_goal($conn, read_slug(isset($data['goal']) ? $data['goal'] : null));
            if (!$goal) {
                fail(404, 'not_found');
            }
            $slug = $goal['slug'];
            $role = require_goal_access($config, $conn, $slug);
            $entryId = read_int(isset($data['entryId']) ? $data['entryId'] : null, 1, PHP_INT_MAX);
            $conn->begin_transaction();
            $goal = db_goal($conn, $slug, true);
            $stmt = $conn->prepare('SELECT id, kind, old_score, new_score, reverted FROM score_log WHERE slug = ? ORDER BY id DESC LIMIT 1');
            $stmt->bind_param('s', $slug);
            $stmt->execute();
            $latest = $stmt->get_result()->fetch_assoc();
            if (!$latest || (int)$latest['id'] !== $entryId || $latest['kind'] === 'undo' || $latest['reverted']
                || (int)$latest['new_score'] !== (int)$goal['score'] || (int)$latest['old_score'] > (int)$goal['target']) {
                $conn->rollback();
                fail(409, 'cannot_undo', ['current' => (int)$goal['score']]);
            }
            $restored = (int)$latest['old_score'];
            set_score($conn, $slug, $restored);
            $stmt = $conn->prepare('UPDATE score_log SET reverted = 1 WHERE id = ?');
            $stmt->bind_param('i', $entryId);
            $stmt->execute();
            log_score($conn, $slug, 'undo', (int)$goal['score'], $restored, $role, '#' . $entryId);
            $conn->commit();
            respond(200, public_goal(db_goal($conn, $slug)));

        case 'list':
            require_platform($config, $conn);
            $goals = [];
            $result = $conn->query('SELECT ' . GOAL_COLUMNS . ' FROM goals ORDER BY updated_at DESC');
            while ($row = $result->fetch_assoc()) {
                $cfg = decode_json($row['config']);
                $draft = decode_json($row['draft_config']);
                $name = is_array($draft) && isset($draft['config']['name']) ? $draft['config']['name'] : (isset($cfg['name']) ? $cfg['name'] : null);
                $goals[] = [
                    'slug' => $row['slug'],
                    'name' => is_string($name) ? $name : null,
                    'score' => (int)$row['score'],
                    'target' => (int)$row['target'],
                    'updatedAt' => (int)$row['updated'],
                    'scoreUpdatedAt' => (int)($row['score_updated'] ?: $row['updated']),
                    'hasEditorPassword' => !empty($row['editor_password_hash']),
                    'hasDraft' => is_array($draft),
                    'published' => (bool)$row['published'],
                ];
            }
            respond(200, ['goals' => $goals, 'defaultGoal' => get_setting($conn, 'default_goal'), 'platform' => platform_profile($conn)]);

        case 'get':
            require_platform($config, $conn);
            $row = resolve_goal($conn, read_slug(isset($data['goal']) ? $data['goal'] : null));
            if (!$row) {
                fail(404, 'not_found');
            }
            respond(200, studio_goal($row));

        case 'save':
            require_platform($config, $conn);
            $slug = read_slug(isset($data['slug']) ? $data['slug'] : null);
            if (!$slug) {
                fail(400, 'invalid_slug');
            }
            $original = isset($data['originalSlug']) && $data['originalSlug'] !== null ? read_slug($data['originalSlug']) : null;
            if (!isset($data['config']) || !is_array($data['config'])) {
                fail(400, 'invalid_config');
            }
            $target = read_int(isset($data['target']) ? $data['target'] : null, 1, MAX_VALUE);
            if ($target === null) {
                fail(400, 'invalid_target');
            }
            $publish = !array_key_exists('publish', $data) || !empty($data['publish']);
            $configJson = json_encode($data['config'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            if ($configJson === false || strlen($configJson) > MAX_CONFIG_BYTES) {
                fail(400, 'invalid_config');
            }

            $conn->begin_transaction();
            $existing = $original ? db_goal($conn, $original, true) : null;
            if ($original && !$existing) {
                $conn->rollback();
                fail(404, 'not_found');
            }
            if ($slug !== $original && db_goal($conn, $slug)) {
                $conn->rollback();
                fail(409, 'slug_taken');
            }

            // Score: only touched when explicitly sent, guarded against concurrent edits.
            $oldScore = $existing ? (int)$existing['score'] : 0;
            $score = $oldScore;
            if (array_key_exists('score', $data) && $data['score'] !== null) {
                $score = read_int($data['score'], 0, MAX_VALUE);
                if ($score === null) {
                    $conn->rollback();
                    fail(400, 'invalid_score');
                }
                if ($existing && array_key_exists('expectedScore', $data) && $data['expectedScore'] !== null && (int)$data['expectedScore'] !== $oldScore) {
                    $conn->rollback();
                    fail(409, 'score_changed', ['current' => $oldScore]);
                }
            }
            // The score is always live; a draft save checks it against the live target.
            $liveTarget = $existing && !$publish ? (int)$existing['target'] : $target;
            if ($score > $liveTarget) {
                $conn->rollback();
                fail(400, 'score_exceeds_target', ['current' => $oldScore]);
            }

            $hash = $existing ? $existing['editor_password_hash'] : null;
            if (array_key_exists('editorPassword', $data)) {
                if ($data['editorPassword'] === null) {
                    $hash = null;
                } elseif (is_string($data['editorPassword']) && $data['editorPassword'] !== '') {
                    $len = function_exists('mb_strlen') ? mb_strlen($data['editorPassword']) : strlen($data['editorPassword']);
                    if ($len < 6) {
                        $conn->rollback();
                        fail(400, 'weak_password');
                    }
                    $hash = password_hash($data['editorPassword'], PASSWORD_DEFAULT);
                }
            }

            $draftToken = $existing && $existing['draft_token'] ? $existing['draft_token'] : bin2hex(random_bytes(12));
            if ($publish) {
                $liveConfig = $configJson;
                $draftJson = null;
                $published = 1;
            } else {
                $liveConfig = $existing ? $existing['config'] : $configJson;
                $target = $existing ? (int)$existing['target'] : $target;
                $draftJson = json_encode(['config' => $data['config'], 'target' => (int)$data['target']], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                $published = $existing ? (int)$existing['published'] : 0;
            }

            if ($existing) {
                $stmt = $conn->prepare('UPDATE goals SET slug = ?, config = ?, target = ?, editor_password_hash = ?, draft_config = ?, draft_token = ?, published = ? WHERE slug = ?');
                $stmt->bind_param('ssisssis', $slug, $liveConfig, $target, $hash, $draftJson, $draftToken, $published, $original);
                $stmt->execute();
                if ($slug !== $original) {
                    // Old links keep working: alias old → new, and re-point older aliases.
                    $stmt = $conn->prepare('DELETE FROM slug_aliases WHERE old_slug = ?');
                    $stmt->bind_param('s', $slug);
                    $stmt->execute();
                    $stmt = $conn->prepare('UPDATE slug_aliases SET slug = ? WHERE slug = ?');
                    $stmt->bind_param('ss', $slug, $original);
                    $stmt->execute();
                    $stmt = $conn->prepare('REPLACE INTO slug_aliases (old_slug, slug) VALUES (?, ?)');
                    $stmt->bind_param('ss', $original, $slug);
                    $stmt->execute();
                    $stmt = $conn->prepare('UPDATE score_log SET slug = ? WHERE slug = ?');
                    $stmt->bind_param('ss', $slug, $original);
                    $stmt->execute();
                    if (get_setting($conn, 'default_goal') === $original) {
                        set_setting($conn, 'default_goal', $slug);
                    }
                }
            } else {
                $stmt = $conn->prepare('DELETE FROM slug_aliases WHERE old_slug = ?');
                $stmt->bind_param('s', $slug);
                $stmt->execute();
                $zero = 0;
                $stmt = $conn->prepare('INSERT INTO goals (slug, config, score, target, editor_password_hash, draft_config, draft_token, published, score_updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)');
                $stmt->bind_param('ssiisssi', $slug, $liveConfig, $zero, $target, $hash, $draftJson, $draftToken, $published);
                $stmt->execute();
            }
            if ($score !== $oldScore || (!$existing && $score > 0)) {
                set_score($conn, $slug, $score);
                log_score($conn, $slug, 'set', $oldScore, $score, 'platform', 'studio');
            }
            if ($published && !get_setting($conn, 'default_goal')) {
                set_setting($conn, 'default_goal', $slug);
            }
            $conn->commit();
            respond(200, studio_goal(db_goal($conn, $slug)));

        case 'discardDraft':
            require_platform($config, $conn);
            $row = resolve_goal($conn, read_slug(isset($data['goal']) ? $data['goal'] : null));
            if (!$row) {
                fail(404, 'not_found');
            }
            $stmt = $conn->prepare('UPDATE goals SET draft_config = NULL WHERE slug = ?');
            $stmt->bind_param('s', $row['slug']);
            $stmt->execute();
            respond(200, studio_goal(db_goal($conn, $row['slug'])));

        case 'delete':
            require_platform($config, $conn);
            $slug = read_slug(isset($data['goal']) ? $data['goal'] : null);
            if (!$slug) {
                fail(400, 'invalid_request');
            }
            foreach (['DELETE FROM goals WHERE slug = ?', 'DELETE FROM slug_aliases WHERE slug = ?', 'DELETE FROM score_log WHERE slug = ?'] as $sql) {
                $stmt = $conn->prepare($sql);
                $stmt->bind_param('s', $slug);
                $stmt->execute();
            }
            if (get_setting($conn, 'default_goal') === $slug) {
                $next = $conn->query('SELECT slug FROM goals WHERE published = 1 ORDER BY updated_at DESC LIMIT 1')->fetch_assoc();
                set_setting($conn, 'default_goal', $next ? $next['slug'] : '');
            }
            respond(200, ['ok' => true]);

        case 'savePlatform':
            require_platform($config, $conn);
            if (!isset($data['profile']) || !is_array($data['profile'])) {
                fail(400, 'invalid_request');
            }
            $profile = sanitize_profile($data['profile']);
            set_setting($conn, 'platform_profile', json_encode($profile, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
            respond(200, $profile);

        case 'setDefault':
            require_platform($config, $conn);
            $row = db_goal($conn, read_slug(isset($data['goal']) ? $data['goal'] : null));
            if (!$row || !$row['published']) {
                fail(404, 'not_found');
            }
            set_setting($conn, 'default_goal', $row['slug']);
            respond(200, ['ok' => true]);
    }

    fail(400, 'invalid_action');
} catch (Throwable $e) {
    error_log('goal api: ' . $e->getMessage());
    fail(500, 'server_error');
}
