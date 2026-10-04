// Punto de entrada: carga la configuración privada antes del servidor.
require('dotenv').config({ path: require('path').join(__dirname, '.env'), quiet: true });
require('./src/production-config')();
require('./src/server');
