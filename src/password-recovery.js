const crypto=require('crypto');
module.exports=function(app,{pool,transporter}){
 const pending=new Map();const ttl=10*60000;
 const cleanup=setInterval(()=>{for(const [k,v] of pending)if(v.until<Date.now())pending.delete(k);},60000);cleanup.unref();
 const digest=s=>crypto.createHash('sha256').update(String(s)).digest();
 const check=(rut,code)=>{const p=pending.get(rut);if(!p||p.until<Date.now()||p.tries>=5){pending.delete(rut);return null;}p.tries++;if(!crypto.timingSafeEqual(p.hash,digest(code)))return null;return p;};
 app.post('/recuperar-solicitar',async(req,res)=>{
  const rut=String(req.body.rut||'').trim();if(!/^\d{7,8}-[\dkK]$/.test(rut))return res.status(400).json({error:'Indica un RUT válido.'});
  const message='Si la cuenta tiene un correo habilitado, recibirás un código que vence en 10 minutos.';
  try{const [[u]]=await pool.query('SELECT institutional_email,first_name FROM user WHERE rut=? AND user_status=1',[rut]);
   if(u?.institutional_email&&!u.institutional_email.endsWith('@temp.com')){
    const code=String(crypto.randomInt(100000,1000000));const entry={hash:digest(code),until:Date.now()+ttl,tries:0};pending.set(rut,entry);
    try{await transporter.sendMail({from:process.env.MAIL_FROM||process.env.MAIL_USER,to:u.institutional_email,subject:'Recuperación de acceso',text:`Tu código de recuperación es ${code}. Vence en 10 minutos. Si no lo solicitaste, ignora este mensaje.`});}catch{if(pending.get(rut)===entry)pending.delete(rut);}
   }
   res.json({success:true,message,correoHint:'el correo registrado'});
  }catch{res.status(503).json({error:'Servicio temporalmente no disponible.'});}
 });
 app.post('/recuperar-verificar',(req,res)=>check(req.body.rut,req.body.codigo)?res.json({success:true,message:'Código verificado correctamente.'}):res.status(400).json({error:'Código incorrecto o expirado.'}));
 app.post('/recuperar-cambiar',async(req,res)=>{
  const {rut,codigo,nuevaPassword}=req.body;
  if(typeof nuevaPassword!=='string'||nuevaPassword.length<8||Buffer.byteLength(nuevaPassword)>72)return res.status(400).json({error:'La contraseña debe tener al menos 8 caracteres y hasta 72 bytes.'});
  const p=check(rut,codigo);if(!p)return res.status(400).json({error:'Código incorrecto o expirado.'});
  pending.delete(rut); // Consume before awaiting to prevent concurrent reuse.
  try{await pool.query('UPDATE user SET password_hash=?,must_reset_password=0,session_token=NULL WHERE rut=? AND user_status=1',[await require('./passwords').hash(nuevaPassword),rut]);res.json({success:true,message:'Contraseña actualizada.'});}catch{res.status(503).json({error:'No se pudo cambiar la contraseña. Solicita otro código.'});}
 });
};
