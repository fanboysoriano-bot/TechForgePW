
const dns = require('dns');
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const { Redis } = require('@upstash/redis');
const cloudinary = require('cloudinary').v2;
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Kafka } = require('kafkajs');

require('dotenv').config();

/* ==========================================================
   CONFIGURACIÓN GENERAL
   ========================================================== */

// DNS de Google opcional
if (process.env.USE_GOOGLE_DNS === 'true') {
    dns.setServers(['8.8.8.8', '8.8.4.4']);
    console.log('DNS de Google habilitado.');
}

// Cloudinary
cloudinary.config({ secure: true });

// Express
const app = express();
const PORT = process.env.PORT || 3000;

// Variables de entorno
const MONGO_URI = process.env.MONGO_URI;
const AUTH_SECRET = process.env.AUTH_JWT_SECRET;

// Rutas
const frontendPath = path.join(__dirname, '..', 'FRONTEND');

// Configuración de sesión
const COOKIE_NAME = 'tf_session';
const SESSION_DAYS = 7;

// Caché
const CACHE_TTL = 300;

// Middlewares
app.use(cors({
    origin: true,
    credentials: true
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.static(frontendPath));

/* ==========================================================
   CONEXIONES Y VARIABLES GLOBALES
   ========================================================== */

let db = null;
let client = null;
let redis = null;
let kafkaProducer = null;

/* ==========================================================
   CONEXIÓN CON KAFKA
   ========================================================== */

async function conectarKafka() {
    const brokers = process.env.KAFKA_BROKERS;

    if (!brokers) {
        console.log('Kafka no configurado. Se omitirá la conexión.');
        return;
    }

    const kafka = new Kafka({
        clientId: 'techforge-backend',
        brokers: brokers.split(',').map(broker => broker.trim())
    });

    const producer = kafka.producer();

    try {
        await producer.connect();

        kafkaProducer = producer;

        console.log('Conexión con Kafka establecida correctamente.');
    } catch (error) {
        kafkaProducer = null;

        console.error(
            'No se pudo conectar con Kafka:',
            error.message
        );

        await producer.disconnect().catch(() => {});
    }
}

/* ==========================================================
   AUTENTICACIÓN Y SESIONES
   ========================================================== */

// Obtener cookie
function getCookie(req, name) {
    const header = req.headers.cookie || '';

    const part = header
        .split(';')
        .map(value => value.trim())
        .find(value => value.startsWith(name + '='));

    return part
        ? decodeURIComponent(part.slice(name.length + 1))
        : null;
}

// Crear sesión

function createSessionCookie(res, user, tipo = 'cliente') {
    const token = jwt.sign(
        {
            sub: user._id.toString(),
            email: user.email,
            tipo
        },
        AUTH_SECRET,
        {
            expiresIn: `${SESSION_DAYS}d`
        }
    );

    res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
        path: '/'
    });
}


// Eliminar sesión
function clearSessionCookie(res) {
    res.clearCookie(COOKIE_NAME, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/'
    });
}

// Middleware de autenticación
function requireAuth(req, res, next) {
    const token = getCookie(req, COOKIE_NAME);

    if (!token) {
        return res.status(401).json({
            error: 'Inicia sesión para continuar.'
        });
    }

    try {
        req.auth = jwt.verify(token, AUTH_SECRET);
        next();
    } catch (error) {
        clearSessionCookie(res);

        return res.status(401).json({
            error: 'Tu sesión expiró. Inicia sesión nuevamente.'
        });
    }
}

