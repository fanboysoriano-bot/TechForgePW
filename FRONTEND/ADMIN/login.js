
const form = document.getElementById('loginForm');
const mensaje = document.getElementById('mensaje');
const btnLogin = document.getElementById('btnLogin');

form.addEventListener('submit', async (e) => {
    e.preventDefault();

    mensaje.textContent = '';
    btnLogin.disabled = true;
    btnLogin.textContent = 'Verificando...';

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    try {
        const respuesta = await fetch('/api/admin/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ email, password })
        });

        const resultado = await respuesta.json();

        if (!respuesta.ok) {
            throw new Error(resultado.error || 'No se pudo iniciar sesión.');
        }

        window.location.href = 'dashboard.html';

    } catch (error) {
        mensaje.textContent = error.message;
    } finally {
        btnLogin.disabled = false;
        btnLogin.textContent = 'Iniciar sesión';
    }
});

