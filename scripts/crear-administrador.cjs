// Ejecutar localmente por TI; nunca es un endpoint web.
require('dotenv').config({quiet:true});
const pool=require('../src/config/database'),passwords=require('../src/passwords');
(async()=>{let c;try{
 const [rut,nombre,correo]=process.argv.slice(2);const password=process.env.CLINICA_ADMIN_PASSWORD;
 if(!rut||!nombre||nombre.length>50||!/^\S+@\S+\.\S+$/.test(correo||'')||!password||password.length<12||Buffer.byteLength(password)>72)throw Error('Uso: node scripts/crear-administrador.cjs RUT "Nombre" correo. Define CLINICA_ADMIN_PASSWORD (12 caracteres mínimo) solo para este proceso.');
 if(!/^\d{7,8}-[0-9K]$/.test(rut))throw Error('RUT inválido.');let sum=0,m=2;for(const n of rut.split('-')[0].split('').reverse()){sum+=Number(n)*m;m=m===7?2:m+1;}const d=11-sum%11;if(String(d===11?0:d===10?'K':d)!==rut.split('-')[1])throw Error('Dígito verificador inválido.');
 c=await pool.getConnection();await c.beginTransaction();const [[exists]]=await c.query('SELECT user_id FROM user WHERE rut=? OR institutional_email=?',[rut,correo]);if(exists)throw Error('La cuenta ya existe. No se modificaron sus permisos.');
 const [u]=await c.query("INSERT INTO user(first_name,first_last_name,second_last_name,rut,username,institutional_email,password_hash,must_reset_password) VALUES(?,'','',?,?,?,?,1)",[nombre,rut,rut,correo,await passwords.hash(password)]);
 await c.query('INSERT INTO user_role(assignment_date,active,role_id,user_id) VALUES(NOW(),1,1,?)',[u.insertId]);await c.commit();console.log('Administrador creado; cambio de contraseña obligatorio al ingresar.');
 }catch(e){if(c)await c.rollback();console.error(e.message);process.exitCode=1;}finally{if(c)c.release();await pool.end();}})();
