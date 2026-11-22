<?php

declare(strict_types=1);

/**
 * Create friendship tables if missing. Safe to run on every deploy.
 *
 * Usage: php ensure-friendships-cli.php
 */

require_once __DIR__ . '/lib/bootstrap.php';

wl_migrate_friendships();

$rows = wl_pdo()->query("SHOW TABLES LIKE " . wl_pdo()->quote('friendships'))->fetchAll();

echo json_encode([
    'ok' => true,
    'tables' => [
        'friendships' => count($rows) > 0,
    ],
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n";
