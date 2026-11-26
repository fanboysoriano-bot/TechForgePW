// Impide avanzar desde el carrito si no hay una sesión válida.
document.addEventListener('click', async (event) => {
    const button = event.target.closest('#view [data-a="go"]');
    if (!button) return;

    // Permite el segundo clic sintético cuando el servidor confirmó la sesión.
    if (window.__tfAuthApprovedClick) {
        window.__tfAuthApprovedClick = false;
        return;
    }

    const destinationStep = Number(button.dataset.s);
    if (destinationStep < 2) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    button.disabled = true;

    try {
        const response = await fetch('/api/auth/me', {
            method: 'GET',
            credentials: 'same-origin',
            headers: { 'Accept': 'application/json' }
        });

        if (response.ok) {
            window.__tfAuthApprovedClick = true;
            button.disabled = false;
            button.click();
            return;
        }

        const returnTo = encodeURIComponent('carrito.html');
        window.location.href = `login.html?returnTo=${returnTo}`;
    } catch (error) {
        console.error('No se pudo verificar la sesión:', error);
        alert('No se pudo verificar tu sesión. Comprueba tu conexión e inténtalo de nuevo.');
        button.disabled = false;
    }
}, true);
