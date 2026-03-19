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

define('DIGITEX_URL',         'https://api.xdigitex.space/deploy.php');
define('DIGITEX_AUTH',        'dx_a6c2ecc10696f578614d5b79abfff621');
define('CYPHERX_MANAGE_URL',  'http://164.68.109.104:5050');
define('GIFTED_STK_URL',      'https://mpesa-stk.giftedtech.co.ke/api/payMaka.php');
define('GIFTED_VERIFY_URL',   'https://mpesa-stk.giftedtech.co.ke/api/verify-transaction.php');
define('OPTIMA_CRYPTO_URL',   'https://optimapaybridge.co.ke/api/v2/crypto_deposit.php');

// Set these in your cPanel environment or replace below
$OPTIMA_KEY    = getenv('OPTIMA_API_KEY')    ?: 'e0b782a1775f838e9e52bbc6207e49b2f0c7e4a03d6bd72265c20d90ff8481b5';
$OPTIMA_SECRET = getenv('OPTIMA_API_SECRET') ?: 'bbf27739b3ccd4bd6da0f3ecdb7c6baa64842136073fa13c97c95e2fcb14f84f';

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

function digitexRequest(array $payload, int $timeout = 65): array {
    $ch = curl_init(DIGITEX_URL);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode($payload),
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json', 'X-AUTH-KEY: ' . DIGITEX_AUTH],
        CURLOPT_TIMEOUT        => $timeout,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);
    $body   = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $decoded = json_decode($body ?: '{}', true) ?? [];
    return ['status' => $status, 'body' => $decoded];
}

function deployViaDigitex(array $payload): ?string {
    $result = digitexRequest($payload);
    $b = $result['body'];
    if (isset($b['error'])) return null; // e.g. "Insufficient Balance"
    if ($result['status'] < 200 || $result['status'] > 299) return null;
    return (string)($b['vps_id'] ?? 'unknown');
}

function statusViaDigitex(string $vpsId): array {
    $result = digitexRequest(['action' => 'status', 'vps_id' => $vpsId], 20);
    return $result['body'];
}

