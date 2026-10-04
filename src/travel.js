const crypto=require('node:crypto'),QR=require('qrcode');
module.exports=({router,admin,support,wrap,fail,pool,ticket,mutable,audit})=>{
 router.post('/travel-location/:code',admin,wrap(async(req,res)=>{
  const t=await ticket(req);if(!t.piso_ticket||!t.habitacion_ticket)fail('El ticket necesita piso y área definidos.');
  await pool.query('INSERT IGNORE INTO inc3_location(piso,area,qr_token) VALUES (?,?,?)',[t.piso_ticket,t.habitacion_ticket,crypto.randomBytes(32).toString('hex')]);
  const [[l]]=await pool.query('SELECT * FROM inc3_location WHERE piso=? AND area=?',[t.piso_ticket,t.habitacion_ticket]);
  const payload='CLINICA-AREA:'+l.qr_token;
  res.json({piso:l.piso,area:l.area,payload,qr:await QR.toDataURL(payload,{width:320,margin:2})});
 }));
 router.post('/travel/:code/:action',support,wrap(async(req,res)=>{
  const c=await pool.getConnection();let observed=false;
  try{
   await c.beginTransaction();const t=await ticket(req,c,true);mutable(t);
   if(t.status_id!==1)fail('El traslado requiere un ticket En curso.');
   if(t.assigned_user_id!==req.actor.user_id)fail('Solo el técnico asignado puede marcar su traslado.',403);
   const [[open]]=await c.query('SELECT *,TIMESTAMPDIFF(SECOND,started_at,NOW()) elapsed FROM inc3_travel WHERE ticket_id=? AND arrived_at IS NULL FOR UPDATE',[t.ticket_id]);
   if(req.params.action==='start'){
    if(open)fail('Ya existe un traslado en curso.',409);
    await c.query('INSERT INTO inc3_travel(ticket_id,user_id) VALUES (?,?)',[t.ticket_id,req.actor.user_id]);
   }else if(req.params.action==='arrive'){
    if(!open||open.user_id!==req.actor.user_id)fail('No hay un traslado propio en curso.');
    const qr=String(req.body.qr||'').trim();if(!/^CLINICA-AREA:[a-f0-9]{64}$/.test(qr))fail('Escanea el QR del área para registrar la llegada.');
    const [[location]]=await c.query('SELECT * FROM inc3_location WHERE qr_token=?',[qr.slice(13)]);
    if(!location)fail('QR de área no reconocido.');
    const reason=String(req.body.justification||'').trim();if(reason.length>1000)fail('La justificación no puede superar 1000 caracteres.');
    if(open.elapsed>3600&&reason.length<10)fail('El traslado supera 60 minutos. Ingresa una justificación de al menos 10 caracteres.');
    observed=location.piso!==t.piso_ticket||location.area!==t.habitacion_ticket;
    await c.query('UPDATE inc3_travel SET arrived_at=NOW(),seconds=TIMESTAMPDIFF(SECOND,started_at,NOW()),location_id=?,observed=?,justification=? WHERE id=?',[location.id,observed?1:0,reason||null,open.id]);
   }else fail('Acción inválida.');
   await audit(c,req,t,'TRASLADO',null,{action:req.params.action,observed});await c.commit();
   res.json({success:true,observed,message:observed?'Marcación observada: el QR corresponde a otra ubicación.':req.params.action==='start'?'Traslado iniciado.':'Arribo validado con QR del área.'});
  }catch(e){await c.rollback();throw e;}finally{c.release();}
 }));
};
