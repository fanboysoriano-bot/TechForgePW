
// Categorías y mapeo de iconos
const C = [
    "Componentes de PC",
    "Periféricos",
    "Accesorios de Hardware",
    "Redes y Conectividad",
    "Streaming y Videoconferencia"
];

const HUE = [30, 210, 150, 260, 330];

const IC = {
    "Tarjetas Gráficas": "display",
    "Procesadores": "microchip",
    "Teclados Mecánicos": "keyboard",
    "Almacenamiento SSD": "hard-drive",
    "Monitores": "tv",
    "Enfriamiento Líquido": "fan",
    "Enfriamiento": "fan",
    "Memoria RAM": "memory",
    "Tarjetas Madre": "server",
    "Mouse Gamer": "computer-mouse",
    "Audio y Headsets": "headphones",
    "Gestión de Energía": "plug",
    "Cables y Conectores": "link",
    "Modding e Iluminación": "lightbulb",
    "Routers": "wifi",
    "Tarjetas de Red": "network-wired",
    "Switches": "network-wired",
    "Adaptadores USB": "wifi",
    "Micrófonos": "microphone",
    "Webcams": "video"
};

let P = [];

const $ = id => document.getElementById(id);
const mx = n => "$" + Number(n || 0).toLocaleString("es-MX") + " MXN";

let st = { c: -1, q: "", m: "", o: "", a: false };
let cart = {};
let productoDetalleActual = null;

const ic = x =>
    `<i class="fa-solid fa-${IC[x.subcategoria] || "microchip"}"></i>`;

function card(x) {
    const stockMinimo = x.gestion_stock?.stock_minimo ?? 0;

    const t = Number(x.stock) === 0
        ? ["Agotado", "low"]
        : Number(x.stock) <= stockMinimo
            ? ["Bajo stock", "low"]
            : x.destacado
                ? ["Destacado", ""]
                : null;

    return `
        <article>
            ${t ? `<div class="tag ${t[1]}">${t[0]}</div>` : ""}

            <div class="im" style="--h:${HUE[x.catIndex || 0]}"
                 onclick="det('${x.sku}')">
                ${ic(x)}
            </div>

            <div class="ip">
                <div>
                    <h4 title="${x.nombre}">${x.nombre}</h4>
                    <p>${x.marca} · ${x.subcategoria}<br>${x.stock} en stock</p>
                </div>

                <div>
                    <span class="pr">${mx(x.precio)}</span>

                    <div class="bt">
                        <button class="b1" onclick="det('${x.sku}')">
                            Detalle
                        </button>

                        <button class="b2"
                                ${Number(x.stock) > 0 ? "" : "disabled"}
                                onclick="add('${x.sku}')">
                            <i class="fa-solid fa-cart-plus"></i> Añadir
                        </button>
                    </div>
                </div>
            </div>
        </article>`;
}

function render() {
    if (P.length === 0) {
        $("productos").innerHTML = `
            <div class="vacio" style="padding: 60px 20px; text-align: center;">
                <i class="fa-solid fa-server"
                   style="font-size: 48px; color: #c5a059; margin-bottom: 15px; display: block;"></i>

                <h3 style="font-family: Georgia, serif; margin-bottom: 8px;">
                    No hay productos disponibles
                </h3>

                <p style="color: #666; font-size: 13px;">
                    No se encontraron productos en MongoDB.
                </p>
            </div>`;

        $("res").textContent = "0 productos";
        return;
    }

    let L = P.filter(x => {
        const catMatch = st.c < 0 || x.catIndex === st.c;
        const marcaMatch = !st.m || x.marca === st.m;
        const stockMatch = !st.a || Number(x.stock) > 0;

        const searchMatch = !st.q ||
            (x.nombre + " " + x.marca + " " + x.subcategoria)
                .toLowerCase()
                .includes(st.q);

        return catMatch && marcaMatch && stockMatch && searchMatch;
    });

    L.sort((a, b) =>
        st.o === "a"
            ? a.precio - b.precio
            : st.o === "d"
                ? b.precio - a.precio
                : (Number(b.destacado) - Number(a.destacado))
    );

    $("res").textContent = L.length + " productos";

    $("productos").innerHTML = L.length
        ? C.map((n, c) => {
            const g = L.filter(x => x.catIndex === c);

            return g.length
                ? `<div>
                    <h2 class="ct">${n}</h2>
                    <div class="gp">${g.map(card).join("")}</div>
                   </div>`
                : "";
        }).join("")
        : '<p class="vacio">No hay productos con esos filtros.</p>';
}

