<?php
declare(strict_types=1);
require __DIR__ . '/lib/bootstrap.php';

$configPath = dirname(__DIR__) . '/wl-config.json';
if (!is_file($configPath)) {
    echo json_encode(['ok' => false, 'error' => 'wl-config.json not found']) . PHP_EOL;
    exit(1);
}

$data = json_decode((string) file_get_contents($configPath), true);
if (!is_array($data) || empty($data['coins'])) {
    echo json_encode(['ok' => false, 'error' => 'No coins in wl-config.json']) . PHP_EOL;
    exit(1);
}

wl_set_config_key('coins', $data['coins']);
if (!empty($data['stats'])) wl_set_config_key('stats', $data['stats']);
if (!empty($data['donationConfig'])) wl_set_config_key('donation', $data['donationConfig']);
if (!empty($data['shopCategories'])) wl_save_shop_categories($data['shopCategories']);

$withImages = 0;
foreach ($data['coins'] as $c) {
    if (!empty($c['imageUrl'])) $withImages++;
}

echo json_encode([
    'ok' => true,
    'coins' => count($data['coins']),
    'withImages' => $withImages,
]) . PHP_EOL;
