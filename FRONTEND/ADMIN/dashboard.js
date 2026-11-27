
const totalPedidos = document.getElementById('totalPedidos');
const pedidosPagados = document.getElementById('pedidosPagados');
const ventasTotales = document.getElementById('ventasTotales');
const tablaPedidos = document.getElementById('tablaPedidos');
const mensaje = document.getElementById('mensaje');
const btnActualizar = document.getElementById('btnActualizar');

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

function obtenerEstado(estado) {
    const texto = String(estado || 'Sin estado');
    const normalizado = texto.toLowerCase();

    let clase = 'other';

    if (normalizado.includes('pagado')) {
        clase = 'paid';
    } else if (
        normalizado.includes('pendiente') ||
        normalizado.includes('procesando')
    ) {
        clase = 'pending';
    }

    return `
        <span class="status ${clase}">
            ${escaparHTML(texto)}
        </span>
    `;
}

function mostrarPedidos(pedidos) {
    if (!Array.isArray(pedidos) || pedidos.length === 0) {
        tablaPedidos.innerHTML = `
            <tr>
                <td colspan="5" class="empty">
                    Todavía no hay pedidos registrados.
                </td>
            </tr>
        `;
        return;
    }

    tablaPedidos.innerHTML = pedidos.map(pedido => {
        const productos = Array.isArray(pedido.items)
            ? pedido.items.map(item => {
                const nombre = escaparHTML(
                    item.nombre || item.nombreProducto || item.producto || 'Producto'
                );

                const cantidad = Number(item.cantidad || 1);

                return `${nombre} (x${cantidad})`;
            }).join(', ')
            : 'Sin productos';

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
                    ${obtenerEstado(pedido.estado)}
                </td>
            </tr>
        `;
    }).join('');
}

function actualizarEstadisticas(pedidos) {
    const total = pedidos.length;

    const pagados = pedidos.filter(pedido =>
        String(pedido.estado || '').toLowerCase().includes('pagado')
    );

    const ventas = pagados.reduce((acumulado, pedido) =>
        acumulado + Number(pedido.total || 0), 0
    );

    totalPedidos.textContent = total;
    pedidosPagados.textContent = pagados.length;
    ventasTotales.textContent = formatoMXN(ventas);
}

async function cargarPedidos() {
    btnActualizar.disabled = true;
    btnActualizar.textContent = 'Cargando...';
    mensaje.textContent = '';

    try {
        const respuesta = await fetch('/api/admin/pedidos', {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Accept': 'application/json'
            }
        });

        if (respuesta.status === 401 || respuesta.status === 403) {
            window.location.href = 'login.html';
            return;
        }

        const resultado = await respuesta.json();

        if (!respuesta.ok) {
            throw new Error(resultado.error || 'No se pudieron cargar los pedidos.');
        }

        actualizarEstadisticas(resultado);
        mostrarPedidos(resultado);

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

    } finally {
        btnActualizar.disabled = false;
        btnActualizar.textContent = '↻ Actualizar';
    }
}

btnActualizar.addEventListener('click', cargarPedidos);

cargarPedidos();
