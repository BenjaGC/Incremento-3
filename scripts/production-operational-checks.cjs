const assert=require('node:assert/strict');

// Extensión de los runners aislados. Nunca admite la base real de la clínica.
module.exports=async({db,password,base='http://127.0.0.1:3200',restartServer})=>{
 const [[database]]=await db.query('SELECT DATABASE() name');
 assert.match(database.name,/^clinica_ui_test_\d+$/,'Las pruebas operativas requieren una base aislada.');
 const checks=[];
 const record=message=>{checks.push(message);console.log('OK:',message);};
 const request=async(url,token,body,method=body?'POST':'GET',status=200)=>{
  const r=await fetch(base+url,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  const text=await r.text();assert.equal(r.status,status,url+' '+text);return text?JSON.parse(text):null;
 };
 const login=async rut=>(await request('/login',null,{rut,password})).token;
 const admin=await login('11111111-1');
 const hash=await require('../src/passwords').hash(password);
 const [tech]=await db.query("INSERT INTO user(first_name,first_last_name,second_last_name,rut,username,institutional_email,password_hash,tipo_usuario) VALUES ('Soporte QA','','','44444444-4','44444444-4','operational-tech@temp.com',?,'TECNICO')",[hash]);
 await db.query('INSERT INTO user_role(assignment_date,active,role_id,user_id) VALUES(NOW(),1,2,?)',[tech.insertId]);
 const [other]=await db.query("INSERT INTO user(first_name,first_last_name,second_last_name,rut,username,institutional_email,password_hash,tipo_usuario) VALUES ('Segundo técnico QA','','','55555555-5','55555555-5','operational-other@temp.com',?,'TECNICO')",[hash]);
 await db.query('INSERT INTO user_role(assignment_date,active,role_id,user_id) VALUES(NOW(),1,2,?)',[other.insertId]);
 // El hook reinicia el proceso completo; sin hook se repite exactamente la migración
 // de identidad que ejecuta el servidor al arrancar.
 if(restartServer)await restartServer();else await require('../src/identity-schema')(db);
 const [[identity]]=await db.query('SELECT u.tipo_usuario,t.nivel FROM user u JOIN tecnico t ON t.user_id=u.user_id WHERE u.user_id=?',[tech.insertId]);
 assert.equal(identity.tipo_usuario,'TECNICO');assert.equal(identity.nivel,'BASICO');
 const technician=await login('44444444-4');
 const otherTechnician=await login('55555555-5');
 const criticalBefore=(await db.query('SELECT user_id FROM user WHERE is_critical_tech=1'))[0];
 await request('/tecnicos/99999999/critico',admin,{critico:true},'PUT',404);
 assert.deepEqual((await db.query('SELECT user_id FROM user WHERE is_critical_tech=1'))[0],criticalBefore);
 const technicians=await request('/tecnicos',admin);assert.ok(technicians.some(t=>t.user_id===tech.insertId));
 await db.query('UPDATE user SET user_status=0 WHERE user_id=?',[other.insertId]);
 assert.ok(!(await request('/tecnicos',admin)).some(t=>t.user_id===other.insertId));
 await db.query('UPDATE user SET user_status=1 WHERE user_id=?',[other.insertId]);
 record('Técnicos básicos conservan identidad después del arranque y el catálogo excluye cuentas deshabilitadas');
 const [equipment]=await db.query("INSERT INTO equipment(equipment_name,equipment_type,location) VALUES ('Equipo operativo QA','Otro','Recepción QA')");
 const [ticket]=await db.query("INSERT INTO ticket(ticket_code,title,description,requester_user_id,category_id,status_id,priority_id,equipment_id,assigned_user_id,piso_ticket,habitacion_ticket,sla_deadline) VALUES ('INC9900001','Operación técnica QA','Incidente para validar técnico básico',2,1,5,1,?,?,'Piso 1','Recepción QA',DATE_ADD(NOW(),INTERVAL 24 HOUR))",[equipment.insertId,tech.insertId]);
 const code='INC9900001';
 await request('/incidente/nota-privada',otherTechnician,{id_ticket:code,nota:'Intento fuera de mi asignación'},'POST',403);
 await request('/incidente/resolver',otherTechnician,{id_ticket:code,info_resolucion:'Intento fuera de mi asignación'},'POST',403);
 await request('/incidente/reasignar',technician,{id_ticket:code,nuevo_tecnico_id:other.insertId,motivo:'Intento sin jefatura'},'POST',403);
 await request('/incidente/reasignar',admin,{id_ticket:code,nuevo_tecnico_id:other.insertId,motivo:'Reasignación manual a técnico básico'});
 assert.equal((await db.query('SELECT assigned_user_id FROM ticket WHERE ticket_id=?',[ticket.insertId]))[0][0].assigned_user_id,other.insertId);
 await request('/incidente/reasignar',admin,{id_ticket:code,nuevo_tecnico_id:tech.insertId,motivo:'Retornar técnico para comprobar acciones'});
 await request('/incidente/ver',technician,{id_ticket:code});
 await request('/incidente/nota-privada',technician,{id_ticket:code,nota:'Nota privada del técnico básico homónimo'});
 await request('/incidente/ajustar-prioridad',technician,{id_ticket:code,priority_id:1,justificacion:'Confirmación de prioridad por técnico básico'});
 const [material]=await db.query("INSERT INTO insumo_catalogo(nombre,costo_unitario_referencia,stock_actual,stock_minimo) VALUES ('Insumo operativo QA',100,10,2)");
 await request('/incidente/materiales',technician,{id_ticket:code,material_id:material.insertId,cantidad:1,costo_unitario:100});
 const [comments]=await db.query("SELECT user_id FROM comment WHERE ticket_id=? AND (is_private=1 OR content LIKE '%PRIORIDAD AJUSTADA%' OR content LIKE '%MATERIAL IMPUTADO%')",[ticket.insertId]);
 assert.ok(comments.length>=3);assert.ok(comments.every(c=>c.user_id===tech.insertId));
 assert.equal((await db.query('SELECT user_id FROM priority_change_log WHERE ticket_id=?',[ticket.insertId]))[0][0].user_id,tech.insertId);
 assert.equal((await db.query('SELECT user_id FROM ticket_material WHERE ticket_id=?',[ticket.insertId]))[0][0].user_id,tech.insertId);
 const history=await request('/incidentes/buscar?q='+code,technician);assert.equal(history[0].requester_user_id,2);assert.equal(history[0].assigned_user_id,tech.insertId);
 assert.ok(JSON.parse(history[0].comentarios).some(c=>c.privado===1));
 await request('/config-public',technician);
 const requester=await login('22222222-2');await request('/config-public',requester);
 record('Nota privada, prioridad, materiales y auditoría usan el técnico autenticado incluso con nombre repetido');
 await db.query('UPDATE ticket SET creation_date=DATE_SUB(NOW(),INTERVAL 6 HOUR),sla_deadline=DATE_ADD(NOW(),INTERVAL 18 HOUR),sla_paused_seconds=0 WHERE ticket_id=?',[ticket.insertId]);
 await request('/incidente/espera',technician,{id_ticket:code,info_espera:'Espera de proveedor para validar temporizador'});
 await db.query('UPDATE ticket SET pausa_inicio=DATE_SUB(NOW(),INTERVAL 2 HOUR) WHERE ticket_id=?',[ticket.insertId]);
 const riskBefore=(await request('/tickets/riesgo-sla',admin)).find(t=>t.id_ticket===code).pctConsumido;
 await request('/incidente/continuar',technician,{id_ticket:code});
 const riskAfter=(await request('/tickets/riesgo-sla',admin)).find(t=>t.id_ticket===code).pctConsumido;
 assert.ok(Math.abs(riskBefore-riskAfter)<=1);assert.ok((await db.query('SELECT sla_paused_seconds FROM ticket WHERE ticket_id=?',[ticket.insertId]))[0][0].sla_paused_seconds>=7200);
 record('Pausa y continuación conservan el porcentaje SLA sin consumir tiempo de proveedor');
 // Un SLA prorrogado por una pausa permite resolver después de las horas base.
 // El cierre manual conserva el ticket en las métricas y en su exportación.
 await db.query('UPDATE ticket SET creation_date=DATE_SUB(NOW(),INTERVAL 30 HOUR),sla_deadline=DATE_ADD(NOW(),INTERVAL 2 HOUR) WHERE ticket_id=?',[ticket.insertId]);
 await request('/incidente/resolver',technician,{id_ticket:code,info_resolucion:'Solución validada dentro del SLA prorrogado por pausa'});
 const kpiBefore=await request('/reportes/kpi',admin);
 await request('/incidente/cerrar',admin,{id_ticket:code});
 const kpiAfter=await request('/reportes/kpi',admin);assert.equal(kpiAfter.totalTickets,kpiBefore.totalTickets);assert.equal(kpiAfter.cumplimientoSlaPct,kpiBefore.cumplimientoSlaPct);
 const [[resolved]]=await db.query('SELECT (resolution_date<=sla_deadline) cumple FROM ticket WHERE ticket_id=?',[ticket.insertId]);assert.equal(resolved.cumple,1);
 const r=await fetch(base+'/reportes/exportar',{method:'POST',headers:{Authorization:'Bearer '+admin,'Content-Type':'application/json'},body:JSON.stringify({formato:'csv'})});assert.equal(r.status,200);
 const csv=await r.text();const line=csv.split('\n').find(s=>s.includes(code));assert.ok(line);assert.match(line,/"Sí"/);
 const performance=await request('/reportes/desempeno-tecnico?user_id='+tech.insertId,admin);assert.equal(performance.totalResueltos,1);
 record('Tickets cerrados permanecen en KPIs, desempeño y exportación; cumplimiento respeta el SLA prorrogado');
 return checks;
};
