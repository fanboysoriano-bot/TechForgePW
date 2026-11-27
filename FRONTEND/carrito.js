
/* ==========================================================
   CONFIGURACIÓN Y CONSTANTES
   ========================================================== */
const LS_CART = 'tf_cart';
const LS_ADDR = 'tf_direcciones';
const LS_ORD  = 'tf_pedidos';
const ENVIO = 150;
const ENVIO_GRATIS = 2000;

/* ==========================================================
   UTILIDADES
   ========================================================== */
const $ = id => document.getElementById(id);

const mx = n => "$" + Number(n || 0).toLocaleString("es-MX") + " MXN";

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
}[c]));

const load = (k, d) => {
    try {
        const v = JSON.parse(localStorage.getItem(k));
        return v ?? d;
    } catch (e) {
        return d;
    }
};

const save = (k, v) => {
    try {
        localStorage.setItem(k, JSON.stringify(v));
    } catch (e) {
        console.error('No se pudo guardar en localStorage:', e);
    }
};

/* ==========================================================
   ESTADO GLOBAL
   ========================================================== */
let P = [];
let cart = load(LS_CART, {});
let addrs = load(LS_ADDR, []);
let step = 1;
let addrId = addrs[0]?.id || null;
let showForm = addrs.length === 0;
let loggedIn = false;
let procesandoPago = false;

/* ==========================================================
   FUNCIONES AUXILIARES DEL CARRITO
   ========================================================== */
function imagen(x) {
    const imgs = Array.isArray(x.imagenes) ? x.imagenes : [];

    const url = imgs.find(i =>
        typeof i === 'string' && i.includes('res.cloudinary.com')
    ) || imgs.find(i =>
        typeof i === 'string' && i.startsWith('https://')
    );

    return url
        ? `<img src="${esc(url)}" alt="${esc(x.nombre)}" loading="lazy" onerror="this.remove()">`
        : `<i class="fa-solid fa-microchip"></i>`;
}

function items() {
    return Object.entries(cart)
        .map(([sku, n]) => ({
            p: P.find(p => p.sku === sku),
            n: Number(n)
        }))
        .filter(x => x.p && x.n > 0);
}

function totals() {
    const subtotal = items().reduce(
        (s, { p, n }) => s + p.precio * n,
        0
    );

    const envio = subtotal === 0
        ? 0
        : (subtotal >= ENVIO_GRATIS ? 0 : ENVIO);

    return {
        subtotal,
        envio,
        total: subtotal + envio
    };
}

function persistCart() {
    save(LS_CART, cart);
}

function setQty(sku, n) {
    const p = P.find(p => p.sku === sku);
    if (!p) return;

    n = Math.min(p.stock, n);

    if (n <= 0) {
        delete cart[sku];
    } else {
        cart[sku] = n;
    }

    persistCart();
}

/* ==========================================================
   SESIÓN Y DIRECCIÓN DEL USUARIO
   ========================================================== */
async function cargarSesionYDireccion() {
    try {
        // Comprobar si el usuario inició sesión
        const sesion = await fetch('/api/auth/me');

        if (!sesion.ok) {
            loggedIn = false;
            return;
        }

        loggedIn = true;

        // Consultar la dirección guardada en MongoDB
        const res = await fetch('/api/auth/direccion');

        if (!res.ok) {
            throw new Error('No se pudo consultar la dirección');
        }

        const data = await res.json();

        if (data.direccion) {
            const direccion = {
                id: 'server',
                ...data.direccion
            };

            // Actualizar la dirección guardada localmente
            addrs = addrs.filter(a => a.id !== 'server');
            addrs.unshift(direccion);

            save(LS_ADDR, addrs);

            addrId = 'server';
            showForm = false;
        }
    } catch (error) {
        console.error('Error al cargar sesión o dirección:', error);
    }
}

