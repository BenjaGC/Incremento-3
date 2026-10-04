// Mapeo clase-tabla de la identidad principal. Los permisos RBAC existentes no se eliminan.
module.exports=async pool=>{
 const [column]=await pool.query("SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='user' AND column_name='tipo_usuario'");
 if(!column.length)await pool.query("ALTER TABLE user ADD tipo_usuario ENUM('SOLICITANTE','TECNICO','ADMINISTRADOR') NOT NULL DEFAULT 'SOLICITANTE'");
 for(const name of ['solicitante','tecnico','administrador'])await pool.query(`CREATE TABLE IF NOT EXISTS ${name}(user_id INT PRIMARY KEY${name==='tecnico'?",nivel ENUM('BASICO','CRITICO') NOT NULL DEFAULT 'BASICO'":''},FOREIGN KEY(user_id) REFERENCES user(user_id) ON DELETE CASCADE)`);
 const [rows]=await pool.query('SELECT TRIGGER_NAME,ACTION_STATEMENT FROM information_schema.triggers WHERE trigger_schema=DATABASE()');const names=new Set(rows.map(r=>r.TRIGGER_NAME));
 for(const event of ['INSERT','UPDATE']){
  const name='inc3_identity_type_'+event.toLowerCase();if(!names.has(name))await pool.query(`CREATE TRIGGER ${name} BEFORE ${event} ON user FOR EACH ROW BEGIN SET NEW.tipo_usuario=CASE WHEN EXISTS(SELECT 1 FROM user_role r WHERE r.user_id=NEW.user_id AND r.role_id=1 AND r.active=1) THEN 'ADMINISTRADOR' WHEN NEW.is_critical_tech=1 OR NEW.tipo_usuario='TECNICO' THEN 'TECNICO' ELSE 'SOLICITANTE' END; END`);
 }
 const sync=row=>`
 DELETE FROM solicitante WHERE user_id=${row}.user_id AND ${row}.tipo_usuario<>'SOLICITANTE';
 DELETE FROM tecnico WHERE user_id=${row}.user_id AND ${row}.tipo_usuario<>'TECNICO';
 DELETE FROM administrador WHERE user_id=${row}.user_id AND ${row}.tipo_usuario<>'ADMINISTRADOR';
 IF ${row}.tipo_usuario='SOLICITANTE' THEN INSERT IGNORE INTO solicitante(user_id) VALUES (${row}.user_id);
 ELSEIF ${row}.tipo_usuario='TECNICO' THEN INSERT INTO tecnico(user_id,nivel) VALUES (${row}.user_id,IF(${row}.is_critical_tech=1,'CRITICO','BASICO')) ON DUPLICATE KEY UPDATE nivel=VALUES(nivel);
 ELSE INSERT IGNORE INTO administrador(user_id) VALUES (${row}.user_id); END IF;`;
 for(const event of ['INSERT','UPDATE']){
  const name='inc3_identity_'+event.toLowerCase();if(!names.has(name))await pool.query(`CREATE TRIGGER ${name} AFTER ${event} ON user FOR EACH ROW BEGIN ${sync('NEW')} END`);
 }
 const choose=id=>`UPDATE user u SET tipo_usuario=CASE WHEN EXISTS(SELECT 1 FROM user_role r WHERE r.user_id=u.user_id AND r.role_id=1 AND r.active=1) THEN 'ADMINISTRADOR' WHEN u.is_critical_tech=1 OR u.tipo_usuario='TECNICO' THEN 'TECNICO' ELSE 'SOLICITANTE' END WHERE u.user_id=${id};`;
 // Conserva los técnicos básicos también cuando se actualiza una asignación RBAC.
 // La migración sustituye únicamente la versión antigua de estos disparadores.
 for(const row of rows)if(/^inc3_role_identity_(insert|update|delete)$/.test(row.TRIGGER_NAME)&&!/u\.tipo_usuario\s*=\s*'TECNICO'/i.test(String(row.ACTION_STATEMENT))){
  await pool.query('DROP TRIGGER `'+row.TRIGGER_NAME+'`');names.delete(row.TRIGGER_NAME);
 }
 for(const event of ['INSERT','UPDATE','DELETE']){
  const name='inc3_role_identity_'+event.toLowerCase();if(!names.has(name))await pool.query(`CREATE TRIGGER ${name} AFTER ${event} ON user_role FOR EACH ROW BEGIN ${choose(event==='DELETE'?'OLD.user_id':'NEW.user_id')}${event==='UPDATE'?'IF OLD.user_id<>NEW.user_id THEN '+choose('OLD.user_id')+' END IF;':''} END`);
 }
 // El trigger materializa exactamente un subtipo por usuario, incluso en las filas antiguas.
 await pool.query("UPDATE user u SET tipo_usuario=CASE WHEN EXISTS(SELECT 1 FROM user_role r WHERE r.user_id=u.user_id AND r.role_id=1 AND r.active=1) THEN 'ADMINISTRADOR' WHEN u.is_critical_tech=1 OR u.tipo_usuario='TECNICO' THEN 'TECNICO' ELSE 'SOLICITANTE' END");
};
