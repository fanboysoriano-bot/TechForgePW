require('dotenv').config();

const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const cloudinary = require('cloudinary').v2;
const { MongoClient } = require('mongodb');

cloudinary.config({ secure: true });

const productos = [
    {
        sku: 'TF-CPU-5700X3D-002',
        url: 'https://nexocomputo.com.mx/wp-content/uploads/2025/04/CP-AMD-100-100000926WOF-a0931f-2.jpg'
    },
    {
        sku: 'TF-PER-K500PRO-003',
        url: 'https://global.machenike.com/cdn/shop/files/14-K500Pro-B94-1000-2_7781ff42-1b7e-4e51-8a39-1e4205545e8f.jpg?v=1725260367'
    },
    {
        sku: 'TF-SSD-990PRO-004',
        url: 'https://images.samsung.com/is/image/samsung/p6pim/es/mz-v9p2t0bw/gallery/es-990pro-nvme-m2-ssd-mz-v9p2t0bw-534283414?$624_468_PNG$'
    },
    {
        sku: 'TF-MON-24G2SP-005',
        url: 'https://cdn.sanity.io/images/hf5b3axp/production/b45f4682910f387c5128b64314e250cc3f426c5d-3840x3840.png?w=1920&fit=max&auto=format'
    },
    {
        sku: 'TF-ACC-AIO240-006',
        url: 'https://ddtech.mx/assets/uploads/bb391c62329ecf8bba0a130d2f61ffad.png'
    },
    {
        sku: 'TF-CPU-12400F-101',
        url: 'https://acf.geeknetic.es/Imagenes/Tutoriales/2021/2388-intel-core-i5-12400f/2388-intel-core-i5-12400f-cabecera-2.jpg'
    },
    {
        sku: 'TF-CPU-R5-7600-102',
        url: 'https://tpucdn.com/cpu-specs/images/chips/2959-front.jpg'
    },
    {
        sku: 'TF-GPU-RX7600-103',
        url: 'https://http2.mlstatic.com/D_NQ_NP_2X_613751-MLA74794294782_032024-O.webp'
    },
    {
        sku: 'TF-GPU-RTX4060-104',
        url: 'https://storage-asset.msi.com/global/picture/product/product_1689728822eb7add0b7cae993b88ba3c45dcd2c94a.webp'
    },
    {
        sku: 'TF-SSD-SN850X-105',
        url: 'https://www.sandisk.com/content/dam/sandisk/en-us/assets/products/internal-storage/wd-black-sn850x-nvme-ssd/gallery/wd-black-sn850x-nvme-ssd-front.png'
    },
    {
        sku: 'TF-SSD-NV2-106',
        url: 'https://http2.mlstatic.com/D_NQ_NP_830812-MLA81675892518_012025-O.webp'
    },
    {
        sku: 'TF-RAM-VENG32-107',
        url: 'https://assets.corsair.com/image/upload/c_pad,q_auto,h_1024,w_1024,f_auto/products/Memory/vengeance-ddr5-blk-config/Gallery/Vengeance-DDR5-2UP-16GB-BLACK_01.webp'
    },
    {
        sku: 'TF-RAM-FURY16-108',
        url: 'https://ddtech.mx/assets/uploads/0f57b4f7a6574bc6a13b2e50a93033f0.png'
    },
    {
        sku: 'TF-MB-B650TOM-109',
        url: 'https://storage-asset.msi.com/global/picture/image/feature/mb/B650/MAG-B650-TOMAHAWK-WIFI/mag-b650-tomahawk-wifi.png'
    },
    {
        sku: 'TF-MB-B550AOR-110',
        url: 'https://www.gigabyte.com/FileUpload/Global/KeyFeature/1601/innergigabyteimages/spec-small.jpg'
    },
    {
        sku: 'TF-PER-K552-111',
        url: 'https://ddtech.mx/assets/uploads/6b700266c3f763d72e048d46fceb211c.jpg'
    },
    {
        sku: 'TF-MSE-G502H-112',
        url: 'https://www.logitechg.com/content/dam/gaming/en/non-braid/hyjal-g502-hero/2025/g502-hero-mouse-top-angle-gallery-1.png'
    },
    {
        sku: 'TF-MSE-DAEES-113',
        url: 'https://assets2.razerzone.com/images/pnx.assets/731278d7b19075077479476c93e9229c/razer-deathadder-essential-gaming-usp01-mobile-v2.jpg'
    },
    {
        sku: 'TF-MON-27GP850-114',
        url: 'https://www.lg.com/cac/images/monitores/md07539241/features/mnt-27gp850-01-1-lg-ultragear-m.jpg'
    },
    {
        sku: 'TF-MON-ODYG5-115',
        url: 'https://images.samsung.com/is/image/samsung/p6pim/mx/ls27cg552elxzx/gallery/mx-odyssey-g5-g55c-ls27cg552elxzx-547958001?$1164_776_PNG$'
    },
    {
        sku: 'TF-MON-24G2-116',
        url: 'https://i5-mx.walmartimages.com/asr/60ad7258-c1ea-451a-8d84-3a0b90b98947.345e977585c690ff127d2a220e0e304f.jpeg?odnHeight=612&odnWidth=612&odnBg=FFFFFF'
    },
    {
        sku: 'TF-AUD-CLOUD2-117',
        url: 'https://hyperx.com/cdn/shop/files/hyperx_cloud_ii_core_wireless_main_1.jpg?v=1763563251'
    },
    {
        sku: 'TF-AUD-G435-118',
        url: 'https://resource.logitechg.com/c_fill,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/gaming/en/products/g435/2025/gallery/g435-3qtr-front-left-angle-black-gallery-1.png'
    },
    {
        sku: 'TF-COOL-H212BK-119',
        url: 'https://a.storyblok.com/f/281110/1500x1500/ebdd2ef6b1/hyper-212-black-01-gallery-05.png/m/960x0/smart'
    }
];