async function eliminarDireccion(id) {
    // Si es la dirección principal de MongoDB, eliminarla también allí
    if (id === 'server' && loggedIn) {
        try {
            const res = await fetch('/api/auth/direccion', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    direccion: null
                })
            });

            if (!res.ok) {
                throw new Error('No se pudo eliminar la dirección de la cuenta');
            }
        } catch (error) {
            console.error(error);
            alert('No se pudo eliminar la dirección guardada en tu cuenta.');
            return;
        }
    }

    addrs = addrs.filter(a => a.id !== id);
    save(LS_ADDR, addrs);

    if (addrId === id) {
        addrId = addrs[0]?.id || null;
    }

    showForm = addrs.length === 0;
    render();
}

/* ==========================================================
   PASOS (BARRA SUPERIOR)
   ========================================================== */
function stepper() {
    const names = [
        'Carrito',
        'Dirección',
        'Pago',
        'Confirmación'
    ];

    $('steps').innerHTML = names.map((n, i) => {
        const k = i + 1;
        const cls = k === step ? 'on' : (k < step ? 'done' : '');

        return `
            <div class="${cls}">
                <b>${k < step ? '<i class="fa-solid fa-check"></i>' : k}</b>
                ${n}
            </div>
        `;
    }).join('');
}

/* ==========================================================
   PASO 1: VISTA DEL CARRITO
   ========================================================== */
function cartHTML() {
    const L = items();

    if (!L.length) {
        return `
            <div class="card empty">
                <i class="fa-solid fa-bag-shopping"></i>
                <h2>Tu carrito está vacío</h2>
                <p style="margin-bottom:20px">
                    Agrega componentes desde el catálogo para continuar.
                </p>
                <a class="btn btn-red" href="index.html">
                    Ir al catálogo
                </a>
            </div>
        `;
    }

    return `
        <div class="card">
            <h2>Tu carrito (${L.reduce((s, x) => s + x.n, 0)} piezas)</h2>

            ${L.map(({ p, n }) => `
                <div class="item">
                    <div class="im">${imagen(p)}</div>

                    <div>
                        <h4>${esc(p.nombre)}</h4>

                        <div class="meta">
                            ${esc(p.marca)} · ${esc(p.subcategoria)} · SKU ${esc(p.sku)}
                        </div>

                        <div class="unit">
                            ${mx(p.precio)} c/u · ${p.stock} en stock
                        </div>

                        <div class="qty">
                            <button data-a="dec" data-s="${esc(p.sku)}" aria-label="Menos">−</button>
                            <b>${n}</b>
                            <button data-a="inc" data-s="${esc(p.sku)}"
                                aria-label="Más" ${n >= p.stock ? 'disabled' : ''}>+</button>
                        </div>
                    </div>

                    <div class="right">
                        <div class="sub">${mx(p.precio * n)}</div>
                        <button class="del" data-a="del" data-s="${esc(p.sku)}">
                            <i class="fa-solid fa-trash"></i> Quitar
                        </button>
                    </div>
                </div>
            `).join('')}

            <div class="actions">
                <a class="btn btn-line" href="index.html">
                    <i class="fa-solid fa-arrow-left"></i> Seguir comprando
                </a>

                <button class="btn btn-red" data-a="go" data-s="2">
                    Continuar <i class="fa-solid fa-arrow-right"></i>
                </button>
            </div>
        </div>
    `;
}

/* ==========================================================
   PASO 2: DIRECCIÓN DE ENVÍO
   ========================================================== */
