const domain=require('./domain');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
module.exports=(api,{pool,router,admin,wrap,fail,uploadDir,transporter,validarRutModulo11,passwords})=>{
 const busy=new Set();
 const job=async(name,fn)=>{if(busy.has(name))fail('Proceso ya en ejecución.',409);busy.add(name);try{await pool.query('UPDATE inc3_jobs SET last_attempt=NOW() WHERE name=?',[name]);const Task={archive:domain.T_DepuracionBD,maintenance:domain.T_MantenimientoTablas,mail:domain.T_IngestaCorreo,directory:domain.T_SincronizacionLDAP}[name];const result=await new Task(fn).ejecutar();await pool.query("UPDATE inc3_jobs SET last_success=IF(JSON_EXTRACT(?,'$.reintento')=true,last_success,NOW()),result=? WHERE name=?",[JSON.stringify(result),JSON.stringify(result),name]);return result;}catch(e){await api.log(e,'critical',{job:name});await pool.query('UPDATE inc3_jobs SET result=? WHERE name=?',[JSON.stringify({error:'Falló el proceso; se reintentará. Los detalles están en Auditoría técnica.'}),name]).catch(()=>{});throw e;}finally{busy.delete(name);}};
 api.archive=()=>job('archive',async()=>{const c=await pool.getConnection();try{await c.beginTransaction();const [r]=await c.query('UPDATE ticket SET is_archived=1 WHERE status_id=6 AND close_date<DATE_SUB(NOW(),INTERVAL 30 DAY) AND is_archived=0');await c.commit();return {archivados:r.affectedRows};}finally{await c.rollback();c.release();}});
 api.maintenance=()=>job('maintenance',async()=>{
  const c=await pool.getConnection();let missing=0,purged=0;const skipped=[];
  try{await c.query('SET SESSION innodb_lock_wait_timeout=2');await c.query('SET SESSION lock_wait_timeout=2');const [rows]=await c.query('SELECT a.* FROM attachment a JOIN ticket t ON t.ticket_id=a.ticket_id WHERE t.is_archived=0 AND a.purged_at IS NULL');for(const a of rows){const file=path.join(uploadDir,path.basename(a.file_path));try{
   if(!fs.existsSync(file)){await c.query('UPDATE attachment SET is_deleted=1,deleted_at=COALESCE(deleted_at,NOW()),purged_at=NOW() WHERE attachment_id=?',[a.attachment_id]);missing++;}
   else if(a.is_deleted&&a.deleted_at&&Date.now()-new Date(a.deleted_at)>48*3600000){await c.beginTransaction();const [[locked]]=await c.query('SELECT * FROM attachment WHERE attachment_id=? FOR UPDATE',[a.attachment_id]);if(locked.is_deleted&&Date.now()-new Date(locked.deleted_at)>48*3600000){fs.unlinkSync(file);await c.query('UPDATE attachment SET purged_at=NOW() WHERE attachment_id=?',[a.attachment_id]);purged++;}await c.commit();}
  }catch(e){await c.rollback();skipped.push(a.attachment_id);await api.log(e,'warning',{operation:'maintenance',attachment:a.attachment_id});}}
  // ANALYZE actualiza estadísticas sin una reconstrucción bloqueante de todas las tablas.
  const [[integrity]]=await c.query('SELECT COUNT(*) orphaned FROM attachment a LEFT JOIN ticket t ON t.ticket_id=a.ticket_id LEFT JOIN user u ON u.user_id=a.upload_by_user_id WHERE t.ticket_id IS NULL OR u.user_id IS NULL');if(!skipped.length){await c.query('ANALYZE TABLE ticket, attachment, category');await c.query('OPTIMIZE TABLE attachment');}return {punteros_corregidos:missing,purgados:purged,referencias_huerfanas:integrity.orphaned,omitidos:skipped,reintento:skipped.length>0};
  }finally{await c.query('SET SESSION innodb_lock_wait_timeout=50').catch(()=>{});await c.query('SET SESSION lock_wait_timeout=31536000').catch(()=>{});c.release();}
 });
 const variables=['nombre_ticket','usuario','contenido'];
 const validate=body=>{if(typeof body!=='string'||body.length>20000||!body.trim())fail('Plantilla de 1 a 20000 caracteres.');if(/<script|<iframe|\son\w+\s*=|javascript:/i.test(body))fail('HTML activo no permitido.');const tokens=body.match(/{{.*?}}/g)||[];if(tokens.some(t=>!variables.includes(t.slice(2,-2).trim()))||/[{}]/.test(body.replace(/{{.*?}}/g,'')))fail('Variables permitidas: {{nombre_ticket}}, {{usuario}}, {{contenido}}.');};
 const escape=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 api.render=async(channel,data)=>{const [[t]]=await pool.query('SELECT body FROM inc3_templates WHERE channel=?',[channel]);return t?t.body.replace(/{{\s*(\w+)\s*}}/g,(_,key)=>key==='contenido'?data[key]||'':escape(data[key])):data.contenido;};
 router.get('/templates',admin,wrap(async(req,res)=>res.json({variables,rows:(await pool.query('SELECT * FROM inc3_templates'))[0]})));
 router.put('/templates/:channel',admin,wrap(async(req,res)=>{if(!['email','whatsapp'].includes(req.params.channel))fail('Canal inválido.');validate(req.body.body);await pool.query('INSERT INTO inc3_templates(channel,body) VALUES (?,?) ON DUPLICATE KEY UPDATE body=VALUES(body)',[req.params.channel,req.body.body]);res.json({success:true});}));
 router.post('/templates/:channel/test',admin,wrap(async(req,res)=>{
  const html=await api.render(req.params.channel,{nombre_ticket:'PRUEBA',usuario:req.actor.first_name,contenido:'Mensaje de prueba solicitado por el administrador.'});
  if(req.params.channel==='email'){if(!/^\S+@\S+\.\S+$/.test(req.body.destino||''))fail('Indica un correo de prueba válido.');await transporter.sendMail({from:process.env.MAIL_USER,to:req.body.destino,subject:'Prueba de plantilla institucional',html,clinicTemplateApplied:true});}
  else if(req.params.channel==='whatsapp'){if(!process.env.WHATSAPP_TOKEN||!process.env.WHATSAPP_PHONE_ID)fail('Configura WHATSAPP_TOKEN y WHATSAPP_PHONE_ID en el servidor.',503);if(!/^\d{8,15}$/.test(req.body.destino||''))fail('Número internacional sin símbolos.');const r=await new domain.NotificacionWhatsApp(({url,options})=>fetch(url,options)).enviar({url:`https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION||'v23.0'}/${process.env.WHATSAPP_PHONE_ID}/messages`,options:{method:'POST',headers:{Authorization:'Bearer '+process.env.WHATSAPP_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',to:req.body.destino,type:'text',text:{body:html.replace(/<[^>]*>/g,'')}}),signal:AbortSignal.timeout(15000)}});if(!r.ok)fail('WhatsApp rechazó el envío. Comprueba el número y la configuración.',502);}
  else fail('Canal inválido.');res.json({success:true,message:'Mensaje de prueba entregado al servicio de envío.'});
 }));
 api.flushReceipts=async()=>{const [pending]=await pool.query("SELECT * FROM inc3_inbox WHERE outcome='created' AND receipt_sent=0");for(const msg of pending){try{await transporter.sendMail({from:process.env.MAIL_USER,to:msg.receipt_to,subject:'Solicitud recibida: '+msg.receipt_code,html:'Hemos registrado tu solicitud con el número '+msg.receipt_code+'.'});await pool.query('UPDATE inc3_inbox SET receipt_sent=1 WHERE message_id=?',[msg.message_id]);}catch(e){await api.log(e,'error',{operation:'email-receipt'});}}};
 api.ingest=async(message)=>{
  if(!message.id||String(message.id).length>255)fail('Mensaje sin identificador válido.');const c=await pool.getConnection();let result;
  try{await c.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');await c.beginTransaction();const [seen]=await c.query('SELECT 1 FROM inc3_inbox WHERE message_id=?',[message.id]);if(seen.length){await c.rollback();return {duplicado:true};}
  const [[u]]=await c.query('SELECT * FROM user WHERE institutional_email=? AND user_status=1',[message.from]);
  if(!u){await c.query("INSERT INTO inc3_inbox(message_id,outcome) VALUES (?,'ignored')",[message.id]);await c.commit();return {ignorado:true};}
  const [[cat]]=await c.query('SELECT category_id FROM category WHERE is_active=1 ORDER BY category_id LIMIT 1');if(!cat)fail('No hay categorías activas.');
  const [eq]=await c.query("INSERT INTO equipment(equipment_name,location,equipment_type) VALUES ('Solicitud por correo',?,'Otro')",[u.operational_area||'Sin indicar']);
  const technician=await api.assign(cat.category_id,1,c);const [[p]]=await c.query('SELECT sla_hours FROM priority WHERE priority_id=1');
  const [r]=await c.query(`INSERT INTO ticket(ticket_code,title,description,ticket_origin,requester_user_id,category_id,status_id,priority_id,equipment_id,assigned_user_id,piso_ticket,habitacion_ticket,sla_deadline) VALUES (?,?,?,'email',?,?,5,1,?,?,?,?,DATE_ADD(NOW(),INTERVAL ? HOUR))`,['MAIL'+crypto.randomBytes(8).toString('hex'),String(message.subject||'Solicitud por correo').slice(0,150),String(message.text||'Sin cuerpo de mensaje').slice(0,20000),u.user_id,cat.category_id,eq.insertId,technician?.user_id||null,u.operational_floor,u.operational_area,p?.sla_hours||24]);
  // Usa el ID autoincremental: no comparte el MAX(código) del registro web concurrente.
  const code='INC'+String(r.insertId).padStart(7,'0');await c.query('UPDATE ticket SET ticket_code=? WHERE ticket_id=?',[code,r.insertId]);await c.query("INSERT INTO inc3_inbox(message_id,ticket_id,outcome,receipt_to,receipt_code) VALUES (?,?,'created',?,?)",[message.id,r.insertId,u.institutional_email,code]);await c.commit();
  result={creado:true,ticket:code};await api.flushReceipts();return result;
  }catch(e){await c.rollback();if(e.code==='ER_DUP_ENTRY')return {duplicado:true};throw e;}finally{c.release();}
 };
 api.mail=()=>job('mail',async()=>{
  await api.flushReceipts();
  if(!process.env.IMAP_HOST||!process.env.IMAP_USER||!process.env.IMAP_PASSWORD)fail('Correo entrante no configurado.',503);
  const {ImapFlow}=require('imapflow'),{simpleParser}=require('mailparser');const client=new ImapFlow({host:process.env.IMAP_HOST,port:Number(process.env.IMAP_PORT||993),secure:true,auth:{user:process.env.IMAP_USER,pass:process.env.IMAP_PASSWORD},logger:false});let lock;let count=0;
  try{await client.connect();lock=await client.getMailboxLock('INBOX');const ids=await client.search({seen:false},{uid:true});for(const uid of ids.slice(0,50)){const raw=await client.fetchOne(uid,{source:true},{uid:true});if(!raw)continue;const msg=await simpleParser(raw.source);await api.ingest({id:msg.messageId||`${process.env.IMAP_HOST}:${client.mailbox.uidValidity}:${uid}`,from:msg.from?.value[0]?.address,subject:msg.subject,text:msg.text});await client.messageFlagsAdd(uid,['\\Seen'],{uid:true});count++;}return {procesados:count};}finally{lock?.release();await client.logout().catch(()=>{});}
 });
 api.syncDirectory=async(entries,activeIds=null)=>{
  if(!Array.isArray(entries)||(!entries.length&&!activeIds?.length))fail('Directorio vacío: se conserva la información local.');
  const normalized=entries.map(u=>({id:String(u.id||''),rut:String(u.rut||'').replaceAll('.','').toUpperCase(),nombre:String(u.nombre||''),correo:String(u.correo||''),area:String(u.area||''),cargo:String(u.cargo||'')}));
  if(normalized.some(u=>!u.id||u.id.length>255||!validarRutModulo11(u.rut)||!u.nombre||u.nombre.length>50||!/^\S+@\S+\.\S+$/.test(u.correo)||u.correo.length>150||u.area.length>100||u.cargo.length>100)||new Set(normalized.map(u=>u.id)).size!==normalized.length)fail('Directorio inválido: se conserva la información local.');
  if(activeIds&&(!Array.isArray(activeIds)||!activeIds.length||activeIds.some(id=>typeof id!=='string'||!id)||new Set(activeIds).size!==activeIds.length))fail('Lista de identidades incompleta; se conserva la información local.');
  const c=await pool.getConnection();try{await c.beginTransaction();let created=0,updated=0;const ids=activeIds?[...activeIds]:[];for(const u of normalized){ids.push(u.id);const [[existing]]=await c.query('SELECT user_id,directory_id FROM user WHERE rut=? FOR UPDATE',[u.rut]);if(existing&&existing.directory_id!==u.id)fail('Conflicto con identidad local; vinculación manual requerida antes de sincronizar.',409);if(existing){await c.query('UPDATE user SET first_name=?,institutional_email=?,operational_area=?,job_title=?,user_status=1 WHERE user_id=?',[u.nombre,u.correo,u.area,u.cargo,existing.user_id]);updated++;}else{const [r]=await c.query("INSERT INTO user(first_name,first_last_name,second_last_name,rut,username,institutional_email,password_hash,directory_id,operational_area,job_title,must_reset_password) VALUES (?,'','',?,?,?,?,?,?,?,1)",[u.nombre,u.rut,u.rut,u.correo,await passwords.hash(crypto.randomBytes(24).toString('hex')),u.id,u.area,u.cargo]);await c.query('INSERT INTO user_role(assignment_date,active,role_id,user_id) VALUES(NOW(),1,2,?)',[r.insertId]);created++;}}
  const [departed]=await c.query('SELECT user_id FROM user WHERE directory_id IS NOT NULL AND directory_id NOT IN (?) AND user_status=1 FOR UPDATE',[ids]);
  let reassigned=0;
  if(departed.length){
   const departedIds=departed.map(u=>u.user_id);
   const [tickets]=await c.query('SELECT ticket_id,assigned_user_id FROM ticket WHERE is_archived=0 AND status_id IN(1,2,5) AND (assigned_user_id IN (?) OR requester_user_id IN (?)) FOR UPDATE',[departedIds,departedIds]);
   if(tickets.length){const [[head]]=await c.query('SELECT u.user_id FROM user u WHERE u.user_status=1 AND u.user_id NOT IN (?) AND EXISTS(SELECT 1 FROM user_role r WHERE r.user_id=u.user_id AND r.role_id=1 AND r.active=1) ORDER BY u.user_id LIMIT 1',[departedIds]);if(!head)fail('No hay jefatura activa para recibir los tickets. No se aplicaron cambios al directorio.',409);
    for(const t of tickets){await c.query('UPDATE ticket SET assigned_user_id=?,notify_creator=1 WHERE ticket_id=?',[head.user_id,t.ticket_id]);await c.query('INSERT INTO comment(content,user_id,ticket_id) VALUES (?,NULL,?)',['Ticket reasignado a jefatura por baja de una cuenta del directorio institucional.',t.ticket_id]);await c.query("INSERT INTO audit_log(action_type,affected_table,affected_record_id,previous_value,new_value,ticket_id,user_id) VALUES ('REASIGNACION','ticket',?,?,?,?,?)",[t.ticket_id,String(t.assigned_user_id||''),JSON.stringify({responsable:head.user_id,motivo:'Baja de directorio',automatico:true}),t.ticket_id,head.user_id]);reassigned++;}
   }
  }
  const [r]=await c.query('UPDATE user SET user_status=0,session_token=NULL WHERE directory_id IS NOT NULL AND directory_id NOT IN (?)',[ids]);await c.commit();return {creados:created,actualizados:updated,deshabilitados:r.affectedRows,reasignados:reassigned};}finally{await c.rollback();c.release();}
 };
 api.directory=()=>job('directory',async()=>{
  if(!process.env.LDAP_URL||!process.env.LDAP_BIND_DN||!process.env.LDAP_PASSWORD||!process.env.LDAP_BASE_DN)fail('Directorio LDAP/AD no configurado.',503);
  if(!process.env.LDAP_URL.startsWith('ldaps://'))fail('Usa LDAPS para proteger las credenciales.');
  const {Client}=require('ldapts');const client=new Client({url:process.env.LDAP_URL,timeout:15000,connectTimeout:10000});
  try{
   await client.bind(process.env.LDAP_BIND_DN,process.env.LDAP_PASSWORD);
   const baseFilter=process.env.LDAP_FILTER||'(&(objectClass=person)(mail=*))';
   const changeAttr=process.env.LDAP_CHANGE_ATTRIBUTE||'whenChanged';if(!/^[a-zA-Z][a-zA-Z0-9-]*$/.test(changeAttr))fail('Atributo de cambios LDAP inválido.');
   const [[checkpoint]]=await pool.query('SELECT synced_at FROM inc3_directory_checkpoint WHERE id=1');const start=new Date();
   const all=await client.search(process.env.LDAP_BASE_DN,{scope:'sub',filter:baseFilter,paged:true,attributes:['dn','userAccountControl']});
   if(all.searchReferences?.length||!all.searchEntries.length)fail('LDAP devolvió un listado vacío o incompleto; se conservan las cuentas locales.');
   const activeIds=all.searchEntries.filter(u=>!(Number(u.userAccountControl||0)&2)).map(u=>u.dn);
   if(!activeIds.length)fail('Directorio sin cuentas activas: revisión administrativa requerida.');
   const stamp=checkpoint?.synced_at?new Date(new Date(checkpoint.synced_at).getTime()-1000).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'.0Z'):null;
   const changes=await client.search(process.env.LDAP_BASE_DN,{scope:'sub',filter:stamp?'(&'+baseFilter+'('+changeAttr+'>='+stamp+'))':baseFilter,paged:true,attributes:['dn','employeeNumber','displayName','mail','department','title','userAccountControl']});
   if(changes.searchReferences?.length)fail('LDAP devolvió cambios incompletos; se conserva la información local.');
   const result=await api.syncDirectory(changes.searchEntries.filter(u=>activeIds.includes(u.dn)).map(u=>({id:u.dn,rut:u.employeeNumber,nombre:u.displayName,correo:u.mail,area:u.department,cargo:u.title})),activeIds);
   await pool.query('INSERT INTO inc3_directory_checkpoint(id,synced_at) VALUES(1,?) ON DUPLICATE KEY UPDATE synced_at=VALUES(synced_at)',[start]);
   return {...result,modo:stamp?'incremental':'inicial',verificacion_bajas:'listado completo de identidades'};
  }finally{await client.unbind().catch(()=>{});}

 });
 router.get('/integrations',admin,(req,res)=>res.json({imap:!!(process.env.IMAP_HOST&&process.env.IMAP_USER&&process.env.IMAP_PASSWORD),ldap:!!(process.env.LDAP_URL&&process.env.LDAP_BIND_DN&&process.env.LDAP_PASSWORD&&process.env.LDAP_BASE_DN),whatsapp:!!(process.env.WHATSAPP_TOKEN&&process.env.WHATSAPP_PHONE_ID)}));
 for(const name of ['archive','maintenance','mail','directory'])router.post('/jobs/'+name,admin,wrap(async(req,res)=>res.json(await api[name]())));
 // Los temporizadores de negocio se ejecutan dentro del servidor, no son automatizaciones de Codex.
 api.startJobs=()=>{const tick=async()=>{try{await api.ready;const now=new Date();const local=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Santiago',dateStyle:'short',timeStyle:'short'}).format(now);const hour=Number(local.slice(11,13));const [jobs]=await pool.query('SELECT * FROM inc3_jobs');for(const j of jobs){const elapsed=j.last_success?now-new Date(j.last_success):Infinity;const attempt=j.last_attempt?now-new Date(j.last_attempt):Infinity;if(attempt<60000||busy.has(j.name))continue;let due=j.name==='archive'?hour===2&&elapsed>20*3600000:j.name==='maintenance'?hour===3&&elapsed>7*86400000:j.name==='directory'?hour===4&&elapsed>20*3600000:elapsed>=60000;if(j.name==='mail'&&!process.env.IMAP_HOST||j.name==='directory'&&!process.env.LDAP_URL)due=false;if(due)api[j.name]().catch(()=>{});}}catch(e){await api.log(e,'critical',{operation:'scheduler'});}};const timer=setInterval(tick,60000);timer.unref();};
};
