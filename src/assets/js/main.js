// -----------------------------------------------------------------------------
// Mini CRUD AJAX — Lado cliente (con UPDATE)
// -----------------------------------------------------------------------------

/** URL absoluta o relativa del endpoint PHP (API del servidor) */
const URL_API_SERVIDOR = '/api.php';

/** Elementos de la interfaz que necesitamos manipular */
const nodoCuerpoTablaUsuarios = document.getElementById('tbody'); // <tbody> del listado
const nodoFilaEstadoVacio = document.getElementById('fila-estado-vacio'); // <tr> fila de “no hay datos”
const formularioAltaUsuario = document.getElementById('formCreate'); // <form> de alta
const nodoZonaMensajesEstado = document.getElementById('msg'); // <div> mensajes
const nodoBotonSubmit = document.getElementById('boton-submit'); // Botón principal (Agregar/Guardar)
const nodoBotonCancelar = document.getElementById('boton-cancelar'); // Botón de cancelar edición
const nodoIndicadorCargando = document.getElementById('indicador-cargando');

// Variable para mantener el estado de la lista actual de usuarios
let estadoUsuariosActuales = [];

// Nodos de los Inputs del formulario
const inputIndex = document.getElementById('inputIndex');
const inputNombre = document.getElementById('inputNombre');
const inputEmail = document.getElementById('inputEmail');

// -----------------------------------------------------------------------------
// BLOQUE: Gestión de mensajes de estado (éxito / error)
// -----------------------------------------------------------------------------
function mostrarMensajeDeEstado(tipoEstado, textoMensaje) {
  nodoZonaMensajesEstado.className = tipoEstado; // .ok | .error | ''
  nodoZonaMensajesEstado.textContent = textoMensaje;
  
  if (tipoEstado !== '') {
    setTimeout(() => {
      nodoZonaMensajesEstado.className = '';
      nodoZonaMensajesEstado.textContent = '';
    }, 2000);
  }
}

// -----------------------------------------------------------------------------
// BLOQUE: Indicador de carga + bloqueo de botón
// -----------------------------------------------------------------------------
function activarEstadoCargando() {
  if (nodoBotonSubmit) nodoBotonSubmit.disabled = true;
  if (nodoIndicadorCargando) nodoIndicadorCargando.hidden = false;
}

function desactivarEstadoCargando() {
  if (nodoBotonSubmit) nodoBotonSubmit.disabled = false;
  if (nodoIndicadorCargando) nodoIndicadorCargando.hidden = true;
}