// Middleware exclusivo para clientes
async function requireCliente(req, res, next) {
    try {
        if (req.auth.tipo !== 'cliente') {
            return res.status(403).json({
                error: 'Esta función es exclusiva para clientes.'
            });
        }

        if (!ObjectId.isValid(req.auth.sub)) {
            return res.status(401).json({
                error: 'Sesión de cliente no válida.'
            });
        }

        const usuario = await db.collection('usuarios').findOne({
            _id: new ObjectId(req.auth.sub),
            email: req.auth.email
        });

        if (!usuario) {
            clearSessionCookie(res);

            return res.status(401).json({
                error: 'La cuenta de cliente ya no existe.'
            });
        }

        req.usuario = usuario;
        next();

    } catch (error) {
        console.error('Error al validar cliente:', error);

        return res.status(500).json({
            error: 'No se pudo validar la cuenta.'
        });
    }
}
// Middleware exclusivo para administradores
async function requireAdmin(req, res, next) {
    try {
        if (req.auth.tipo !== 'admin') {
            return res.status(403).json({
                error: 'Acceso exclusivo para administradores.'
            });
        }

        if (!ObjectId.isValid(req.auth.sub)) {
            return res.status(401).json({
                error: 'Sesión de administrador no válida.'
            });
        }

        const administrador = await db.collection('administradores').findOne({
            _id: new ObjectId(req.auth.sub),
            email: req.auth.email
        });

        if (!administrador) {
            return res.status(403).json({
                error: 'La cuenta de administrador no está autorizada.'
            });
        }

        req.admin = administrador;
        next();

    } catch (error) {
        console.error('Error al validar administrador:', error);

        return res.status(500).json({
            error: 'No se pudo validar el acceso.'
        });
    }
}


/* ==========================================================
   AUTENTICACIÓN: ADMINISTRADORES
   ========================================================== */

app.post('/api/admin/login', async (req, res) => {
    try {
        const email = String(req.body.email || '').trim().toLowerCase();
        const password = String(req.body.password || '');

        if (!email || !password) {
            return res.status(400).json({
                error: 'Escribe tu correo y contraseña.'
            });
        }

        const administrador = await db.collection('administradores')
            .findOne({ email });

        if (!administrador) {
            return res.status(401).json({
                error: 'Correo o contraseña incorrectos.'
            });
        }

        const coincide = await bcrypt.compare(
            password,
            administrador.passwordHash
        );

        if (!coincide) {
            return res.status(401).json({
                error: 'Correo o contraseña incorrectos.'
            });
        }

        createSessionCookie(res, administrador, 'admin');

        return res.json({
            mensaje: 'Sesión de administrador iniciada.',
            administrador: {
                nombre: administrador.nombre,
                email: administrador.email
            }
        });

    } catch (error) {
        console.error('Error al iniciar sesión de administrador:', error);

        return res.status(500).json({
            error: 'No se pudo iniciar sesión.'
        });
    }
});

/* ==========================================================
   AUTENTICACIÓN: REGISTRO
   ========================================================== */

app.post('/api/auth/register', async (req, res) => {
    try {
        const nombre = String(req.body.nombre || '').trim();
        const email = String(req.body.email || '').trim().toLowerCase();
        const password = String(req.body.password || '');

        // Validar nombre
        if (nombre.length < 3 || nombre.length > 80) {
            return res.status(400).json({
                error: 'Escribe un nombre de entre 3 y 80 caracteres.'
            });
        }

        // Validar correo
        if (
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
            email.length > 160
        ) {
            return res.status(400).json({
                error: 'Escribe un correo electrónico válido.'
            });
        }

        // Validar contraseña
        if (password.length < 8 || password.length > 72) {
            return res.status(400).json({
                error: 'La contraseña debe tener entre 8 y 72 caracteres.'
            });
        }

        const usuarios = db.collection('usuarios');

        // Comprobar correo existente
        const existente = await usuarios.findOne({ email });

        if (existente) {
            return res.status(409).json({
                error: 'Ya existe una cuenta con ese correo.'
            });
        }

        // Encriptar contraseña
        const passwordHash = await bcrypt.hash(password, 12);

        // Crear usuario
        const resultado = await usuarios.insertOne({
            nombre,
            email,
            passwordHash,
            creadoEn: new Date()
        });

        const usuario = {
            _id: resultado.insertedId,
            nombre,
            email
        };

        // Iniciar sesión automáticamente
        createSessionCookie(res, usuario);

        return res.status(201).json({
            mensaje: 'Cuenta creada correctamente.',
            usuario: {
                nombre,
                email
            }
        });

    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                error: 'Ya existe una cuenta con ese correo.'
            });
        }

        console.error('Error al registrar usuario:', error);

        return res.status(500).json({
            error: 'No se pudo crear la cuenta.'
        });
    }
});

