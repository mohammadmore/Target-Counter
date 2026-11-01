<?php
/**
 * Goal platform API (PHP 7.4+ / MySQL).
 *
 * Public
 *   GET  api.php?goal=<slug>        -> {slug, config, score, target, updatedAt}
 *        (no slug = the platform's default goal)
 *
 * Auth
 *   POST {"action":"login","password":"…"}                -> platform (studio) token
 *   POST {"action":"login","password":"…","goal":"slug"}  -> editor token for that goal
 *        (the platform password is accepted too and yields a platform token)
 *
 * Editor or platform token  (header "Authorization: Bearer <token>")
 *   POST {"action":"update","goal":"slug","score":int,"target"?:int}
 *
 * Platform token only
 *   POST {"action":"list"}
 *   POST {"action":"get","goal":"slug"}
 *   POST {"action":"save","originalSlug"?:"…","slug":"…","config":{…},"target":int,"score"?:int,
 *         "editorPassword"?: string|null}   ("" or missing = keep, null = remove)
 *   POST {"action":"delete","goal":"slug"}
 *   POST {"action":"setDefault","goal":"slug"}
 *   POST multipart/form-data action=upload kind=image|font file=<file>  -> {"url":"uploads/…"}
 *
 * Secrets live in kiyan-config.php (see server/kiyan-config.example.php).
 */

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store, max-age=0');
header('X-Content-Type-Options: nosniff');

const MAX_VALUE = 999999999999999;   // 15 digits — safe for JS numbers
const DEFAULT_TARGET = 60000000;
const TOKEN_TTL = 43200;             // 12 hours
const MAX_FAILED_LOGINS = 8;
const LOCKOUT_SECONDS = 900;
const MAX_CONFIG_BYTES = 200000;
const SLUG_PATTERN = '/^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/';
const UPLOAD_DIR = 'uploads';

function respond($status, $body)
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function fail($status, $code)
{
    respond($status, ['error' => $code]);
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

function issue_token($config, $scope, $marker)
{
    $exp = time() + TOKEN_TTL;
    $scopeB64 = rtrim(strtr(base64_encode($scope), '+/', '-_'), '=');
    return [$exp . '.' . $scopeB64 . '.' . sign_token($config, $scope, $exp, $marker), $exp];
}

/** Returns the token scope ("platform" | "goal:<slug>") or null. */
function read_token($config, $conn = null)
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
        $marker = platform_marker($config);
    } elseif (is_string($scope) && strpos($scope, 'goal:') === 0 && $conn) {
        $goal = db_goal($conn, substr($scope, 5));
        if (!$goal || empty($goal['editor_password_hash'])) {
            return null;
        }
        $marker = $goal['editor_password_hash'];
    } else {
        return null;
    }
    return hash_equals(sign_token($config, $scope, $exp, $marker), $m[3]) ? $scope : null;
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

// ---------------------------------------------------------------------------
// Database
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

