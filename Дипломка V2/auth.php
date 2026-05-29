<?php
header('Content-Type: application/json; charset=utf-8');

$action = isset($_GET['action']) ? $_GET['action'] : null;
$method = $_SERVER['REQUEST_METHOD'];

function sendJson($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function getRequestData() {
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);
    if (json_last_error() === JSON_ERROR_NONE && is_array($data)) {
        return $data;
    }
    return $_POST;
}

function validateEmail($email) {
    return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
}

function ensureDataFile() {
    $dir = __DIR__ . '/data';
    if (!is_dir($dir)) {
        mkdir($dir, 0777, true);
    }
    $file = $dir . '/users.json';
    if (!file_exists($file)) {
        $users = [
            [
                'id' => 'u-admin',
                'name' => 'Администратор',
                'email' => 'admin@vatk.kz',
                'password' => 'admin123',
                'role' => 'admin',
                'createdAt' => date('c')
            ],
            [
                'id' => 'u-teacher',
                'name' => 'Aida Bek',
                'email' => 'teacher@vatk.kz',
                'password' => 'teacher123',
                'role' => 'teacher',
                'createdAt' => date('c')
            ],
            [
                'id' => 'u-student',
                'name' => 'Nursultan S.',
                'email' => 'student@vatk.kz',
                'password' => 'student123',
                'role' => 'student',
                'createdAt' => date('c')
            ],
            [
                'id' => 'u-secretary',
                'name' => 'Секретарь',
                'email' => 'secretary@vatk.kz',
                'password' => 'secretary123',
                'role' => 'secretary',
                'createdAt' => date('c')
            ]
        ];
        file_put_contents($file, json_encode($users, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    }
    return $file;
}

function loadUsers() {
    $file = ensureDataFile();
    $data = file_get_contents($file);
    $users = json_decode($data, true);
    if (!is_array($users)) {
        $users = [];
    }
    return $users;
}

function saveUsers($users) {
    $file = ensureDataFile();
    file_put_contents($file, json_encode($users, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
}

if (!$action) {
    sendJson(['message' => 'Действие не указано'], 400);
}

if ($action === 'check') {
    sendJson(['status' => 'ok']);
}

$data = getRequestData();

if ($action === 'login' && $method === 'POST') {
    $email = isset($data['email']) ? trim(mb_strtolower($data['email'])) : '';
    $password = isset($data['password']) ? trim($data['password']) : '';

    if (!$email || !$password) {
        sendJson(['message' => 'Email и пароль обязательны'], 400);
    }
    if (!validateEmail($email)) {
        sendJson(['message' => 'Введите корректный email'], 400);
    }

    $users = loadUsers();
    foreach ($users as $user) {
        if (mb_strtolower($user['email']) === $email && $user['password'] === $password) {
            sendJson(['user' => [
                'id' => $user['id'],
                'name' => $user['name'],
                'email' => $user['email'],
                'role' => $user['role'],
                'createdAt' => $user['createdAt']
            ]]);
        }
    }

    sendJson(['message' => 'Неверный email или пароль'], 401);
}

if ($action === 'register' && $method === 'POST') {
    $name = isset($data['name']) ? trim($data['name']) : '';
    $email = isset($data['email']) ? trim(mb_strtolower($data['email'])) : '';
    $password = isset($data['password']) ? trim($data['password']) : '';
    $role = isset($data['role']) ? trim($data['role']) : '';

    if (!$name || !$email || !$password || !$role) {
        sendJson(['message' => 'Все поля обязательны'], 400);
    }
    if (!validateEmail($email)) {
        sendJson(['message' => 'Введите корректный email'], 400);
    }
    $allowedRoles = ['student', 'teacher', 'secretary'];
    if (!in_array($role, $allowedRoles, true)) {
        sendJson(['message' => 'Недопустимая роль'], 400);
    }

    $users = loadUsers();
    foreach ($users as $user) {
        if (mb_strtolower($user['email']) === $email) {
            sendJson(['message' => 'Пользователь уже существует'], 409);
        }
    }

    $newUser = [
        'id' => 'u-' . time(),
        'name' => $name,
        'email' => $email,
        'password' => $password,
        'role' => $role,
        'createdAt' => date('c')
    ];
    $users[] = $newUser;
    saveUsers($users);

    sendJson(['user' => [
        'id' => $newUser['id'],
        'name' => $newUser['name'],
        'email' => $newUser['email'],
        'role' => $newUser['role'],
        'createdAt' => $newUser['createdAt']
    ]], 201);
}

sendJson(['message' => 'Метод не найден'], 404);
