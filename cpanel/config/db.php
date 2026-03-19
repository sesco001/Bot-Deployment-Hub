<?php
// ============================================================
// DATABASE CONFIGURATION
// Edit these values to match your cPanel MySQL credentials
// ============================================================

define('DB_HOST', 'localhost');
define('DB_NAME', 'your_database_name');   // e.g. youraccount_makames
define('DB_USER', 'your_db_username');     // e.g. youraccount_dbuser
define('DB_PASS', 'your_db_password');
define('DB_CHARSET', 'utf8mb4');

function getDB(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ];
        $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
    }
    return $pdo;
}
