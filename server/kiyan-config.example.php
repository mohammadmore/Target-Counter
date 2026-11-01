<?php
/**
 * Copy this file to kiyan-config.php and fill in real values.
 *
 * Where to put it on cPanel (first match wins):
 *   1. One folder ABOVE the folder that holds api.php (recommended — not web-reachable)
 *      e.g. /home/<user>/kiyan-config.php when api.php is in /home/<user>/public_html/
 *   2. Next to api.php (the bundled .htaccess blocks direct downloads)
 *
 * NEVER commit kiyan-config.php to git.
 */
return [
    // MySQL (cPanel > MySQL Databases)
    'db_host' => 'localhost',
    'db_user' => 'CHANGE_ME',
    'db_pass' => 'CHANGE_ME',
    'db_name' => 'CHANGE_ME',

    // Admin password. Preferred: a hash generated with
    //   php -r "echo password_hash('your-password', PASSWORD_DEFAULT), PHP_EOL;"
    'admin_password_hash' => '',
    // Fallback if you cannot run PHP from a shell (leave empty when using the hash):
    'admin_password' => '',

    // Long random string used to sign admin login tokens (64+ characters).
    // Generate e.g. with: php -r "echo bin2hex(random_bytes(32)), PHP_EOL;"
    // Changing it logs every admin out.
    'token_secret' => 'CHANGE_ME_TO_A_LONG_RANDOM_STRING',

    // Only needed if the front-end is served from a DIFFERENT domain than api.php.
    // e.g. ['https://kiyanteam.example']
    'allowed_origins' => [],
];