/* ==========================================================
   AUTENTICACIÓN: INICIO DE SESIÓN
   ========================================================== */

app.post('/api/auth/login', async (req, res) => {
    try {
        const email = String(req.body.email || '').trim().toLowerCase();
        const password = String(req.body.password || '');

        if (!email || !password) {
            return res.status(400).json({
                error: 'Escribe tu correo y contraseña.'
            });
        }

        const usuario = await db.collection('usuarios').findOne({ email });

        if (!usuario) {
            return res.status(401).json({
                error: 'Correo o contraseña incorrectos.'
            });
        }

        const coincide = await bcrypt.compare(
            password,
            usuario.passwordHash
        );

        if (!coincide) {
            return res.status(401).json({
                error: 'Correo o contraseña incorrectos.'
            });
        }

        createSessionCookie(res, usuario);

        return res.json({
            mensaje: 'Sesión iniciada.',
            usuario: {
                nombre: usuario.nombre,
                email: usuario.email,
                direccion: usuario.direccion || null
            }
        });

    } catch (error) {
        console.error('Error al iniciar sesión:', error);

        return res.status(500).json({
            error: 'No se pudo iniciar sesión.'
        });
    }
});

/* ==========================================================
   AUTENTICACIÓN: SESIÓN ACTUAL
   ========================================================== */

app.get('/api/auth/me', requireAuth, async (req, res) => {
    try {
        if (!ObjectId.isValid(req.auth.sub)) {
            clearSessionCookie(res);

            return res.status(401).json({
                error: 'Sesión no válida.'
            });
        }

        let cuenta;
        let tipo;

        if (req.auth.tipo === 'admin') {
            tipo = 'admin';

            cuenta = await db.collection('administradores').findOne({
                _id: new ObjectId(req.auth.sub),
                email: req.auth.email
            });

        } else if (req.auth.tipo === 'cliente') {
            tipo = 'cliente';

            cuenta = await db.collection('usuarios').findOne({
                _id: new ObjectId(req.auth.sub),
                email: req.auth.email
            }, {
                projection: {
                    nombre: 1,
                    email: 1,
                    direccion: 1
                }
            });

        } else {
            clearSessionCookie(res);

            return res.status(401).json({
                error: 'Tipo de sesión no válido.'
            });
        }

        if (!cuenta) {
            clearSessionCookie(res);

            return res.status(401).json({
                error: 'La cuenta ya no existe.'
            });
        }

        return res.json({
            autenticado: true,
            tipo,
            usuario: {
                nombre: cuenta.nombre,
                email: cuenta.email,
                direccion: cuenta.direccion || null
            }
        });

    } catch (error) {
        console.error('Error al consultar sesión:', error);

        return res.status(500).json({
            error: 'No se pudo consultar la sesión.'
        });
    }
});

/* ==========================================================
   DIRECCIONES: CONSULTAR
   ========================================================== */

app.get('/api/auth/direccion', requireAuth, requireCliente, async (req, res) => {
    try {
        const usuario = await db.collection('usuarios').findOne(
            {
                _id: new ObjectId(req.auth.sub)
            },
            {
                projection: {
                    direccion: 1
                }
            }
        );

        if (!usuario) {
            return res.status(404).json({
                error: 'Usuario no encontrado.'
            });
        }

        return res.json({
            direccion: usuario.direccion || null
        });

    } catch (error) {
        console.error('Error al consultar dirección:', error);

        return res.status(500).json({
            error: 'No se pudo consultar la dirección.'
        });
    }
});

/* ==========================================================
   DIRECCIONES: GUARDAR O ACTUALIZAR
   ========================================================== */

