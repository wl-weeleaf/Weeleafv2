<?php

declare(strict_types=1);

/**
 * Repair coin images on disk + DB.
 * Optional: restore base64 from wl-config.json when files are missing.
 */
require __DIR__ . '/lib/bootstrap.php';

$coins = wl_get_config_key('coins', []);
if (!is_array($coins)) {
    $coins = [];
}

$restored = 0;
$configPath = dirname(__DIR__) . '/wl-config.json';
$configCoins = [];

if (is_file($configPath)) {
    $data = json_decode((string) file_get_contents($configPath), true);
    foreach (($data['coins'] ?? []) as $c) {
        if (!empty($c['id'])) {
            $configCoins[$c['id']] = $c;
        }
    }
}

foreach ($coins as &$coin) {
    $id = (string) ($coin['id'] ?? '');
    if ($id === '') {
        continue;
    }

    $url = (string) ($coin['imageUrl'] ?? '');
    $needsFile = $url === '' || str_starts_with($url, '/uploads/');
    $fileMissing = true;

    if (str_starts_with($url, '/uploads/')) {
        $diskPath = dirname(__DIR__) . $url;
        $fileMissing = !is_file($diskPath);
    }

    if ($needsFile && $fileMissing && isset($configCoins[$id]['imageUrl'])) {
        $src = (string) $configCoins[$id]['imageUrl'];
        if ($src !== '') {
            $coin['imageUrl'] = $src;
            $restored++;
        }
    }

    if ($id === 'member' && $fileMissing) {
        $hive = null;
        foreach ($configCoins as $cc) {
            if (($cc['id'] ?? '') === 'wl-hive' && !empty($cc['imageUrl'])) {
                $hive = (string) $cc['imageUrl'];
                break;
            }
        }
        if ($hive !== null && $hive !== '') {
            $coin['imageUrl'] = $hive;
            $restored++;
        }
    }
}
unset($coin);

if ($restored > 0) {
    wl_set_config_key('coins', $coins);
}

$repair = wl_repair_coin_image_urls();
$coins = $repair['coins'] ?: $coins;

$result = wl_externalize_coin_images($coins);
if ($result['changed']) {
    wl_set_config_key('coins', $result['coins']);
}

$written = 0;
foreach ($result['coins'] as $coin) {
    $url = (string) ($coin['imageUrl'] ?? '');
    if (str_starts_with($url, '/uploads/')) {
        $diskPath = dirname(__DIR__) . $url;
        if (is_file($diskPath)) {
            $written++;
        }
    }
}

echo json_encode([
    'ok' => true,
    'restoredFromConfig' => $restored,
    'repairedFromDisk' => $repair['repaired'] ?? 0,
    'filesOnDisk' => $written,
    'coins' => count($result['coins']),
]) . PHP_EOL;
