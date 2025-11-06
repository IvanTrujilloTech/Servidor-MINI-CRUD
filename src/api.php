<?php
// 1) Cabecera y utilidades de respuesta JSON
header('Content-Type: application/json; charset=utf-8');

/**
 * Envía una respuesta de éxito con envoltura homogénea.
 */
function responder_json_exito(mixed $contenidoDatos, int $codigoHttp = 200): void
{
    http_response_code($codigoHttp);
    echo json_encode(
        ['ok' => true, 'data' => $contenidoDatos],
        JSON_UNESCAPED_UNICODE
    );
    exit;
}

/**
 * Envía una respuesta de error con envoltura homogénea.
 */
function responder_json_error(string $mensajeError, int $codigoHttp = 400): void
{
    http_response_code($codigoHttp);
    echo json_encode(
        ['ok' => false, 'error' => $mensajeError],
        JSON_UNESCAPED_UNICODE
    );
    exit;
}

/**
 * Comprueba si ya existe un usuario con el email dado.
 * Puede ignorar un índice específico (útil para 'update').
 *
 * @param array $usuarios Lista actual en memoria.
 * @param string $emailNormalizado Email normalizado en minúsculas.
 * @param int|null $ignorarIndice Opcional. Índice a ignorar en la comprobación.
 */
function existeEmailDuplicado(array $usuarios, string $emailNormalizado, ?int $ignorarIndice = null): bool
{
    foreach ($usuarios as $indice => $u) {
        // Si estamos actualizando, ignoramos la comprobación en el mismo índice
        if ($indice === $ignorarIndice) {
            continue;
        }
        if (isset($u['email']) && is_string($u['email']) && mb_strtolower($u['email']) === $emailNormalizado) {
            return true;
        }
    }
    return false;
}


// 2) Ruta al archivo de persistencia (misma carpeta)
$rutaArchivoDatosJson = __DIR__ . '/data.json';

// 2.1) Si no existe, lo creamos con un array JSON vacío ([])
if (!file_exists($rutaArchivoDatosJson)) {
    file_put_contents($rutaArchivoDatosJson, json_encode([]) . "\n");
}

// 2.2) Cargar su contenido como array asociativo de PHP
$listaUsuarios = json_decode((string) file_get_contents($rutaArchivoDatosJson), true);

// 2.3) Si por cualquier motivo no es un array, lo normalizamos a []
if (!is_array($listaUsuarios)) {
    $listaUsuarios = [];
}

// 3) Método HTTP y acción (por querystring o formulario)
$metodoHttpRecibido = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$accionSolicitada = $_GET['action'] ?? $_POST['action'] ?? 'list';

// 4) LISTAR usuarios: GET /api.php?action=list
if ($metodoHttpRecibido === 'GET' && $accionSolicitada === 'list') {
    responder_json_exito($listaUsuarios); // 200 OK
}

