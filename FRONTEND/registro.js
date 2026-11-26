const form = document.getElementById('registerForm');
const message = document.getElementById('message');
const submitButton = document.getElementById('submitButton');

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

    const nombre = document.getElementById('nombre').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (password !== confirmPassword) {
        message.textContent = 'Las contraseñas no coinciden.';
        return;
    }
    if (password.length < 8) {
        message.textContent = 'La contraseña debe tener al menos 8 caracteres.';
        return;
    }

    submitButton.disabled = true;
    submitButton.textContent = 'Creando cuenta...';

    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ nombre, email, password })
        });
        const data = await response.json();

        if (!response.ok) throw new Error(data.error || 'No se pudo crear la cuenta.');

        message.textContent = 'Cuenta creada. Redirigiendo al carrito...';
        message.classList.add('success');
        location.href = 'carrito.html';
    } catch (error) {
        message.textContent = error.message || 'Error de conexión con el servidor.';
        submitButton.disabled = false;
        submitButton.innerHTML = 'Crear cuenta <i class="fa-solid fa-arrow-right"></i>';
    }
});
