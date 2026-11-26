const dns = require('dns');
const express = require('express');
const { MongoClient } = require('mongodb');
const { Redis } = require('@upstash/redis');
const cloudinary = require('cloudinary').v2;
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

require('dotenv').config();

cloudinary.config({ secure: true });

if (process.env.USE_GOOGLE_DNS === 'true') {
    dns.setServers(['8.8.8.8', '8.8.4.4']);
}

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;
const AUTH_SECRET = process.env.AUTH_JWT_SECRET;
const frontendPath = path.join(__dirname, '..', 'FRONTEND');

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.static(frontendPath));

let db;
let client;
let redis;

const CACHE_TTL = 300;
const COOKIE_NAME = 'tf_session';
const SESSION_DAYS = 7;

function getCookie(req, name) {
    const header = req.headers.cookie || '';
    const part = header.split(';').map(x => x.trim())
        .find(x => x.startsWith(name + '='));
    return part ? decodeURIComponent(part.slice(name.length + 1)) : null;
}

function createSessionCookie(res, user) {
    const token = jwt.sign(
        { sub: user._id.toString(), email: user.email },
        AUTH_SECRET,
        { expiresIn: `${SESSION_DAYS}d` }
    );

    res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
        path: '/'
    });
}

function clearSessionCookie(res) {
    res.clearCookie(COOKIE_NAME, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/'
    });
}

function requireAuth(req, res, next) {
    const token = getCookie(req, COOKIE_NAME);
    if (!token) {
        return res.status(401).json({ error: 'Inicia sesión para continuar.' });
    }

    try {
        req.auth = jwt.verify(token, AUTH_SECRET);
        next();
    } catch (error) {
        clearSessionCookie(res);
        return res.status(401).json({ error: 'Tu sesión expiró. Inicia sesión nuevamente.' });
    }
}

// Registro de usuario
app.post('/api/auth/register', async (req, res) => {
    try {
        const nombre = String(req.body.nombre || '').trim();
        const email = String(req.body.email || '').trim().toLowerCase();
        const password = String(req.body.password || '');

        if (nombre.length < 3 || nombre.length > 80) {
            return res.status(400).json({ error: 'Escribe un nombre de entre 3 y 80 caracteres.' });
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 160) {
            return res.status(400).json({ error: 'Escribe un correo electrónico válido.' });
        }
        if (password.length < 8 || password.length > 72) {
            return res.status(400).json({ error: 'La contraseña debe tener entre 8 y 72 caracteres.' });
        }

        const usuarios = db.collection('usuarios');
        const existente = await usuarios.findOne({ email });
        if (existente) {
            return res.status(409).json({ error: 'Ya existe una cuenta con ese correo.' });
        }

        const passwordHash = await bcrypt.hash(password, 12);
        const result = await usuarios.insertOne({
            nombre,
            email,
            passwordHash,
            creadoEn: new Date()
        });

        createSessionCookie(res, { _id: result.insertedId, email });
        return res.status(201).json({
            mensaje: 'Cuenta creada correctamente.',
            usuario: { nombre, email }
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ error: 'Ya existe una cuenta con ese correo.' });
        }
        console.error('Error al registrar usuario:', error);
        return res.status(500).json({ error: 'No se pudo crear la cuenta.' });
    }
});

// Inicio de sesión
app.post('/api/auth/login', async (req, res) => {
    try {
        const email = String(req.body.email || '').trim().toLowerCase();
        const password = String(req.body.password || '');

        if (!email || !password) {
            return res.status(400).json({ error: 'Escribe tu correo y contraseña.' });
        }

        const usuario = await db.collection('usuarios').findOne({ email });
        if (!usuario) {
            return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
        }

        const coincide = await bcrypt.compare(password, usuario.passwordHash);
        if (!coincide) {
            return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
        }

        createSessionCookie(res, usuario);
        return res.json({
            mensaje: 'Sesión iniciada.',
            usuario: { nombre: usuario.nombre, email: usuario.email }
        });
    } catch (error) {
        console.error('Error al iniciar sesión:', error);
        return res.status(500).json({ error: 'No se pudo iniciar sesión.' });
    }
});

