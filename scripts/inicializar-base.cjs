// Solo instala en una base existente y vacía; nunca borra una instalación.
require('dotenv').config({quiet:true});
const mysql=require('mysql2/promise'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 let db;
 try{
  if(!process.env.DB_NAME)throw Error('Configura DB_NAME en .env y crea esa base vacía en MySQL.');
  db=await mysql.createConnection({host:process.env.DB_HOST||'localhost',port:Number(process.env.DB_PORT||3306),user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME,multipleStatements:true});
  const [tables]=await db.query('SHOW TABLES');
  if(tables.length)throw Error('La base contiene tablas. Instalación cancelada: no se reemplazaron datos.');
  for(const name of ['clinica.sql','datos-iniciales.sql'])await db.query(fs.readFileSync(path.join(__dirname,'../database',name),'utf8'));
  console.log('Estructura base y catálogos instalados. Sigue docs/INSTALACION.md: ejecuta npm run db:migrate con la cuenta de instalación y después npm start.');
 }finally{if(db)await db.end();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
