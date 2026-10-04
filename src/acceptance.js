// Funciones P-27, P-31, P-32, P-33 y P-35 sobre el stack existente.
const multer=require('multer');
const XLSX=require('xlsx');
const passwords=require('./passwords');
const crypto=require('node:crypto');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {promisify}=require('node:util');
const execFile=promisify(require('node:child_process').execFile);

module.exports=function registerAcceptance(app,{pool,validarRutModulo11,enviarCorreoOperativo}) {
 const admin=async(req,res,next)=>{
  try {
   const token=(req.headers.authorization||'').replace(/^Bearer /,'');
   if(!token)return res.status(401).json({error:'Inicia sesión para continuar.'});
   const [users]=await pool.query("SELECT DISTINCT u.user_id,u.first_name FROM user u JOIN user_role ur ON ur.user_id=u.user_id JOIN role r ON r.role_id=ur.role_id WHERE u.session_token=? AND u.user_status=1 AND ur.active=1 AND r.role_name='Admin'",[token]);
   if(!users.length)return res.status(403).json({error:'Se requiere una sesión de administrador activa.'});
   req.actor=users[0];next();
  }catch(e){next(e);}
 };
 app.post('/incidente/escalar',admin,async(req,res)=>{
  const {id_ticket,jefatura_id,motivo}=req.body;
  if(!id_ticket||!Number.isInteger(Number(jefatura_id))||!motivo?.trim())return res.status(400).json({error:'Indica ticket, jefatura y motivo.'});
  const c=await pool.getConnection();
  try {
   await c.beginTransaction();
   const [tickets]=await c.query('SELECT ticket_id,status_id FROM ticket WHERE ticket_code=? FOR UPDATE',[id_ticket]);
   if(!tickets.length||![1,2,5].includes(tickets[0].status_id)){await c.rollback();return res.status(400).json({error:'Solo se pueden escalar tickets activos.'});}
   const [boss]=await c.query("SELECT u.user_id,u.first_name,u.institutional_email FROM user u JOIN user_role ur ON ur.user_id=u.user_id JOIN role r ON r.role_id=ur.role_id WHERE u.user_id=? AND u.user_status=1 AND ur.active=1 AND r.role_name='Admin'",[jefatura_id]);
   if(!boss.length){await c.rollback();return res.status(400).json({error:'La jefatura debe ser un administrador activo.'});}
   const content=`ESCALAMIENTO A JEFATURA: ${boss[0].first_name}. Motivo: ${motivo.trim()}`;
   await c.query('INSERT INTO comment(content,user_id,ticket_id,is_private) VALUES (?,?,?,1)',[content,req.actor.user_id,tickets[0].ticket_id]);
   await c.query("INSERT INTO audit_log(action_type,affected_table,affected_record_id,new_value,user_id,ticket_id) VALUES ('ESCALAMIENTO_JEFATURA','ticket',?,?,?,?)",[tickets[0].ticket_id,JSON.stringify({jefatura_id:Number(jefatura_id),motivo:motivo.trim()}),req.actor.user_id,tickets[0].ticket_id]);
   await c.commit();
   const safe=value=>String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
   await enviarCorreoOperativo(boss[0].institutional_email,`Escalamiento a jefatura: ${id_ticket}`,`<p>${safe(content)}</p>`);
   res.json({success:true,message:'Escalamiento registrado y aviso solicitado a jefatura.'});
  }catch(e){await c.rollback();res.status(500).json({error:'No se pudo registrar el escalamiento.'});}finally{c.release();}
 });

 const csvUpload=multer({storage:multer.memoryStorage(),limits:{fileSize:2*1024*1024,files:1}}).single('archivo');
 app.post('/usuarios/importar-csv',admin,(req,res)=>csvUpload(req,res,async uploadError=>{
  if(uploadError||!req.file||!req.file.originalname.toLowerCase().endsWith('.csv'))return res.status(400).json({error:'Selecciona un CSV de hasta 2 MB.'});
  let rows;
  try {
   const workbook=XLSX.read(req.file.buffer.toString('utf8').replace(/^\uFEFF/,''),{type:'string',raw:true});
   rows=XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]],{defval:'',raw:true});
  }catch(e){return res.status(400).json({error:'No se pudo interpretar el CSV.'});}
  if(!rows.length||rows.length>1000)return res.status(400).json({error:'El CSV debe tener entre 1 y 1000 usuarios.'});
  const errors=[],ruts=new Set(),emails=new Set();
  rows=rows.map((row,index)=>{
   const user=Object.fromEntries(Object.entries(row).map(([key,value])=>[key.trim().toLowerCase(),String(value).trim()]));
   user.rut=(user.rut||'').toUpperCase();
   if(!user.nombre||user.nombre.length>50)errors.push({fila:index+2,error:'Nombre obligatorio, máximo 50 caracteres.'});
   if(!validarRutModulo11(user.rut))errors.push({fila:index+2,error:'RUT inválido (módulo 11).'});
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.correo||'')||user.correo.length>150)errors.push({fila:index+2,error:'Correo inválido.'});
   if(!user.password||user.password.length<8||Buffer.byteLength(user.password)>72)errors.push({fila:index+2,error:'Contraseña de al menos 8 caracteres y hasta 72 bytes.'});
   if(ruts.has(user.rut)||emails.has(user.correo?.toLowerCase()))errors.push({fila:index+2,error:'RUT o correo duplicado dentro del archivo.'});
   ruts.add(user.rut);emails.add(user.correo?.toLowerCase());return user;
  });
  if(errors.length)return res.status(400).json({error:'CSV rechazado. No se importó ningún usuario.',errores:errors});
  const c=await pool.getConnection();
  try {
   await c.beginTransaction();
   const [roles]=await c.query("SELECT role_id FROM role WHERE role_name='Usuario'");
   if(!roles.length)throw Error('Falta el rol Usuario.');
   for(const row of rows){
    const [insert]=await c.query("INSERT INTO user(first_name,first_last_name,second_last_name,institutional_email,rut,username,password_hash,must_reset_password) VALUES (?,'','',?,?,?,?,1)",[row.nombre,row.correo,row.rut,row.rut,await passwords.hash(row.password)]);
    await c.query('INSERT INTO user_role(assignment_date,active,role_id,user_id) VALUES (NOW(),1,?,?)',[roles[0].role_id,insert.insertId]);
   }
   await c.commit();res.json({success:true,importados:rows.length,message:`Se importaron ${rows.length} usuarios con perfil Usuario.`});
  }catch(e){await c.rollback();res.status(e.code==='ER_DUP_ENTRY'?409:500).json({error:e.code==='ER_DUP_ENTRY'?'Ya existe un RUT, usuario o correo del CSV. No se importó ninguna fila.':'No se pudo importar. No se guardaron cambios.'});}finally{c.release();}
 }));

 // Contrato provisional; no afirma compatibilidad con IMER real.
 app.post('/integraciones/imer/webhook',async(req,res)=>{
  const expected=process.env.IMER_WEBHOOK_TOKEN||'';
  const provided=(req.headers.authorization||'').replace(/^Bearer /,'');
  if(!expected)return res.status(503).json({error:'Webhook IMER no configurado.'});
  if(Buffer.byteLength(expected)!==Buffer.byteLength(provided)||!crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(provided)))return res.status(401).json({error:'Token inválido.'});
  const {evento_id,id_ticket,descripcion}=req.body;
  if(typeof evento_id!=='string'||!evento_id.trim()||evento_id.length>100||typeof descripcion!=='string'||descripcion.trim().length<10||descripcion.length>5000||typeof id_ticket!=='string')return res.status(400).json({error:'Se requieren evento_id, id_ticket existente y descripción de 10 a 5000 caracteres.'});
  const c=await pool.getConnection();
  try {
   await c.beginTransaction();
   const [tickets]=await c.query('SELECT ticket_id,category_id,requester_user_id FROM ticket WHERE ticket_code=? FOR UPDATE',[id_ticket]);
   if(!tickets.length||tickets[0].category_id!==6){await c.rollback();return res.status(404).json({error:'Debe existir un ticket de Sistema Externo para recibir el evento.'});}
   const ticket=tickets[0],marker='imer:'+evento_id;
   const [prior]=await c.query('SELECT log_id FROM external_integration_log WHERE ticket_id=? AND endpoint=?',[ticket.ticket_id,marker]);
   if(prior.length){await c.commit();return res.json({success:true,duplicado:true});}
   await c.query('INSERT INTO comment(content,user_id,ticket_id) VALUES (?,?,?)',[`FALLA INFORMADA POR IMER (${evento_id}): ${descripcion.trim()}`,ticket.requester_user_id,ticket.ticket_id]);
   await c.query('INSERT INTO external_integration_log(ticket_id,endpoint,exito) VALUES (?,?,1)',[ticket.ticket_id,marker]);
   await c.query('UPDATE ticket SET notify_creator=1 WHERE ticket_id=?',[ticket.ticket_id]);
   await c.commit();res.status(201).json({success:true,message:'Evento recibido y registrado en la actividad del ticket.'});
  }catch(e){await c.rollback();res.status(500).json({error:'No se pudo registrar el evento.'});}finally{c.release();}
 });

 app.post('/admin/respaldo',admin,async(req,res)=>{
  const dir=await fs.promises.mkdtemp(path.join(os.tmpdir(),'clinica-backup-'));
  const file=path.join(dir,'respaldo.sql');
  const q=value=>'"'+String(value).replaceAll('\\','\\\\').replaceAll('"','\\"')+'"';
  try {
   const cnf=path.join(dir,'mysql.cnf');
   await fs.promises.writeFile(cnf,'[client]\nhost='+q(process.env.DB_HOST||'localhost')+'\nport='+q(process.env.DB_PORT||3306)+'\nuser='+q(process.env.DB_USER||'root')+'\npassword='+q(process.env.DB_PASSWORD||'')+'\n',{mode:0o600});
   const executable=process.env.MYSQLDUMP_PATH||(process.platform==='win32'?'C:/Program Files/MySQL/MySQL Server 8.4/bin/mysqldump.exe':'mysqldump');
   await execFile(executable,['--defaults-extra-file='+cnf,'--single-transaction','--no-tablespaces','--set-gtid-purged=OFF','--default-character-set=utf8mb4','--result-file='+file,process.env.DB_NAME||'mydb'],{windowsHide:true,timeout:120000});
   res.download(file,`clinica-${new Date().toISOString().replace(/[:.]/g,'-')}.sql`,async error=>{await fs.promises.rm(dir,{recursive:true,force:true});if(error&&!res.headersSent)res.status(500).json({error:'No se pudo descargar el respaldo.'});});
  }catch(e){await fs.promises.rm(dir,{recursive:true,force:true});res.status(500).json({error:'No se pudo crear el respaldo. Verifica MYSQLDUMP_PATH y los permisos de MySQL.'});}
 });
};