async function ejecutarCarga() {
    if (!process.env.MONGO_URI || !process.env.CLOUDINARY_URL) {
        throw new Error('Faltan MONGO_URI o CLOUDINARY_URL en el archivo .env');
    }

    const cliente = new MongoClient(process.env.MONGO_URI);
    const imagenesSubidas = [];

    try {
        await cliente.connect();

        const db = cliente.db('techforge');
        const coleccion = db.collection('productos');

        console.log('Conectado a MongoDB.');
        console.log('Iniciando carga de 24 imágenes...\n');

        for (const producto of productos) {
            try {
                const resultado = await cloudinary.uploader.upload(
                    producto.url,
                    {
                        folder: 'techforge/productos',
                        public_id: producto.sku,
                        overwrite: true,
                        resource_type: 'image'
                    }
                );

                imagenesSubidas.push({
                    sku: producto.sku,
                    url: resultado.secure_url
                });

                console.log(`Subida correcta: ${producto.sku}`);
            } catch (error) {
                console.error(`Error al subir ${producto.sku}:`, error.message);
            }
        }

        console.log(`\nImágenes subidas: ${imagenesSubidas.length}/24`);

        if (imagenesSubidas.length === 0) {
            throw new Error('No se pudo subir ninguna imagen. No se modificó MongoDB.');
        }

        const operaciones = imagenesSubidas.map(imagen => ({
            updateOne: {
                filter: { sku: imagen.sku },
                update: {
                    $addToSet: { imagenes: imagen.url }
                },
                upsert: false
            }
        }));

        const actualizacion = await coleccion.bulkWrite(operaciones);

        console.log('\nActualización de MongoDB terminada.');
        console.log('Documentos modificados:', actualizacion.modifiedCount);
        console.log('Productos encontrados:', actualizacion.matchedCount);
        console.log('El producto TF-GPU-4070S-001 fue excluido.');

    } finally {
        await cliente.close();
    }
}

ejecutarCarga().catch(error => {
    console.error('Error general:', error.message);
    process.exitCode = 1;
});
