<?php
// ============================================================
// MaKames Digital Business Center - PHP API Router
// ============================================================

require_once __DIR__ . '/../config/db.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ─── Config ─────────────────────────────────────────────────

define('CYPHERX_DEPLOY_URL', 'https://xdigitex.space/deploy_proxy.php');
define('CYPHERX_MANAGE_URL', 'http://164.68.109.104:5050');
define('CYPHERX_API_KEY',    'cypherx2026');
define('PAYHERO_CHANNEL_ID', 5962);

// Set PAYHERO_AUTH_TOKEN in your environment or replace the string below
$PAYHERO_AUTH = getenv('PAYHERO_AUTH_TOKEN') ?: 'Basic cnN6d3ZSaDBCUGN5WkZTOHlJZkI6RWdCSXFPM3V0T0RvQk01NXJsMFJNNk52QVBCSE41WHJaOERqZndJOQ==';

// ─── Helpers ────────────────────────────────────────────────

function respond(int $status, mixed $data): void {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function respondError(int $status, string $message): void {
    respond($status, ['error' => $message]);
}

function getBody(): array {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function hashPassword(string $password): string {
    return hash('sha256', $password);
}

function generateReferralCode(): string {
    return strtoupper(bin2hex(random_bytes(4)));
}

function generateToken(int $userId): string {
    return 'token-' . $userId . '-' . bin2hex(random_bytes(8));
}

function normalizePhone(string $phone): string {
    $cleaned = preg_replace('/\D/', '', $phone);
    if (strlen($cleaned) === 10 && str_starts_with($cleaned, '0')) {
        return '254' . substr($cleaned, 1);
    }
    return $cleaned;
}

function httpPost(string $url, array $data, array $headers = []): array {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode($data),
        CURLOPT_HTTPHEADER     => array_merge(['Content-Type: application/json'], $headers),
        CURLOPT_TIMEOUT        => 65,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);
    $body   = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $decoded = json_decode($body ?: '{}', true) ?? [];
    return ['status' => $status, 'body' => $decoded, 'raw' => $body];
}

function deployCypherX(string $sessionId, string $ownerNumber): ?string {
    $result = httpPost(
        CYPHERX_DEPLOY_URL,
        [
            'repo_url' => 'https://github.com/Dark-Xploit/CypherX',
            'env'      => ['SESSION_ID' => $sessionId, 'OWNER_NUMBER' => $ownerNumber],
        ],
        ['x-api-key: ' . CYPHERX_API_KEY]
    );
    if ($result['status'] === 200 || $result['status'] === 201) {
        $b = $result['body'];
        return $b['deployment']['id'] ?? $b['container_id'] ?? $b['id'] ?? null;
    }
    return null;
}

function manageCypherX(string $action, string $botId): void {
    $method = ($action === 'delete') ? 'DELETE' : 'POST';
    $ch = curl_init(CYPHERX_MANAGE_URL . "/$action/$botId");
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST  => $method,
        CURLOPT_HTTPHEADER     => ['Auth-Key: 254MANAGER'],
        CURLOPT_TIMEOUT        => 15,
    ]);
    curl_exec($ch);
    curl_close($ch);
}

function formatUser(array $u): array {
    return [
        'id'                  => (int)$u['id'],
        'username'            => $u['username'],
        'email'               => $u['email'],
        'referralCode'        => $u['referral_code'],
        'referredBy'          => $u['referred_by'] !== null ? (int)$u['referred_by'] : null,
        'freeDeployDaysLeft'  => (int)$u['free_deploy_days_left'],
        'createdAt'           => $u['created_at'],
    ];
}

function formatWallet(array $w): array {
    return [
        'id'         => (int)$w['id'],
        'userId'     => (int)$w['user_id'],
        'balanceMd'  => (int)$w['balance_md'],
        'balanceKes' => (int)$w['balance_kes'],
        'updatedAt'  => $w['updated_at'],
    ];
}

