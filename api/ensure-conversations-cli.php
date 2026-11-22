<?php

declare(strict_types=1);

/**
 * Create DM tables if missing. Safe to run on every deploy.
 *
 * Usage: php ensure-conversations-cli.php
 */

require_once __DIR__ . '/lib/bootstrap.php';

wl_migrate_conversations();

$tables = [];
foreach (['conversations', 'conversation_members', 'messages'] as $name) {
    $rows = wl_pdo()->query("SHOW TABLES LIKE " . wl_pdo()->quote($name))->fetchAll();
    $tables[$name] = count($rows) > 0;
}

echo json_encode([
    'ok' => true,
    'tables' => $tables,
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n";