// Mostrar detalles del producto
function det(sku) {
    const x = P.find(item => item.sku === sku);

    if (!x) return;

    productoDetalleActual = x;

    const sp = Object.entries(x.especificaciones || {})
        .map(([k, v]) => `
            <tr>
                <td>${k[0].toUpperCase() + k.slice(1).replace(/_/g, " ")}</td>
                <td>${Array.isArray(v)
                    ? v.join(", ")
                    : v === true
                        ? "Sí"
                        : v === false
                            ? "No"
                            : v}</td>
            </tr>
        `).join("");

    const almacenesHTML = (x.gestion_stock?.almacenes || [])
        .map(a => `${a.almacen}: ${a.cantidad}`)
        .join(" · ");

    $("md").innerHTML = `
        <button class="x" onclick="cl()" aria-label="Cerrar">
            <i class="fa-solid fa-xmark"></i>
        </button>

        <div class="mi" style="--h:${HUE[x.catIndex || 0]}">
            ${ic(x)}
        </div>

        <div class="mb">
            <h3>${x.nombre}</h3>
            <div class="mp">${mx(x.precio)}</div>
            <p>${x.marca} · ${x.subcategoria}</p>

            <table>${sp}</table>

            <div class="dis">
                <b>Disponibilidad por almacén:</b>
                ${almacenesHTML || "Sin información de almacenes"}
                (${x.stock} total)
            </div>

            <div class="cnt">
                <span>Piezas:</span>

                <div>
                    <button onclick="qt(-1)">-</button>
                    <b id="qn">1</b>
                    <button onclick="qt(1)">+</button>
                </div>
            </div>

            <button class="ok"
                onclick="add('${x.sku}', Number($('qn').textContent)); cl()"
                ${Number(x.stock) > 0 ? "" : "disabled"}>
                Añadir al pedido
            </button>
        </div>`;

    $("ov").classList.add("on");
}

// Modificar cantidad en el detalle
function qt(d) {
    const e = $("qn");

    if (!e || !productoDetalleActual) return;

    const maximo = Number(productoDetalleActual.stock);

    e.textContent = Math.min(
        maximo,
        Math.max(1, Number(e.textContent) + d)
    );
}

// Información de TechForge
function about() {
    $("md").innerHTML = `
        <button class="x" onclick="cl()" aria-label="Cerrar">
            <i class="fa-solid fa-xmark"></i>
        </button>

        <div class="mb">
            <h3>Sobre TechForge</h3>

            <p>
                TechForge utiliza una arquitectura NoSQL con MongoDB,
                estructurando documentos polimórficos en la colección
                de productos y manteniendo categorías independientes
                para optimizar las consultas del e-commerce.
            </p>

            <button class="ok" onclick="cl()">Volver al catálogo</button>
        </div>`;

    $("ov").classList.add("on");
}

// Cerrar ventana de detalles
function cl() {
    $("ov").classList.remove("on");
    productoDetalleActual = null;
}

// Mostrar u ocultar carrito
function toggleCart() {
    $("pedido").classList.toggle("open");
}

// Agregar productos al carrito
function add(sku, n = 1) {
    const product = P.find(p => p.sku === sku);

    if (!product) return;

    const stock = Number(product.stock);
    const cantidadActual = Number(cart[sku] || 0);
    const cantidadSolicitada = Number(n);

    if (!Number.isFinite(cantidadSolicitada) || cantidadSolicitada <= 0) {
        return;
    }

    if (stock <= 0) return;

    cart[sku] = Math.min(
        stock,
        cantidadActual + cantidadSolicitada
    );

    upd();
}

