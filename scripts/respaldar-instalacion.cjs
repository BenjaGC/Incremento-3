require('dotenv').config({quiet:true});
const fs=require('fs'),path=require('path'),{spawn}=require('child_process'),archiver=require('archiver');
(async()=>{
 const target=process.env.CLINICA_BACKUP_DIR;if(!target)throw Error('Configura CLINICA_BACKUP_DIR en un volumen privado de respaldos.');
 const folder=path.resolve(target);const publicDir=path.resolve('public');const dataDir=path.resolve(process.env.CLINICA_DATA_DIR||publicDir);if(folder===publicDir||folder.startsWith(publicDir+path.sep)||folder===dataDir||folder.startsWith(dataDir+path.sep))throw Error('El destino de respaldos debe estar separado de public y de los archivos de la aplicación.');fs.mkdirSync(folder,{recursive:true});
 const stamp=new Date().toISOString().replace(/[:.]/g,'-');const sql=path.join(folder,stamp+'.sql.partial');
 const executable=process.env.MYSQLDUMP_PATH||(process.platform==='win32'?'C:/Program Files/MySQL/MySQL Server 8.4/bin/mysqldump.exe':'mysqldump');
 const output=fs.createWriteStream(sql,{flags:'wx',mode:0o600});
 const child=spawn(executable,['--host='+process.env.DB_HOST,'--port='+(process.env.DB_PORT||3306),'--user='+process.env.DB_USER,'--single-transaction','--no-tablespaces','--set-gtid-purged=OFF','--hex-blob',process.env.DB_NAME],{windowsHide:true,env:{...process.env,MYSQL_PWD:process.env.DB_PASSWORD},stdio:['ignore','pipe','ignore']});
 await Promise.all([new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',code=>code?reject(Error('mysqldump falló; no se publicó el respaldo.')):resolve());}),new Promise((resolve,reject)=>{output.on('finish',resolve);output.on('error',reject);child.stdout.pipe(output);})]);
 const dest=path.join(folder,'clinica-'+stamp+'.zip'),partial=dest+'.partial';
 await new Promise((resolve,reject)=>{const file=fs.createWriteStream(partial,{flags:'wx',mode:0o600});const zip=archiver('zip',{zlib:{level:6}});file.on('close',resolve);file.on('error',reject);zip.on('error',reject);zip.pipe(file);zip.file(sql,{name:'database.sql'});for(const name of ['uploads','manuales'])if(fs.existsSync(path.join(dataDir,name)))zip.directory(path.join(dataDir,name),name);zip.append(JSON.stringify({createdAt:new Date().toISOString(),database:process.env.DB_NAME,format:1,consistency:'Detener escrituras durante el respaldo para coherencia entre SQL y archivos.'},null,2),{name:'manifest.json'});zip.finalize();});
 fs.renameSync(partial,dest);fs.unlinkSync(sql);console.log('Respaldo creado: '+dest);
})().catch(e=>{console.error(e.message);process.exitCode=1});
