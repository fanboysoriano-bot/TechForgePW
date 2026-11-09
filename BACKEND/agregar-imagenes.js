
require("dotenv").config();

const mongoose = require("mongoose");
const dns = require("dns");

if (process.env.USE_GOOGLE_DNS === "true") {
    dns.setServers(["8.8.8.8", "8.8.4.4"]);
}

const imagenes = [
    ["TF-UPS-BX600-122", "https://www.cyberpuerta.mx/img/product/XS/CP-APC-BR1100M2-LM-1.jpg"],
    ["TF-CAB-DP14-123", "https://www.cyberpuerta.mx/img/product/XS/CP-ATEN-2L7D02DP-f9357c.jpg"],
    ["TF-MOD-ARGB3-124", "https://www.cyberpuerta.mx/img/product/XS/CP-DEEPCOOL-R-FL12-WHAPN3-G-0c07c1.jpg"],
    ["TF-NET-AX55-125", "https://www.cyberpuerta.mx/img/product/XS/CP-TP-LINK-ARCHERC6-1.jpg"],
    ["TF-NET-TX20E-126", "https://www.cyberpuerta.mx/img/product/XS/CP-TP-LINK-ARCHERTX20E-353b24.jpg"],
    ["TF-NET-SG108-127", "https://www.cyberpuerta.mx/img/product/XS/CP-TP-LINK-TL-SG108-1.jpg"],
    ["TF-NET-T3UP-128", "https://www.cyberpuerta.mx/img/product/XS/CP-TP-LINK-TL-WN722N-1.jpg"],
    ["TF-STR-QCASTS-129", "https://www.cyberpuerta.mx/img/product/XS/CP-HYPERX-4P5P8AA-8d04a2.jpg"],
    ["TF-STR-C920-130", "https://www.cyberpuerta.mx/img/product/XS/CP-LOGITECH-960-000764-1.png"],
    ["TF-MB-B550AOR-110", "https://www.cyberpuerta.mx/img/product/L/CP-AORUS-B550AORUSELITEV2-1.jpg"],
    ["TF-COOL-H100I-120", "https://www.cyberpuerta.mx/img/product/L/CP-CORSAIR-CW-9060065-WW2-923c0d.jpg"],
    ["TF-PSU-MWE750-121", "https://www.cyberpuerta.mx/img/product/L/CP-COOLERMASTER-MPE-7501-AFAAG-1.jpg"]
];

async function ejecutar() {
    try {
        await mongoose.connect(process.env.MONGO_URI);

        console.log("Conectado a MongoDB Atlas");

        const productos = mongoose.connection.db.collection("productos");

        for (const [sku, url] of imagenes) {
            const resultado = await productos.updateOne(
                { sku: sku },
                { $addToSet: { imagenes: url } }
            );

            if (resultado.matchedCount === 0) {
                console.log(sku + ": SKU no encontrado");
            } else if (resultado.modifiedCount === 1) {
                console.log(sku + ": Imagen agregada");
            } else {
                console.log(sku + ": Imagen ya existente");
            }
        }

        console.log("Proceso terminado correctamente.");

    } catch (error) {
        console.error("Error:", error.message);
    } finally {
        await mongoose.disconnect();
    }
}

ejecutar();