function formatTransaction(array $t): array {
    return [
        'id'          => (int)$t['id'],
        'userId'      => (int)$t['user_id'],
        'type'        => $t['type'],
        'amountMd'    => (int)$t['amount_md'],
        'description' => $t['description'],
        'createdAt'   => $t['created_at'],
    ];
}

function formatDeployment(array $d): array {
    return [
        'id'               => (int)$d['id'],
        'userId'           => (int)$d['user_id'],
        'botTypeId'        => $d['bot_type_id'],
        'botName'          => $d['bot_name'],
        'status'           => $d['status'],
        'apiKey'           => $d['api_key'],
        'config'           => $d['config'],
        'deployedAt'       => $d['deployed_at'],
        'expiresAt'        => $d['expires_at'],
        'updatedAt'        => $d['updated_at'],
    ];
}

// ─── Bot Types ──────────────────────────────────────────────

function getBotTypes(): array {
    return [
        [
            'id'          => 'cypher-x',
            'name'        => 'Cypher X',
            'description' => 'The most advanced WhatsApp bot — powered by live VPS deployment. Supports AI replies, group management, media tools, and much more.',
            'costMd'      => 30,
            'apiEndpoint' => '/api/bots/cypher-x',
            'features'    => ['Live VPS deployment', 'AI-powered auto replies', 'Group management & anti-delete', 'Media downloads & stickers', 'Custom commands', 'Multi-owner support'],
            'isActive'    => true,
            'envFields'   => [
                ['key' => 'SESSION_ID',    'label' => 'WhatsApp Session ID',  'placeholder' => 'Paste your session string here...', 'required' => true,  'isSecret' => true,  'helpLink' => 'https://xdigitex.space'],
                ['key' => 'OWNER_NUMBER',  'label' => 'Owner Phone Number',   'placeholder' => 'e.g. 254712345678',                 'required' => true,  'isSecret' => false],
            ],
        ],
        [
            'id'          => 'king-md',
            'name'        => 'King MD Bot',
            'description' => 'The flagship WhatsApp/Telegram bot with advanced automation, AI replies, and multi-platform support.',
            'costMd'      => 30,
            'apiEndpoint' => '/api/bots/king-md',
            'features'    => ['AI-powered auto replies', 'Multi-platform support', 'Group management', 'Media downloads', 'Custom commands', 'Admin controls'],
            'isActive'    => true,
        ],
        [
            'id'          => 'social-bot',
            'name'        => 'Social Media Bot',
            'description' => 'Automate your social media presence with scheduled posts, engagement tools, and analytics.',
            'costMd'      => 50,
            'apiEndpoint' => '/api/bots/social-bot',
            'features'    => ['Scheduled posting', 'Auto engagement', 'Cross-platform support', 'Analytics dashboard', 'Hashtag automation', 'DM automation'],
            'isActive'    => true,
        ],
        [
            'id'          => 'ecommerce-bot',
            'name'        => 'E-Commerce Bot',
            'description' => 'Handle customer inquiries, orders, and payments automatically.',
            'costMd'      => 50,
            'apiEndpoint' => '/api/bots/ecommerce-bot',
            'features'    => ['Order management', 'Payment integration', 'Inventory alerts', 'Customer support', 'Product catalog', 'Auto invoicing'],
            'isActive'    => true,
        ],
        [
            'id'          => 'crypto-bot',
            'name'        => 'Crypto Trading Bot',
            'description' => 'Monitor cryptocurrency markets and automate trading strategies.',
            'costMd'      => 50,
            'apiEndpoint' => '/api/bots/crypto-bot',
            'features'    => ['Real-time price alerts', 'Trading signals', 'Portfolio tracking', 'Multi-exchange support', 'Risk management', 'PnL reports'],
            'isActive'    => false,
        ],
    ];
}

// ─── Router ─────────────────────────────────────────────────

$method = $_SERVER['REQUEST_METHOD'];
$uri    = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$uri    = preg_replace('#^/api#', '', $uri);
$uri    = rtrim($uri, '/') ?: '/';
$db     = getDB();

// ── Health ──────────────────────────────────────────────────

if ($uri === '/healthz' && $method === 'GET') {
    respond(200, ['status' => 'ok']);
}

