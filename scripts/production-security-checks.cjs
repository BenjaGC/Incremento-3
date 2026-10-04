const assert=require('assert/strict'),fs=require('fs'),path=require('path');
module.exports=async({db,page,password,temp})=>{
 const base='http://127.0.0.1:3200';
 const call=async(url,token,data,method=data?'POST':'GET')=>fetch(base+url,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});
 const login=async rut=>{const r=await call('/login',null,{rut,password});assert.equal(r.status,200);return (await r.json()).token;};
 const admin=await login('11111111-1'),user=await login('22222222-2');
 for(const url of ['/incidentes','/incidentes/cerrados?esAdmin=si','/estadisticas','/reportes/kpi','/manuales','/uploads/private.txt'])assert.equal((await call(url)).status,401,url);
 for(const url of ['/estadisticas','/reportes/kpi','/configuracion-externa'])assert.equal((await call(url,user)).status,403,url);
 let r=await call('/incidentes?usuario=Soporte%20QA&esAdmin=si',user);assert.equal(r.status,200);assert.deepEqual(await r.json(),[]);
 r=await call('/incidentes/cerrados?usuario=Soporte%20QA&esAdmin=si',user);assert.deepEqual(await r.json(),[]);
 const payload={piso:'Piso 1',habitacion:'Recepción',aparato:'Computador/Hardware',category_id:1,priority_id:1,descripcion:'Prueba de acceso y comentario protegido',nombreActivo:'Equipo de prueba',creador:'Soporte QA'};
 r=await call('/incidente',user,payload);assert.equal(r.status,200,await r.text());
 const [[t]]=await db.query('SELECT * FROM ticket ORDER BY ticket_id DESC LIMIT 1');assert.equal(t.requester_user_id,2);
 fs.writeFileSync(path.join(temp,'uploads','private.txt'),'private');
 await db.query("INSERT INTO attachment(file_name,file_path,mime_type,upload_by_user_id,ticket_id) VALUES('private.txt','/uploads/private.txt','text/plain',1,?)",[t.ticket_id]);
 assert.equal((await call('/uploads/private.txt',user)).status,200);
 await db.query('UPDATE ticket SET requester_user_id=1,assigned_user_id=1 WHERE ticket_id=?',[t.ticket_id]);
 assert.equal((await call('/uploads/private.txt',user)).status,404);
 assert.equal((await call('/incidente/'+t.ticket_code+'/adjuntos-zip',user)).status,403);
 assert.equal((await call('/incidente/reasignar',user,{id_ticket:t.ticket_code,nuevo_tecnico_id:2,motivo:'Intento no autorizado'})).status,403);
 await db.query('UPDATE ticket SET requester_user_id=2 WHERE ticket_id=?',[t.ticket_id]);
 await db.query("INSERT INTO comment(content,user_id,ticket_id) VALUES('<img src=x onerror=alert(1)><script>alert(2)</script><b>Nota</b>',2,?)",[t.ticket_id]);
 r=await call('/incidentes',user);const listing=await r.text();assert.ok(!listing.includes('onerror'));assert.ok(!listing.includes('<script>'));
 await db.query('UPDATE user SET last_login=DATE_SUB(NOW(),INTERVAL 9 HOUR) WHERE user_id=2');assert.equal((await call('/incidentes',user)).status,401);
 await db.query("UPDATE user SET institutional_email='recovery@example.test' WHERE user_id=2");
 const recover=async()=>{const r=await call('/recuperar-solicitar',null,{rut:'22222222-2'});assert.equal(r.status,200);const mails=fs.readFileSync(path.join(temp,'mail.jsonl'),'utf8').trim().split('\n').map(JSON.parse);return mails.at(-1).text.match(/\b\d{6}\b/)[0];};
 const code=await recover();for(let i=0;i<5;i++)assert.equal((await call('/recuperar-verificar',null,{rut:'22222222-2',codigo:'000000'})).status,400);
 assert.equal((await call('/recuperar-cambiar',null,{rut:'22222222-2',codigo:code,nuevaPassword:'NuevaClaveSegura2026!'})).status,400);
 const code2=await recover();assert.equal((await call('/recuperar-cambiar',null,{rut:'22222222-2',codigo:code2,nuevaPassword:'NuevaClaveSegura2026!'})).status,200);
 assert.equal((await call('/recuperar-cambiar',null,{rut:'22222222-2',codigo:code2,nuevaPassword:'OtraClaveSegura2026!'})).status,400);
 // Check authenticated browser links receive the download cookie.
 const auth=await page.request.post(base+'/login',{data:{rut:'11111111-1',password}});assert.equal(auth.status(),200);assert.ok(auth.headers()['set-cookie'].includes('HttpOnly'));
 assert.equal((await page.request.get(base+'/uploads/private.txt')).status(),200);
 assert.equal((await call('/registro',null,{nombre:'Prueba',rut:'12345678-5',correo:'demo@example.test',password:'a'})).status,400);
 // CSV uses the public administration API, stores only a bcrypt hash and forces
 // the first password change before granting access to ticket information.
 const csvAdmin=await login('11111111-1'),csvNonAdmin=await login('33333333-3');
 const importCSV=async(csv,token=csvAdmin)=>{
  const body=new FormData();body.append('archivo',new Blob([csv],{type:'text/csv'}),'usuarios.csv');
  return fetch(base+'/usuarios/importar-csv',{method:'POST',headers:{Authorization:'Bearer '+token},body});
 };
 const csvHeader='nombre,rut,correo,password\r\n';
 assert.equal((await importCSV(csvHeader+'CSV QA,12345678-5,csv@example.test,'+password+'\r\n',csvNonAdmin)).status,403);
 const tooManyBytes='á'.repeat(37);
 r=await importCSV(csvHeader+'CSV QA,12345678-5,csv@example.test,'+tooManyBytes+'\r\n');assert.equal(r.status,400);
 assert.equal((await db.query('SELECT user_id FROM user WHERE rut=?',['12345678-5']))[0].length,0);
 r=await importCSV(csvHeader+'CSV QA,12345678-5,csv@example.test,'+password+'\r\n');assert.equal(r.status,200,await r.text());
 const [[imported]]=await db.query('SELECT user_id,password_hash,must_reset_password FROM user WHERE rut=?',['12345678-5']);
 assert.match(imported.password_hash,/^\$2[aby]\$/);assert.notEqual(imported.password_hash,password);
 assert.ok(await require('../src/passwords').verify(password,imported.password_hash));assert.equal(imported.must_reset_password,1);
 const importedToken=await login('12345678-5');assert.equal((await call('/incidentes',importedToken)).status,428);
 assert.equal((await call('/api/v3/password',importedToken,{password:'ClaveNuevaCSV2026!'})).status,200);
 assert.equal((await call('/incidentes',importedToken)).status,200);
 console.log('Seguridad: sesión, roles, alcance de tickets, adjuntos, XSS, caducidad, recuperación e importación CSV con contraseña protegida verificados.');
};