app.put('/api/auth/direccion', requireAuth, requireCliente, async (req, res) => {
    try {
        const direccion = req.body.direccion;

        // Eliminar dirección guardada
        if (direccion === null) {
            await db.collection('usuarios').updateOne(
                {
                    _id: new ObjectId(req.auth.sub)
                },
                {
                    $unset: {
                        direccion: ''
                    }
                }
            );

            return res.json({
                mensaje: 'Dirección eliminada.'
            });
        }

        const campos = [
            'nombre',
            'tel',
            'calle',
            'colonia',
            'cp',
            'ciudad',
            'estado'
        ];

        // Validar campos obligatorios
        if (
            !direccion ||
            campos.some(campo =>
                typeof direccion[campo] !== 'string' ||
                !direccion[campo].trim()
            )
        ) {
            return res.status(400).json({
                error: 'Completa todos los campos obligatorios de la dirección.'
            });
        }

        // Validar teléfono y código postal
        if (
            !/^\d{10}$/.test(direccion.tel) ||
            !/^\d{5}$/.test(direccion.cp)
        ) {
            return res.status(400).json({
                error: 'El teléfono o código postal no tienen un formato válido.'
            });
        }

        // Limpiar datos
        const direccionLimpia = {
            nombre: direccion.nombre.trim(),
            tel: direccion.tel.trim(),
            calle: direccion.calle.trim(),
            colonia: direccion.colonia.trim(),
            cp: direccion.cp.trim(),
            ciudad: direccion.ciudad.trim(),
            estado: direccion.estado.trim(),
            ref: typeof direccion.ref === 'string'
                ? direccion.ref.trim()
                : ''
        };

        const resultado = await db.collection('usuarios').updateOne(
            {
                _id: new ObjectId(req.auth.sub)
            },
            {
                $set: {
                    direccion: direccionLimpia
                }
            }
        );

        if (!resultado.matchedCount) {
            return res.status(404).json({
                error: 'Usuario no encontrado.'
            });
        }

        return res.json({
            mensaje: 'Dirección guardada correctamente.',
            direccion: direccionLimpia
        });

    } catch (error) {
        console.error('Error al guardar dirección:', error);

        return res.status(500).json({
            error: 'No se pudo guardar la dirección.'
        });
    }
});

/* ==========================================================
   AUTENTICACIÓN: CERRAR SESIÓN
   ========================================================== */

app.post('/api/auth/logout', (req, res) => {
    clearSessionCookie(res);

    return res.json({
        mensaje: 'Sesión cerrada.'
    });
});

/* ==========================================================
   API DE PRODUCTOS
   ========================================================== */

app.get('/api/productos', async (req, res) => {
    const cacheKey = 'techforge:productos';

    try {
        // Consultar Redis
        if (redis) {
            try {
                const productosCache = await redis.get(cacheKey);

                if (productosCache !== null) {
                    console.log('Productos obtenidos desde Redis');
                    return res.json(productosCache);
                }
            } catch (error) {
                console.error('Error al consultar Redis:', error.message);
            }
        }

        // Consultar MongoDB
        const productos = await db.collection('productos')
            .find({})
            .toArray();

        // Guardar en Redis
        if (redis) {
            try {
                await redis.set(cacheKey, productos, {
                    ex: CACHE_TTL
                });

                console.log('Productos guardados en Redis');
            } catch (error) {
                console.error('Error al guardar productos en Redis:', error.message);
            }
        }

        return res.json(productos);

    } catch (error) {
        console.error('Error al obtener los productos:', error);

        return res.status(500).json({
            error: 'Error al obtener los productos.'
        });
    }
});

/* ==========================================================
   API DE CATEGORÍAS
   ========================================================== */

app.get('/api/categorias', async (req, res) => {
    const cacheKey = 'techforge:categorias';

    try {
        // Consultar Redis
        if (redis) {
            try {
                const categoriasCache = await redis.get(cacheKey);

                if (categoriasCache !== null) {
                    console.log('Categorías obtenidas desde Redis');
                    return res.json(categoriasCache);
                }
            } catch (error) {
                console.error('Error al consultar Redis:', error.message);
            }
        }

        // Consultar MongoDB
        const categorias = await db.collection('categorias')
            .find({})
            .toArray();

        // Guardar en Redis
        if (redis) {
            try {
                await redis.set(cacheKey, categorias, {
                    ex: CACHE_TTL
                });

                console.log('Categorías guardadas en Redis');
            } catch (error) {
                console.error('Error al guardar categorías en Redis:', error.message);
            }
        }

        return res.json(categorias);

    } catch (error) {
        console.error('Error al obtener las categorías:', error);

        return res.status(500).json({
            error: 'Error al obtener las categorías.'
        });
    }
});

