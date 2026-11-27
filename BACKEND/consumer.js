
require('dotenv').config();

const { Kafka } = require('kafkajs');

const brokers = (process.env.KAFKA_BROKERS || 'localhost:9092')
    .split(',')
    .map(broker => broker.trim());

const kafka = new Kafka({
    clientId: 'techforge-consumer',
    brokers
});

const consumer = kafka.consumer({
    groupId: 'techforge-pedidos'
});

async function iniciarConsumidor() {
    try {
        await consumer.connect();
        console.log('Consumidor conectado a Kafka.');

        await consumer.subscribe({
            topic: 'pedidos',
            fromBeginning: true
        });

        console.log('Esperando pedidos de TechForge...');

        await consumer.run({
            eachMessage: async ({ topic, partition, message }) => {
                try {
                    const evento = JSON.parse(message.value.toString());

                    if (evento.tipo === 'PEDIDO_CREADO') {
                        console.log('\n================================');
                        console.log('       NUEVO PEDIDO RECIBIDO');
                        console.log('================================');
                        console.log('Pedido:', evento.numero);
                        console.log('Usuario:', evento.usuarioId);
                        console.log('Total: $' + evento.total);
                        console.log('Productos:');

                        evento.items.forEach(item => {
                            console.log(
                                `- ${item.nombre} | Cantidad: ${item.cantidad}`
                            );
                        });

                        console.log('Topic:', topic);
                        console.log('Partición:', partition);
                        console.log('================================\n');
                    }
                } catch (error) {
                    console.error('Error al procesar mensaje:', error);
                }
            }
        });

    } catch (error) {
        console.error('Error del consumidor:', error);
        process.exitCode = 1;
    }
}

iniciarConsumidor();

async function cerrar() {
    console.log('\nCerrando consumidor...');
    await consumer.disconnect();
    process.exit(0);
}

process.on('SIGINT', cerrar);
process.on('SIGTERM', cerrar);

