<?php
/**
 * Kiyan Pearl score API.
 *
 *   GET  api.php                                   -> {"score":int,"target":int}
 *   POST api.php {"action":"login","password":"…"} -> {"token":"…","expiresAt":int}
 *   POST api.php {"action":"update","score":int,"target"?:int}
 *        + header "Authorization: Bearer <token>"  -> {"score":int,"target":int}
 *
 * Credentials live in kiyan-config.php (see server/kiyan-config.example.php),
 * which must never be committed. Preferred location is one level ABOVE the
 * web root; the same folder as this file also works (protected by .htaccess).
 */

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store, max-age=0');
header('X-Content-Type-Options: nosniff');

const MAX_VALUE = 99999999;      // 8 digits, matches the admin digit wheels
const DEFAULT_TARGET = 60000000;
const TOKEN_TTL = 43200;         // 12 hours
const MAX_FAILED_LOGINS = 8;
const LOCKOUT_SECONDS = 900;     // 15 minutes

function respond($status, $body)
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
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

// ---------------------------------------------------------------------------
// CORS: same-origin needs nothing; cross-origin only for explicit allow-list
// ---------------------------------------------------------------------------
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
// Auth helpers
// ---------------------------------------------------------------------------
function token_signature($config, $exp)
{
    // Binding the password hash means changing the password revokes all tokens.
    $passwordMarker = !empty($config['admin_password_hash']) ? $config['admin_password_hash'] : hash('sha256', $config['admin_password']);
    return hash_hmac('sha256', 'admin|' . $exp . '|' . $passwordMarker, $config['token_secret']);
}

function issue_token($config)
{
    $exp = time() + TOKEN_TTL;
    return [$exp . '.' . token_signature($config, $exp), $exp];
}

function verify_token($config, $token)
{
    $parts = explode('.', (string)$token, 2);
    if (count($parts) !== 2 || !ctype_digit($parts[0])) {
        return false;
    }
    $exp = (int)$parts[0];
    if ($exp < time()) {
        return false;
    }
    return hash_equals(token_signature($config, $exp), $parts[1]);
}

function check_password($config, $password)
{
    if (!is_string($password) || $password === '') {
        return false;
    }
    if (!empty($config['admin_password_hash'])) {
        return password_verify($password, $config['admin_password_hash']);
    }
    return hash_equals((string)$config['admin_password'], $password);
}

function bearer_token()
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
    return preg_match('/^Bearer\s+(\S+)$/i', $header, $m) ? $m[1] : '';
}

/** Simple per-IP brute-force protection stored in the system temp dir. */
function throttle_file()
{
    $ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : 'unknown';
    return sys_get_temp_dir() . '/kiyan_login_' . hash('sha256', $ip);
}

function throttle_state()
{
    $file = throttle_file();
    $state = ['count' => 0, 'since' => time()];
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
    $int = filter_var($value, FILTER_VALIDATE_INT);
    if ($int === false || $int < $min || $int > $max) {
        return null;
    }
    return $int;
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
    return $conn;
}

function db_read($conn)
{
    try {
        $result = $conn->query('SELECT score, target FROM kiyan_score WHERE id = 1');
    } catch (mysqli_sql_exception $e) {
        if ($e->getCode() !== 1146) { // 1146 = table doesn't exist
            throw $e;
        }
        // First run only: create the table.
        $conn->query('CREATE TABLE IF NOT EXISTS kiyan_score (
            id INT(11) PRIMARY KEY DEFAULT 1,
            score BIGINT NOT NULL DEFAULT 0,
            target BIGINT NOT NULL DEFAULT ' . DEFAULT_TARGET . '
        )');
        $result = $conn->query('SELECT score, target FROM kiyan_score WHERE id = 1');
    }
    $row = $result->fetch_assoc();
    if (!$row) {
        $conn->query('INSERT IGNORE INTO kiyan_score (id, score, target) VALUES (1, 0, ' . DEFAULT_TARGET . ')');
        return ['score' => 0, 'target' => DEFAULT_TARGET];
    }
    return ['score' => (int)$row['score'], 'target' => (int)$row['target']];
}

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------
try {
    if ($method === 'GET') {
        $conn = db_connect($config);
        respond(200, db_read($conn));
    }

    if ($method !== 'POST') {
        fail(405, 'method_not_allowed');
    }

    $contentType = isset($_SERVER['CONTENT_TYPE']) ? $_SERVER['CONTENT_TYPE'] : '';
    if (stripos($contentType, 'application/json') !== 0) {
        fail(415, 'unsupported_media_type');
    }
    $data = json_decode((string)file_get_contents('php://input'), true);
    if (!is_array($data)) {
        fail(400, 'invalid_request');
    }
    $action = isset($data['action']) ? $data['action'] : '';

    if ($action === 'login') {
        $state = throttle_state();
        if ($state['count'] >= MAX_FAILED_LOGINS) {
            fail(429, 'too_many_attempts');
        }
        if (!check_password($config, isset($data['password']) ? $data['password'] : '')) {
            $state['count']++;
            @file_put_contents(throttle_file(), json_encode($state), LOCK_EX);
            sleep(1);
            fail(401, 'invalid_password');
        }
        @unlink(throttle_file());
        list($token, $exp) = issue_token($config);
        respond(200, ['token' => $token, 'expiresAt' => $exp]);
    }

    if ($action === 'update') {
        if (!verify_token($config, bearer_token())) {
            fail(401, 'unauthorized');
        }

        $conn = db_connect($config);
        $current = db_read($conn);

        $score = read_int(isset($data['score']) ? $data['score'] : null, 0, MAX_VALUE);
        if ($score === null) {
            fail(400, 'invalid_score');
        }
        $target = $current['target'];
        if (array_key_exists('target', $data)) {
            $target = read_int($data['target'], 1, MAX_VALUE);
            if ($target === null) {
                fail(400, 'invalid_target');
            }
        }
        if ($score > $target) {
            fail(400, 'score_exceeds_target');
        }

        $stmt = $conn->prepare('UPDATE kiyan_score SET score = ?, target = ? WHERE id = 1');
        $stmt->bind_param('ii', $score, $target);
        $stmt->execute();
        $stmt->close();

        respond(200, ['score' => $score, 'target' => $target]);
    }

    fail(400, 'invalid_action');
} catch (Throwable $e) {
    error_log('kiyan api: ' . $e->getMessage());
    fail(500, 'server_error');
}
