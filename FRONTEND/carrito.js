// FRONTEND/carrito.js
// Se carga DESPUÉS de app.js (en index.html). No modifica app.js: solo lo "envuelve".
//  - Agrega el botón "Visualizar carrito" debajo de "Vaciar pedido"
//  - Guarda el carrito en localStorage para que carrito.html lo lea

(function () {
    const KEY = 'tf_cart';

    // 1) Botón "Visualizar carrito" (debajo de "Vaciar pedido")
    try {
        const panel = document.getElementById('pedido');
        if (panel && !document.getElementById('btnVerCarrito')) {
            const btn = document.createElement('button');
            btn.id = 'btnVerCarrito';
            btn.className = 'vc';
            btn.type = 'button';
            btn.style.marginTop = '8px';
            btn.textContent = 'Visualizar carrito';
            btn.onclick = () => { window.location.href = 'carrito.html'; };

            const vaciar = panel.querySelector('.vc');
            if (vaciar) vaciar.insertAdjacentElement('afterend', btn);
            else panel.appendChild(btn);
        }
    } catch (e) {
        console.error('carrito.js (botón):', e);
    }

    // 2) Restaurar y guardar el carrito (cart y upd vienen de app.js)
    try {
        const guardado = JSON.parse(localStorage.getItem(KEY) || '{}');
        if (guardado && typeof guardado === 'object') cart = guardado;

        const originalUpd = upd;
        upd = function () {
            originalUpd();
            try { localStorage.setItem(KEY, JSON.stringify(cart)); } catch (e) {}
        };

        // Guarda de inmediato lo que ya hay en el carrito
        localStorage.setItem(KEY, JSON.stringify(cart));
    } catch (e) {
        console.error('carrito.js (guardado):', e);
    }
})();