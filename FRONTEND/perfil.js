
const profileBtn = document.getElementById('profileBtn');
const profileMenu = document.getElementById('profileMenu');
const profileStatus = document.getElementById('profileStatus');
const profileOptions = document.getElementById('profileOptions');

profileBtn.addEventListener('click', () => {
    profileMenu.classList.toggle('active');
});

document.addEventListener('click', event => {
    if (!event.target.closest('#profileArea')) {
        profileMenu.classList.remove('active');
    }
});

async function cargarPerfil() {
    try {
        const response = await fetch('/api/auth/me', {
            credentials: 'same-origin'
        });

        if (!response.ok) {
            mostrarSinSesion();
            return;
        }

        const data = await response.json();

        if (data.tipo === 'admin') {
            mostrarAdministrador(data.usuario);
        } else if (data.tipo === 'cliente') {
            mostrarCliente(data.usuario);
        } else {
            mostrarSinSesion();
        }

    } catch (error) {
        console.error('Error al consultar sesión:', error);
        profileStatus.textContent = 'No se pudo consultar la sesión.';
        profileOptions.innerHTML = '';
    }
}

function mostrarSinSesion() {
    document.body.classList.remove('admin-mode');

    profileBtn.innerHTML = '<span>👤</span><span>Mi cuenta</span>';
    profileStatus.textContent = 'Bienvenido a TechForge';

    profileOptions.innerHTML = `
        <a href="login.html">Iniciar como cliente</a>
        <a href="ADMIN/login.html">Iniciar como administrador</a>
        <a href="registro.html">¿No tienes cuenta? Regístrate</a>
    `;
}

function mostrarCliente(usuario) {
    document.body.classList.remove('admin-mode');

    profileBtn.innerHTML = '<span>👤</span><span>Mi cuenta</span>';
    profileStatus.textContent = `Cliente: ${usuario.nombre}`;

    profileOptions.innerHTML = `
        <a href="carrito.html">Mi carrito</a>
        <button class="logout-option" id="logoutBtn">Cerrar sesión</button>
    `;

    document.getElementById('logoutBtn')
        .addEventListener('click', cerrarSesion);
}

function mostrarAdministrador(usuario) {
    document.body.classList.add('admin-mode');

    profileBtn.innerHTML = '<span>🛡️</span><span>Administrador</span>';
    profileStatus.textContent = `Administrador: ${usuario.nombre}`;

    // No eliminar elementos del catálogo ni del carrito.
    // CSS ocultará únicamente las opciones de compra.

    profileOptions.innerHTML = `
        <a href="ADMIN/dashboard.html">Ir al panel administrativo</a>
        <button class="logout-option" id="logoutBtn">Cerrar sesión</button>
    `;

    document.getElementById('logoutBtn')
        .addEventListener('click', cerrarSesion);
}

async function cerrarSesion() {
    try {
        const response = await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'same-origin'
        });

        if (!response.ok) {
            throw new Error('No se pudo cerrar la sesión.');
        }

        window.location.href = 'index.html';

    } catch (error) {
        alert(error.message);
    }
}

cargarPerfil();
