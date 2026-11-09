
const dns = require('dns');
const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');
const path = require('path');

require('dotenv').config();

if (process.env.USE_GOOGLE_DNS === 'true') {
    dns.setServers(['8.8.8.8', '8.8.4.4']);
}

const app = express();

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

// FRONTEND está fuera de BACKEND, al mismo nivel
const frontendPath = path.join(__dirname, '..', 'FRONTEND');

app.use(cors());
app.use(express.json());

// API de productos
let db;

app.get('/api/productos', async (req, res) => {
    try {
        const productos = await db.collection('productos').find({}).toArray();
        res.json(productos);
    } catch (error) {
        console.error('Error al obtener productos:', error);
        res.status(500).json({ error: 'Error al obtener los productos' });
    }
});

// API de categorías
app.get('/api/categorias', async (req, res) => {
    try {
        const categorias = await db.collection('categorias').find({}).toArray();
        res.json(categorias);
    } catch (error) {
        console.error('Error al obtener categorías:', error);
        res.status(500).json({ error: 'Error al obtener las categorías' });
    }
});

// Estado de conexión
app.get('/api/estado', async (req, res) => {
    try {
        await db.command({ ping: 1 });

        res.json({
            servidor: 'funcionando',
            baseDatos: 'MongoDB Atlas',
            baseDatosConectada: true
        });
    } catch (error) {
        res.status(500).json({
            servidor: 'funcionando',
            baseDatos: 'MongoDB Atlas',
            baseDatosConectada: false
        });
    }
});

// Publicar frontend
app.use(express.static(frontendPath));

app.get('/', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

// Ruta no encontrada
app.use((req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
});

// Iniciar conexión y servidor
async function iniciarServidor() {
    let client;

    try {
        if (!MONGO_URI) {
            throw new Error('No se encontró MONGO_URI en el archivo .env');
        }

        client = new MongoClient(MONGO_URI, {
            serverSelectionTimeoutMS: 15000
        });

        await client.connect();

        db = client.db('techforge');

        await db.command({ ping: 1 });

        console.log('¡Conectado exitosamente a MongoDB Atlas!');

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

process.on('SIGTERM', async () => {
    if (client) {
        await client.close().catch(() => {});
    }

    process.exit(0);
});

iniciarServidor();
