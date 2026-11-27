require('dotenv').config();

const { MongoClient } = require('mongodb');

async function actualizarPedidos() {
    const client = new MongoClient(process.env.MONGO_URI);

    try {
        await client.connect();

        const db = client.db('techforge');
        const pedidos = db.collection('pedidos');

        const resultado = await pedidos.updateMany(
            {
                $or: [
                    { estadoPedido: { $exists: false } },
                    { estadoPedido: null }
                ]
            },
            {
                $set: { estadoPedido: 'Pendiente' }
            }
        );

        console.log('Pedidos actualizados:', resultado.modifiedCount);

        const todos = await pedidos.find(
            {},
            {
                projection: {
                    numero: 1,
                    estado: 1,
                    estadoPedido: 1
                }
            }
        ).toArray();

        console.table(todos);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await client.close();
    }
}

actualizarPedidos();