// Consultar sesión actual
app.get('/api/auth/me', requireAuth, async (req, res) => {
    try {
        const { ObjectId } = require('mongodb');
        const usuario = await db.collection('usuarios').findOne(
            { _id: new ObjectId(req.auth.sub) },
            { projection: { nombre: 1, email: 1 } }
        );

        if (!usuario) {
            clearSessionCookie(res);
            return res.status(401).json({ error: 'La cuenta ya no existe.' });
        }

        res.json({ autenticado: true, usuario });
    } catch (error) {
        console.error('Error al consultar sesión:', error);
        res.status(401).json({ error: 'Sesión no válida.' });
    }
});

// Cerrar sesión
app.post('/api/auth/logout', (req, res) => {
    clearSessionCookie(res);
    res.json({ mensaje: 'Sesión cerrada.' });
});

// API de productos
app.get('/api/productos', async (req, res) => {
    const cacheKey = 'techforge:productos';
    try {
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

        const productos = await db.collection('productos').find({}).toArray();

        if (redis) {
            try {
                await redis.set(cacheKey, productos, { ex: CACHE_TTL });
                console.log('Productos guardados en Redis');
            } catch (error) {
                console.error('Error al guardar productos en Redis:', error.message);
            }
        }
        res.json(productos);
    } catch (error) {
        console.error('Error al obtener los productos:', error);
        res.status(500).json({ error: 'Error al obtener los productos' });
    }
});

// API de categorías
app.get('/api/categorias', async (req, res) => {
    const cacheKey = 'techforge:categorias';
    try {
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

        const categorias = await db.collection('categorias').find({}).toArray();

        if (redis) {
            try {
                await redis.set(cacheKey, categorias, { ex: CACHE_TTL });
                console.log('Categorías guardadas en Redis');
            } catch (error) {
                console.error('Error al guardar categorías en Redis:', error.message);
            }
        }
        res.json(categorias);
    } catch (error) {
        console.error('Error al obtener las categorías:', error);
        res.status(500).json({ error: 'Error al obtener las categorías' });
    }
});

// Estado de conexiones
app.get('/api/estado', async (req, res) => {
    let mongoConectada = false;
    let redisConectado = false;

    try {
        await db.command({ ping: 1 });
        mongoConectada = true;
    } catch (error) {
        console.error('Error MongoDB:', error.message);
    }

    try {
        if (redis) {
            await redis.ping();
            redisConectado = true;
        }
    } catch (error) {
        console.error('Error Redis:', error.message);
    }

    res.json({
        servidor: 'funcionando',
        mongoDB: mongoConectada,
        redis: redisConectado,
        cacheTTL: CACHE_TTL
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

app.use((req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
});

async function iniciarServidor() {
    try {
        if (!MONGO_URI) throw new Error('No se encontró MONGO_URI');
        if (!AUTH_SECRET || AUTH_SECRET.length < 32) {
            throw new Error('Configura AUTH_JWT_SECRET con una cadena aleatoria de al menos 32 caracteres.');
        }

        client = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 15000 });
        await client.connect();

        db = client.db('techforge');
        await db.command({ ping: 1 });
        await db.collection('usuarios').createIndex({ email: 1 }, { unique: true });

        console.log('¡Conectado exitosamente a MongoDB Atlas!');

        if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
            redis = new Redis({
                url: process.env.UPSTASH_REDIS_REST_URL,
                token: process.env.UPSTASH_REDIS_REST_TOKEN
            });
            await redis.ping();
            console.log('¡Conectado exitosamente a Upstash Redis!');
        } else {
            console.warn('Redis no está configurado. El servidor continuará sin caché.');
        }

        app.listen(PORT, '0.0.0.0', () => {
            console.log(`Servidor corriendo en el puerto ${PORT}`);
        });
    } catch (error) {
        console.error('Error al iniciar el servidor:', error.message);
        if (client) await client.close().catch(() => {});
        process.exit(1);
    }
}

process.on('SIGTERM', async () => {
    console.log('Cerrando servidor...');
    if (client) await client.close().catch(() => {});
    process.exit(0);
});

iniciarServidor();
