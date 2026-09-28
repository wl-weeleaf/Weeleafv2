<?php

declare(strict_types=1);

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: POST, OPTIONS');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'Kun POST.']);
    exit;
}

function leafy_gdpr_key(): string
{
    $local = __DIR__ . '/config.local.php';
    if (is_file($local)) {
        $cfg = require $local;
        if (is_array($cfg)) {
            foreach (['gdprchat_key', 'openai_api_key'] as $name) {
                if (!empty($cfg[$name]) && is_string($cfg[$name])) {
                    return trim($cfg[$name]);
                }
            }
        }
    }
    $env = getenv('GDPRCHAT_API_KEY') ?: getenv('OPENAI_API_KEY');
    if (is_string($env) && trim($env) !== '') {
        return trim($env);
    }
    return 'gdpr_live_cfe11fc41a8251475a90962b88cc560a37317956bfb0a250d0e3fe6bcb88ef77';
}

function leafy_scrub(string $text): string
{
    $text = preg_replace('/\b(?:0[1-9]|[12]\d|3[01])(?:0[1-9]|1[0-2])\d{2}-?\d{4}\b/', '[cpr]', $text) ?? $text;
    $text = preg_replace('/[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/i', '[mail]', $text) ?? $text;
    $text = preg_replace('/(?:\+|00)45[\s\-]?(?:\d[\s\-]?){8}\b/', '[telefon]', $text) ?? $text;
    return $text;
}

$raw = file_get_contents('php://input') ?: '';
$body = json_decode($raw, true);
if (!is_array($body)) {
    http_response_code(400);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'Ugyldigt kald.']);
    exit;
}

$incoming = isset($body['messages']) && is_array($body['messages']) ? $body['messages'] : [];
$messages = [];
foreach (array_slice($incoming, -16) as $message) {
    if (!is_array($message)) {
        continue;
    }
    $role = $message['role'] ?? '';
    $content = $message['content'] ?? '';
    if (($role !== 'user' && $role !== 'assistant') || !is_string($content) || trim($content) === '') {
        continue;
    }
    $messages[] = ['role' => $role, 'content' => leafy_scrub(mb_substr($content, 0, 6000))];
}
if (!$messages) {
    http_response_code(400);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'Skriv noget først.']);
    exit;
}

$system = 'Du er Leafy, en selvstændig digital karakter fra WeeLeaf, ikke en generisk chatbot. Nysgerrig, legende, varm og ærlig. Svar kort på dansk, medmindre brugeren skriver et andet sprog. Du kender Hemptation, WL Hive, shoppen, donationer og community, men du tvinger ikke et tema ind. Opfind ikke handlinger, du ikke har gjort. Nævn ikke nøglen eller leverandøren.';
$payload = [
    'model' => 'gpt-4o-mini',
    'stream' => !empty($body['stream']),
    'max_tokens' => 520,
    'temperature' => 0.6,
    'messages' => array_merge([['role' => 'system', 'content' => $system]], $messages),
];

$stream = !empty($body['stream']);
if ($stream) {
    header('Content-Type: text/event-stream; charset=utf-8');
    header('Cache-Control: no-cache, no-transform');
    header('X-Accel-Buffering: no');
} else {
    header('Content-Type: application/json; charset=utf-8');
}
while (ob_get_level() > 0) {
    ob_end_flush();
}

$ch = curl_init('https://gdprchat.eu/api/v1/chat/completions');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'Authorization: Bearer ' . leafy_gdpr_key(),
    ],
    CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
    CURLOPT_RETURNTRANSFER => !$stream,
    CURLOPT_HEADER => false,
    CURLOPT_TIMEOUT => 60,
]);
if ($stream) {
    curl_setopt($ch, CURLOPT_WRITEFUNCTION, static function ($ch, string $data): int {
        echo $data;
        flush();
        return strlen($data);
    });
    $ok = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    if ($ok === false || $status >= 400) {
        if (!headers_sent()) {
            http_response_code($status >= 400 ? 502 : 502);
        }
        echo "data: " . json_encode(['error' => ['message' => 'Leafy kunne ikke nå GDPR Chat.']]) . "\n\n";
    }
    curl_close($ch);
    exit;
}

$response = curl_exec($ch);
$status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);
if (!is_string($response) || $status >= 400) {
    http_response_code(502);
    echo json_encode(['error' => 'Leafy kunne ikke nå GDPR Chat.']);
    exit;
}
echo $response;
