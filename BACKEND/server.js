
const dns = require('dns');
const express = require('express');
const { MongoClient } = require('mongodb');
const { Redis } = require('@upstash/redis');
const cloudinary = require('cloudinary').v2;
const cors = require('cors');
const path = require('path');

require('dotenv').config();
cloudinary.config({
    secure: true
});

if (process.env.USE_GOOGLE_DNS === 'true') {
    dns.setServers(['8.8.8.8', '8.8.4.4']);
}

const app = express();

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

const frontendPath = path.join(__dirname, '..', 'FRONTEND');

app.use(cors());
app.use(express.json());

// Conexiones
let db;
let client;
let redis;

// Tiempo de caché: 5 minutos
const CACHE_TTL = 300;

app.use(express.static(frontendPath));

// API de productos
app.get('/api/productos', async (req, res) => {
    const cacheKey = 'techforge:productos';

    try {
        // 1. Consultar Redis
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

        // 2. Consultar MongoDB si no hay caché
        const productos = await db.collection('productos')
            .find({})
            .toArray();

        // 3. Guardar resultados en Redis
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

        res.json(productos);

    } catch (error) {
        console.error('Error al obtener productos:', error);
        res.status(500).json({
            error: 'Error al obtener los productos'
        });
    }
});

// API de categorías
app.get('/api/categorias', async (req, res) => {
    const cacheKey = 'techforge:categorias';

    try {
        // 1. Consultar Redis
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

        // 2. Consultar MongoDB
        const categorias = await db.collection('categorias')
            .find({})
            .toArray();

        // 3. Guardar en Redis
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

        res.json(categorias);

    } catch (error) {
        console.error('Error al obtener categorías:', error);
        res.status(500).json({
            error: 'Error al obtener las categorías'
        });
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

// Ruta principal
app.get('/', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

// Ruta no encontrada
app.use((req, res) => {
    res.status(404).json({
        error: 'Ruta no encontrada'
    });
});

// Iniciar servidor
async function iniciarServidor() {
    try {
        if (!MONGO_URI) {
            throw new Error('No se encontró MONGO_URI');
        }

        client = new MongoClient(MONGO_URI, {
            serverSelectionTimeoutMS: 15000
        });

        await client.connect();

        db = client.db('techforge');
        await db.command({ ping: 1 });

        console.log('¡Conectado exitosamente a MongoDB Atlas!');

        // Conectar Redis si existen las variables
        if (
            process.env.UPSTASH_REDIS_REST_URL &&
            process.env.UPSTASH_REDIS_REST_TOKEN
        ) {
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

        if (client) {
            await client.close().catch(() => {});
        }

        process.exit(1);
    }
}

// Cierre correcto
process.on('SIGTERM', async () => {
    console.log('Cerrando servidor...');

    if (client) {
        await client.close().catch(() => {});
    }

    process.exit(0);
});

iniciarServidor();