function addrHTML() {
    const list = addrs.map(a => `
        <div class="addr ${a.id === addrId ? 'sel' : ''}"
            data-a="pick" data-s="${esc(a.id)}">

            <input type="radio" name="addr"
                ${a.id === addrId ? 'checked' : ''} tabindex="-1">

            <div class="t">
                <b>${esc(a.nombre)}</b> · <small>${esc(a.tel)}</small><br>
                ${esc(a.calle)}, ${esc(a.colonia)}<br>
                ${esc(a.cp)} ${esc(a.ciudad)}, ${esc(a.estado)}
                ${a.ref ? `<br><small>Ref: ${esc(a.ref)}</small>` : ''}
            </div>

            <button class="rm" data-a="deladdr" data-s="${esc(a.id)}">
                <i class="fa-solid fa-trash"></i>
            </button>
        </div>
    `).join('');

    const form = `
        <div class="formbox">
            <h3>Nueva dirección</h3>

            <div class="grid2">
                <label class="f">
                    Nombre completo
                    <input class="i" id="a-nombre" autocomplete="name">
                    <small class="err" id="e-a-nombre"></small>
                </label>

                <label class="f">
                    Teléfono (10 dígitos)
                    <input class="i" id="a-tel" inputmode="numeric"
                        maxlength="10" autocomplete="tel">
                    <small class="err" id="e-a-tel"></small>
                </label>

                <label class="f full">
                    Calle y número
                    <input class="i" id="a-calle" autocomplete="street-address">
                    <small class="err" id="e-a-calle"></small>
                </label>

                <label class="f">
                    Colonia
                    <input class="i" id="a-colonia">
                    <small class="err" id="e-a-colonia"></small>
                </label>

                <label class="f">
                    Código postal
                    <input class="i" id="a-cp" inputmode="numeric"
                        maxlength="5" autocomplete="postal-code">
                    <small class="err" id="e-a-cp"></small>
                </label>

                <label class="f">
                    Ciudad / Alcaldía
                    <input class="i" id="a-ciudad">
                    <small class="err" id="e-a-ciudad"></small>
                </label>

                <label class="f">
                    Estado
                    <input class="i" id="a-estado">
                    <small class="err" id="e-a-estado"></small>
                </label>

                <label class="f full">
                    Referencias (opcional)
                    <input class="i" id="a-ref"
                        placeholder="Entre calles, color de fachada...">
                </label>
            </div>

            <div class="actions" style="margin-top:14px">
                ${addrs.length
                    ? `<button class="btn btn-line" data-a="canceladdr">Cancelar</button>`
                    : '<span></span>'}

                <button class="btn btn-red" data-a="saveaddr">
                    Guardar dirección
                </button>
            </div>
        </div>
    `;

    return `
        <div class="card">
            <h2>¿A dónde enviamos tu pedido?</h2>

            ${addrs.length
                ? list
                : '<p style="color:var(--mut);margin-bottom:12px">Aún no tienes direcciones guardadas.</p>'}

            ${showForm
                ? form
                : `<button class="btn btn-line" data-a="newaddr">
                    <i class="fa-solid fa-plus"></i> Agregar nueva dirección
                   </button>`}

            <div class="actions">
                <button class="btn btn-line" data-a="go" data-s="1">
                    <i class="fa-solid fa-arrow-left"></i> Volver
                </button>

                <button class="btn btn-red" data-a="go" data-s="3"
                    ${addrId && !showForm ? '' : 'disabled'}>
                    Continuar al pago <i class="fa-solid fa-arrow-right"></i>
                </button>
            </div>
        </div>
    `;
}

function validateAddr() {
    const v = id => $(id).value.trim();

    const rules = {
        'a-nombre': [
            v('a-nombre').length >= 3,
            'Escribe tu nombre completo'
        ],
        'a-tel': [
            /^\d{10}$/.test(v('a-tel')),
            'Debe tener 10 dígitos'
        ],
        'a-calle': [
            v('a-calle').length >= 3,
            'Escribe calle y número'
        ],
        'a-colonia': [
            v('a-colonia').length >= 2,
            'Escribe la colonia'
        ],
        'a-cp': [
            /^\d{5}$/.test(v('a-cp')),
            'Código postal de 5 dígitos'
        ],
        'a-ciudad': [
            v('a-ciudad').length >= 2,
            'Escribe la ciudad'
        ],
        'a-estado': [
            v('a-estado').length >= 2,
            'Escribe el estado'
        ]
    };

    let ok = true;

    for (const [id, [pass, msg]] of Object.entries(rules)) {
        $(id).classList.toggle('bad', !pass);
        $('e-' + id).textContent = pass ? '' : msg;

        if (!pass) ok = false;
    }

    return ok;
}

/* ==========================================================
   GUARDAR DIRECCIÓN
   ========================================================== */
