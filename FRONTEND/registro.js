
const form = document.getElementById('registerForm');
const message = document.getElementById('message');
const submitButton = document.getElementById('submitButton');

// Mostrar u ocultar contraseña
document.querySelector('.toggle-password').addEventListener('click', () => {
    const input = document.getElementById('password');
    const show = input.type === 'password';

    input.type = show ? 'text' : 'password';

    document.querySelector('.toggle-password i').className =
        show ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye';
});

// Registro
form.addEventListener('submit', async (event) => {
    event.preventDefault();

    message.textContent = '';
    message.className = 'message';

    const nombre = document.getElementById('nombre').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    const direccion = {
        calle: document.getElementById('calle').value.trim(),
        numero: document.getElementById('numero').value.trim(),
        colonia: document.getElementById('colonia').value.trim(),
        municipio: document.getElementById('municipio').value.trim(),
        estado: document.getElementById('estado').value.trim(),
        codigoPostal: document.getElementById('codigoPostal').value.trim(),
        referencias: document.getElementById('referencias').value.trim()
    };

    if (password !== confirmPassword) {
        message.textContent = 'Las contraseñas no coinciden.';
        return;
    }

    if (password.length < 8 || password.length > 72) {
        message.textContent = 'La contraseña debe tener entre 8 y 72 caracteres.';
        return;
    }

    if (!/^\d{5}$/.test(direccion.codigoPostal)) {
        message.textContent = 'El código postal debe contener exactamente 5 dígitos.';
        return;
    }

    submitButton.disabled = true;
    submitButton.innerHTML = 'Creando cuenta...';

    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'same-origin',
            body: JSON.stringify({
                nombre,
                email,
                password,
                direccion
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'No se pudo crear la cuenta.');
        }

        message.textContent = 'Cuenta creada correctamente. Redirigiendo...';
        message.classList.add('success');

        location.href = 'carrito.html';

    } catch (error) {
        message.textContent =
            error.message || 'Error de conexión con el servidor.';

        submitButton.disabled = false;
        submitButton.innerHTML =
            'Crear cuenta <i class="fa-solid fa-arrow-right"></i>';
    }
});