// Eliminar producto del carrito
function removeFromCart(sku) {
    delete cart[sku];
    upd();
}

// Vaciar carrito
function clearCart() {
    cart = {};
    upd();
}

// Actualizar carrito y totales
function upd() {
    const entries = Object.entries(cart)
        .filter(([sku, n]) => n > 0);

    const totalCount = entries.reduce(
        (s, [sku, n]) => s + n,
        0
    );

    const totalPrice = entries.reduce((s, [sku, n]) => {
        const prod = P.find(p => p.sku === sku);

        return s + (prod ? prod.precio * n : 0);
    }, 0);

    $("cnt").textContent = totalCount;

    $("pl").innerHTML = entries.length === 0
        ? "<li>Aún no agregas productos.</li>"
        : entries.map(([sku, n]) => {
            const prod = P.find(p => p.sku === sku);

            return `
                <li>
                    <span>${n}x ${prod
                        ? prod.nombre.slice(0, 20)
                        : sku}…</span>

                    <span>${mx(prod ? prod.precio * n : 0)}</span>

                    <button onclick="removeFromCart('${sku}')"
                            aria-label="Quitar">
                        &times;
                    </button>
                </li>`;
        }).join("");

    $("tot").textContent = "Total: " + mx(totalPrice);
}

// Inicializar categorías
$("cats").innerHTML = ["Ver todo", ...C]
    .map((n, k) =>
        `<button class="${k ? "" : "on"}" data-c="${k - 1}">${n}</button>`
    )
    .join("");

// Eventos de categorías
$("cats").onclick = e => {
    const b = e.target.closest("button");

    if (!b) return;

    st.c = Number(b.dataset.c);

    [...$("cats").children].forEach(x =>
        x.classList.toggle("on", x === b)
    );

    render();
};

// Búsqueda
$("q").oninput = e => {
    st.q = e.target.value.trim().toLowerCase();
    render();
};

// Filtro por marca
$("fm").onchange = e => {
    st.m = e.target.value;
    render();
};

// Ordenamiento
$("fo").onchange = e => {
    st.o = e.target.value;
    render();
};

// Filtro de disponibilidad
$("fd").onchange = e => {
    st.a = e.target.checked;
    render();
};

// Cerrar modal al pulsar fuera
$("ov").onclick = e => {
    if (e.target.id === "ov") cl();
};

// Cerrar modal con Escape
document.onkeydown = e => {
    if (e.key === "Escape") cl();
};

// Conexión con la API de Node.js, Express y MongoDB
async function cargarProductos() {
    try {
        const res = await fetch('/api/productos');

        if (!res.ok) {
            throw new Error(`Error HTTP: ${res.status}`);
        }

        const data = await res.json();

        if (!Array.isArray(data)) {
            throw new Error("La API no devolvió una lista de productos.");
        }

        P = data.map(item => {
            let catIndex = C.indexOf(item.categoria);

            if (catIndex === -1) catIndex = 0;

            return {
                ...item,
                catIndex,
                stock: Number(item.stock || 0),
                precio: Number(item.precio || 0)
            };
        });

        const marcas = [...new Set(
            P.map(x => x.marca).filter(Boolean)
        )].sort();

        $("fm").innerHTML = '<option value="">Todas</option>';

        marcas.forEach(m => {
            $("fm").add(new Option(m, m));
        });

        render();
        upd();

    } catch (err) {
        console.error(
            "Error al conectar con la API de MongoDB:",
            err
        );

        $("productos").innerHTML = `
            <div class="vacio" style="padding: 40px 20px; text-align: center;">
                <i class="fa-solid fa-triangle-exclamation"
                   style="font-size: 40px; color: #c10000; margin-bottom: 10px; display: block;"></i>

                <h3>No se pudo conectar al servidor backend</h3>

                <p style="color: #666; font-size: 13px;">
                    Verifica que la API de Express esté funcionando
                    y que MongoDB Atlas esté conectado.
                </p>
            </div>`;

        $("res").textContent = "Error al cargar productos";
    }
}

// Iniciar catálogo
cargarProductos();