/* ==========================================================
   ESTADO DE CONEXIONES
   ========================================================== */

app.get('/api/estado', async (req, res) => {
    let mongoConectada = false;
    let redisConectado = false;

    // Comprobar MongoDB
    try {
        await db.command({
            ping: 1
        });

        mongoConectada = true;

    } catch (error) {
        console.error('Error MongoDB:', error.message);
    }

    // Comprobar Redis
    try {
        if (redis) {
            await redis.ping();
            redisConectado = true;
        }
    } catch (error) {
        console.error('Error Redis:', error.message);
    }

    return res.json({
        servidor: 'funcionando',
        mongoDB: mongoConectada,
        redis: redisConectado,
        kafka: Boolean(kafkaProducer),
        cacheTTL: CACHE_TTL
    });
});

/* ==========================================================
   FRONTEND
   ========================================================== */

app.get('/', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

/* ==========================================================
   PEDIDOS
   ========================================================== */

// Crear un pedido y guardarlo en MongoDB
app.post('/api/pedidos', requireAuth, requireCliente, async (req, res) => {
    try {
        const { items, direccion, pago } = req.body;

        // Validaciones básicas
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                error: 'El pedido no contiene productos.'
            });
        }

        if (!direccion || !direccion.nombre || !direccion.calle ||
            !direccion.colonia || !direccion.cp || !direccion.ciudad ||
            !direccion.estado || !direccion.tel) {
            return res.status(400).json({
                error: 'La dirección de envío está incompleta.'
            });
        }

        if (!pago || !pago.marca || !/^\d{4}$/.test(pago.ultimos4 || '')) {
            return res.status(400).json({
                error: 'Los datos de pago son inválidos.'
            });
        }

        // Validar y normalizar los productos recibidos
        const cantidades = new Map();

        for (const item of items) {
            const sku = String(item.sku || '').trim();
            const cantidad = Number(item.cantidad);

            if (!sku || !Number.isInteger(cantidad) || cantidad < 1) {
                return res.status(400).json({
                    error: 'Hay productos o cantidades inválidas.'
                });
            }

            cantidades.set(sku, (cantidades.get(sku) || 0) + cantidad);
        }

        const skus = [...cantidades.keys()];

        // Consultar los productos directamente en MongoDB
        const productos = await db.collection('productos')
            .find({ sku: { $in: skus } })
            .toArray();

        if (productos.length !== skus.length) {
            return res.status(400).json({
                error: 'Uno o más productos ya no están disponibles.'
            });
        }

        const productosPedido = [];

        for (const producto of productos) {
            const cantidad = cantidades.get(producto.sku);
            const precio = Number(producto.precio);
            const stock = Number(producto.stock);

            if (!Number.isFinite(precio) || precio < 0) {
                return res.status(400).json({
                    error: `Precio inválido para ${producto.sku}.`
                });
            }

            if (!Number.isFinite(stock) || cantidad > stock) {
                return res.status(409).json({
                    error: `Stock insuficiente para ${producto.nombre}.`
                });
            }

            productosPedido.push({
                sku: producto.sku,
                nombre: producto.nombre,
                precio,
                cantidad
            });
        }

        // Calcular importes en el servidor
        const subtotal = productosPedido.reduce(
            (total, item) => total + item.precio * item.cantidad,
            0
        );

        const envio = subtotal === 0 ? 0 : (subtotal >= 2000 ? 0 : 150);
        const total = subtotal + envio;

        const fecha = new Date();

        const pedido = {
            numero: 'TF-' +
                fecha.toISOString().slice(0, 10).replace(/-/g, '') +
                '-' +
                require('crypto').randomBytes(3).toString('hex').toUpperCase(),

            usuarioId: req.auth.sub,
            fecha,

            items: productosPedido,
            direccion: {
                nombre: String(direccion.nombre).trim(),
                tel: String(direccion.tel).trim(),
                calle: String(direccion.calle).trim(),
                colonia: String(direccion.colonia).trim(),
                cp: String(direccion.cp).trim(),
                ciudad: String(direccion.ciudad).trim(),
                estado: String(direccion.estado).trim(),
                ref: String(direccion.ref || '').trim()
            },

            pago: {
                marca: String(pago.marca).trim(),
                ultimos4: pago.ultimos4
            },

            subtotal,
            envio,
            total,
            estado: 'Pagado (simulado)',
            estadoPedido: 'Pendiente'
        };

        // Guardar primero en MongoDB
        const resultado = await db.collection('pedidos').insertOne(pedido);

        pedido._id = resultado.insertedId;

        // Publicar evento en Kafka
        let eventoKafka = 'pendiente';

        if (kafkaProducer) {
            try {
                await kafkaProducer.send({
                    topic: 'pedidos',
                    messages: [{
                        key: pedido.numero,
                        value: JSON.stringify({
                            tipo: 'PEDIDO_CREADO',
                            pedidoId: pedido._id.toString(),
                            numero: pedido.numero,
                            usuarioId: pedido.usuarioId,
                            fecha: pedido.fecha,
                            total: pedido.total,
                            items: pedido.items
                        })
                    }]
                });

                eventoKafka = 'publicado';
            } catch (error) {
                console.error('Error publicando pedido en Kafka:', error.message);
            }
        }

        return res.status(201).json({
            mensaje: 'Pedido registrado correctamente.',
            pedido,
            eventoKafka
        });

    } catch (error) {
        console.error('Error al crear pedido:', error);

        return res.status(500).json({
            error: 'No se pudo registrar el pedido.'
        });
    }
});