// 5) CREAR usuario: POST /api.php?action=create
if ($metodoHttpRecibido === 'POST' && $accionSolicitada === 'create') {
    $cuerpoBruto = (string) file_get_contents('php://input');
    $datosDecodificados = $cuerpoBruto !== '' ? (json_decode($cuerpoBruto, true) ?? []) : [];
    
    // Extraemos datos y normalizamos
    $nombreUsuarioNuevo = trim((string) ($datosDecodificados['nombre'] ?? $_POST['nombre'] ?? ''));
    $correoUsuarioNuevo = trim((string) ($datosDecodificados['email'] ?? $_POST['email'] ?? ''));
    $correoUsuarioNormalizado = mb_strtolower($correoUsuarioNuevo);

    // Validación mínima en servidor
    if ($nombreUsuarioNuevo === '' || $correoUsuarioNuevo === '') {
        responder_json_error('Los campos "nombre" y "email" son obligatorios.', 422);
    }
    if (!filter_var($correoUsuarioNuevo, FILTER_VALIDATE_EMAIL)) {
        responder_json_error('El campo "email" no tiene un formato válido.', 422);
    }
    if (mb_strlen($nombreUsuarioNuevo) > 60 || mb_strlen($correoUsuarioNuevo) > 120) {
        responder_json_error('Nombre o email exceden la longitud máxima.', 422);
    }
    
    // Evitar duplicados por email (sin índice a ignorar)
    if (existeEmailDuplicado($listaUsuarios, $correoUsuarioNormalizado)) {
        responder_json_error('Ya existe un usuario con ese email.', 409); // 409 Conflict
    }

    // Agregamos y persistimos (guardamos el email normalizado)
    $listaUsuarios[] = [
        'nombre' => $nombreUsuarioNuevo,
        'email' => $correoUsuarioNormalizado,
    ];
    
    file_put_contents(
        $rutaArchivoDatosJson,
        json_encode($listaUsuarios, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n"
    );
    
    responder_json_exito($listaUsuarios, 201); // 201 Created
}

// 5.5) ACTUALIZAR usuario: POST /api.php?action=update
if ($metodoHttpRecibido === 'POST' && $accionSolicitada === 'update') {
    $cuerpoBruto = (string) file_get_contents('php://input');
    $datosDecodificados = $cuerpoBruto !== '' ? (json_decode($cuerpoBruto, true) ?? []) : [];

    // Extraemos índice y datos
    $indiceAActualizar = $datosDecodificados['index'] ?? null;
    $nombreUsuario = trim((string) ($datosDecodificados['nombre'] ?? ''));
    $correoUsuario = trim((string) ($datosDecodificados['email'] ?? ''));
    $correoUsuarioNormalizado = mb_strtolower($correoUsuario);

    // Validar que el índice es un número entero
    if (!is_int($indiceAActualizar)) {
         responder_json_error('El campo "index" es inválido o no se proporcionó.', 422);
    }
    
    // Validar que el índice existe en nuestra lista
    if (!isset($listaUsuarios[$indiceAActualizar])) {
        responder_json_error('El índice de usuario no existe.', 404); // 404 Not Found
    }

    // Validaciones de datos (igual que en 'create')
    if ($nombreUsuario === '' || $correoUsuario === '') {
        responder_json_error('Los campos "nombre" y "email" son obligatorios.', 422);
    }
    if (!filter_var($correoUsuario, FILTER_VALIDATE_EMAIL)) {
        responder_json_error('El campo "email" no tiene un formato válido.', 422);
    }
    if (mb_strlen($nombreUsuario) > 60 || mb_strlen($correoUsuario) > 120) {
        responder_json_error('Nombre o email exceden la longitud máxima.', 422);
    }

    // Evitar duplicados, PERO ignorando el índice del usuario que estamos editando
    if (existeEmailDuplicado($listaUsuarios, $correoUsuarioNormalizado, $indiceAActualizar)) {
        responder_json_error('Ya existe otro usuario con ese email.', 409); // 409 Conflict
    }

    // Actualizamos los datos en memoria
    $listaUsuarios[$indiceAActualizar] = [
        'nombre' => $nombreUsuario,
        'email' => $correoUsuarioNormalizado,
    ];
    
    // Persistimos en disco
    file_put_contents(
        $rutaArchivoDatosJson,
        json_encode($listaUsuarios, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n"
    );
    
    responder_json_exito($listaUsuarios, 200); // 200 OK
}


// 6) ELIMINAR usuario: POST /api.php?action=delete
if (($metodoHttpRecibido === 'POST' || $metodoHttpRecibido === 'DELETE') && $accionSolicitada === 'delete') {
    
    $indiceEnQuery = $_GET['index'] ?? null;
    if ($indiceEnQuery === null) {
        $cuerpoBruto = (string) file_get_contents('php://input');
        if ($cuerpoBruto !== '') {
            $datosDecodificados = json_decode($cuerpoBruto, true) ?? [];
            $indiceEnQuery = $datosDecodificados['index'] ?? null;
        } else {
            $indiceEnQuery = $_POST['index'] ?? null;
        }
    }

    if ($indiceEnQuery === null) {
        responder_json_error('Falta el parámetro "index" para eliminar.', 422);
    }
    
    $indiceUsuarioAEliminar = (int) $indiceEnQuery;
    
    if (!isset($listaUsuarios[$indiceUsuarioAEliminar])) {
        responder_json_error('El índice indicado no existe.', 404); // 404 Not Found
    }

    unset($listaUsuarios[$indiceUsuarioAEliminar]);
    $listaUsuarios = array_values($listaUsuarios);

    file_put_contents(
        $rutaArchivoDatosJson,
        json_encode($listaUsuarios, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n"
    );

    responder_json_exito($listaUsuarios); // 200 OK
}

// 7) Si llegamos aquí, la acción solicitada no está soportada
responder_json_error('Acción no soportada. Use list | create | update | delete', 400);