async function saveAddr() {
    if (!validateAddr()) return;

    const a = {
        id: 'server',
        nombre: $('a-nombre').value.trim(),
        tel: $('a-tel').value.trim(),
        calle: $('a-calle').value.trim(),
        colonia: $('a-colonia').value.trim(),
        cp: $('a-cp').value.trim(),
        ciudad: $('a-ciudad').value.trim(),
        estado: $('a-estado').value.trim(),
        ref: $('a-ref').value.trim()
    };

    // Si el usuario inició sesión, guardar la dirección en MongoDB
    if (loggedIn) {
        try {
            const res = await fetch('/api/auth/direccion', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    direccion: a
                })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'No se pudo guardar la dirección');
            }

        } catch (error) {
            console.error('Error al guardar dirección:', error);
            alert('No se pudo guardar tu dirección en tu cuenta. Inténtalo nuevamente.');
            return;
        }
    }

    // Guardar también una copia local
    addrs = addrs.filter(x => x.id !== 'server');
    addrs.unshift(a);

    save(LS_ADDR, addrs);

    addrId = a.id;
    showForm = false;

    render();
}

/* ==========================================================
   PASO 3: PAGO CON TARJETA
   ========================================================== */
function payHTML() {
    const t = totals();
    const a = addrs.find(x => x.id === addrId);

    return `
        <div class="card">
            <h2>Pago con tarjeta</h2>

            <div class="demo">
                <b>Modo simulación:</b> usa
                <b>4242 4242 4242 4242</b> para un pago aprobado,
                o <b>4000 0000 0000 0002</b> para ver un rechazo.
                Cualquier fecha futura y CVV de 3 dígitos.
            </div>

            <div id="payerr"></div>

            <div class="paygrid">
                <div>
                    <div class="cc">
                        <div class="chip"></div>
                        <div class="num" id="pv-num">•••• •••• •••• ••••</div>

                        <div class="row">
                            <span id="pv-name">Nombre del titular</span>
                            <span id="pv-exp">MM/AA</span>
                        </div>

                        <div class="row" style="margin-top:10px">
                            <span class="br" id="pv-br">&nbsp;</span>
                        </div>
                    </div>
                </div>

                <div class="grid2">
                    <label class="f full">
                        Número de tarjeta
                        <input class="i" id="c-num" inputmode="numeric"
                            autocomplete="cc-number"
                            placeholder="0000 0000 0000 0000" maxlength="19">
                        <small class="err" id="e-c-num"></small>
                    </label>

                    <label class="f full">
                        Nombre del titular
                        <input class="i" id="c-name" autocomplete="cc-name"
                            placeholder="Como aparece en la tarjeta">
                        <small class="err" id="e-c-name"></small>
                    </label>

                    <label class="f">
                        Vencimiento
                        <input class="i" id="c-exp" inputmode="numeric"
                            autocomplete="cc-exp" placeholder="MM/AA" maxlength="5">
                        <small class="err" id="e-c-exp"></small>
                    </label>

                    <label class="f">
                        CVV
                        <input class="i" id="c-cvv" inputmode="numeric"
                            autocomplete="cc-csc" placeholder="123"
                            maxlength="4" type="password">
                        <small class="err" id="e-c-cvv"></small>
                    </label>
                </div>
            </div>

            <div class="secure">
                <i class="fa-solid fa-lock"></i>
                Por seguridad, el número completo y el CVV nunca se guardan;
                solo los últimos 4 dígitos.
            </div>

            <p style="font-size:13px;color:var(--mut);margin-top:14px">
                <i class="fa-solid fa-location-dot"></i>
                Envío a: ${a
                    ? esc(a.calle) + ', ' + esc(a.colonia) + ', ' + esc(a.cp)
                    : '—'}
            </p>

            <div class="actions">
                <button class="btn btn-line" data-a="go" data-s="2">
                    <i class="fa-solid fa-arrow-left"></i> Volver
                </button>

                <button class="btn btn-red" data-a="pay">
                    <i class="fa-solid fa-lock"></i> Pagar ${mx(t.total)}
                </button>
            </div>
        </div>
    `;
}

const digits = s => s.replace(/\D/g, '');

function brand(n) {
    if (/^4/.test(n)) return 'Visa';
    if (/^(5[1-5]|2[2-7])/.test(n)) return 'Mastercard';
    if (/^3[47]/.test(n)) return 'American Express';
    return '';
}

