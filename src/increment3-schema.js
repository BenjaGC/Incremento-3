// Migración aditiva e idempotente. Nunca reemplaza tablas ni datos existentes.
module.exports=async function migrate(pool){
 const [pauseColumn]=await pool.query("SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='ticket' AND column_name='sla_paused_seconds'");
 const add=async(table,column,type)=>{const [r]=await pool.query('SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=? AND column_name=?',[table,column]);if(!r.length)await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${type}`);};
 for(const [table,column,type] of [
 ['user','operational_area','VARCHAR(100) NULL'],['user','operational_floor','VARCHAR(50) NULL'],['user','job_title','VARCHAR(100) NULL'],['user','directory_id','VARCHAR(255) NULL'],['user','must_reset_password','TINYINT NOT NULL DEFAULT 0'],['user','last_seen','DATETIME NULL'],['user','competencies_configured','TINYINT NOT NULL DEFAULT 0'],
 ['attachment','deleted_at','DATETIME NULL'],['attachment','purged_at','DATETIME NULL'],['ticket','survey_version','INT NULL'],['ticket','sla_paused_seconds','BIGINT NOT NULL DEFAULT 0']])await add(table,column,type);
 // En las versiones anteriores, la prórroga ya quedaba almacenada en sla_deadline.
 if(!pauseColumn.length)await pool.query('UPDATE ticket t JOIN priority p ON p.priority_id=t.priority_id SET t.sla_paused_seconds=GREATEST(0,TIMESTAMPDIFF(SECOND,t.creation_date,t.sla_deadline)-p.sla_hours*3600) WHERE t.sla_deadline IS NOT NULL AND t.is_archived=0');
 const [[authorColumn]]=await pool.query("SELECT COLUMN_TYPE,IS_NULLABLE FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='comment' AND column_name='user_id'");
 if(authorColumn.IS_NULLABLE==='NO')await pool.query('ALTER TABLE comment MODIFY user_id '+authorColumn.COLUMN_TYPE+' NULL');
 const tables=[
 `CREATE TABLE IF NOT EXISTS inc3_config(id INT PRIMARY KEY, upload_mb INT NOT NULL DEFAULT 10, manual_mb INT NOT NULL DEFAULT 50, cost_threshold DECIMAL(12,2) NOT NULL DEFAULT 100000, saturation INT NOT NULL DEFAULT 3)`,
 `CREATE TABLE IF NOT EXISTS inc3_log(id BIGINT AUTO_INCREMENT PRIMARY KEY, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, severity VARCHAR(20), message TEXT, stack TEXT, context JSON)`,
 `CREATE TABLE IF NOT EXISTS inc3_jobs(name VARCHAR(40) PRIMARY KEY, last_success DATETIME NULL, last_attempt DATETIME NULL, result JSON NULL)`,
 `CREATE TABLE IF NOT EXISTS inc3_templates(channel VARCHAR(20) PRIMARY KEY, body TEXT NOT NULL, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)`,
 `CREATE TABLE IF NOT EXISTS inc3_survey_version(id INT AUTO_INCREMENT PRIMARY KEY, questions JSON NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
 `CREATE TABLE IF NOT EXISTS inc3_survey_answer(ticket_id INT PRIMARY KEY, version_id INT NOT NULL, user_id INT NOT NULL, answers JSON NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
 `CREATE TABLE IF NOT EXISTS inc3_competency(user_id INT NOT NULL, category_id INT NOT NULL, PRIMARY KEY(user_id,category_id), FOREIGN KEY(user_id) REFERENCES user(user_id), FOREIGN KEY(category_id) REFERENCES category(category_id))`,
 `CREATE TABLE IF NOT EXISTS inc3_travel(id INT AUTO_INCREMENT PRIMARY KEY, ticket_id INT NOT NULL, user_id INT NOT NULL, started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, arrived_at DATETIME NULL, seconds INT NULL, FOREIGN KEY(ticket_id) REFERENCES ticket(ticket_id))`,
 `CREATE TABLE IF NOT EXISTS inc3_inbox(message_id VARCHAR(255) PRIMARY KEY, ticket_id INT NULL, outcome VARCHAR(30), created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`
 ];for(const sql of tables)await pool.query(sql);
 await pool.query("CREATE TABLE IF NOT EXISTS inc3_location(id INT AUTO_INCREMENT PRIMARY KEY,piso VARCHAR(50) NOT NULL,area VARCHAR(100) NOT NULL,qr_token CHAR(64) NOT NULL UNIQUE,UNIQUE KEY area_unica(piso,area))");
 await add('inc3_travel','location_id','INT NULL');await add('inc3_travel','observed','TINYINT NOT NULL DEFAULT 0');await add('inc3_travel','justification','VARCHAR(1000) NULL');
 await add('inc3_inbox','receipt_to','VARCHAR(150) NULL');await add('inc3_inbox','receipt_code','VARCHAR(20) NULL');await add('inc3_inbox','receipt_sent','TINYINT NOT NULL DEFAULT 0');
 await pool.query('INSERT IGNORE INTO inc3_config(id) VALUES (1)');
 await pool.query('UPDATE inc3_config SET saturation=3 WHERE id=1 AND saturation<>3');
 for(const name of ['archive','maintenance','mail','directory'])await pool.query('INSERT IGNORE INTO inc3_jobs(name) VALUES (?)',[name]);
 await pool.query("INSERT INTO status(status_id,status_name) SELECT 6,'Cerrado' WHERE NOT EXISTS(SELECT 1 FROM status WHERE status_id=6)");
 await pool.query('UPDATE status SET is_closed=1 WHERE status_id=6');
 await pool.query("INSERT INTO inc3_survey_version(questions) SELECT ? WHERE NOT EXISTS(SELECT 1 FROM inc3_survey_version)",[JSON.stringify(['¿Cómo evalúa la atención recibida?','¿La solución resolvió su problema?'])]);
 const [index]=await pool.query("SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='ticket' AND index_name='inc3_archive_search'");
 if(!index.length)await pool.query('CREATE INDEX inc3_archive_search ON ticket(is_archived,close_date,category_id)');
 const [fulltext]=await pool.query("SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='ticket' AND index_name='inc3_archive_text'");
 if(!fulltext.length)await pool.query('CREATE FULLTEXT INDEX inc3_archive_text ON ticket(title,description)');
 // La inmutabilidad también se aplica si un proceso antiguo intenta escribir directamente.
 const [triggers]=await pool.query('SELECT trigger_name FROM information_schema.triggers WHERE trigger_schema=DATABASE()');
 const names=new Set(triggers.map(t=>t.TRIGGER_NAME||t.trigger_name));
 for(const action of ['UPDATE','DELETE']){const name='inc3_ticket_'+action.toLowerCase();if(!names.has(name))await pool.query(`CREATE TRIGGER ${name} BEFORE ${action} ON ticket FOR EACH ROW BEGIN IF OLD.is_archived=1 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Ticket archivado: solo lectura'; END IF; END`);}
 for(const table of ['comment','attachment','ticket_material'])for(const action of ['INSERT','UPDATE','DELETE']){const name=`inc3_${table}_${action.toLowerCase()}`,row=action==='INSERT'?'NEW':'OLD';if(!names.has(name))await pool.query(`CREATE TRIGGER ${name} BEFORE ${action} ON ${table} FOR EACH ROW BEGIN IF EXISTS(SELECT 1 FROM ticket WHERE ticket_id=${row}.ticket_id AND is_archived=1) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Ticket archivado: solo lectura'; END IF; END`);}
 for(const table of ['comment','attachment','ticket_material']){const name=`inc3_${table}_new_parent`;if(!names.has(name))await pool.query(`CREATE TRIGGER ${name} BEFORE UPDATE ON ${table} FOR EACH ROW BEGIN IF EXISTS(SELECT 1 FROM ticket WHERE ticket_id=NEW.ticket_id AND is_archived=1) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Ticket archivado: solo lectura'; END IF; END`);}
 await pool.query('CREATE TABLE IF NOT EXISTS inc3_directory_checkpoint(id INT PRIMARY KEY,synced_at DATETIME NOT NULL)');
 await require('./identity-schema')(pool);
};
