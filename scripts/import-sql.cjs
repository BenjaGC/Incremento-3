// DELIMITER es una orden del cliente MySQL, no SQL del servidor.
// Preserva los cuerpos de triggers del respaldo y los bloques ordinarios de mysqldump.
module.exports=async(connection,sql)=>{
 let delimiter=';',buffer='';
 const flush=async()=>{if(buffer.trim())await connection.query(buffer);buffer='';};
 for(const line of sql.split(/\r?\n/)){
  const command=line.match(/^DELIMITER\s+(\S+)\s*$/i);
  if(command){await flush();delimiter=command[1];continue;}
  buffer+=line+'\n';
  if(delimiter!==';'&&line.trimEnd().endsWith(delimiter)){buffer=buffer.trimEnd().slice(0,-delimiter.length);await flush();}
 }
 await flush();
};