// ── POST /users/register ────────────────────────────────────

if ($uri === '/users/register' && $method === 'POST') {
    $body         = getBody();
    $username     = trim($body['username'] ?? '');
    $email        = trim($body['email'] ?? '');
    $password     = $body['password'] ?? '';
    $referralCode = $body['referralCode'] ?? null;

    if (!$username || !$email || !$password) respondError(400, 'username, email and password are required');

    $stmt = $db->prepare('SELECT id FROM users WHERE email = ?');
    $stmt->execute([$email]);
    if ($stmt->fetch()) respondError(400, 'Email already registered');

    $stmt = $db->prepare('SELECT id FROM users WHERE username = ?');
    $stmt->execute([$username]);
    if ($stmt->fetch()) respondError(400, 'Username already taken');

    $referredBy = null;
    if ($referralCode) {
        $stmt = $db->prepare('SELECT id FROM users WHERE referral_code = ?');
        $stmt->execute([$referralCode]);
        $referrer = $stmt->fetch();
        if ($referrer) $referredBy = (int)$referrer['id'];
    }

    $myCode       = generateReferralCode();
    $passwordHash = hashPassword($password);

    $stmt = $db->prepare('INSERT INTO users (username, email, password_hash, referral_code, referred_by, free_deploy_days_left) VALUES (?, ?, ?, ?, ?, 0)');
    $stmt->execute([$username, $email, $passwordHash, $myCode, $referredBy]);
    $userId = (int)$db->lastInsertId();

    $stmt = $db->prepare('INSERT INTO wallets (user_id, balance_md, balance_kes) VALUES (?, 0, 0)');
    $stmt->execute([$userId]);

    if ($referredBy) {
        $stmt = $db->prepare('INSERT INTO referrals (referrer_id, referred_user_id) VALUES (?, ?)');
        $stmt->execute([$referredBy, $userId]);

        $stmt = $db->prepare('SELECT COUNT(*) AS cnt FROM referrals WHERE referrer_id = ?');
        $stmt->execute([$referredBy]);
        $total = (int)$stmt->fetch()['cnt'];
        if ($total % 5 === 0) {
            $stmt = $db->prepare('UPDATE users SET free_deploy_days_left = 3 WHERE id = ?');
            $stmt->execute([$referredBy]);
        }
    }

    $stmt = $db->prepare('SELECT * FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    respond(201, formatUser($stmt->fetch()));
}

// ── POST /users/login ───────────────────────────────────────

if ($uri === '/users/login' && $method === 'POST') {
    $body  = getBody();
    $email = trim($body['email'] ?? '');
    $pass  = $body['password'] ?? '';

    if (!$email || !$pass) respondError(400, 'email and password are required');

    $stmt = $db->prepare('SELECT * FROM users WHERE email = ?');
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if (!$user || $user['password_hash'] !== hashPassword($pass)) respondError(401, 'Invalid email or password');

    respond(200, ['user' => formatUser($user), 'token' => generateToken((int)$user['id'])]);
}

// ── GET /users/{userId} ─────────────────────────────────────

if (preg_match('#^/users/(\d+)$#', $uri, $m) && $method === 'GET') {
    $userId = (int)$m[1];
    $stmt   = $db->prepare('SELECT * FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    $user = $stmt->fetch();
    if (!$user) respondError(404, 'User not found');
    respond(200, formatUser($user));
}

// ── GET /wallet/{userId} ────────────────────────────────────

if (preg_match('#^/wallet/(\d+)$#', $uri, $m) && $method === 'GET') {
    $userId = (int)$m[1];
    $stmt   = $db->prepare('SELECT * FROM wallets WHERE user_id = ?');
    $stmt->execute([$userId]);
    $wallet = $stmt->fetch();
    if (!$wallet) respondError(404, 'Wallet not found');
    respond(200, formatWallet($wallet));
}

// ── POST /wallet/{userId}/stk-push (PayHero M-Pesa) ─────────

if (preg_match('#^/wallet/(\d+)/stk-push$#', $uri, $m) && $method === 'POST') {
    global $PAYHERO_AUTH;
    $userId = (int)$m[1];
    $body   = getBody();
    $phone  = trim($body['phone'] ?? '');
    $amount = (int)($body['amount'] ?? 0);

    if (!$phone || $amount < 10) respondError(400, 'Phone number and amount (min 10 KES) are required.');

    $normalPhone = normalizePhone($phone);
    $reference   = 'MD-' . $userId . '-' . time();

    $domain      = $_SERVER['HTTP_HOST'] ?? '';
    $callbackUrl = $domain ? "https://$domain/api/wallet/payhero-callback" : 'https://makamesdigital.replit.app/api/wallet/payhero-callback';

    $payload = [
        'amount'             => $amount,
        'phone_number'       => $normalPhone,
        'channel_id'         => PAYHERO_CHANNEL_ID,
        'provider'           => 'm-pesa',
        'external_reference' => $reference,
        'callback_url'       => $callbackUrl,
    ];

    $ch = curl_init('https://backend.payhero.co.ke/api/v2/payments');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode($payload),
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json',
            'Authorization: ' . $PAYHERO_AUTH,
        ],
        CURLOPT_TIMEOUT        => 30,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);
    $raw    = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $data = json_decode($raw ?: '{}', true) ?? [];

    if ($status < 200 || $status >= 300) {
        $msg = $data['message'] ?? $data['error'] ?? "PayHero error $status";
        respondError(400, $msg);
    }

    respond(200, [
        'success'           => true,
        'reference'         => $reference,
        'checkoutRequestId' => $data['CheckoutRequestID'] ?? $data['checkout_request_id'] ?? $reference,
        'message'           => 'STK push sent. Enter PIN on your phone to complete payment.',
    ]);
}

