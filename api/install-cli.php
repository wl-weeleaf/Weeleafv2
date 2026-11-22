<?php
declare(strict_types=1);
require __DIR__ . '/lib/bootstrap.php';

$pdo = wl_pdo();
$existing = (int) $pdo->query('SELECT COUNT(*) FROM users')->fetchColumn();
if ($existing > 0) {
    echo json_encode(['ok' => true, 'message' => 'Already installed', 'users' => $existing]) . PHP_EOL;
    exit(0);
}

$configPath = dirname(__DIR__) . '/wl-config.json';
$data = [];
if (is_file($configPath)) {
    $decoded = json_decode((string) file_get_contents($configPath), true);
    if (is_array($decoded)) {
        $data = $decoded;
    }
}
if (!$data) {
    $data = require __DIR__ . '/seed-data.php';
}

$adminId = 'wl-admin';
$testId = 'user-test-wl';
$adminPass = (string) wl_config()['admin_password'];

$pdo->prepare('INSERT INTO users (id, name, email, password_hash, role) VALUES (:id, :name, :email, :hash, :role)')->execute([
    'id' => $adminId, 'name' => 'WL Admin', 'email' => 'admin@weeleaf.com',
    'hash' => password_hash($adminPass, PASSWORD_DEFAULT), 'role' => 'admin',
]);
$pdo->prepare('INSERT INTO users (id, name, email, password_hash, role) VALUES (:id, :name, :email, :hash, :role)')->execute([
    'id' => $testId, 'name' => 'WL Test', 'email' => 'test@weeleaf.com',
    'hash' => password_hash('test1234', PASSWORD_DEFAULT), 'role' => 'member',
]);

if (!empty($data['coins'])) wl_set_config_key('coins', $data['coins']);
if (!empty($data['stats'])) wl_set_config_key('stats', $data['stats']);
if (!empty($data['donationConfig'])) wl_set_config_key('donation', $data['donationConfig']);

$defaultStats = [
    ['id' => 'members', 'label' => 'Medlemmer', 'value' => 0, 'suffix' => ''],
    ['id' => 'co2', 'label' => 'Kg CO₂ sparet', 'value' => 0, 'suffix' => 'kg'],
    ['id' => 'donations', 'label' => 'Donationer', 'value' => 0, 'suffix' => 'kr'],
];
if (!wl_get_config_key('stats')) wl_set_config_key('stats', $defaultStats);
if (!wl_get_config_key('donation')) wl_set_config_key('donation', ['mobilepay' => '', 'link' => '', 'qrImageUrl' => '']);
wl_set_config_key('github', ['token' => '', 'owner' => 'filiptom888-lgtm', 'repo' => 'Weeleafv2', 'branch' => 'main']);

if (!empty($data['shopCategories'])) wl_save_shop_categories($data['shopCategories']);

if (!empty($data['blogPosts'])) {
    $stmt = $pdo->prepare('INSERT INTO posts (id, author, title, body, image_url, tags, created_at) VALUES (:id, :author, :title, :body, :image_url, :tags, :created_at)');
    foreach ($data['blogPosts'] as $post) {
        $date = isset($post['date']) ? gmdate('Y-m-d H:i:s', strtotime($post['date'])) : gmdate('Y-m-d H:i:s');
        $stmt->execute([
            'id' => $post['id'] ?? wl_new_id('post'),
            'author' => $post['author'] ?? 'WL Team',
            'title' => $post['title'] ?? '',
            'body' => $post['body'] ?? '',
            'image_url' => $post['imageUrl'] ?? '',
            'tags' => json_encode($post['tags'] ?? [], JSON_UNESCAPED_UNICODE),
            'created_at' => $date,
        ]);
    }
}

echo json_encode(['ok' => true, 'message' => 'Install complete', 'users' => 2]) . PHP_EOL;