function luhn(n) {
    let sum = 0;
    let alt = false;

    for (let i = n.length - 1; i >= 0; i--) {
        let d = +n[i];

        if (alt) {
            d *= 2;
            if (d > 9) d -= 9;
        }

        sum += d;
        alt = !alt;
    }

    return sum % 10 === 0;
}

function fmtNum(raw) {
    const n = digits(raw);

    if (/^3[47]/.test(n)) {
        const a = n.slice(0, 15);

        return [
            a.slice(0, 4),
            a.slice(4, 10),
            a.slice(10)
        ].filter(Boolean).join(' ');
    }

    return n.slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
}

function fmtExp(raw) {
    const n = digits(raw).slice(0, 4);

    return n.length > 2
        ? n.slice(0, 2) + '/' + n.slice(2)
        : n;
}

function updatePreview() {
    const n = digits($('c-num').value);

    const padded = (
        fmtNum(n) + ' ••••••••••••••••'
    ).slice(0, /^3[47]/.test(n) ? 17 : 19);

    $('pv-num').textContent = n
        ? padded
        : '•••• •••• •••• ••••';

    $('pv-name').textContent =
        $('c-name').value.trim() || 'Nombre del titular';

    $('pv-exp').textContent =
        $('c-exp').value || 'MM/AA';

    $('pv-br').textContent = brand(n) || '\u00a0';
}

function validatePay() {
    const num = digits($('c-num').value);
    const name = $('c-name').value.trim();
    const exp = $('c-exp').value;
    const cvv = $('c-cvv').value;

    const amex = /^3[47]/.test(num);

    const m = +exp.slice(0, 2);
    const y = 2000 + +exp.slice(3, 5);

    const expFormat =
        /^\d{2}\/\d{2}$/.test(exp) &&
        m >= 1 &&
        m <= 12;

    const notExpired =
        expFormat &&
        new Date(y, m, 1) > new Date();

    const rules = {
        'c-num': [
            (amex ? num.length === 15 : num.length === 16) && luhn(num),
            'Número de tarjeta inválido'
        ],
        'c-name': [
            name.length >= 3 && /\s/.test(name),
            'Escribe nombre y apellido'
        ],
        'c-exp': [
            notExpired,
            expFormat ? 'La tarjeta está vencida' : 'Usa el formato MM/AA'
        ],
        'c-cvv': [
            amex ? /^\d{4}$/.test(cvv) : /^\d{3}$/.test(cvv),
            amex ? 'CVV de 4 dígitos' : 'CVV de 3 dígitos'
        ]
    };

    let ok = true;

    for (const [id, [pass, msg]] of Object.entries(rules)) {
        $(id).classList.toggle('bad', !pass);
        $('e-' + id).textContent = pass ? '' : msg;

        if (!pass) ok = false;
    }

    return ok;
}

/* ==========================================================
   PROCESAR PAGO SIMULADO
   ========================================================== */

async function pay() {
    if (procesandoPago) return;

    $('payerr').innerHTML = '';

    if (!validatePay()) return;

    const num = digits($('c-num').value);

    const info = {
        marca: brand(num) || 'Tarjeta',
        ultimos4: num.slice(-4)
    };

    const rechazada = num === '4000000000000002';

    $('c-num').value = '';
    $('c-cvv').value = '';

    procesandoPago = true;

    const boton = document.querySelector('[data-a="pay"]');
    if (boton) boton.disabled = true;

    $('proctxt').textContent = 'Procesando pago…';
    $('proc').classList.add('on');

    setTimeout(() => {
        $('proctxt').textContent = 'Verificando con el banco…';
    }, 1100);

    setTimeout(async () => {
        $('proc').classList.remove('on');

        if (rechazada) {
            procesandoPago = false;
            render();

            $('payerr').innerHTML = `
                <div class="banner">
                    <i class="fa-solid fa-circle-xmark"></i>
                    Pago rechazado por el banco (simulación).
                    Intenta con otra tarjeta.
                </div>
            `;

            return;
        }

        await createOrder(info);

    }, 2400);
}


/* ==========================================================
   CREAR PEDIDO
   ========================================================== */

