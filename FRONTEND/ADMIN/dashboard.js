
const totalPedidos = document.getElementById('totalPedidos');
const pedidosPagados = document.getElementById('pedidosPagados');
const ventasTotales = document.getElementById('ventasTotales');

const tablaPedidos = document.getElementById('tablaPedidos');
const tablaEntregados = document.getElementById('tablaEntregados');

const totalEntregados = document.getElementById('totalEntregados');

const mensaje = document.getElementById('mensaje');
const btnActualizar = document.getElementById('btnActualizar');
const btnActualizarHistorial = document.getElementById('btnActualizarHistorial');

const vistaResumen = document.getElementById('vistaResumen');
const vistaCompletados = document.getElementById('vistaCompletados');

const enlacesMenu = document.querySelectorAll('.nav-link[data-view]');

let pedidosActivos = [];
let pedidosEntregados = [];

const formatoMXN = cantidad =>
    Number(cantidad || 0).toLocaleString('es-MX', {
        style: 'currency',
        currency: 'MXN'
    });

function escaparHTML(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, caracter => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[caracter]);
}

function obtenerFecha(fecha) {
    if (!fecha) return 'Sin fecha';

    const fechaConvertida = new Date(fecha);

    if (Number.isNaN(fechaConvertida.getTime())) {
        return 'Sin fecha';
    }

    return fechaConvertida.toLocaleDateString('es-MX', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

function obtenerEstadoPedido(estado) {
    const estados = ['Pendiente', 'En proceso', 'Entregado'];

    return estados.includes(estado) ? estado : 'Pendiente';
}

// Selector de estado para pedidos activos
function crearSelectorEstado(pedido) {
    const estadoActual = obtenerEstadoPedido(pedido.estadoPedido);

    return `
        <select
            class="order-status-select"
            data-id="${escaparHTML(pedido._id)}"
            data-estado-anterior="${escaparHTML(estadoActual)}"
            aria-label="Cambiar estado del pedido"
        >
            <option value="Pendiente" ${estadoActual === 'Pendiente' ? 'selected' : ''}>
                Pendiente
            </option>

            <option value="En proceso" ${estadoActual === 'En proceso' ? 'selected' : ''}>
                En proceso
            </option>

            <option value="Entregado">
                Entregado
            </option>
        </select>
    `;
}

// Construir filas de pedidos
function crearFilaPedido(pedido, completado = false) {
    const productos = Array.isArray(pedido.items)
        ? pedido.items.map(item => {
            const nombre = escaparHTML(
                item.nombre ||
                item.nombreProducto ||
                item.producto ||
                'Producto'
            );

            const cantidad = Number(item.cantidad || 1);

            return `${nombre} (x${cantidad})`;
        }).join(', ')
        : 'Sin productos';

    const estadoHTML = completado
        ? '<span class="status delivered">Entregado</span>'
        : crearSelectorEstado(pedido);

    return `
        <tr>
            <td class="order-number">
                ${escaparHTML(pedido.numero || 'Sin número')}
            </td>

            <td>
                ${escaparHTML(obtenerFecha(pedido.fecha))}
            </td>

            <td class="order-products">
                ${productos}
            </td>

            <td class="order-total">
                ${formatoMXN(pedido.total)}
            </td>

            <td>
                ${estadoHTML}
            </td>
        </tr>
    `;
}

// Mostrar pedidos activos
function mostrarPedidosActivos() {
    if (pedidosActivos.length === 0) {
        tablaPedidos.innerHTML = `
            <tr>
                <td colspan="5" class="empty">
                    No hay pedidos pendientes o en proceso.
                </td>
            </tr>
        `;
        return;
    }

    tablaPedidos.innerHTML = pedidosActivos.map(pedido =>
        crearFilaPedido(pedido)
    ).join('');
}

// Mostrar historial de entregados
function mostrarPedidosEntregados() {
    const entregados = pedidosEntregados.filter(pedido =>
        pedido.estadoPedido === 'Entregado'
    );

    totalEntregados.textContent = entregados.length;

    if (entregados.length === 0) {
        tablaEntregados.innerHTML = `
            <tr>
                <td colspan="5" class="empty">
                    Todavía no hay pedidos completados.
                </td>
            </tr>
        `;
        return;
    }

    tablaEntregados.innerHTML = entregados.map(pedido =>
        crearFilaPedido(pedido, true)
    ).join('');
}

// Actualizar estadísticas generales
function actualizarEstadisticas() {
    const todosLosPedidos = [
        ...pedidosActivos,
        ...pedidosEntregados
    ];

    const pagados = todosLosPedidos.filter(pedido =>
        String(pedido.estado || '').toLowerCase().includes('pagado')
    );

    const ventas = pagados.reduce((acumulado, pedido) =>
        acumulado + Number(pedido.total || 0), 0
    );

    totalPedidos.textContent = todosLosPedidos.length;
    pedidosPagados.textContent = pagados.length;
    ventasTotales.textContent = formatoMXN(ventas);
}

// Cargar pedidos desde el backend
async function cargarPedidos() {
    btnActualizar.disabled = true;
    btnActualizarHistorial.disabled = true;

    btnActualizar.textContent = 'Cargando...';
    btnActualizarHistorial.textContent = 'Cargando...';

    mensaje.textContent = '';

    try {
        const [respuestaActivos, respuestaEntregados] = await Promise.all([
            fetch('/api/admin/pedidos', {
                credentials: 'include',
                headers: {
                    'Accept': 'application/json'
                }
            }),

            fetch('/api/admin/pedidos/entregados', {
                credentials: 'include',
                headers: {
                    'Accept': 'application/json'
                }
            })
        ]);

        if (
            respuestaActivos.status === 401 ||
            respuestaActivos.status === 403 ||
            respuestaEntregados.status === 401 ||
            respuestaEntregados.status === 403
        ) {
            window.location.href = 'login.html';
            return;
        }

        const [resultadoActivos, resultadoEntregados] = await Promise.all([
            respuestaActivos.json(),
            respuestaEntregados.json()
        ]);

        if (!respuestaActivos.ok) {
            throw new Error(
                resultadoActivos.error || 'No se pudieron cargar los pedidos activos.'
            );
        }

        if (!respuestaEntregados.ok) {
            throw new Error(
                resultadoEntregados.error || 'No se pudo cargar el historial.'
            );
        }

        if (
            !Array.isArray(resultadoActivos) ||
            !Array.isArray(resultadoEntregados)
        ) {
            throw new Error('El servidor devolvió una respuesta inválida.');
        }

        pedidosActivos = resultadoActivos;
        pedidosEntregados = resultadoEntregados;

        mostrarPedidosActivos();
        mostrarPedidosEntregados();
        actualizarEstadisticas();

    } catch (error) {
        console.error('Error al cargar pedidos:', error);

        mensaje.textContent = error.message;

        tablaPedidos.innerHTML = `
            <tr>
                <td colspan="5" class="error-row">
                    No se pudieron cargar los pedidos.
                </td>
            </tr>
        `;

        tablaEntregados.innerHTML = `
            <tr>
                <td colspan="5" class="error-row">
                    No se pudo cargar el historial.
                </td>
            </tr>
        `;

    } finally {
        btnActualizar.disabled = false;
        btnActualizarHistorial.disabled = false;

        btnActualizar.textContent = '↻ Actualizar';
        btnActualizarHistorial.textContent = '↻ Actualizar';
    }
}

// Cambiar estado del pedido
async function actualizarEstado(id, nuevoEstado, selector) {
    const estadoAnterior = selector.dataset.estadoAnterior;

    selector.disabled = true;
    mensaje.textContent = 'Actualizando estado del pedido...';

    try {
        const respuesta = await fetch(
            `/api/admin/pedidos/${encodeURIComponent(id)}/estado`,
            {
                method: 'PATCH',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    estadoPedido: nuevoEstado
                })
            }
        );

        if (respuesta.status === 401 || respuesta.status === 403) {
            window.location.href = 'login.html';
            return;
        }

        const resultado = await respuesta.json();

        if (!respuesta.ok) {
            throw new Error(
                resultado.error || 'No se pudo actualizar el pedido.'
            );
        }

        mensaje.textContent = nuevoEstado === 'Entregado'
            ? 'Pedido movido a pedidos completados.'
            : 'Estado actualizado correctamente.';

        // Recargar ambas tablas para reflejar el cambio.
        await cargarPedidos();

    } catch (error) {
        console.error('Error al actualizar estado:', error);

        mensaje.textContent = error.message;

        selector.value = estadoAnterior;
        selector.disabled = false;
    }
}