// ── POST /wallet/payhero-callback ───────────────────────────

if ($uri === '/wallet/payhero-callback' && $method === 'POST') {
    $body      = getBody();
    $status    = $body['Status'] ?? $body['status'] ?? '';
    $reference = $body['ExternalReference'] ?? $body['external_reference'] ?? '';
    $amount    = (int)($body['Amount'] ?? $body['amount'] ?? 0);

    $isSuccess = in_array(strtolower($status), ['success', 'complete', 'completed'], true);

    if ($isSuccess && $reference && $amount > 0) {
        $parts  = explode('-', $reference);
        $userId = (int)($parts[1] ?? 0);
        if ($userId > 0) {
            $stmt = $db->prepare('SELECT * FROM wallets WHERE user_id = ?');
            $stmt->execute([$userId]);
            $wallet = $stmt->fetch();
            if ($wallet) {
                $stmt = $db->prepare('UPDATE wallets SET balance_md = balance_md + ?, balance_kes = balance_kes + ? WHERE user_id = ?');
                $stmt->execute([$amount, $amount, $userId]);
                $stmt = $db->prepare('INSERT INTO transactions (user_id, type, amount_md, description) VALUES (?, "topup", ?, ?)');
                $stmt->execute([$userId, $amount, "M-Pesa top-up (PayHero): $amount KES"]);
            }
        }
    }

    respond(200, ['status' => 'received']);
}

// ── POST /wallet/{userId}/topup (manual/card/international) ─

if (preg_match('#^/wallet/(\d+)/topup$#', $uri, $m) && $method === 'POST') {
    $userId        = (int)$m[1];
    $body          = getBody();
    $amountKes     = (int)($body['amountKes'] ?? 0);
    $paymentMethod = $body['paymentMethod'] ?? '';

    if ($amountKes <= 0) respondError(400, 'amountKes must be positive');
    if (!$paymentMethod) respondError(400, 'paymentMethod is required');

    $amountMd = $amountKes;

    $stmt = $db->prepare('SELECT * FROM wallets WHERE user_id = ?');
    $stmt->execute([$userId]);
    $wallet = $stmt->fetch();
    if (!$wallet) respondError(404, 'Wallet not found');

    $stmt = $db->prepare('UPDATE wallets SET balance_md = balance_md + ?, balance_kes = balance_kes + ? WHERE user_id = ?');
    $stmt->execute([$amountMd, $amountKes, $userId]);

    $stmt = $db->prepare('INSERT INTO transactions (user_id, type, amount_md, description) VALUES (?, "topup", ?, ?)');
    $stmt->execute([$userId, $amountMd, "Top-up via $paymentMethod: $amountKes KES"]);

    $stmt = $db->prepare('SELECT * FROM wallets WHERE user_id = ?');
    $stmt->execute([$userId]);
    respond(200, formatWallet($stmt->fetch()));
}

