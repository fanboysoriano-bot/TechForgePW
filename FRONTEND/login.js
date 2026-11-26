const form = document.getElementById('loginForm');
const message = document.getElementById('message');
const submitButton = document.getElementById('submitButton');

function getReturnUrl() {
    const value = new URLSearchParams(location.search).get('returnTo') || 'carrito.html';
    // Solo permitir rutas relativas del propio sitio.
    if (value.startsWith('/') || value.includes('://') || value.startsWith('//')) return 'carrito.html';
    return value;
}

document.querySelector('.toggle-password').addEventListener('click', () => {
    const input = document.getElementById('password');
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    document.querySelector('.toggle-password i').className = show ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye';
});

form.addEventListener('submit', async (event) => {
    event.preventDefault();
    message.textContent = '';
    message.className = 'message';

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    submitButton.disabled = true;
    submitButton.textContent = 'Verificando...';

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();

        if (!response.ok) throw new Error(data.error || 'No se pudo iniciar sesión.');

        message.textContent = 'Sesión iniciada. Redirigiendo...';
        message.classList.add('success');
        location.href = getReturnUrl();
    } catch (error) {
        message.textContent = error.message || 'Error de conexión con el servidor.';
        submitButton.disabled = false;
        submitButton.innerHTML = 'Iniciar sesión <i class="fa-solid fa-arrow-right"></i>';
    }
});
