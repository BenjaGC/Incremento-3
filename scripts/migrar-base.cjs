// Ejecutar con una cuenta autorizada para crear los triggers del esquema.
// Las credenciales temporales de migración no cambian la cuenta de ejecución.
require('dotenv').config({quiet:true});
const mysql=require('mysql2/promise');
(async()=>{let db;try{
 db=await mysql.createConnection({host:process.env.DB_HOST||'localhost',port:Number(process.env.DB_PORT||3306),user:process.env.CLINICA_MIGRATION_USER||process.env.DB_USER,password:process.env.CLINICA_MIGRATION_PASSWORD||process.env.DB_PASSWORD,database:process.env.DB_NAME});
 await require('../src/increment3-schema')(db);
 console.log('Ampliaciones y disparadores preparados. El servidor puede usar su cuenta MySQL dedicada.');
}finally{if(db)await db.end();}})().catch(e=>{console.error('No se pudo completar la migración: '+e.message);process.exitCode=1;});