// ── GET /wallet/{userId}/transactions ───────────────────────

if (preg_match('#^/wallet/(\d+)/transactions$#', $uri, $m) && $method === 'GET') {
    $userId = (int)$m[1];
    $stmt   = $db->prepare('SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50');
    $stmt->execute([$userId]);
    respond(200, array_map('formatTransaction', $stmt->fetchAll()));
}

// ── GET /bots ───────────────────────────────────────────────

if ($uri === '/bots' && $method === 'GET') {
    respond(200, getBotTypes());
}

// ── GET /bots/deployments ───────────────────────────────────

if ($uri === '/bots/deployments' && $method === 'GET') {
    $userId = (int)($_GET['userId'] ?? 0);
    if (!$userId) respondError(400, 'userId is required');
    $stmt = $db->prepare('SELECT * FROM bot_deployments WHERE user_id = ?');
    $stmt->execute([$userId]);
    respond(200, array_map('formatDeployment', $stmt->fetchAll()));
}

// ── POST /bots/deployments ──────────────────────────────────

if ($uri === '/bots/deployments' && $method === 'POST') {
    $body              = getBody();
    $userId            = (int)($body['userId'] ?? 0);
    $botTypeId         = $body['botTypeId'] ?? '';
    $botName           = trim($body['botName'] ?? '');
    $apiKey            = $body['apiKey'] ?? null;
    $config            = $body['config'] ?? null;
    $useFreeDeployment = (bool)($body['useFreeDeployment'] ?? false);

    if (!$userId || !$botTypeId || !$botName) respondError(400, 'userId, botTypeId and botName are required');

    $botTypes = getBotTypes();
    $botType  = null;
    foreach ($botTypes as $bt) {
        if ($bt['id'] === $botTypeId) { $botType = $bt; break; }
    }
    if (!$botType)            respondError(400, 'Bot type not found');
    if (!$botType['isActive']) respondError(400, 'This bot is not yet available');

    $stmt = $db->prepare('SELECT * FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    $user = $stmt->fetch();
    if (!$user) respondError(404, 'User not found');

    $isFreeDeployment = false;
    $expiresAt        = null;

    if ($useFreeDeployment && (int)$user['free_deploy_days_left'] > 0) {
        $isFreeDeployment = true;
        $days      = (int)$user['free_deploy_days_left'];
        $expiresAt = date('Y-m-d H:i:s', strtotime("+$days days"));
        $stmt      = $db->prepare('UPDATE users SET free_deploy_days_left = 0 WHERE id = ?');
        $stmt->execute([$userId]);
    } else {
        $stmt = $db->prepare('SELECT * FROM wallets WHERE user_id = ?');
        $stmt->execute([$userId]);
        $wallet = $stmt->fetch();
        if (!$wallet) respondError(400, 'Wallet not found');

        $balance = (int)$wallet['balance_md'];
        $cost    = (int)$botType['costMd'];
        if ($balance < $cost) respondError(400, "Insufficient balance. You need $cost MDs but have $balance MDs.");

        $stmt = $db->prepare('UPDATE wallets SET balance_md = balance_md - ?, balance_kes = balance_kes - ? WHERE user_id = ?');
        $stmt->execute([$cost, $cost, $userId]);

        $stmt = $db->prepare('INSERT INTO transactions (user_id, type, amount_md, description) VALUES (?, "deduction", ?, ?)');
        $stmt->execute([$userId, -$cost, "Bot deployment: $botName ({$botType['name']})"]);
    }

    // CypherX: deploy to live VPS
    $deployStatus       = 'running';
    $externalContainerId = null;

    if ($botTypeId === 'cypher-x') {
        $parsedConfig = [];
        if ($config) { $tmp = json_decode($config, true); if (is_array($tmp)) $parsedConfig = $tmp; }

        $sessionId   = $parsedConfig['SESSION_ID']   ?? '';
        $ownerNumber = $parsedConfig['OWNER_NUMBER']  ?? '';

        $containerId = deployCypherX($sessionId, $ownerNumber);
        if ($containerId) {
            $externalContainerId = $containerId;
        } else {
            $deployStatus = 'pending';
        }
    }

    $finalApiKey = $externalContainerId ?? $apiKey;

    $stmt = $db->prepare('INSERT INTO bot_deployments (user_id, bot_type_id, bot_name, status, api_key, config, is_free_deployment, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    $stmt->execute([$userId, $botTypeId, $botName, $deployStatus, $finalApiKey, $config, $isFreeDeployment ? 1 : 0, $expiresAt]);
    $deploymentId = (int)$db->lastInsertId();

    $stmt = $db->prepare('SELECT * FROM bot_deployments WHERE id = ?');
    $stmt->execute([$deploymentId]);
    respond(201, formatDeployment($stmt->fetch()));
}

// ── GET /bots/deployments/{id} ──────────────────────────────

if (preg_match('#^/bots/deployments/(\d+)$#', $uri, $m) && $method === 'GET') {
    $id   = (int)$m[1];
    $stmt = $db->prepare('SELECT * FROM bot_deployments WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) respondError(404, 'Deployment not found');
    respond(200, formatDeployment($row));
}

// ── PATCH /bots/deployments/{id} ────────────────────────────

if (preg_match('#^/bots/deployments/(\d+)$#', $uri, $m) && $method === 'PATCH') {
    $id   = (int)$m[1];
    $body = getBody();

    $sets = []; $params = [];
    if (isset($body['botName']) && $body['botName'] !== null) { $sets[] = 'bot_name = ?'; $params[] = $body['botName']; }
    if (array_key_exists('apiKey', $body))                    { $sets[] = 'api_key = ?';  $params[] = $body['apiKey']; }
    if (array_key_exists('config', $body))                    { $sets[] = 'config = ?';   $params[] = $body['config']; }
    if (isset($body['status']) && in_array($body['status'], ['running', 'stopped'], true)) {
        $sets[] = 'status = ?'; $params[] = $body['status'];
    }

    if (empty($sets)) respondError(400, 'No fields to update');

    $params[] = $id;
    $stmt     = $db->prepare('UPDATE bot_deployments SET ' . implode(', ', $sets) . ' WHERE id = ?');
    $stmt->execute($params);
    if ($stmt->rowCount() === 0) respondError(404, 'Deployment not found');

    $stmt = $db->prepare('SELECT * FROM bot_deployments WHERE id = ?');
    $stmt->execute([$id]);
    respond(200, formatDeployment($stmt->fetch()));
}

// ── DELETE /bots/deployments/{id} ───────────────────────────

if (preg_match('#^/bots/deployments/(\d+)$#', $uri, $m) && $method === 'DELETE') {
    $id   = (int)$m[1];

    // If CypherX, call management API to stop/delete on VPS
    $stmt = $db->prepare('SELECT * FROM bot_deployments WHERE id = ?');
    $stmt->execute([$id]);
    $dep = $stmt->fetch();
    if ($dep && $dep['bot_type_id'] === 'cypher-x' && $dep['api_key']) {
        manageCypherX('delete', $dep['api_key']);
    }

    $stmt = $db->prepare('DELETE FROM bot_deployments WHERE id = ?');
    $stmt->execute([$id]);
    if ($stmt->rowCount() === 0) respondError(404, 'Deployment not found');
    http_response_code(204);
    exit;
}

// ── POST /bots/deployments/{id}/restart ─────────────────────

if (preg_match('#^/bots/deployments/(\d+)/restart$#', $uri, $m) && $method === 'POST') {
    $id   = (int)$m[1];

    $stmt = $db->prepare('SELECT * FROM bot_deployments WHERE id = ?');
    $stmt->execute([$id]);
    $dep = $stmt->fetch();
    if (!$dep) respondError(404, 'Deployment not found');

    if ($dep['bot_type_id'] === 'cypher-x' && $dep['api_key']) {
        manageCypherX('restart', $dep['api_key']);
    }

    $stmt = $db->prepare("UPDATE bot_deployments SET status = 'running' WHERE id = ?");
    $stmt->execute([$id]);

    $stmt = $db->prepare('SELECT * FROM bot_deployments WHERE id = ?');
    $stmt->execute([$id]);
    respond(200, formatDeployment($stmt->fetch()));
}

// ── GET /referrals/{userId} ─────────────────────────────────

if (preg_match('#^/referrals/(\d+)$#', $uri, $m) && $method === 'GET') {
    $userId = (int)$m[1];

    $stmt = $db->prepare('SELECT * FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    $user = $stmt->fetch();
    if (!$user) respondError(404, 'User not found');

    $stmt = $db->prepare('SELECT r.*, u.username FROM referrals r JOIN users u ON u.id = r.referred_user_id WHERE r.referrer_id = ?');
    $stmt->execute([$userId]);
    $rows = $stmt->fetchAll();

    $entries = array_map(fn($r) => [
        'id'               => (int)$r['id'],
        'referredUsername' => $r['username'],
        'joinedAt'         => $r['joined_at'],
    ], $rows);

    respond(200, [
        'userId'             => $userId,
        'referralCode'       => $user['referral_code'],
        'referralCount'      => count($rows),
        'freeDeployDaysLeft' => (int)$user['free_deploy_days_left'],
        'referrals'          => $entries,
    ]);
}

// ── POST /referrals/apply ───────────────────────────────────

if ($uri === '/referrals/apply' && $method === 'POST') {
    $body         = getBody();
    $userId       = (int)($body['userId'] ?? 0);
    $referralCode = trim($body['referralCode'] ?? '');

    if (!$userId || !$referralCode) respondError(400, 'userId and referralCode are required');

    $stmt = $db->prepare('SELECT * FROM users WHERE referral_code = ?');
    $stmt->execute([$referralCode]);
    $referrer = $stmt->fetch();
    if (!$referrer) respondError(400, 'Invalid referral code');
    if ((int)$referrer['id'] === $userId) respondError(400, 'Cannot use your own referral code');

    $stmt = $db->prepare('SELECT id FROM referrals WHERE referred_user_id = ?');
    $stmt->execute([$userId]);
    if ($stmt->fetch()) respondError(400, 'Already used a referral code');

    $stmt = $db->prepare('INSERT INTO referrals (referrer_id, referred_user_id) VALUES (?, ?)');
    $stmt->execute([(int)$referrer['id'], $userId]);

    $stmt = $db->prepare('UPDATE users SET referred_by = ? WHERE id = ?');
    $stmt->execute([(int)$referrer['id'], $userId]);

    $stmt = $db->prepare('SELECT COUNT(*) AS cnt FROM referrals WHERE referrer_id = ?');
    $stmt->execute([(int)$referrer['id']]);
    $total = (int)$stmt->fetch()['cnt'];

    $freeDeployDaysGranted = 0;
    if ($total % 5 === 0) {
        $freeDeployDaysGranted = 3;
        $stmt = $db->prepare('UPDATE users SET free_deploy_days_left = 3 WHERE id = ?');
        $stmt->execute([(int)$referrer['id']]);
    }

    respond(200, [
        'success'               => true,
        'message'               => $freeDeployDaysGranted > 0
            ? "Referral applied! {$referrer['username']} earned $freeDeployDaysGranted free deployment days!"
            : 'Referral applied successfully!',
        'freeDeployDaysGranted' => $freeDeployDaysGranted,
    ]);
}

// ── 404 fallback ─────────────────────────────────────────────
respondError(404, 'API endpoint not found');