// Detectar cambios de estado en pedidos activos
tablaPedidos.addEventListener('change', event => {
    const selector = event.target.closest('.order-status-select');

    if (!selector) return;

    const id = selector.dataset.id;
    const pedido = pedidosActivos.find(item => item._id === id);

    if (!pedido) return;

    const nuevoEstado = selector.value;

    if (nuevoEstado === pedido.estadoPedido) return;

    actualizarEstado(id, nuevoEstado, selector);
});

// Navegación del menú lateral
function mostrarVista(tipo) {
    const esResumen = tipo === 'resumen';

    vistaResumen.hidden = !esResumen;
    vistaCompletados.hidden = esResumen;

    enlacesMenu.forEach(enlace => {
        enlace.classList.toggle(
            'active',
            enlace.dataset.view === tipo
        );
    });

    if (tipo === 'completados') {
        mostrarPedidosEntregados();
    }
}

enlacesMenu.forEach(enlace => {
    enlace.addEventListener('click', event => {
        event.preventDefault();

        mostrarVista(enlace.dataset.view);

        history.replaceState(
            null,
            '',
            enlace.getAttribute('href')
        );
    });
});

// Botones de actualización
btnActualizar.addEventListener('click', cargarPedidos);
btnActualizarHistorial.addEventListener('click', cargarPedidos);

// Carga inicial
cargarPedidos();

const seccionInicial = location.hash === '#completados'
    ? 'completados'
    : 'resumen';

mostrarVista(seccionInicial);