async function createOrder(pago) {
    const dir = addrs.find(a => a.id === addrId);

    try {
        if (!dir) {
            throw new Error('Selecciona una dirección de envío.');
        }

        const res = await fetch('/api/pedidos', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                items: items().map(({ p, n }) => ({
                    sku: p.sku,
                    cantidad: n
                })),
                direccion: dir,
                pago
            })
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || 'No se pudo registrar el pedido.');
        }

        // Recuperar el pedido guardado en MongoDB
        lastOrder = data.pedido;

        // Vaciar el carrito únicamente después de guardar el pedido
        cart = {};
        persistCart();

        // Mostrar confirmación
        step = 4;
        render();

        console.log('Pedido registrado en MongoDB:', lastOrder.numero);
        console.log('Estado del evento Kafka:', data.eventoKafka);

    } catch (error) {
        console.error('Error al registrar el pedido:', error);

        $('payerr').innerHTML = `
            <div class="banner">
                <i class="fa-solid fa-circle-xmark"></i>
                ${esc(error.message)}
            </div>
        `;

    } finally {
        procesandoPago = false;
    }
}


/* ==========================================================
   PASO 4: CONFIRMACIÓN
   ========================================================== */

function confirmHTML() {
    const o = lastOrder;
    const d = o.direccion;

    return `
        <div class="card okc">
            <div class="big">
                <i class="fa-solid fa-check"></i>
            </div>

            <h2 style="margin-bottom:4px">¡Gracias por tu compra!</h2>

            <p style="color:var(--mut)">
                Tu pedido fue registrado correctamente (simulación).
            </p>

            <div class="oid">${esc(o.numero)}</div>

            <div class="det">
                <h3>Productos</h3>

                ${o.items.map(i => `
                    <div class="srow">
                        <span>${i.cantidad}× ${esc(i.nombre)}</span>
                        <span>${mx(i.precio * i.cantidad)}</span>
                    </div>
                `).join('')}

                <div class="srow">
                    <span>Envío</span>
                    <span>${o.envio ? mx(o.envio) : 'Gratis'}</span>
                </div>

                <div class="srow tot">
                    <span>Total pagado</span>
                    <span>${mx(o.total)}</span>
                </div>
            </div>

            <div class="det">
                <p>
                    <b><i class="fa-solid fa-location-dot"></i> Enviar a:</b><br>
                    ${esc(d.nombre)} · ${esc(d.tel)}<br>
                    ${esc(d.calle)}, ${esc(d.colonia)}<br>
                    ${esc(d.cp)} ${esc(d.ciudad)}, ${esc(d.estado)}
                </p>

                <p>
                    <b><i class="fa-solid fa-credit-card"></i> Pago:</b>
                    ${esc(o.pago.marca)} terminada en ${esc(o.pago.ultimos4)}
                </p>
            </div>

            <div class="actions" style="justify-content:center">
                <a class="btn btn-red" href="index.html">
                    Volver al catálogo
                </a>
            </div>
        </div>
    `;
}


/* ==========================================================
   RESUMEN LATERAL
   ========================================================== */
function summaryHTML() {
    const t = totals();
    const falta = ENVIO_GRATIS - t.subtotal;

    return `
        <h3>Resumen del pedido</h3>

        ${step > 1 ? `
            <div class="mini">
                ${items().map(({ p, n }) => `
                    <div class="srow">
                        <span>
                            ${n}× ${esc(p.nombre.slice(0, 28))}${p.nombre.length > 28 ? '…' : ''}
                        </span>
                        <span>${mx(p.precio * n)}</span>
                    </div>
                `).join('')}
            </div>
        ` : ''}

        <div class="srow">
            <span>Subtotal</span>
            <span>${mx(t.subtotal)}</span>
        </div>

        <div class="srow ${t.envio === 0 && t.subtotal ? 'free' : ''}">
            <span>Envío</span>
            <span>
                ${t.subtotal === 0 ? '—' : (t.envio ? mx(t.envio) : 'Gratis')}
            </span>
        </div>

        <div class="srow tot">
            <span>Total</span>
            <span>${mx(t.total)}</span>
        </div>

        ${t.subtotal && falta > 0 ? `
            <div class="hint">
                <i class="fa-solid fa-truck"></i>
                Te faltan ${mx(falta)} para envío gratis.
            </div>
        ` : ''}
    `;
}