// Consultar los pedidos del usuario que inició sesión
app.get('/api/pedidos/mis-pedidos', requireAuth, requireCliente, async (req, res) => {
    try {
        const pedidos = await db.collection('pedidos')
            .find({ usuarioId: req.auth.sub })
            .sort({ fecha: -1 })
            .toArray();

        res.json(pedidos);

    } catch (error) {
        console.error('Error al consultar pedidos:', error);

        res.status(500).json({
            error: 'No se pudieron consultar tus pedidos.'
        });
    }
});



/* ==========================================================
   ADMINISTRACIÓN DE PEDIDOS
   ========================================================== */

// Consultar pedidos activos: Pendientes y En proceso
app.get('/api/admin/pedidos', requireAuth, requireAdmin, async (req, res) => {
    try {
        const pedidos = await db.collection('pedidos')
            .find({
                $or: [
                    { estadoPedido: { $exists: false } },
                    { estadoPedido: null },
                    { estadoPedido: { $ne: 'Entregado' } }
                ]
            })
            .project({
                numero: 1,
                usuarioId: 1,
                fecha: 1,
                items: 1,
                'direccion.nombre': 1,
                subtotal: 1,
                envio: 1,
                total: 1,
                estado: 1,
                estadoPedido: 1
            })
            .sort({ fecha: -1 })
            .toArray();

        return res.json(pedidos);

    } catch (error) {
        console.error('Error al consultar pedidos activos:', error);

        return res.status(500).json({
            error: 'No se pudieron consultar los pedidos.'
        });
    }
});

// Consultar historial de pedidos entregados
app.get('/api/admin/pedidos/entregados', requireAuth, requireAdmin, async (req, res) => {
    try {
        const pedidos = await db.collection('pedidos')
            .find({
                estadoPedido: 'Entregado'
            })
            .project({
                numero: 1,
                usuarioId: 1,
                fecha: 1,
                items: 1,
                'direccion.nombre': 1,
                subtotal: 1,
                envio: 1,
                total: 1,
                estado: 1,
                estadoPedido: 1
            })
            .sort({ fecha: -1 })
            .toArray();

        return res.json(pedidos);

    } catch (error) {
        console.error('Error al consultar pedidos entregados:', error);

        return res.status(500).json({
            error: 'No se pudo consultar el historial de entregados.'
        });
    }
});

