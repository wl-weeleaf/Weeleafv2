<?php

declare(strict_types=1);

require __DIR__ . '/lib/bootstrap.php';

$coins = wl_get_config_key('coins', []);
$coinResult = is_array($coins) ? wl_externalize_coin_images($coins) : ['coins' => [], 'changed' => false];
if ($coinResult['changed']) {
    wl_set_config_key('coins', $coinResult['coins']);
}

$blogMigrated = wl_migrate_blog_post_images();
wl_get_donation_for_api();

echo json_encode([
    'ok' => true,
    'coinsChanged' => $coinResult['changed'],
    'blogMigrated' => $blogMigrated,
    'coinCount' => count($coinResult['coins']),
]) . PHP_EOL;
