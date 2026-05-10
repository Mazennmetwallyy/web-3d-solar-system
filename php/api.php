<?php

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/Planet.php';

function respond(array $data, int $code = 200): void {
    http_response_code($code);
    echo json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit;
}

function error(string $message, int $code = 400): void {
    respond(['status' => 'error', 'message' => $message], $code);
}

$action = strtolower(trim($_GET['action'] ?? ''));

switch ($action) {

    case 'planets':
        $model   = new Planet();
        $planets = $model->getAll();
        respond(['status' => 'ok', 'count' => count($planets), 'data' => $planets]);

    case 'planet':
        $model = new Planet();

        if (!empty($_GET['name'])) {
            $planet = $model->getByName(trim($_GET['name']));
        } elseif (!empty($_GET['id'])) {
            $planet = $model->getById((int)$_GET['id']);
        } else {
            error('Provide name or id parameter.');
        }

        if (!$planet) {
            error('Planet not found.', 404);
        }
        respond(['status' => 'ok', 'data' => $planet]);

    case 'setup':
        require_once __DIR__ . '/setup.php';
        break;

    default:
        error('Unknown action. Valid actions: planets, planet, setup.');
}