// Modificar estado de un pedido
app.patch('/api/admin/pedidos/:id/estado', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const estadoPedido = String(req.body.estadoPedido || '').trim();

        const estadosPermitidos = [
            'Pendiente',
            'En proceso',
            'Entregado'
        ];

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({
                error: 'Identificador de pedido no válido.'
            });
        }

        if (!estadosPermitidos.includes(estadoPedido)) {
            return res.status(400).json({
                error: 'El estado seleccionado no es válido.'
            });
        }

        const resultado = await db.collection('pedidos').updateOne(
            { _id: new ObjectId(id) },
            {
                $set: {
                    estadoPedido,
                    actualizadoEn: new Date()
                }
            }
        );

        if (!resultado.matchedCount) {
            return res.status(404).json({
                error: 'No se encontró el pedido.'
            });
        }

        return res.json({
            mensaje: 'Estado del pedido actualizado correctamente.',
            estadoPedido
        });

    } catch (error) {
        console.error('Error al actualizar estado del pedido:', error);

        return res.status(500).json({
            error: 'No se pudo actualizar el estado del pedido.'
        });
    }
});




/* ==========================================================
   RUTA NO ENCONTRADA
   ========================================================== */

app.use((req, res) => {
    res.status(404).json({
        error: 'Ruta no encontrada.'
    });
});

/* ==========================================================
   INICIAR SERVIDOR
   ========================================================== */

async function iniciarServidor() {
    try {
        // Validar variables obligatorias
        if (!MONGO_URI) {
            throw new Error('No se encontró MONGO_URI en el archivo .env');
        }

        if (!AUTH_SECRET || AUTH_SECRET.length < 32) {
            throw new Error(
                'Configura AUTH_JWT_SECRET con una cadena aleatoria de al menos 32 caracteres.'
            );
        }

        // Conectar MongoDB
        client = new MongoClient(MONGO_URI, {
            serverSelectionTimeoutMS: 15000
        });

        await client.connect();

        db = client.db('techforge');

        await db.command({
            ping: 1
        });

        // Índice único para los correos
        await db.collection('usuarios').createIndex(
            {
                email: 1
            },
            {
                unique: true
            }
        );
        // Índice único para los administradores
await db.collection('administradores').createIndex(
    {
        email: 1
    },
    {
        unique: true
    }
);

        console.log('¡Conectado exitosamente a MongoDB Atlas!');

        // Conectar Redis
        if (
            process.env.UPSTASH_REDIS_REST_URL &&
            process.env.UPSTASH_REDIS_REST_TOKEN
        ) {
            try {
                redis = new Redis({
                    url: process.env.UPSTASH_REDIS_REST_URL,
                    token: process.env.UPSTASH_REDIS_REST_TOKEN
                });

                await redis.ping();

                console.log('¡Conectado exitosamente a Upstash Redis!');

            } catch (error) {
                redis = null;

                console.error(
                    'No se pudo conectar con Redis. El servidor continuará sin caché:',
                    error.message
                );
            }
        } else {
            console.warn(
                'Redis no está configurado. El servidor continuará sin caché.'
            );
        }

        // Conectar Kafka
        await conectarKafka();

        // Iniciar servidor
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`Servidor corriendo en el puerto ${PORT}`);
        });

    } catch (error) {
        console.error('Error al iniciar el servidor:', error);

        if (kafkaProducer) {
            await kafkaProducer.disconnect().catch(() => {});
            kafkaProducer = null;
        }

        if (client) {
            await client.close().catch(() => {});
            client = null;
        }

        process.exit(1);
    }
}

/* ==========================================================
   CIERRE CONTROLADO DEL SERVIDOR
   ========================================================== */

let cerrandoServidor = false;

async function cerrarServidor() {
    if (cerrandoServidor) return;

    cerrandoServidor = true;

    console.log('Cerrando conexiones del servidor...');

    if (kafkaProducer) {
        await kafkaProducer.disconnect().catch(error => {
            console.error('Error al cerrar Kafka:', error.message);
        });

        kafkaProducer = null;
    }

    if (client) {
        await client.close().catch(error => {
            console.error('Error al cerrar MongoDB:', error.message);
        });

        client = null;
    }

    console.log('Conexiones cerradas correctamente.');
    process.exit(0);
}

process.on('SIGTERM', cerrarServidor);
process.on('SIGINT', cerrarServidor);

/* ==========================================================
   EJECUCIÓN
   ========================================================== */

iniciarServidor();