// -----------------------------------------------------------------------------
// BLOQUE: Sanitización de texto
// -----------------------------------------------------------------------------
function convertirATextoSeguro(entradaPosiblementePeligrosa) {
  return String(entradaPosiblementePeligrosa)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// -----------------------------------------------------------------------------
// BLOQUE: Renderizado del listado de usuarios
// -----------------------------------------------------------------------------
function renderizarTablaDeUsuarios(arrayUsuarios) {
  nodoCuerpoTablaUsuarios.innerHTML = '';
  
  // Guardamos el estado actual
  estadoUsuariosActuales = Array.isArray(arrayUsuarios) ? arrayUsuarios : [];

  if (estadoUsuariosActuales.length > 0) {
    if (nodoFilaEstadoVacio) nodoFilaEstadoVacio.hidden = true;
  } else {
    if (nodoFilaEstadoVacio) nodoFilaEstadoVacio.hidden = false;
    return; // no hay filas que pintar
  }
  
  estadoUsuariosActuales.forEach((usuario, posicionEnLista) => {
    const nodoFila = document.createElement('tr');
    
    // Añadido botón "Editar" y data-accion
    nodoFila.innerHTML = `
      <td>${posicionEnLista + 1}</td>
      <td>${convertirATextoSeguro(usuario?.nombre ?? '')}</td>
      <td>${convertirATextoSeguro(usuario?.email ?? '')}</td>
      <td>
        <button data-accion="editar" data-posicion="${posicionEnLista}">
          Editar
        </button>
        <button data-accion="eliminar" data-posicion="${posicionEnLista}">
          Eliminar
        </button>
      </td>
    `;
    nodoCuerpoTablaUsuarios.appendChild(nodoFila);
  });
}

// -----------------------------------------------------------------------------
// BLOQUE: Carga inicial y refresco del listado (GET list)
// -----------------------------------------------------------------------------
async function obtenerYMostrarListadoDeUsuarios() {
  try {
    const respuestaHttp = await fetch(`${URL_API_SERVIDOR}?action=list`);
    const cuerpoJson = await respuestaHttp.json();
    if (!cuerpoJson.ok) {
      throw new Error(cuerpoJson.error || 'No fue posible obtener el listado.');
    }
    renderizarTablaDeUsuarios(cuerpoJson.data);
  } catch (error) {
    mostrarMensajeDeEstado('error', error.message);
  }
}

// -----------------------------------------------------------------------------
// BLOQUE: Funciones de Modo Edición
// -----------------------------------------------------------------------------

/** Pone el formulario en "Modo Edición" */
function iniciarModoEdicion(posicion) {
  const usuario = estadoUsuariosActuales[posicion];
  if (!usuario) return;

  // Rellenamos el formulario
  inputIndex.value = posicion; // <-- ¡Clave!
  inputNombre.value = usuario.nombre;
  inputEmail.value = usuario.email;

  // Cambiamos botones
  nodoBotonSubmit.textContent = 'Guardar Cambios';
  nodoBotonCancelar.hidden = false;

  // Llevamos al usuario arriba del todo para ver el formulario
  window.scrollTo({ top: 0, behavior: 'smooth' });
  inputNombre.focus();
}

/** Devuelve el formulario al "Modo Creación" */
function cancelarModoEdicion() {
  formularioAltaUsuario.reset(); // Limpia nombre y email
  inputIndex.value = ''; // <-- ¡Clave! Limpia el índice

  // Restaura botones
  nodoBotonSubmit.textContent = 'Agregar usuario';
  nodoBotonCancelar.hidden = true;
}

// -----------------------------------------------------------------------------
// BLOQUE: Alta y Actualización (POST create / POST update)
// -----------------------------------------------------------------------------
formularioAltaUsuario?.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  
  const datosFormulario = new FormData(formularioAltaUsuario);
  
  // Leemos el índice del campo oculto
  const indiceStr = String(datosFormulario.get('index') || '');
  const esModoEdicion = indiceStr !== '';

  const datosUsuario = {
    nombre: String(datosFormulario.get('nombre') || '').trim(),
    email: String(datosFormulario.get('email') || '').trim(),
  };
  
  if (!datosUsuario.nombre || !datosUsuario.email) {
    mostrarMensajeDeEstado('error', 'Los campos Nombre y Email son obligatorios.');
    return;
  }
  
  // Determinamos la acción y el payload
  const accion = esModoEdicion ? 'update' : 'create';
  const url = `${URL_API_SERVIDOR}?action=${accion}`;
  
  // Añadimos el índice al payload SOLO si estamos editando
  const payload = { ...datosUsuario };
  if (esModoEdicion) {
    payload.index = parseInt(indiceStr, 10);
  }

  try {
    activarEstadoCargando();
    
    const respuestaHttp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload), // Usamos el payload dinámico
    });
    
    const cuerpoJson = await respuestaHttp.json();
    
    if (!cuerpoJson.ok) {
      throw new Error(cuerpoJson.error || 'No fue posible guardar los cambios.');
    }
    
    renderizarTablaDeUsuarios(cuerpoJson.data);
    
    // Usamos la función de cancelar para resetear el form
    cancelarModoEdicion(); 
    
    const mensajeExito = esModoEdicion 
      ? 'Usuario actualizado correctamente.' 
      : 'Usuario agregado correctamente.';
    mostrarMensajeDeEstado('ok', mensajeExito);
    
  } catch (error) {
    mostrarMensajeDeEstado('error', error.message);
  } finally {
    desactivarEstadoCargando();
  }
});

// -----------------------------------------------------------------------------
// BLOQUE: Eliminación y Edición (Delegación de eventos)
// -----------------------------------------------------------------------------
nodoCuerpoTablaUsuarios?.addEventListener('click', async (evento) => {
  // Buscamos cualquier botón con data-posicion
  const botonPulsado = evento.target.closest('button[data-posicion]');
  if (!botonPulsado) return;

  const posicionUsuario = parseInt(botonPulsado.dataset.posicion, 10);
  if (!Number.isInteger(posicionUsuario)) return;

  // Leemos la acción del botón
  const accion = botonPulsado.dataset.accion;

  // --- Rama 1: Editar ---
  if (accion === 'editar') {
    iniciarModoEdicion(posicionUsuario);
    return; // No hay nada más que hacer
  }
  
  // --- Rama 2: Eliminar ---
  if (accion === 'eliminar') {
    if (!window.confirm('¿Deseas eliminar este usuario?')) return;
    
    try {
      const respuestaHttp = await fetch(`${URL_API_SERVIDOR}?action=delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ index: posicionUsuario }),
      });
      
      const cuerpoJson = await respuestaHttp.json();
      if (!cuerpoJson.ok) {
        throw new Error(cuerpoJson.error || 'No fue posible eliminar el usuario.');
      }
      
      renderizarTablaDeUsuarios(cuerpoJson.data);
      mostrarMensajeDeEstado('ok', 'Usuario eliminado correctamente.');
      
      // Si justo estábamos editando el usuario que borramos, reseteamos el form
      if (String(inputIndex.value) === String(posicionUsuario)) {
        cancelarModoEdicion();
      }

    } catch (error) {
      mostrarMensajeDeEstado('error', error.message);
    }
  }
});

// -----------------------------------------------------------------------------
// BLOQUE: Listener para el botón Cancelar
// -----------------------------------------------------------------------------
nodoBotonCancelar?.addEventListener('click', () => {
  cancelarModoEdicion();
});

// -----------------------------------------------------------------------------
// BLOQUE: Inicialización de la pantalla
// -----------------------------------------------------------------------------
obtenerYMostrarListadoDeUsuarios();