/* ==========================================================
   RENDER PRINCIPAL
   ========================================================== */
function render() {
    if (step < 4 && !items().length) {
        step = 1;
    }

    stepper();

    const single = step === 4;

    $('wrap').classList.toggle('single', single);
    $('side').style.display = single ? 'none' : '';

    if (single) {
        $('view').innerHTML = confirmHTML();
        return;
    }

    $('view').innerHTML = [
        null,
        cartHTML,
        addrHTML,
        payHTML
    ][step]();

    $('side').innerHTML = summaryHTML();

    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

/* ==========================================================
   EVENTOS E INICIALIZACIÓN
   ========================================================== */
document.addEventListener('DOMContentLoaded', () => {

    $('view').addEventListener('click', e => {
        const el = e.target.closest('[data-a]');

        if (!el || el.disabled) return;

        const a = el.dataset.a;
        const s = el.dataset.s;

        if (a === 'inc') {
            setQty(s, (cart[s] || 0) + 1);
            render();

        } else if (a === 'dec') {
            setQty(s, (cart[s] || 0) - 1);
            render();

        } else if (a === 'del') {
            setQty(s, 0);
            render();

        } else if (a === 'go') {
            step = Number(s);
            render();

        } else if (a === 'pick') {
            if (e.target.closest('[data-a="deladdr"]')) return;

            addrId = s;
            render();

        } else if (a === 'deladdr') {
            e.stopPropagation();
            eliminarDireccion(s);

        } else if (a === 'newaddr') {
            showForm = true;
            render();

        } else if (a === 'canceladdr') {
            showForm = false;
            render();

        } else if (a === 'saveaddr') {
            saveAddr();

        } else if (a === 'pay') {
            pay();
        }
    });

    $('view').addEventListener('input', e => {
        const t = e.target;

        if (t.id === 'c-num') {
            t.value = fmtNum(t.value);
            updatePreview();

        } else if (t.id === 'c-exp') {
            t.value = fmtExp(t.value);
            updatePreview();

        } else if (t.id === 'c-cvv') {
            t.value = digits(t.value).slice(0, 4);

        } else if (t.id === 'c-name') {
            updatePreview();

        } else if (t.id === 'a-tel') {
            t.value = digits(t.value).slice(0, 10);

        } else if (t.id === 'a-cp') {
            t.value = digits(t.value).slice(0, 5);
        }
    });

    init();
});

/* ==========================================================
   CARGAR CARRITO Y PRODUCTOS
   ========================================================== */
async function init() {
    $('view').innerHTML = `
        <div class="card empty">
            <i class="fa-solid fa-spinner fa-spin"></i>
            <p>Cargando tu carrito…</p>
        </div>
    `;

    try {
        // 1. Obtener productos de la API
        const res = await fetch('/api/productos');

        if (!res.ok) {
            throw new Error('HTTP ' + res.status);
        }

        const data = await res.json();

        P = data.map(x => ({
            ...x,
            stock: Number(x.stock || 0),
            precio: Number(x.precio || 0)
        }));

        // 2. Comprobar sesión y recuperar dirección de MongoDB
        await cargarSesionYDireccion();

        // 3. Comprobar cantidades del carrito con el stock disponible
        Object.keys(cart).forEach(sku => {
            setQty(
                sku,
                Math.min(
                    Number(cart[sku]),
                    (P.find(p => p.sku === sku)?.stock) || 0
                )
            );
        });

        // 4. Mostrar el carrito
        render();

    } catch (err) {
        console.error(err);

        $('view').innerHTML = `
            <div class="card empty">
                <i class="fa-solid fa-triangle-exclamation"
                    style="color:var(--red)"></i>

                <h2>No se pudo cargar el carrito</h2>

                <p style="margin-bottom:18px">
                    Verifica que el servidor esté activo.
                </p>

                <a class="btn btn-red" href="index.html">
                    Volver al catálogo
                </a>
            </div>
        `;
    }
}
