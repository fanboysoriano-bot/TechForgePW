// FRONTEND/carrito.js
// Se carga DESPUÉS de app.js. No modifica app.js: solo lo "envuelve".
//  - Restaura el carrito guardado al abrir el catálogo
//  - Guarda el carrito en localStorage cada vez que cambia
//  - Agrega un botón "Ver carrito y pagar" al mini-panel

(function () {
    const KEY = 'tf_cart';

    // 1) Restaurar carrito guardado (cart es la variable de app.js)
    try {
        const guardado = JSON.parse(localStorage.getItem(KEY) || '{}');
        if (guardado && typeof guardado === 'object') cart = guardado;
    } catch (e) { /* si falla, se queda vacío */ }

    // 2) Guardar en cada cambio
    const originalUpd = upd;
    upd = function () {
        originalUpd();
        try { localStorage.setItem(KEY, JSON.stringify(cart)); } catch (e) {}
    };

    // 3) Botón hacia la página del carrito completo
    const panel = document.getElementById('pedido');
    const vaciar = panel && panel.querySelector('.vc');
    if (panel && vaciar) {
        const btn = document.createElement('button');
        btn.className = 'vc';
        btn.type = 'button';
        btn.style.marginBottom = '8px';
        btn.textContent = 'Ver carrito y pagar';
        btn.onclick = () => { window.location.href = 'carrito.html'; };
        panel.insertBefore(btn, vaciar);
    }
})();
