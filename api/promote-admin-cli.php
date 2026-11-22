<?php

declare(strict_types=1);

/**
 * Promote an existing user to admin by email.
 *
 * Usage (on server):
 *   cd ~/domains/weeleaf.com/public_html/api
 *   php promote-admin-cli.php user@example.com
 */
require __DIR__ . '/lib/bootstrap.php';

$email = strtolower(trim($argv[1] ?? ($_GET['email'] ?? '')));
if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    echo json_encode(['ok' => false, 'error' => 'Usage: php promote-admin-cli.php user@example.com']) . PHP_EOL;
    exit(1);
}

$stmt = wl_pdo()->prepare('SELECT id, name, email, role FROM users WHERE email = :email LIMIT 1');
$stmt->execute(['email' => $email]);
$user = $stmt->fetch();

if (!$user) {
    echo json_encode(['ok' => false, 'error' => 'Ingen bruger fundet med den e-mail. Opret konto først.']) . PHP_EOL;
    exit(1);
}

if ($user['role'] === 'admin') {
    echo json_encode([
        'ok' => true,
        'message' => 'Brugeren er allerede admin.',
        'user' => ['id' => $user['id'], 'name' => $user['name'], 'email' => $user['email'], 'role' => 'admin'],
    ], JSON_UNESCAPED_UNICODE) . PHP_EOL;
    exit(0);
}

wl_pdo()->prepare('UPDATE users SET role = :role WHERE id = :id')->execute([
    'role' => 'admin',
    'id' => $user['id'],
]);

echo json_encode([
    'ok' => true,
    'message' => 'Bruger opgraderet til admin.',
    'user' => ['id' => $user['id'], 'name' => $user['name'], 'email' => $user['email'], 'role' => 'admin'],
], JSON_UNESCAPED_UNICODE) . PHP_EOL;
