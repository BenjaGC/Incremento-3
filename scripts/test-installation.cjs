require('dotenv').config({quiet:true});
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('node:assert/strict'),mysql=require('mysql2/promise'),{spawnSync}=require('child_process'),crypto=require('crypto');
(async()=>{
 const name='clinica_ui_test_'+Date.now(),temp=fs.mkdtempSync(path.join(os.tmpdir(),'clinica-install-'));
 const db=await mysql.createConnection({host:process.env.DB_HOST,user:process.env.DB_USER,password:process.env.DB_PASSWORD,port:Number(process.env.DB_PORT||3306),multipleStatements:true});
 const appUser='clinica_qa_'+crypto.randomBytes(6).toString('hex');
 const env={...process.env,DB_NAME:name,DB_USER:appUser,DB_PASSWORD:crypto.randomBytes(24).toString('hex'),CLINICA_ADMIN_PASSWORD:crypto.randomBytes(20).toString('hex'),CLINICA_BACKUP_DIR:path.join(temp,'backups'),CLINICA_DATA_DIR:path.join(temp,'data')};
 const run=(file,args=[],expected=0)=>{const r=spawnSync(process.execPath,['scripts/'+file,...args],{env,encoding:'utf8',windowsHide:true});assert.equal(r.status,expected,r.stderr);return r.stdout;};
 try{
  await db.query('CREATE DATABASE ??',[name]);
  await db.query("CREATE USER ?@'localhost' IDENTIFIED BY ?",[appUser,env.DB_PASSWORD]);
  await db.query("GRANT ALL PRIVILEGES ON ??.* TO ?@'localhost'",[name,appUser]);
  run('inicializar-base.cjs');run('inicializar-base.cjs',[],1);
  const migration=spawnSync(process.execPath,['scripts/migrar-base.cjs'],{env:{...env,CLINICA_MIGRATION_USER:process.env.DB_USER,CLINICA_MIGRATION_PASSWORD:process.env.DB_PASSWORD},encoding:'utf8',windowsHide:true});assert.equal(migration.status,0,migration.stderr);
  await db.changeUser({database:name});
  const application=await mysql.createConnection({host:env.DB_HOST,port:Number(env.DB_PORT||3306),user:appUser,password:env.DB_PASSWORD,database:name});
  try{await require('../src/increment3-schema')(application);}finally{await application.end();}
  run('crear-administrador.cjs',['11111111-1','Administrador QA','admin@example.test']);
  run('crear-administrador.cjs',['11111111-1','Administrador QA','admin@example.test'],1);
  const [[u]]=await db.query('SELECT password_hash,must_reset_password FROM user');assert.ok(await require('../src/passwords').verify(env.CLINICA_ADMIN_PASSWORD,u.password_hash));assert.equal(u.must_reset_password,1);
  fs.mkdirSync(path.join(env.CLINICA_DATA_DIR,'uploads'),{recursive:true});fs.writeFileSync(path.join(env.CLINICA_DATA_DIR,'uploads','probe.txt'),'archivo de prueba');
  run('respaldar-instalacion.cjs');const archive=path.join(env.CLINICA_BACKUP_DIR,fs.readdirSync(env.CLINICA_BACKUP_DIR).find(n=>n.endsWith('.zip')));
  const result=spawnSync('python',['-c','import zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); assert z.read("uploads/probe.txt")==b"archivo de prueba"; z.extract("database.sql",sys.argv[2])',archive,temp],{encoding:'utf8',windowsHide:true});assert.equal(result.status,0,result.stderr);
  await db.query('CREATE DATABASE ??',[name+'_restore']);await db.changeUser({database:name+'_restore'});await require('./import-sql.cjs')(db,fs.readFileSync(path.join(temp,'database.sql'),'utf8'));
  assert.equal((await db.query('SELECT COUNT(*) n FROM user_role WHERE role_id=1'))[0][0].n,1);
  console.log('OK instalación con cuenta dedicada, migración administrativa, arranque idempotente sin permisos globales, rechazo de reinstalación, administrador cifrado y único, respaldo de SQL/archivos y restauración.');
 }finally{
  await db.changeUser({database:'mysql'});await db.query('DROP DATABASE IF EXISTS ??',[name]);await db.query('DROP DATABASE IF EXISTS ??',[name+'_restore']);await db.query("DROP USER IF EXISTS ?@'localhost'",[appUser]);await db.end();
  if(path.dirname(temp)===os.tmpdir()&&path.basename(temp).startsWith('clinica-install-'))fs.rmSync(temp,{recursive:true,force:true});
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
