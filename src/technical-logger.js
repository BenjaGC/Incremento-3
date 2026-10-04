const fs=require('node:fs'),path=require('node:path');
class TechnicalLogger {
 constructor(pool,file){this.pool=pool;this.file=file;}
 redact(value){let text=String(value||'');for(const [key,secret] of Object.entries(process.env))if(/PASSWORD|TOKEN|SECRET|PASS|KEY/i.test(key)&&secret?.length>3)text=text.replaceAll(secret,'[REDACTADO]');return text.replace(/(password|token|secret|authorization|pass)["'\s:=]+[^\s,;}]+/gi,'$1=[REDACTADO]').slice(0,12000);}
 async write(error,severity='error',context={}){
  const record={severity,message:this.redact(error.message||error),stack:this.redact(error.stack),context:{...context,node:process.version,environment:process.env.NODE_ENV||'local'}};
  try{await this.pool.query('INSERT INTO inc3_log(severity,message,stack,context) VALUES (?,?,?,?)',[severity,record.message,record.stack,JSON.stringify(record.context)]);}
  catch{fs.mkdirSync(path.dirname(this.file),{recursive:true});fs.appendFileSync(this.file,JSON.stringify({...record,date:new Date().toISOString()})+'\n');}
 }
}
module.exports=TechnicalLogger;