function logsViaDigitex(string $vpsId): array {
    $result = digitexRequest(['action' => 'logs', 'vps_id' => $vpsId], 20);
    return $result['body'];
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

define('DEPLOY_DAYS', 36);


function safeBotName(string $name, int $userId): string {
    return strtolower(preg_replace('/[^a-z0-9]/i', '', $name)) . '_' . $userId . '_' . time();
}

function getBotTypes(): array {
    return [
        [
            'id'          => 'cypher-x',
            'name'        => 'Cypher X',
            'description' => 'The most advanced WhatsApp bot — powered by live VPS deployment. Supports AI replies, group management, media tools, and much more.',
            'costMd'      => 30,
            'deployDays'  => DEPLOY_DAYS,
            'badge'       => 'Live VPS',
            'apiEndpoint' => '/api/bots/cypher-x',
            'features'    => ['Live VPS deployment — 36 days nonstop', 'AI-powered auto replies', 'Group management & anti-delete', 'Media downloads & stickers', 'Custom commands', 'Multi-owner support'],
            'isActive'    => true,
            'envFields'   => [
                ['key' => 'SESSION_ID',   'label' => 'WhatsApp Session ID', 'placeholder' => 'Paste your session string here...', 'required' => true,  'isSecret' => true,  'helpLink' => 'https://xdigitex.space'],
                ['key' => 'OWNER_NUMBER', 'label' => 'Owner Phone Number',  'placeholder' => 'e.g. 254712345678',                 'required' => true,  'isSecret' => false],
            ],
        ],
        [
            'id'          => 'king-md',
            'name'        => 'King MD Bot',
            'description' => 'Specialized WhatsApp MD bot with country code support. Advanced automation, AI replies, and rock-solid group management for power users.',
            'costMd'      => 30,
            'deployDays'  => DEPLOY_DAYS,
            'badge'       => 'Live VPS',
            'apiEndpoint' => '/api/bots/king-md',
            'features'    => ['Live VPS deployment — 36 days nonstop', 'AI-powered auto replies', 'Country code support', 'Group management', 'Media downloads', 'Admin controls'],
            'isActive'    => true,
            'envFields'   => [
                ['key' => 'OWNER_NUMBER', 'label' => 'Owner Phone Number (with country code)', 'placeholder' => 'e.g. 254712345678', 'required' => true,  'isSecret' => false],
                ['key' => 'SESSION_ID',   'label' => 'King MD Session String',   'placeholder' => 'KING_SESSION_HERE', 'required' => true,  'isSecret' => true,  'helpLink' => 'https://peace-hub-mcbo.onrender.com/pair'],
                ['key' => 'COUNTRY_CODE', 'label' => 'Country Code',                          'placeholder' => 'e.g. 254',          'required' => true,  'isSecret' => false],
            ],
        ],
        [
            'id'          => 'bwm-xmd-go',
            'name'        => 'BWM-XMD-GO',
            'description' => 'High-performance Go-based WhatsApp bot with blazing fast container deployment. Built for reliability and speed on dedicated infrastructure.',
            'costMd'      => 50,
            'deployDays'  => DEPLOY_DAYS,
            'badge'       => 'Live VPS',
            'apiEndpoint' => '/api/bots/bwm-xmd-go',
            'features'    => ['Live VPS deployment — 36 days nonstop', 'Go-powered high performance', 'Real-time log streaming', 'Auto media handling', 'Group & sticker tools', 'Fast boot time'],
            'isActive'    => true,
            'envFields'   => [
                ['key' => 'OWNER_NUMBER', 'label' => 'Owner Phone Number',  'placeholder' => 'e.g. 254710000000', 'required' => true,  'isSecret' => false],
                ['key' => 'SESSION_ID',   'label' => 'BWM Session ID',       'placeholder' => 'BWM_SESSION_HERE',  'required' => true,  'isSecret' => true,  'helpLink' => 'https://main.bwmxmd.online/scan/'],
            ],
        ],
        [
            'id'          => 'atassa-cloud',
            'name'        => 'Atassa Cloud',
            'description' => 'Secure cloud-hosted WhatsApp bot with automated port allocation and encrypted deployment. Ideal for group admins and business automation.',
            'costMd'      => 50,
            'deployDays'  => DEPLOY_DAYS,
            'badge'       => 'Live VPS',
            'apiEndpoint' => '/api/bots/atassa-cloud',
            'features'    => ['Live VPS deployment — 36 days nonstop', 'Auto port allocation', 'Encrypted secure containers', 'Live console log streaming', 'Group automation', 'Always-on uptime'],
            'isActive'    => true,
            'envFields'   => [
                ['key' => 'SESSION_ID', 'label' => 'Atassa Session ID', 'placeholder' => 'Atassa~...', 'required' => true, 'isSecret' => true, 'helpLink' => 'https://session.giftedtech.co.ke/'],
            ],
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

// ── POST /wallet/{userId}/stk-push (GiftedTech M-Pesa) ──────

if (preg_match('#^/wallet/(\d+)/stk-push$#', $uri, $m) && $method === 'POST') {
    $userId = (int)$m[1];
    $body   = getBody();
    $phone  = trim($body['phone'] ?? '');
    $amount = (int)($body['amount'] ?? 0);

    if (!$phone || $amount < 1) respondError(400, 'Phone number and amount are required.');

    $normalPhone = normalizePhone($phone);
    if (!str_starts_with($normalPhone, '254') || strlen($normalPhone) !== 12) {
        respondError(400, 'Enter a valid Safaricom number (e.g. 0712345678).');
    }

    $ch = curl_init(GIFTED_STK_URL);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode(['phoneNumber' => $normalPhone, 'amount' => (string)$amount]),
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_TIMEOUT        => 30,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);
    $raw = curl_exec($ch);
    curl_close($ch);

    $data = json_decode($raw ?: '{}', true) ?? [];

    if (!($data['success'] ?? false) || empty($data['CheckoutRequestID'])) {
        respondError(400, $data['message'] ?? 'STK push failed. Please try again.');
    }

    respond(200, [
        'success'           => true,
        'checkoutRequestId' => $data['CheckoutRequestID'],
        'message'           => 'STK push sent. Enter your M-Pesa PIN to complete payment.',
    ]);
}

// ── POST /wallet/stk-status (GiftedTech verify + auto-credit) ─

if ($uri === '/wallet/stk-status' && $method === 'POST') {
    global $db;
    $body              = getBody();
    $checkoutRequestId = $body['checkoutRequestId'] ?? $body['checkout_request_id'] ?? '';
    $userId            = (int)($body['userId'] ?? 0);
    $amount            = (int)($body['amount'] ?? 0);

    if (!$checkoutRequestId) respondError(400, 'checkoutRequestId is required');

    $ch = curl_init(GIFTED_VERIFY_URL);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode(['checkoutRequestId' => $checkoutRequestId]),
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);
    $raw = curl_exec($ch);
    curl_close($ch);

    $data        = json_decode($raw ?: '{}', true) ?? [];
    $status      = strtolower($data['status'] ?? 'pending');
    $resultDesc  = $data['data']['ResultDesc'] ?? '';
    $receiptCode = $data['data']['MpesaReceiptNumber'] ?? '';
    $paidAmount  = (int)($data['data']['Amount'] ?? $amount);

    // Only credit on EXACT 'completed' — never credit on 'cancelled', 'failed', or anything else
    $isCompleted = $status === 'completed';
    $isFailed    = $status === 'failed' || $status === 'cancelled' || $status === 'canceled';

    if ($isCompleted) {
        $creditAmt = $paidAmount > 0 ? $paidAmount : $amount;
        if ($userId > 0 && $creditAmt > 0) {
            $stmt = $db->prepare('SELECT id FROM wallets WHERE user_id = ?');
            $stmt->execute([$userId]);
            if ($stmt->fetch()) {
                $stmt = $db->prepare('UPDATE wallets SET balance_md = balance_md + ?, balance_kes = balance_kes + ? WHERE user_id = ?');
                $stmt->execute([$creditAmt, $creditAmt, $userId]);
                $desc = $receiptCode ? "M-Pesa top-up: $creditAmt KES — Code: $receiptCode" : "M-Pesa top-up: $creditAmt KES";
                $stmt = $db->prepare('INSERT INTO transactions (user_id, type, amount_md, description) VALUES (?, "topup", ?, ?)');
                $stmt->execute([$userId, $creditAmt, $desc]);
            }
        }
        respond(200, ['status' => 'completed', 'amount' => $creditAmt, 'transactionCode' => $receiptCode, 'resultDesc' => $resultDesc]);
    }

    if ($isFailed) {
        respond(200, ['status' => 'failed', 'message' => $resultDesc ?: 'Payment was cancelled or not completed.']);
    }

    respond(200, ['status' => 'pending']);
}

// ── POST /wallet/{userId}/crypto-checkout (OptimaPay USDT) ───

if (preg_match('#^/wallet/(\d+)/crypto-checkout$#', $uri, $m) && $method === 'POST') {
    global $OPTIMA_KEY, $OPTIMA_SECRET;
    $userId    = (int)$m[1];
    $body      = getBody();
    $amountUsd = round((float)($body['amountUsd'] ?? 0), 2);

    if ($amountUsd < 1) respondError(400, 'Minimum $1 USD required.');

    $payload = json_encode([
        'amount'             => $amountUsd,
        'order_id'           => 'TXN_' . $userId . '_' . time(),
        'payment_account_id' => 14,
    ]);

    $ch = curl_init(OPTIMA_CRYPTO_URL);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json',
            'X-API-KEY: '    . $OPTIMA_KEY,
            'X-API-SECRET: ' . $OPTIMA_SECRET,
        ],
        CURLOPT_TIMEOUT        => 25,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);
    $raw      = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr  = curl_error($ch);
    curl_close($ch);

    if ($curlErr) respondError(500, "Gateway connection error: $curlErr");

    $data = [];
    if ($raw) $data = json_decode($raw, true) ?? [];

    if (($data['success'] ?? false) === true && !empty($data['checkout_url'])) {
        respond(200, ['success' => true, 'checkoutUrl' => $data['checkout_url']]);
    }

    $errMsg = $data['message'] ?? $data['error']
        ?? ($httpCode === 500
            ? 'Crypto gateway error (HTTP 500). Verify your OptimaPay API credentials are correct and the account is active.'
            : "OptimaPay error (HTTP $httpCode)");
    respondError(400, $errMsg);
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
    // All deployments always expire in 36 days
    $expiresAt = date('Y-m-d H:i:s', strtotime('+' . DEPLOY_DAYS . ' days'));

    if ($useFreeDeployment && (int)$user['free_deploy_days_left'] > 0) {
        $isFreeDeployment = true;
        $stmt = $db->prepare('UPDATE users SET free_deploy_days_left = 0 WHERE id = ?');
        $stmt->execute([$userId]);
    } else {
        $stmt = $db->prepare('SELECT * FROM wallets WHERE user_id = ?');
        $stmt->execute([$userId]);
        $wallet = $stmt->fetch();
        if (!$wallet) respondError(400, 'Wallet not found');

        $balance = (int)$wallet['balance_md'];
        $cost    = (int)$botType['costMd'];
        if ($balance < $cost) respondError(400, "Insufficient balance. Need $cost MD, have $balance MD.");

        $stmt = $db->prepare('UPDATE wallets SET balance_md = balance_md - ?, balance_kes = balance_kes - ? WHERE user_id = ?');
        $stmt->execute([$cost, $cost, $userId]);

        $stmt = $db->prepare('INSERT INTO transactions (user_id, type, amount_md, description) VALUES (?, "deduction", ?, ?)');
        $stmt->execute([$userId, -$cost, "Bot deployment: $botName ({$botType['name']}) — " . DEPLOY_DAYS . " days"]);
    }

    // Deploy to live VPS based on bot type
    $deployStatus    = 'running';
    $externalBotId   = null;

    $parsedConfig = [];
    if ($config) { $tmp = json_decode($config, true); if (is_array($tmp)) $parsedConfig = $tmp; }

    if ($botTypeId === 'cypher-x') {
        $vpsId = deployViaDigitex([
            'bot_type'     => 'cypherx',
            'owner_number' => $parsedConfig['OWNER_NUMBER'] ?? '',
            'session'      => $parsedConfig['SESSION_ID']   ?? '',
        ]);
        if ($vpsId) { $externalBotId = $vpsId; } else { $deployStatus = 'pending'; }

    } elseif ($botTypeId === 'king-md') {
        $vpsId = deployViaDigitex([
            'bot_type'     => 'king',
            'owner_number' => $parsedConfig['OWNER_NUMBER'] ?? '',
            'session'      => $parsedConfig['SESSION_ID']   ?? '',
            'code'         => $parsedConfig['COUNTRY_CODE'] ?? '254',
        ]);
        if ($vpsId) { $externalBotId = $vpsId; } else { $deployStatus = 'pending'; }

    } elseif ($botTypeId === 'bwm-xmd-go') {
        $vpsId = deployViaDigitex([
            'bot_type'     => 'bwm',
            'bot_name'     => safeBotName($botName, $userId),
            'owner_number' => $parsedConfig['OWNER_NUMBER'] ?? '',
            'session'      => $parsedConfig['SESSION_ID']   ?? '',
        ]);
        if ($vpsId) { $externalBotId = $vpsId; } else { $deployStatus = 'pending'; }

    } elseif ($botTypeId === 'atassa-cloud') {
        $vpsId = deployViaDigitex([
            'bot_type' => 'atassa',
            'bot_name' => safeBotName($botName, $userId),
            'session'  => $parsedConfig['SESSION_ID'] ?? '',
        ]);
        if ($vpsId) { $externalBotId = $vpsId; } else { $deployStatus = 'pending'; }
    }

    $finalApiKey = $externalBotId ?? $apiKey;

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

// ── GET /bots/deployments/{id}/status ───────────────────────

if (preg_match('#^/bots/deployments/(\d+)/status$#', $uri, $m) && $method === 'GET') {
    $id   = (int)$m[1];
    $stmt = $db->prepare('SELECT * FROM bot_deployments WHERE id = ?');
    $stmt->execute([$id]);
    $dep = $stmt->fetch();
    if (!$dep) respondError(404, 'Deployment not found');

    if (!$dep['api_key']) {
        respond(200, ['vps_id' => null, 'status' => $dep['status'], 'message' => 'Bot not yet deployed on VPS']);
    }

    $data = statusViaDigitex($dep['api_key']);

    // Sync DB status
    $vpsStatus = strtolower($data['status'] ?? '');
    if ($vpsStatus === 'running' && $dep['status'] !== 'running') {
        $db->prepare("UPDATE bot_deployments SET status='running' WHERE id=?")->execute([$id]);
    } elseif (in_array($vpsStatus, ['stopped','exited']) && $dep['status'] !== 'stopped') {
        $db->prepare("UPDATE bot_deployments SET status='stopped' WHERE id=?")->execute([$id]);
    }

    respond(200, array_merge(['vps_id' => $dep['api_key']], $data));
}

// ── GET /bots/deployments/{id}/logs ─────────────────────────

if (preg_match('#^/bots/deployments/(\d+)/logs$#', $uri, $m) && $method === 'GET') {
    $id   = (int)$m[1];
    $stmt = $db->prepare('SELECT * FROM bot_deployments WHERE id = ?');
    $stmt->execute([$id]);
    $dep = $stmt->fetch();
    if (!$dep) respondError(404, 'Deployment not found');

    if (!$dep['api_key']) {
        respond(200, ['vps_id' => null, 'logs' => '', 'message' => 'Bot not yet deployed — no VPS logs available']);
    }

    $data = logsViaDigitex($dep['api_key']);
    $logs = $data['logs'] ?? $data['output'] ?? json_encode($data);
    respond(200, ['vps_id' => $dep['api_key'], 'logs' => $logs]);
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