/** Creates tables on first run and migrates the legacy single-score table. Cheap afterwards. */
function ensure_schema($conn)
{
    try {
        $conn->query('SELECT 1 FROM goals LIMIT 1');
        return;
    } catch (mysqli_sql_exception $e) {
        if ($e->getCode() !== 1146) {
            throw $e;
        }
    }
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
        $stmt = $conn->prepare('INSERT IGNORE INTO goals (slug, config, score, target) VALUES (\'kiyan\', NULL, ?, ?)');
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

function db_goal($conn, $slug)
{
    $stmt = $conn->prepare('SELECT slug, config, score, target, editor_password_hash, UNIX_TIMESTAMP(updated_at) AS updated FROM goals WHERE slug = ?');
    $stmt->bind_param('s', $slug);
    $stmt->execute();
    return $stmt->get_result()->fetch_assoc() ?: null;
}

function public_goal($row)
{
    return [
        'slug' => $row['slug'],
        'config' => $row['config'] !== null ? json_decode($row['config'], true) : null,
        'score' => (int)$row['score'],
        'target' => (int)$row['target'],
        'updatedAt' => (int)$row['updated'],
    ];
}

function goal_name($row)
{
    if ($row['config'] === null) {
        return null;
    }
    $cfg = json_decode($row['config'], true);
    return isset($cfg['name']) && is_string($cfg['name']) ? $cfg['name'] : null;
}

function require_platform($config, $conn)
{
    if (read_token($config, $conn) !== 'platform') {
        fail(401, 'unauthorized');
    }
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
        $slug = isset($_GET['goal']) && $_GET['goal'] !== '' ? read_slug($_GET['goal']) : get_setting($conn, 'default_goal');
        $row = $slug ? db_goal($conn, $slug) : null;
        if (!$row) {
            fail(404, 'not_found');
        }
        respond(200, public_goal($row));
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
            $scope = null;
            $marker = null;
            if (check_platform_password($config, $password)) {
                $scope = 'platform';
                $marker = platform_marker($config);
            } elseif (isset($data['goal']) && ($slug = read_slug($data['goal']))) {
                $goal = db_goal($conn, $slug);
                if ($goal && !empty($goal['editor_password_hash']) && is_string($password) && $password !== ''
                    && password_verify($password, $goal['editor_password_hash'])) {
                    $scope = 'goal:' . $slug;
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
            list($token, $exp) = issue_token($config, $scope, $marker);
            respond(200, ['token' => $token, 'expiresAt' => $exp, 'scope' => $scope === 'platform' ? 'platform' : 'editor']);

        case 'update':
            $slug = read_slug(isset($data['goal']) ? $data['goal'] : null);
            if (!$slug) {
                fail(400, 'invalid_request');
            }
            $scope = read_token($config, $conn);
            if ($scope !== 'platform' && $scope !== 'goal:' . $slug) {
                fail(401, 'unauthorized');
            }
            $goal = db_goal($conn, $slug);
            if (!$goal) {
                fail(404, 'not_found');
            }
            $score = read_int(isset($data['score']) ? $data['score'] : null, 0, MAX_VALUE);
            if ($score === null) {
                fail(400, 'invalid_score');
            }
            $target = (int)$goal['target'];
            if (array_key_exists('target', $data)) {
                $target = read_int($data['target'], 1, MAX_VALUE);
                if ($target === null) {
                    fail(400, 'invalid_target');
                }
            }
            if ($score > $target) {
                fail(400, 'score_exceeds_target');
            }
            $stmt = $conn->prepare('UPDATE goals SET score = ?, target = ? WHERE slug = ?');
            $stmt->bind_param('iis', $score, $target, $slug);
            $stmt->execute();
            respond(200, public_goal(db_goal($conn, $slug)));

        case 'list':
            require_platform($config, $conn);
            $goals = [];
            $result = $conn->query('SELECT slug, config, score, target, editor_password_hash, UNIX_TIMESTAMP(updated_at) AS updated FROM goals ORDER BY updated_at DESC');
            while ($row = $result->fetch_assoc()) {
                $goals[] = [
                    'slug' => $row['slug'],
                    'name' => goal_name($row),
                    'score' => (int)$row['score'],
                    'target' => (int)$row['target'],
                    'updatedAt' => (int)$row['updated'],
                    'hasEditorPassword' => !empty($row['editor_password_hash']),
                ];
            }
            respond(200, ['goals' => $goals, 'defaultGoal' => get_setting($conn, 'default_goal')]);

        case 'get':
            require_platform($config, $conn);
            $row = db_goal($conn, (string)read_slug(isset($data['goal']) ? $data['goal'] : null));
            if (!$row) {
                fail(404, 'not_found');
            }
            $goal = public_goal($row);
            $goal['hasEditorPassword'] = !empty($row['editor_password_hash']);
            respond(200, $goal);

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
            $configJson = json_encode($data['config'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            if ($configJson === false || strlen($configJson) > MAX_CONFIG_BYTES) {
                fail(400, 'invalid_config');
            }
            $target = read_int(isset($data['target']) ? $data['target'] : null, 1, MAX_VALUE);
            if ($target === null) {
                fail(400, 'invalid_target');
            }

            $existing = $original ? db_goal($conn, $original) : null;
            if ($original && !$existing) {
                fail(404, 'not_found');
            }
            if ($slug !== $original && db_goal($conn, $slug)) {
                fail(409, 'slug_taken');
            }

            $score = $existing ? (int)$existing['score'] : 0;
            if (array_key_exists('score', $data) && $data['score'] !== null) {
                $score = read_int($data['score'], 0, MAX_VALUE);
                if ($score === null) {
                    fail(400, 'invalid_score');
                }
            }
            if ($score > $target) {
                fail(400, 'score_exceeds_target');
            }

            $hash = $existing ? $existing['editor_password_hash'] : null;
            if (array_key_exists('editorPassword', $data)) {
                if ($data['editorPassword'] === null) {
                    $hash = null;
                } elseif (is_string($data['editorPassword']) && $data['editorPassword'] !== '') {
                    if (mb_strlen($data['editorPassword']) < 6) {
                        fail(400, 'weak_password');
                    }
                    $hash = password_hash($data['editorPassword'], PASSWORD_DEFAULT);
                }
            }

            if ($existing) {
                $stmt = $conn->prepare('UPDATE goals SET slug = ?, config = ?, score = ?, target = ?, editor_password_hash = ? WHERE slug = ?');
                $stmt->bind_param('ssiiss', $slug, $configJson, $score, $target, $hash, $original);
                $stmt->execute();
                if ($slug !== $original && get_setting($conn, 'default_goal') === $original) {
                    set_setting($conn, 'default_goal', $slug);
                }
            } else {
                $stmt = $conn->prepare('INSERT INTO goals (slug, config, score, target, editor_password_hash) VALUES (?, ?, ?, ?, ?)');
                $stmt->bind_param('ssiis', $slug, $configJson, $score, $target, $hash);
                $stmt->execute();
            }
            if (!get_setting($conn, 'default_goal')) {
                set_setting($conn, 'default_goal', $slug);
            }
            respond(200, public_goal(db_goal($conn, $slug)));

        case 'delete':
            require_platform($config, $conn);
            $slug = read_slug(isset($data['goal']) ? $data['goal'] : null);
            if (!$slug) {
                fail(400, 'invalid_request');
            }
            $stmt = $conn->prepare('DELETE FROM goals WHERE slug = ?');
            $stmt->bind_param('s', $slug);
            $stmt->execute();
            if (get_setting($conn, 'default_goal') === $slug) {
                $next = $conn->query('SELECT slug FROM goals ORDER BY updated_at DESC LIMIT 1')->fetch_assoc();
                set_setting($conn, 'default_goal', $next ? $next['slug'] : '');
            }
            respond(200, ['ok' => true]);

        case 'setDefault':
            require_platform($config, $conn);
            $slug = read_slug(isset($data['goal']) ? $data['goal'] : null);
            if (!$slug || !db_goal($conn, $slug)) {
                fail(404, 'not_found');
            }
            set_setting($conn, 'default_goal', $slug);
            respond(200, ['ok' => true]);
    }

    fail(400, 'invalid_action');
} catch (Throwable $e) {
    error_log('goal api: ' . $e->getMessage());
    fail(500, 'server_error');
}
